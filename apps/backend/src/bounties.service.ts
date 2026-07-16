import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { sanitizeDescription } from './common/sanitize-description';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toSkip,
} from './common/pagination.dto';
import { Bounty } from './entities/bounty.entity';

@Injectable()
export class BountiesService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bounties: Repository<Bounty>,
  ) {}

  async create(dto: CreateBountyDto) {
    const existing = await this.bounties.findOne({ where: { title: dto.title } });
    if (existing) {
      return existing;
    }

    const bounty = this.bounties.create({
      ...dto,
      description: sanitizeDescription(dto.description),
      rewardAmount: BigInt(dto.rewardAmount),
      deadline: dto.deadline ? new Date(dto.deadline) : null,
    });
    return this.bounties.save(bounty);
  }

  /**
   * List bounties with server-side pagination + filters.
   */
  async findAll(
    pagination: PaginationQueryDto = {},
  ): Promise<PaginatedResponse<Bounty>> {
    const { page = 1, limit = 20, owner, contributor, status } = pagination;

    const queryBuilder = this.bounties.createQueryBuilder('bounty');

    if (owner) {
      queryBuilder.andWhere('bounty.owner = :owner', { owner });
    }

    if (contributor) {
      queryBuilder.andWhere('bounty.contributors LIKE :contributor', {
        contributor: `%${contributor}%`,
      });
    }

    if (status) {
      queryBuilder.andWhere('bounty.status = :status', { status });
    }

    queryBuilder.orderBy('bounty.createdAt', 'DESC');

    const [data, total] = await queryBuilder
      .skip(toSkip(page, limit))
      .take(limit)
      .getManyAndCount();

    return PaginatedResponse.of(data, total, page, limit);
  }

  async findByOwner(ownerId: string) {
    return this.findAll({ owner: ownerId });
  }

  async findOne(id: string) {
    const bounty = await this.bounties.findOne({ where: { id } });
    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }
    return bounty;
  }

  async update(id: string, dto: UpdateBountyDto) {
    const bounty = await this.findOne(id);
    Object.assign(bounty, {
      ...dto,
      description: dto.description === undefined ? bounty.description : sanitizeDescription(dto.description),
      rewardAmount: dto.rewardAmount !== undefined ? BigInt(dto.rewardAmount) : bounty.rewardAmount,
      deadline: dto.deadline === undefined ? bounty.deadline : new Date(dto.deadline),
    });
    return this.bounties.save(bounty);
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    await this.bounties.softRemove(bounty);
    return { deleted: true };
  }

  async restore(id: string) {
    const bounty = await this.bounties.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }
    if (bounty.deletedAt === null) {
      return bounty;
    }
    await this.bounties.restore(id);
    return this.findOne(id);
  }
      }
