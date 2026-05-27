import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssetQuotesService } from './asset-quotes.service';
import { AssetSyncService } from './asset-sync.service';

@Injectable()
export class AssetsCronService {
  private readonly logger = new Logger(AssetsCronService.name);

  constructor(
    private readonly sync: AssetSyncService,
    private readonly quotes: AssetQuotesService,
  ) {}

  /** Catálogo: 02:00 diário (BR), providers rodam em sequência */
  @Cron('0 2 * * *')
  async syncCatalogDaily() {
    this.logger.log('Starting daily asset catalog sync');
    const results = await this.sync.syncAll();
    this.logger.log(`Catalog sync done: ${JSON.stringify(results)}`);
  }

  /** Cotações: a cada 60s (requisito BR; US/crypto no mesmo ciclo por simplicidade) */
  @Cron(CronExpression.EVERY_MINUTE)
  async refreshQuotes() {
    await this.quotes.refreshAllQuotes();
  }
}
