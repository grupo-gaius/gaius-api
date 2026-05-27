import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogAssetType, PreferredCurrency } from '@prisma/client';
import {
  AssetCatalogProvider,
  AssetQuoteProvider,
} from './asset-provider.interface';
import { CatalogAssetInput, QuoteSnapshot } from './asset-catalog.types';

interface BrapiAvailableResponse {
  stocks?: string[];
}

interface BrapiQuoteResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  currency?: string;
  sector?: string;
  logourl?: string;
}

interface BrapiQuoteResponse {
  results?: BrapiQuoteResult[];
}

@Injectable()
export class BrapiProvider implements AssetCatalogProvider, AssetQuoteProvider, OnModuleInit {
  readonly name = 'brapi';
  private readonly logger = new Logger(BrapiProvider.name);
  private readonly baseUrl = 'https://brapi.dev/api';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.getToken();
    const perReq = this.maxTickersPerRequest();
    if (token) {
      this.logger.log(
        `BRAPI_TOKEN ok — máx. ${perReq} ticker(s) por requisição (plano brapi)`,
      );
    } else {
      this.logger.warn(
        'BRAPI_TOKEN ausente — só PETR4, MGLU3, VALE3 e ITUB4. https://brapi.dev/dashboard',
      );
    }
  }

  private getToken(): string | undefined {
    return this.config.get<string>('BRAPI_TOKEN')?.trim() || undefined;
  }

  /** Plano gratuito brapi = 1 ativo por request. */
  maxTickersPerRequest(): number {
    const n = Number(this.config.get<string>('BRAPI_MAX_TICKERS_PER_REQUEST') ?? '1');
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  }

  private requestDelayMs(): number {
    const n = Number(this.config.get<string>('BRAPI_REQUEST_DELAY_MS') ?? '350');
    return Number.isFinite(n) && n >= 0 ? n : 350;
  }

  private catalogSyncLimit(): number {
    const n = Number(this.config.get<string>('BRAPI_CATALOG_SYNC_LIMIT') ?? '0');
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchBrapi<T>(path: string): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { headers });

    if (res.status === 401) {
      throw new Error('brapi 401: token inválido. Confira BRAPI_TOKEN no .env');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`brapi ${path} failed: ${res.status} ${body.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }

  private inferBrType(ticker: string, name: string): CatalogAssetType {
    const upper = name.toUpperCase();
    if (upper.includes('FII') || upper.includes('FUNDO IMOB')) return CatalogAssetType.FII;
    if (upper.includes('ETF')) return CatalogAssetType.ETF_BR;
    if (/11$/.test(ticker) && !upper.includes('ETF')) return CatalogAssetType.FII;
    return CatalogAssetType.ACAO_BR;
  }

  private mapQuoteToCatalog(r: BrapiQuoteResult): CatalogAssetInput {
    const name = r.longName ?? r.shortName ?? r.symbol;
    return {
      ticker: r.symbol.toUpperCase(),
      name,
      type: this.inferBrType(r.symbol, name),
      exchange: 'B3',
      currency: PreferredCurrency.BRL,
      sector: r.sector,
      country: 'BR',
      logoUrl: r.logourl,
    };
  }

  /** Um único ticker: GET /quote/PETR4 */
  async fetchCatalogItem(ticker: string): Promise<CatalogAssetInput | null> {
    const symbol = ticker.toUpperCase();
    const data = await this.fetchBrapi<BrapiQuoteResponse>(`/quote/${symbol}`);
    const r = data.results?.[0];
    if (!r) return null;
    return this.mapQuoteToCatalog(r);
  }

  /** Um único ticker: cotação */
  async fetchQuote(ticker: string): Promise<QuoteSnapshot | null> {
    const symbol = ticker.toUpperCase();
    const data = await this.fetchBrapi<BrapiQuoteResponse>(`/quote/${symbol}`);
    const r = data.results?.[0];
    if (r?.regularMarketPrice == null) return null;
    return {
      ticker: r.symbol.toUpperCase(),
      price: r.regularMarketPrice,
      currency: PreferredCurrency.BRL,
      source: 'brapi',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Sync em massa: só lista /available (rápido, sem estourar cota).
   * Detalhes completos: use POST /assets/:ticker/sync (1 por vez).
   */
  async fetchCatalog(): Promise<CatalogAssetInput[]> {
    const data = await this.fetchBrapi<BrapiAvailableResponse>('/available');
    let tickers = (data.stocks ?? []).map((t) => t.toUpperCase());

    const limit = this.catalogSyncLimit();
    if (limit > 0) {
      tickers = tickers.slice(0, limit);
    }

    this.logger.log(`brapi: ${tickers.length} tickers (lista /available, sem batch de cotação)`);

    return tickers.map((ticker) => ({
      ticker,
      name: ticker,
      type: this.inferBrType(ticker, ticker),
      exchange: 'B3',
      currency: PreferredCurrency.BRL,
      country: 'BR',
    }));
  }

  /** Vários tickers — respeita BRAPI_MAX_TICKERS_PER_REQUEST (padrão 1). */
  async fetchQuotes(tickers: string[]): Promise<QuoteSnapshot[]> {
    if (tickers.length === 0) return [];

    const batchSize = this.maxTickersPerRequest();
    const delay = this.requestDelayMs();
    const results: QuoteSnapshot[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const joined = batch.map((t) => t.toUpperCase()).join(',');
      const data = await this.fetchBrapi<BrapiQuoteResponse>(`/quote/${joined}`);

      for (const r of data.results ?? []) {
        if (r.regularMarketPrice == null) continue;
        results.push({
          ticker: r.symbol.toUpperCase(),
          price: r.regularMarketPrice,
          currency: PreferredCurrency.BRL,
          source: 'brapi',
          updatedAt: now,
        });
      }

      if (i + batchSize < tickers.length && delay > 0) {
        await this.sleep(delay);
      }
    }

    return results;
  }
}
