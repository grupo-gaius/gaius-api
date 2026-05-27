import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogAssetType, PreferredCurrency } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AssetResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ example: 'PETR4' })
  @Expose()
  ticker!: string;

  @ApiProperty({ example: 'Petrobras PN' })
  @Expose()
  name!: string;

  @ApiProperty({ enum: CatalogAssetType })
  @Expose()
  type!: CatalogAssetType;

  @ApiPropertyOptional({ example: 'B3' })
  @Expose()
  exchange?: string | null;

  @ApiProperty({ enum: PreferredCurrency })
  @Expose()
  currency!: PreferredCurrency;

  @ApiPropertyOptional()
  @Expose()
  sector?: string | null;

  @ApiPropertyOptional()
  @Expose()
  country?: string | null;

  @ApiPropertyOptional()
  @Expose()
  logoUrl?: string | null;
}

@Exclude()
export class PaginatedAssetsDto {
  @ApiProperty({ type: [AssetResponseDto] })
  @Expose()
  items!: AssetResponseDto[];

  @ApiProperty()
  @Expose()
  total!: number;

  @ApiProperty()
  @Expose()
  page!: number;

  @ApiProperty()
  @Expose()
  limit!: number;
}
