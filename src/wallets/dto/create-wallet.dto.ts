import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({ example: 'Carteira principal' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Ações BR de longo prazo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
