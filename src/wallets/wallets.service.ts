import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogAssetType, Prisma, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import {
  AllocationSliceDto,
  PaginatedTransactionsDto,
  TransactionResponseDto,
  WalletDetailDto,
  WalletPositionDto,
  WalletResponseDto,
  WalletSummaryDto,
} from './dto/wallet-response.dto';

const WALLET_CACHE_TTL = 30;

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private walletCacheKey(id: string) {
    return `wallet:${id}`;
  }

  private async assertWalletOwner(walletId: string, userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId, isArchived: false },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  private toNumber(value: Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  private async getQuotePrice(ticker: string, fallback: number) {
    const cached = await this.redis.raw.get(`asset:${ticker.toUpperCase()}`);
    if (cached) {
      const parsed = JSON.parse(cached) as { price?: number };
      if (parsed.price != null) {
        return { price: parsed.price, stale: false };
      }
    }
    return { price: fallback, stale: true };
  }

  private async invalidateWalletCache(walletId: string) {
    await this.redis.raw.del(this.walletCacheKey(walletId));
  }

  async create(userId: string, dto: CreateWalletDto): Promise<WalletResponseDto> {
    const wallet = await this.prisma.wallet.create({
      data: { userId, name: dto.name, description: dto.description },
    });
    return plainToInstance(WalletResponseDto, wallet, { excludeExtraneousValues: true });
  }

  async list(userId: string): Promise<WalletResponseDto[]> {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
    return plainToInstance(WalletResponseDto, wallets, { excludeExtraneousValues: true });
  }

  private async buildWalletDetail(walletId: string): Promise<WalletDetailDto> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        walletAssets: { include: { asset: true } },
      },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    let totalCost = 0;
    let totalValue = 0;
    const positions: WalletPositionDto[] = [];

    for (const wa of wallet.walletAssets) {
      const qty = this.toNumber(wa.quantity);
      const avgPrice = this.toNumber(wa.avgPrice);
      const { price: currentPrice, stale } = await this.getQuotePrice(
        wa.asset.ticker,
        avgPrice,
      );
      const cost = qty * avgPrice;
      const value = qty * currentPrice;
      totalCost += cost;
      totalValue += value;

      positions.push({
        assetId: wa.assetId,
        ticker: wa.asset.ticker,
        name: wa.asset.name,
        type: wa.asset.type,
        quantity: qty,
        avgPrice,
        currentPrice,
        currentValue: value,
        returnPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        stale,
      });
    }

    const totalReturnPercent =
      totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    return plainToInstance(
      WalletDetailDto,
      {
        ...wallet,
        positions,
        totalValue,
        totalReturnPercent,
      },
      { excludeExtraneousValues: true },
    );
  }

  async findOne(userId: string, walletId: string): Promise<WalletDetailDto> {
    await this.assertWalletOwner(walletId, userId);

    const cacheKey = this.walletCacheKey(walletId);
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as WalletDetailDto;
    }

    const detail = await this.buildWalletDetail(walletId);
    await this.redis.raw.set(cacheKey, JSON.stringify(detail), 'EX', WALLET_CACHE_TTL);
    return detail;
  }

  async update(
    userId: string,
    walletId: string,
    dto: UpdateWalletDto,
  ): Promise<WalletResponseDto> {
    await this.assertWalletOwner(walletId, userId);
    const wallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: dto,
    });
    await this.invalidateWalletCache(walletId);
    return plainToInstance(WalletResponseDto, wallet, { excludeExtraneousValues: true });
  }

  async archive(userId: string, walletId: string): Promise<void> {
    await this.assertWalletOwner(walletId, userId);
    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { isArchived: true },
    });
    await this.invalidateWalletCache(walletId);
  }

  async addTransaction(
    userId: string,
    walletId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    await this.assertWalletOwner(walletId, userId);

    const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletAsset.findUnique({
        where: { walletId_assetId: { walletId, assetId: dto.assetId } },
      });

      const qty = new Decimal(dto.quantity);
      const price = new Decimal(dto.price);
      const fee = new Decimal(dto.fee ?? 0);

      if (dto.type === TransactionType.SELL) {
        if (!existing || existing.quantity.lessThan(qty)) {
          throw new ForbiddenException('Insufficient quantity to sell');
        }
        const newQty = existing.quantity.minus(qty);
        if (newQty.isZero()) {
          await tx.walletAsset.delete({
            where: { walletId_assetId: { walletId, assetId: dto.assetId } },
          });
        } else {
          await tx.walletAsset.update({
            where: { walletId_assetId: { walletId, assetId: dto.assetId } },
            data: { quantity: newQty },
          });
        }
      } else {
        if (existing) {
          const oldQty = existing.quantity;
          const oldAvg = existing.avgPrice;
          const newQty = oldQty.plus(qty);
          const newAvg = oldQty
            .mul(oldAvg)
            .plus(qty.mul(price))
            .div(newQty);
          await tx.walletAsset.update({
            where: { walletId_assetId: { walletId, assetId: dto.assetId } },
            data: { quantity: newQty, avgPrice: newAvg, purchaseAt: dto.date },
          });
        } else {
          await tx.walletAsset.create({
            data: {
              walletId,
              assetId: dto.assetId,
              quantity: qty,
              avgPrice: price,
              purchaseAt: dto.date,
            },
          });
        }
      }

      const transaction = await tx.transaction.create({
        data: {
          walletId,
          assetId: dto.assetId,
          type: dto.type,
          quantity: qty,
          price,
          fee,
          date: dto.date,
        },
        include: { asset: true },
      });

      return transaction;
    });

    await this.invalidateWalletCache(walletId);

    return plainToInstance(
      TransactionResponseDto,
      {
        id: result.id,
        assetId: result.assetId,
        ticker: result.asset.ticker,
        type: result.type,
        quantity: this.toNumber(result.quantity),
        price: this.toNumber(result.price),
        fee: this.toNumber(result.fee),
        date: result.date,
      },
      { excludeExtraneousValues: true },
    );
  }

  async listTransactions(
    userId: string,
    walletId: string,
    query: ListTransactionsQueryDto,
  ): Promise<PaginatedTransactionsDto> {
    await this.assertWalletOwner(walletId, userId);
    const limit = query.limit ?? 20;

    const items = await this.prisma.transaction.findMany({
      where: { walletId },
      take: limit + 1,
      ...(query.cursor && {
        cursor: { id: query.cursor },
        skip: 1,
      }),
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      include: { asset: true },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].id : undefined;

    return {
      items: page.map((t) =>
        plainToInstance(
          TransactionResponseDto,
          {
            id: t.id,
            assetId: t.assetId,
            ticker: t.asset.ticker,
            type: t.type,
            quantity: this.toNumber(t.quantity),
            price: this.toNumber(t.price),
            fee: this.toNumber(t.fee),
            date: t.date,
          },
          { excludeExtraneousValues: true },
        ),
      ),
      nextCursor,
    };
  }

  async summary(userId: string, walletId: string): Promise<WalletSummaryDto> {
    const detail = await this.findOne(userId, walletId);
    const byType = new Map<CatalogAssetType, number>();

    for (const p of detail.positions) {
      byType.set(p.type, (byType.get(p.type) ?? 0) + p.currentValue);
    }

    const totalValue = detail.totalValue || 1;
    const allocation = [...byType.entries()].map(([type, value]) =>
      plainToInstance(
        AllocationSliceDto,
        {
          type,
          value,
          percent: (value / totalValue) * 100,
        },
        { excludeExtraneousValues: true },
      ),
    );

    return plainToInstance(
      WalletSummaryDto,
      { walletId, allocation, totalValue: detail.totalValue },
      { excludeExtraneousValues: true },
    );
  }

  async consolidated(userId: string): Promise<WalletDetailDto> {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, isArchived: false },
      include: {
        walletAssets: { include: { asset: true } },
      },
    });

    const merged = new Map<
      string,
      { asset: (typeof wallets)[0]['walletAssets'][0]['asset']; quantity: number; avgPrice: number; cost: number }
    >();

    for (const wallet of wallets) {
      for (const wa of wallet.walletAssets) {
        const qty = this.toNumber(wa.quantity);
        const avg = this.toNumber(wa.avgPrice);
        const existing = merged.get(wa.assetId);
        if (!existing) {
          merged.set(wa.assetId, {
            asset: wa.asset,
            quantity: qty,
            avgPrice: avg,
            cost: qty * avg,
          });
        } else {
          const newQty = existing.quantity + qty;
          const newCost = existing.cost + qty * avg;
          merged.set(wa.assetId, {
            asset: wa.asset,
            quantity: newQty,
            avgPrice: newCost / newQty,
            cost: newCost,
          });
        }
      }
    }

    let totalCost = 0;
    let totalValue = 0;
    const positions: WalletPositionDto[] = [];

    for (const row of merged.values()) {
      const { price: currentPrice, stale } = await this.getQuotePrice(
        row.asset.ticker,
        row.avgPrice,
      );
      const value = row.quantity * currentPrice;
      totalCost += row.cost;
      totalValue += value;
      positions.push({
        assetId: row.asset.id,
        ticker: row.asset.ticker,
        name: row.asset.name,
        type: row.asset.type,
        quantity: row.quantity,
        avgPrice: row.avgPrice,
        currentPrice,
        currentValue: value,
        returnPercent: row.cost > 0 ? ((value - row.cost) / row.cost) * 100 : 0,
        stale,
      });
    }

    const totalReturnPercent =
      totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    return plainToInstance(
      WalletDetailDto,
      {
        id: 'consolidated',
        name: 'Carteira consolidada',
        description: 'União de todas as carteiras',
        isArchived: false,
        createdAt: new Date(),
        positions,
        totalValue,
        totalReturnPercent,
      },
      { excludeExtraneousValues: true },
    );
  }
}
