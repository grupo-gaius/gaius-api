import { ConfigService } from '@nestjs/config';

/**
 * Uses JWT_SECRET from env; in non-production falls back so local dev works without .env.
 */
export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set');
  }
  return 'development-jwt-secret-not-for-production';
}
