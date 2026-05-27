import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogAssetType, PreferredCurrency } from '@prisma/client';

/** Resposta de POST /assets/:ticker/sync (dados do provider, antes/depois do upsert). */
export class CatalogAssetInputDto {
  @ApiProperty({ example: 'PETR4' })
  ticker!: string;

  @ApiProperty({ example: 'Petrobras PN' })
  name!: string;

  @ApiProperty({ enum: CatalogAssetType, example: 'ACAO_BR' })
  type!: CatalogAssetType;

  @ApiPropertyOptional({ example: 'B3' })
  exchange?: string;

  @ApiProperty({ enum: PreferredCurrency, example: 'BRL' })
  currency!: PreferredCurrency;

  @ApiPropertyOptional({ example: 'Petróleo, Gás e Biocombustíveis' })
  sector?: string;

  @ApiPropertyOptional({ example: 'BR' })
  country?: string;

  @ApiPropertyOptional({ example: 'https://icons.brapi.dev/icons/PETR4.png' })
  logoUrl?: string;
}
