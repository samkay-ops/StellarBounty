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
    // Re-initialization protection: check if bounty with same title already exists
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
   * List bounties with server-side pagination + filters (owner, contributor, status).
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

  /**
   * Helper method used by me.controller.ts for /me/bounties
   */
  async findByOwner(ownerId: string) {
    return this.findAll({ owner: ownerId });
  }

  async findOne(id: string) {
    const bounty = await this.bounties.findOne({ where: {
