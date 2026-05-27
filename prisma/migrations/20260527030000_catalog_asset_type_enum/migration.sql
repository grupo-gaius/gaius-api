-- Enum legado AssetType (STOCK, FII, ETF, CRYPTO) ≠ enum do Gaius API. Catálogo usa tipo próprio.

DO $$ BEGIN
  CREATE TYPE "CatalogAssetType" AS ENUM (
    'ACAO_BR',
    'FII',
    'ETF_BR',
    'STOCK_US',
    'ETF_US',
    'ETF_INTL',
    'CRYPTO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'asset_catalog'
      AND column_name = 'type' AND udt_name = 'AssetType'
  ) THEN
    ALTER TABLE "asset_catalog" DROP COLUMN "type";
    ALTER TABLE "asset_catalog" ADD COLUMN "type" "CatalogAssetType" NOT NULL DEFAULT 'ACAO_BR';
    ALTER TABLE "asset_catalog" ALTER COLUMN "type" DROP DEFAULT;
  END IF;
END $$;
