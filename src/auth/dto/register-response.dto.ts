import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RegisterResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Maria Silva' })
  @Expose()
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  @Expose()
  email!: string;

  @ApiProperty({ example: '2026-05-26T12:00:00.000Z' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-26T12:00:00.000Z' })
  @Expose()
  updatedAt!: Date;
}
