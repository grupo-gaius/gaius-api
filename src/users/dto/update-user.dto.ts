import { ApiPropertyOptional } from '@nestjs/swagger';
import { PreferredCurrency } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: PreferredCurrency, example: 'BRL' })
  @IsOptional()
  @IsEnum(PreferredCurrency)
  preferredCurrency?: PreferredCurrency;

  @ApiPropertyOptional({ example: 'dark' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;

  @ApiPropertyOptional({ enum: PreferredCurrency })
  @IsOptional()
  @IsEnum(PreferredCurrency)
  defaultCurrency?: PreferredCurrency;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
