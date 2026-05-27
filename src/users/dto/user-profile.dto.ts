import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PreferredCurrency, UserStatus } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class UserPreferencesDto {
  @ApiProperty({ example: 'system' })
  @Expose()
  theme!: string;

  @ApiProperty({ enum: PreferredCurrency, example: 'BRL' })
  @Expose()
  defaultCurrency!: PreferredCurrency;

  @ApiProperty({ example: true })
  @Expose()
  notificationsEnabled!: boolean;
}

@Exclude()
export class UserProfileDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Maria Silva' })
  @Expose()
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  @Expose()
  email!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png' })
  @Expose()
  avatarUrl?: string | null;

  @ApiProperty({ enum: PreferredCurrency, example: 'BRL' })
  @Expose()
  preferredCurrency!: PreferredCurrency;

  @ApiProperty({ enum: UserStatus, example: 'ACTIVE' })
  @Expose()
  status!: UserStatus;

  @ApiPropertyOptional({ example: '2026-05-26T12:00:00.000Z' })
  @Expose()
  lastLoginAt?: Date | null;

  @ApiProperty({ example: '2026-05-26T12:00:00.000Z' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-26T12:00:00.000Z' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: UserPreferencesDto })
  @Expose()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;
}
