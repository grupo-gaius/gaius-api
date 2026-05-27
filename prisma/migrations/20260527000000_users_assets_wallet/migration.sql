-- Gaius API schema (catálogo em asset_catalog — não confundir com tabela legada "assets")

-- Enums
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PreferredCurrency" AS ENUM ('BRL', 'USD', 'EUR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AssetType" AS ENUM ('ACAO_BR', 'FII', 'ETF_BR', 'STOCK_US', 'ETF_US', 'ETF_INTL', 'CRYPTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users: colunas novas
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_currency" "PreferredCurrency" NOT NULL DEFAULT 'BRL';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Wallets: criar em banco novo ou evoluir schema legado (1 carteira/user) → múltiplas carteiras
CREATE TABLE IF NOT EXISTS "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DROP INDEX IF EXISTS "wallets_user_id_key";
CREATE INDEX IF NOT EXISTS "wallets_user_id_idx" ON "wallets"("user_id");

DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Renomear tabela legada "assets" (posições) se existir com coluna wallet_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'wallet_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legacy_wallet_positions'
  ) THEN
    ALTER TABLE "assets" RENAME TO "legacy_wallet_positions";
  END IF;
END $$;

-- Catálogo de ativos negociáveis
CREATE TABLE IF NOT EXISTS "asset_catalog" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "exchange" TEXT,
    "currency" "PreferredCurrency" NOT NULL DEFAULT 'BRL',
    "sector" TEXT,
    "country" TEXT,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_catalog_ticker_key" ON "asset_catalog"("ticker");
CREATE INDEX IF NOT EXISTS "asset_catalog_type_idx" ON "asset_catalog"("type");
CREATE INDEX IF NOT EXISTS "asset_catalog_name_idx" ON "asset_catalog"("name");

CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "default_currency" "PreferredCurrency" NOT NULL DEFAULT 'BRL',
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_id_key" ON "user_preferences"("user_id");

CREATE TABLE IF NOT EXISTS "exchange_rates" (
    "id" TEXT NOT NULL,
    "from" "PreferredCurrency" NOT NULL,
    "to" "PreferredCurrency" NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_from_to_key" ON "exchange_rates"("from", "to");

CREATE TABLE IF NOT EXISTS "wallet_assets" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "avg_price" DECIMAL(18,8) NOT NULL,
    "purchase_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_assets_wallet_id_asset_id_key" ON "wallet_assets"("wallet_id", "asset_id");

CREATE TABLE IF NOT EXISTS "transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "fee" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transactions_wallet_id_date_idx" ON "transactions"("wallet_id", "date");

DO $$ BEGIN
  ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "wallet_assets" ADD CONSTRAINT "wallet_assets_wallet_id_fkey"
    FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "wallet_assets" ADD CONSTRAINT "wallet_assets_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "asset_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey"
    FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "asset_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
