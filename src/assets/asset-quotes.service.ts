import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CatalogAssetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BrapiProvider } from './providers/brapi.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { QuoteSnapshot } from './providers/asset-catalog.types';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';

const TTL_BR_SECONDS = 60;
const TTL_US_SECONDS = 300;
const TTL_CRYPTO_SECONDS = 30;

@Injectable()
export class AssetQuotesService {
  private readonly logger = new Logger(AssetQuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly brapi: BrapiProvider,
    private readonly yahoo: YahooFinanceProvider,
    private readonly coingecko: CoinGeckoProvider,
  ) {}

  private redisKey(ticker: string, type: CatalogAssetType) {
    if (type === CatalogAssetType.CRYPTO) {
      return `asset:crypto:${ticker.toUpperCase()}`;
    }
    return `asset:${ticker.toUpperCase()}`;
  }

  private ttlForType(type: CatalogAssetType) {
    if (type === CatalogAssetType.CRYPTO) return TTL_CRYPTO_SECONDS;
    if (
      type === CatalogAssetType.STOCK_US ||
      type === CatalogAssetType.ETF_US ||
      type === CatalogAssetType.ETF_INTL
    ) {
      return TTL_US_SECONDS;
    }
    return TTL_BR_SECONDS;
  }

  async saveQuote(ticker: string, type: CatalogAssetType, quote: QuoteSnapshot) {
    const key = this.redisKey(ticker, type);
    const ttl = this.ttlForType(type);
    await this.redis.raw.set(key, JSON.stringify(quote), 'EX', ttl);
    await this.redis.raw.set(
      `asset:${ticker.toUpperCase()}`,
      JSON.stringify(quote),
      'EX',
      ttl,
    );
  }

  async getQuote(ticker: string): Promise<QuoteSnapshot | null> {
    const asset = await this.prisma.asset.findFirst({
      where: { ticker: { equals: ticker, mode: 'insensitive' }, isActive: true },
    });
    if (!asset) return null;

    const key = this.redisKey(asset.ticker, asset.type);
    const raw =
      (await this.redis.raw.get(key)) ??
      (await this.redis.raw.get(`asset:${asset.ticker.toUpperCase()}`));
    if (!raw) return null;
    return JSON.parse(raw) as QuoteSnapshot;
  }

  /** Busca cotação ao vivo para 1 ticker e grava no Redis. */
  async refreshOne(ticker: string): Promise<QuoteSnapshot> {
    const symbol = ticker.toUpperCase();
    let asset = await this.prisma.asset.findFirst({
      where: { ticker: symbol, isActive: true },
    });

    if (!asset) {
      const quote = await this.brapi.fetchQuote(symbol);
      if (quote) {
        await this.saveQuote(symbol, CatalogAssetType.ACAO_BR, quote);
        return quote;
      }
      throw new NotFoundException(
        `Asset ${symbol} not in catalog. Run POST /assets/${symbol}/sync first`,
      );
    }

    let quote: QuoteSnapshot | null = null;
    const brTypes: CatalogAssetType[] = [CatalogAssetType.ACAO_BR, CatalogAssetType.FII, CatalogAssetType.ETF_BR];
    const usTypes: CatalogAssetType[] = [
      CatalogAssetType.STOCK_US,
      CatalogAssetType.ETF_US,
      CatalogAssetType.ETF_INTL,
    ];

    if (brTypes.includes(asset.type)) {
      quote = await this.brapi.fetchQuote(symbol);
    } else if (usTypes.includes(asset.type)) {
      const quotes = await this.yahoo.fetchQuotes([symbol]);
      quote = quotes[0] ?? null;
    } else if (asset.type === CatalogAssetType.CRYPTO) {
      const quotes = await this.coingecko.fetchQuotes([symbol]);
      quote = quotes[0] ?? null;
    }

    if (!quote) {
      throw new NotFoundException(`Quote not available for ${symbol}`);
    }

    await this.saveQuote(symbol, asset.type, quote);
    return quote;
  }

  async refreshAllQuotes(): Promise<{ updated: number; errors: string[] }> {
    const limit = Number(process.env.BRAPI_CRON_QUOTE_LIMIT ?? '30');
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
      select: { ticker: true, type: true },
      take: Number.isFinite(limit) && limit > 0 ? limit : 30,
    });

    const brTypes: CatalogAssetType[] = [CatalogAssetType.ACAO_BR, CatalogAssetType.FII, CatalogAssetType.ETF_BR];
    const usTypes: CatalogAssetType[] = [
      CatalogAssetType.STOCK_US,
      CatalogAssetType.ETF_US,
      CatalogAssetType.ETF_INTL,
    ];

    const errors: string[] = [];
    let updated = 0;

    for (const asset of assets) {
      try {
        if (brTypes.includes(asset.type)) {
          const quote = await this.brapi.fetchQuote(asset.ticker);
          if (quote) {
            await this.saveQuote(asset.ticker, asset.type, quote);
            updated++;
          }
        } else if (usTypes.includes(asset.type)) {
          const quotes = await this.yahoo.fetchQuotes([asset.ticker]);
          if (quotes[0]) {
            await this.saveQuote(asset.ticker, asset.type, quotes[0]);
            updated++;
          }
        } else if (asset.type === CatalogAssetType.CRYPTO) {
          const quotes = await this.coingecko.fetchQuotes([asset.ticker]);
          if (quotes[0]) {
            await this.saveQuote(asset.ticker, asset.type, quotes[0]);
            updated++;
          }
        }
      } catch (err) {
        errors.push(`${asset.ticker}: ${err}`);
      }
    }

    this.logger.log(`quotes refreshed: ${updated} (limit ${assets.length})`);
    return { updated, errors };
  }
}
