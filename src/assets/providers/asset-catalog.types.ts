import { CatalogAssetType, PreferredCurrency } from '@prisma/client';

export interface CatalogAssetInput {
  ticker: string;
  name: string;
  type: CatalogAssetType;
  exchange?: string;
  currency: PreferredCurrency;
  sector?: string;
  country?: string;
  logoUrl?: string;
}

export interface QuoteSnapshot {
  ticker: string;
  price: number;
  currency: PreferredCurrency;
  source: 'brapi' | 'yahoo' | 'coingecko';
  updatedAt: string;
}
