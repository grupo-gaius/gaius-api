import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogAssetType, TransactionType } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class WalletResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional()
  @Expose()
  description?: string | null;

  @ApiProperty()
  @Expose()
  isArchived!: boolean;

  @ApiProperty()
  @Expose()
  createdAt!: Date;
}

@Exclude()
export class WalletPositionDto {
  @ApiProperty()
  @Expose()
  assetId!: string;

  @ApiProperty({ example: 'PETR4' })
  @Expose()
  ticker!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: CatalogAssetType })
  @Expose()
  type!: CatalogAssetType;

  @ApiProperty()
  @Expose()
  quantity!: number;

  @ApiProperty()
  @Expose()
  avgPrice!: number;

  @ApiProperty({ description: 'Preço atual do Redis ou avgPrice se indisponível' })
  @Expose()
  currentPrice!: number;

  @ApiProperty()
  @Expose()
  currentValue!: number;

  @ApiProperty()
  @Expose()
  returnPercent!: number;

  @ApiProperty()
  @Expose()
  stale!: boolean;
}

export class WalletDetailDto extends WalletResponseDto {
  @ApiProperty({ type: [WalletPositionDto] })
  @Expose()
  @Type(() => WalletPositionDto)
  positions!: WalletPositionDto[];

  @ApiProperty()
  @Expose()
  totalValue!: number;

  @ApiProperty()
  @Expose()
  totalReturnPercent!: number;
}

@Exclude()
export class TransactionResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  assetId!: string;

  @ApiProperty({ example: 'PETR4' })
  @Expose()
  ticker!: string;

  @ApiProperty({ enum: TransactionType })
  @Expose()
  type!: TransactionType;

  @ApiProperty()
  @Expose()
  quantity!: number;

  @ApiProperty()
  @Expose()
  price!: number;

  @ApiProperty()
  @Expose()
  fee!: number;

  @ApiProperty()
  @Expose()
  date!: Date;
}

export class PaginatedTransactionsDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  @Expose()
  items!: TransactionResponseDto[];

  @ApiPropertyOptional()
  @Expose()
  nextCursor?: string;
}

@Exclude()
export class AllocationSliceDto {
  @ApiProperty({ enum: CatalogAssetType })
  @Expose()
  type!: CatalogAssetType;

  @ApiProperty()
  @Expose()
  value!: number;

  @ApiProperty()
  @Expose()
  percent!: number;
}

export class WalletSummaryDto {
  @ApiProperty()
  @Expose()
  walletId!: string;

  @ApiProperty({ type: [AllocationSliceDto] })
  @Expose()
  @Type(() => AllocationSliceDto)
  allocation!: AllocationSliceDto[];

  @ApiProperty()
  @Expose()
  totalValue!: number;
}
