import { CatalogAssetInput, QuoteSnapshot } from './asset-catalog.types';

export interface AssetCatalogProvider {
  readonly name: string;
  fetchCatalog(): Promise<CatalogAssetInput[]>;
}

export interface AssetQuoteProvider {
  readonly name: string;
  fetchQuotes(tickers: string[]): Promise<QuoteSnapshot[]>;
}
