import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/interfaces/jwt-payload-user.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import {
  PaginatedTransactionsDto,
  TransactionResponseDto,
  WalletDetailDto,
  WalletResponseDto,
  WalletSummaryDto,
} from './dto/wallet-response.dto';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar carteira' })
  @ApiCreatedResponse({ type: WalletResponseDto })
  create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateWalletDto) {
    return this.walletsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar carteiras do usuário' })
  @ApiOkResponse({ type: [WalletResponseDto] })
  list(@CurrentUser() user: JwtPayloadUser) {
    return this.walletsService.list(user.id);
  }

  @Get('consolidated')
  @ApiOperation({ summary: 'Carteira consolidada (todas as carteiras)' })
  @ApiOkResponse({ type: WalletDetailDto })
  consolidated(@CurrentUser() user: JwtPayloadUser) {
    return this.walletsService.consolidated(user.id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Alocação por tipo de ativo (gráfico pizza)' })
  @ApiParam({ name: 'id', description: 'UUID da carteira' })
  @ApiOkResponse({ type: WalletSummaryDto })
  @ApiNotFoundResponse()
  summary(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.walletsService.summary(user.id, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da carteira com posições e rentabilidade' })
  @ApiParam({ name: 'id', description: 'UUID da carteira' })
  @ApiOkResponse({ type: WalletDetailDto })
  @ApiNotFoundResponse()
  findOne(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.walletsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nome/descrição da carteira' })
  @ApiParam({ name: 'id', description: 'UUID da carteira' })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiNotFoundResponse()
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.walletsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Arquivar carteira (soft delete)' })
  @ApiParam({ name: 'id', description: 'UUID da carteira' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  archive(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.walletsService.archive(user.id, id);
  }

  @Post(':id/transactions')
  @ApiOperation({ summary: 'Registrar compra ou venda' })
  @ApiParam({ name: 'id', description: 'UUID da carteira' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  @ApiNotFoundResponse()
  addTransaction(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.walletsService.addTransaction(user.id, id, dto);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Histórico de transações (cursor-based)' })
  @ApiParam({ name: 'id', description: 'UUID da carteira' })
  @ApiOkResponse({ type: PaginatedTransactionsDto })
  @ApiNotFoundResponse()
  listTransactions(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.walletsService.listTransactions(user.id, id, query);
  }
}
