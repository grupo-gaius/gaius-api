import { Injectable, Logger } from '@nestjs/common';
import { CatalogAssetType, PreferredCurrency } from '@prisma/client';
import {
  AssetCatalogProvider,
  AssetQuoteProvider,
} from './asset-provider.interface';
import { CatalogAssetInput, QuoteSnapshot } from './asset-catalog.types';

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
}

@Injectable()
export class CoinGeckoProvider implements AssetCatalogProvider, AssetQuoteProvider {
  readonly name = 'coingecko';
  private readonly logger = new Logger(CoinGeckoProvider.name);
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  /** ticker (BTC) → coingecko id (bitcoin) */
  private idByTicker = new Map<string, string>();

  async fetchCatalog(): Promise<CatalogAssetInput[]> {
    const catalog: CatalogAssetInput[] = [];
    const pages = 2;

    for (let page = 1; page <= pages; page++) {
      const url = `${this.baseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`coingecko markets failed: ${res.status}`);
      }
      const markets = (await res.json()) as CoinGeckoMarket[];
      for (const m of markets) {
        const ticker = m.symbol.toUpperCase();
        this.idByTicker.set(ticker, m.id);
        catalog.push({
          ticker,
          name: m.name,
          type: CatalogAssetType.CRYPTO,
          exchange: 'CRYPTO',
          currency: PreferredCurrency.USD,
          country: 'GLOBAL',
          logoUrl: m.image,
        });
      }
    }

    this.logger.log(`coingecko: ${catalog.length} cryptos cataloged`);
    return catalog;
  }

  async ensureTickerIds(tickers: string[]) {
    const missing = tickers.filter((t) => !this.idByTicker.has(t.toUpperCase()));
    if (missing.length === 0) return;

    const url = `${this.baseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1`;
    const res = await fetch(url);
    if (!res.ok) return;
    const markets = (await res.json()) as CoinGeckoMarket[];
    for (const m of markets) {
      this.idByTicker.set(m.symbol.toUpperCase(), m.id);
    }
  }

  async fetchQuotes(tickers: string[]): Promise<QuoteSnapshot[]> {
    await this.ensureTickerIds(tickers);

    const ids: string[] = [];
    const tickerForId: string[] = [];

    for (const ticker of tickers) {
      const id = this.idByTicker.get(ticker.toUpperCase());
      if (!id) continue;
      ids.push(id);
      tickerForId.push(ticker.toUpperCase());
    }

    if (ids.length === 0) return [];

    const url = `${this.baseUrl}/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`coingecko price failed: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, { usd?: number }>;
    const now = new Date().toISOString();
    const results: QuoteSnapshot[] = [];

    ids.forEach((id, i) => {
      const usd = data[id]?.usd;
      if (usd == null) return;
      results.push({
        ticker: tickerForId[i],
        price: usd,
        currency: PreferredCurrency.USD,
        source: 'coingecko',
        updatedAt: now,
      });
    });

    return results;
  }
}
