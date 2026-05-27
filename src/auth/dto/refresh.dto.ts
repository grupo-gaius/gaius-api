import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Refresh token retornado no login ou no refresh anterior',
    example: 'abc123refreshTokenExample',
  })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
