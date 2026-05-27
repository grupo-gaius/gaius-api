import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gaius API')
    .setDescription(
      [
        'API REST do Gaius — investimentos, carteiras e catálogo de ativos.',
        '',
        '**Autenticação:** rotas protegidas usam `Authorization: Bearer <access_token>`.',
        'Obtenha o token em `POST /auth/login` ou `POST /auth/register`.',
        '',
        '**Assets:** rotas de catálogo e cotação são públicas (sem Bearer).',
        'Fluxo sugerido: `POST /assets/sync` → `POST /assets/{ticker}/sync` → `POST /assets/{ticker}/quote/refresh` → `GET /assets/{ticker}/quote`.',
        '',
        '**Providers:** brapi (B3), Yahoo Finance (US seed), CoinGecko (top 500 crypto).',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addTag('Auth', 'Registro, login, refresh e reset de senha')
    .addTag('Users', 'Perfil e preferências (autenticado)')
    .addTag('Assets', 'Catálogo, sync e cotações (público)')
    .addTag('Wallets', 'Carteiras, posições e transações (autenticado)')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`\nAplicação rodando na porta ${port} 🚀`);
  console.log(`Swagger: http://localhost:${port}/docs\n`);
}

void bootstrap();
