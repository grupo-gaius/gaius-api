import { ApiProperty } from '@nestjs/swagger';
import { PreferredCurrency } from '@prisma/client';

export class AssetQuoteDto {
  @ApiProperty({ example: 'PETR4' })
  ticker!: string;

  @ApiProperty({ example: 38.52 })
  price!: number;

  @ApiProperty({ enum: PreferredCurrency })
  currency!: PreferredCurrency;

  @ApiProperty({ example: 'brapi', enum: ['brapi', 'yahoo', 'coingecko'] })
  source!: string;

  @ApiProperty({ example: '2026-05-27T02:00:00.000Z' })
  updatedAt!: string;
}

