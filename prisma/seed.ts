import { CatalogAssetType, PreferredCurrency, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const assets = [
  {
    ticker: 'PETR4',
    name: 'Petrobras PN',
    type: CatalogAssetType.ACAO_BR,
    exchange: 'B3',
    currency: PreferredCurrency.BRL,
    sector: 'Petróleo',
    country: 'BR',
  },
  {
    ticker: 'VALE3',
    name: 'Vale ON',
    type: CatalogAssetType.ACAO_BR,
    exchange: 'B3',
    currency: PreferredCurrency.BRL,
    sector: 'Mineração',
    country: 'BR',
  },
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística FII',
    type: CatalogAssetType.FII,
    exchange: 'B3',
    currency: PreferredCurrency.BRL,
    sector: 'Logística',
    country: 'BR',
  },
  {
    ticker: 'AAPL',
    name: 'Apple Inc',
    type: CatalogAssetType.STOCK_US,
    exchange: 'NASDAQ',
    currency: PreferredCurrency.USD,
    sector: 'Tecnologia',
    country: 'US',
  },
  {
    ticker: 'BTC',
    name: 'Bitcoin',
    type: CatalogAssetType.CRYPTO,
    exchange: 'CRYPTO',
    currency: PreferredCurrency.USD,
    sector: 'Cripto',
    country: 'GLOBAL',
  },
];

async function main() {
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { ticker: asset.ticker },
      create: asset,
      update: asset,
    });
  }
  console.log(`Seeded ${assets.length} assets`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
