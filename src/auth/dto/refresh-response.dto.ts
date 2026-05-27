import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RefreshResponseDto {
  @ApiProperty({
    description: 'Novo JWT de acesso (TTL 15 min)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Expose()
  accessToken!: string;

  @ApiProperty({
    description: 'Novo refresh token (rotação — o anterior é invalidado)',
    example: 'xyz789newRefreshTokenExample',
  })
  @Expose()
  refreshToken!: string;
}
