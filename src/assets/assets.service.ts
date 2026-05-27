import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AssetResponseDto, PaginatedAssetsDto } from './dto/asset-response.dto';
import { ListAssetsQueryDto } from './dto/list-assets-query.dto';

const SEARCH_CACHE_TTL = 60 * 5;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private buildWhere(query: ListAssetsQueryDto, search?: string): Prisma.AssetWhereInput {
    const where: Prisma.AssetWhereInput = { isActive: true };
    if (query.type) where.type = query.type;
    if (query.exchange) where.exchange = { equals: query.exchange, mode: 'insensitive' };
    if (query.sector) where.sector = { contains: query.sector, mode: 'insensitive' };
    if (query.country) where.country = { equals: query.country, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { ticker: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async list(query: ListAssetsQueryDto): Promise<PaginatedAssetsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { ticker: 'asc' },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      items: plainToInstance(AssetResponseDto, items, { excludeExtraneousValues: true }),
      total,
      page,
      limit,
    };
  }

  async search(q: string, query: ListAssetsQueryDto): Promise<PaginatedAssetsDto> {
    const cacheKey = `asset:search:${q.toLowerCase()}:${JSON.stringify(query)}`;
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PaginatedAssetsDto;
    }

    const where = this.buildWhere(query, q);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { ticker: 'asc' },
      }),
      this.prisma.asset.count({ where }),
    ]);

    const payload: PaginatedAssetsDto = {
      items: plainToInstance(AssetResponseDto, items, { excludeExtraneousValues: true }),
      total,
      page,
      limit,
    };

    await this.redis.raw.set(cacheKey, JSON.stringify(payload), 'EX', SEARCH_CACHE_TTL);
    return payload;
  }

  async findByTicker(ticker: string): Promise<AssetResponseDto> {
    const asset = await this.prisma.asset.findFirst({
      where: { ticker: { equals: ticker, mode: 'insensitive' }, isActive: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return plainToInstance(AssetResponseDto, asset, { excludeExtraneousValues: true });
  }
}
