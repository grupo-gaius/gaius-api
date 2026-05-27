import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BrapiProvider } from './providers/brapi.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { CatalogAssetInput } from './providers/asset-catalog.types';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';

export interface SyncResult {
  provider: string;
  upserted: number;
  errors: string[];
}

@Injectable()
export class AssetSyncService {
  private readonly logger = new Logger(AssetSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brapi: BrapiProvider,
    private readonly yahoo: YahooFinanceProvider,
    private readonly coingecko: CoinGeckoProvider,
  ) {}

  async syncAll(): Promise<SyncResult[]> {
    return [
      await this.syncProvider('brapi', () => this.brapi.fetchCatalog()),
      await this.syncProvider('yahoo', () => this.yahoo.fetchCatalog()),
      await this.syncProvider('coingecko', () => this.coingecko.fetchCatalog()),
    ];
  }

  /** Sincroniza 1 ativo com dados completos do provider correto. */
  async syncOne(ticker: string): Promise<CatalogAssetInput> {
    const symbol = ticker.toUpperCase();

    let item: CatalogAssetInput | null = null;
    let provider = 'brapi';

    if (/^[A-Z]{4}\d{1,2}$/.test(symbol) || symbol.endsWith('11')) {
      item = await this.brapi.fetchCatalogItem(symbol);
      provider = 'brapi';
    }

    if (!item) {
      const yahooCatalog = await this.yahoo.fetchCatalog();
      item = yahooCatalog.find((a) => a.ticker === symbol) ?? null;
      if (item) provider = 'yahoo';
    }

    if (!item) {
      const crypto = await this.coingecko.fetchCatalog();
      item = crypto.find((a) => a.ticker === symbol) ?? null;
      if (item) provider = 'coingecko';
    }

    if (!item) {
      item = await this.brapi.fetchCatalogItem(symbol);
      provider = 'brapi';
    }

    if (!item) {
      throw new NotFoundException(`Asset ${symbol} not found in providers`);
    }

    await this.prisma.asset.upsert({
      where: { ticker: item.ticker },
      create: { ...item, isActive: true },
      update: {
        name: item.name,
        type: item.type,
        exchange: item.exchange,
        currency: item.currency,
        sector: item.sector,
        country: item.country,
        logoUrl: item.logoUrl,
        isActive: true,
      },
    });

    this.logger.log(`${provider}: synced ${item.ticker}`);
    return item;
  }

  private async syncProvider(
    name: string,
    fetcher: () => Promise<CatalogAssetInput[]>,
  ): Promise<SyncResult> {
    const errors: string[] = [];
    let upserted = 0;

    try {
      const catalog = await fetcher();
      for (const item of catalog) {
        try {
          await this.prisma.asset.upsert({
            where: { ticker: item.ticker },
            create: { ...item, isActive: true },
            update: {
              name: item.name,
              type: item.type,
              exchange: item.exchange,
              currency: item.currency,
              sector: item.sector,
              country: item.country,
              logoUrl: item.logoUrl,
              isActive: true,
            },
          });
          upserted++;
        } catch (err) {
          errors.push(`${item.ticker}: ${err}`);
        }
      }
      this.logger.log(`${name}: ${upserted} assets synced`);
    } catch (err) {
      errors.push(String(err));
      this.logger.error(`${name} sync failed`, err);
    }

    return { provider: name, upserted, errors };
  }
}
