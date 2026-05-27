import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token ativo (opcional; o logout já invalida o access token)',
    example: 'abc123refreshTokenExample',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
