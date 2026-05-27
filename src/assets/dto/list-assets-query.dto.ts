import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogAssetType, PreferredCurrency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListAssetsQueryDto {
  @ApiPropertyOptional({ enum: CatalogAssetType })
  @IsOptional()
  @IsEnum(CatalogAssetType)
  type?: CatalogAssetType;

  @ApiPropertyOptional({ example: 'B3' })
  @IsOptional()
  @IsString()
  exchange?: string;

  @ApiPropertyOptional({ example: 'Financeiro' })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ example: 'BR' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SearchAssetsQueryDto extends ListAssetsQueryDto {
  @ApiProperty({
    example: 'PETR',
    description: 'Termo de busca (ticker ou nome, parcial)',
    required: true,
  })
  @IsString()
  @Min(1)
  q!: string;
}
