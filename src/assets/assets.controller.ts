import { Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AssetQuotesService } from './asset-quotes.service';
import { AssetSyncService } from './asset-sync.service';
import { AssetsService } from './assets.service';
import { CatalogAssetInputDto } from './dto/catalog-asset-input.dto';
import { AssetQuoteDto } from './dto/asset-quote.dto';
import { AssetResponseDto, PaginatedAssetsDto } from './dto/asset-response.dto';
import { ListAssetsQueryDto, SearchAssetsQueryDto } from './dto/list-assets-query.dto';
import {
  RefreshQuotesResponseDto,
  SyncAssetsResponseDto,
} from './dto/sync-assets-response.dto';

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly assetSync: AssetSyncService,
    private readonly assetQuotes: AssetQuotesService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Listar ativos',
    description: 'Paginação e filtros por tipo, bolsa, setor e país.',
  })
  @ApiOkResponse({ type: PaginatedAssetsDto })
  list(@Query() query: ListAssetsQueryDto) {
    return this.assetsService.list(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Buscar ativos',
    description: 'Busca por ticker ou nome (parcial, case-insensitive). Resultado cacheado no Redis (~5 min).',
  })
  @ApiOkResponse({ type: PaginatedAssetsDto })
  search(@Query() query: SearchAssetsQueryDto) {
    return this.assetsService.search(query.q, query);
  }

  @Public()
  @Post('sync')
  @ApiOperation({
    summary: 'Sincronizar catálogo completo',
    description:
      'Importa tickers da brapi (~1800+), seed US do Yahoo (12) e top 500 crypto do CoinGecko. ' +
      'Na brapi usa apenas `/available` (sem cotação). Cron diário às 02:00. ' +
      'Para nome/setor/logo de um papel BR: `POST /assets/{ticker}/sync`.',
  })
  @ApiOkResponse({ type: SyncAssetsResponseDto })
  async syncCatalog(): Promise<SyncAssetsResponseDto> {
    const results = await this.assetSync.syncAll();
    return { results };
  }

  @Public()
  @Post('quotes/refresh')
  @ApiOperation({
    summary: 'Atualizar cotações em lote',
    description:
      'Atualiza até `BRAPI_CRON_QUOTE_LIMIT` ativos ativos (padrão 30) e grava no Redis. ' +
      'Cron roda a cada 60s com o mesmo limite. Para um ticker: `POST /assets/{ticker}/quote/refresh`.',
  })
  @ApiOkResponse({ type: RefreshQuotesResponseDto })
  refreshQuotes(): Promise<RefreshQuotesResponseDto> {
    return this.assetQuotes.refreshAllQuotes();
  }

  @Public()
  @Post(':ticker/sync')
  @ApiOperation({
    summary: 'Sincronizar um ativo',
    description:
      'Busca dados completos no provider (brapi: 1 request/ticker no plano gratuito). ' +
      'Faz upsert no catálogo `asset_catalog`.',
  })
  @ApiParam({ name: 'ticker', example: 'PETR4' })
  @ApiOkResponse({ type: CatalogAssetInputDto })
  @ApiNotFoundResponse({ description: 'Ticker não encontrado em nenhum provider' })
  syncOne(@Param('ticker') ticker: string) {
    return this.assetSync.syncOne(ticker);
  }

  @Public()
  @Post(':ticker/quote/refresh')
  @ApiOperation({
    summary: 'Atualizar cotação de um ativo',
    description: 'Busca preço ao vivo (brapi / Yahoo / CoinGecko) e grava no Redis com TTL por tipo.',
  })
  @ApiParam({ name: 'ticker', example: 'PETR4' })
  @ApiOkResponse({ type: AssetQuoteDto })
  @ApiNotFoundResponse({ description: 'Ativo ou cotação indisponível' })
  refreshOneQuote(@Param('ticker') ticker: string) {
    return this.assetQuotes.refreshOne(ticker);
  }

  @Public()
  @Get(':ticker/quote')
  @ApiOperation({
    summary: 'Ler cotação do cache',
    description: 'Retorna cotação do Redis. Se vazio, execute `POST /assets/{ticker}/quote/refresh` antes.',
  })
  @ApiParam({ name: 'ticker', example: 'PETR4' })
  @ApiOkResponse({ type: AssetQuoteDto })
  @ApiNotFoundResponse({ description: 'Cotação não disponível no cache' })
  async getQuote(@Param('ticker') ticker: string) {
    const quote = await this.assetQuotes.getQuote(ticker);
    if (!quote) {
      throw new NotFoundException('Quote not available. Run POST /assets/quotes/refresh');
    }
    return quote;
  }

  @Public()
  @Get(':ticker')
  @ApiOperation({ summary: 'Detalhe do ativo no catálogo' })
  @ApiParam({ name: 'ticker', example: 'PETR4' })
  @ApiOkResponse({ type: AssetResponseDto })
  @ApiNotFoundResponse()
  findByTicker(@Param('ticker') ticker: string) {
    return this.assetsService.findByTicker(ticker);
  }
}
