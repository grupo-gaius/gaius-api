import { ApiProperty } from '@nestjs/swagger';

export class SyncProviderResultDto {
  @ApiProperty({ example: 'brapi', enum: ['brapi', 'yahoo', 'coingecko'] })
  provider!: string;

  @ApiProperty({
    example: 1819,
    description: 'Quantidade de upserts bem-sucedidos neste provider',
  })
  upserted!: number;

  @ApiProperty({
    type: [String],
    example: [],
    description: 'Erros por ticker (vazio quando tudo OK)',
  })
  errors!: string[];
}

export class SyncAssetsResponseDto {
  @ApiProperty({ type: [SyncProviderResultDto] })
  results!: SyncProviderResultDto[];
}

export class RefreshQuotesResponseDto {
  @ApiProperty({ example: 28, description: 'Cotações gravadas no Redis' })
  updated!: number;

  @ApiProperty({
    type: [String],
    example: [],
    description: 'Falhas por ticker',
  })
  errors!: string[];
}
