import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT de acesso (TTL 15 min)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Expose()
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token opaco (TTL 7 dias)',
    example: 'abc123refreshTokenExample',
  })
  @Expose()
  refreshToken!: string;
}
