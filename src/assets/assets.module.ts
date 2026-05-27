import { Module } from '@nestjs/common';
import { AssetQuotesService } from './asset-quotes.service';
import { AssetSyncService } from './asset-sync.service';
import { AssetsCronService } from './assets-cron.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { BrapiProvider } from './providers/brapi.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';

@Module({
  controllers: [AssetsController],
  providers: [
    AssetsService,
    AssetSyncService,
    AssetQuotesService,
    AssetsCronService,
    BrapiProvider,
    YahooFinanceProvider,
    CoinGeckoProvider,
  ],
  exports: [AssetsService, AssetQuotesService],
})
export class AssetsModule {}
