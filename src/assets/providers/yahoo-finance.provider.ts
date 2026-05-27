import { Injectable, Logger } from '@nestjs/common';
import { CatalogAssetType, PreferredCurrency } from '@prisma/client';
import {
  AssetCatalogProvider,
  AssetQuoteProvider,
} from './asset-provider.interface';
import { CatalogAssetInput, QuoteSnapshot } from './asset-catalog.types';

/** Lista inicial de ativos US — catálogo completo exige provider pago ou seed manual. */
const US_SEED: Array<{ ticker: string; name: string; type: CatalogAssetType }> = [
  { ticker: 'AAPL', name: 'Apple Inc', type: CatalogAssetType.STOCK_US },
  { ticker: 'MSFT', name: 'Microsoft Corp', type: CatalogAssetType.STOCK_US },
  { ticker: 'GOOGL', name: 'Alphabet Inc', type: CatalogAssetType.STOCK_US },
  { ticker: 'AMZN', name: 'Amazon.com Inc', type: CatalogAssetType.STOCK_US },
  { ticker: 'NVDA', name: 'NVIDIA Corp', type: CatalogAssetType.STOCK_US },
  { ticker: 'META', name: 'Meta Platforms', type: CatalogAssetType.STOCK_US },
  { ticker: 'TSLA', name: 'Tesla Inc', type: CatalogAssetType.STOCK_US },
  { ticker: 'JPM', name: 'JPMorgan Chase', type: CatalogAssetType.STOCK_US },
  { ticker: 'V', name: 'Visa Inc', type: CatalogAssetType.STOCK_US },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', type: CatalogAssetType.ETF_US },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', type: CatalogAssetType.ETF_US },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', type: CatalogAssetType.ETF_US },
];

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
    }>;
  };
}

@Injectable()
export class YahooFinanceProvider implements AssetCatalogProvider, AssetQuoteProvider {
  readonly name = 'yahoo';
  private readonly logger = new Logger(YahooFinanceProvider.name);

  async fetchCatalog(): Promise<CatalogAssetInput[]> {
    return US_SEED.map((s) => ({
      ticker: s.ticker,
      name: s.name,
      type: s.type,
      exchange: s.type === CatalogAssetType.ETF_US ? 'NYSE' : 'NASDAQ',
      currency: PreferredCurrency.USD,
      country: 'US',
    }));
  }

  async fetchQuotes(tickers: string[]): Promise<QuoteSnapshot[]> {
    const results: QuoteSnapshot[] = [];
    const now = new Date().toISOString();

    for (const ticker of tickers) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'GaiusAPI/1.0' },
        });
        if (!res.ok) continue;

        const data = (await res.json()) as YahooChartResponse;
        const meta = data.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice;
        if (price == null) continue;

        results.push({
          ticker: ticker.toUpperCase(),
          price,
          currency: PreferredCurrency.USD,
          source: 'yahoo',
          updatedAt: now,
        });
      } catch (err) {
        this.logger.warn(`yahoo quote ${ticker}: ${err}`);
      }
    }

    return results;
  }
}
