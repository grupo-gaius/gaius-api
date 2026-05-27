# Gaius API

API REST em [NestJS](https://nestjs.com/) com autenticação JWT, [Prisma](https://www.prisma.io/) e PostgreSQL.

## Pré-requisitos

| Ferramenta | Versão sugerida | Observação |
|------------|-----------------|------------|
| [Node.js](https://nodejs.org/) | 20+ | LTS recomendado |
| [pnpm](https://pnpm.io/) | 9.15.4 | `corepack enable` no projeto |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | — | Só para o banco em desenvolvimento |

Ativar o pnpm na versão do projeto:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## Setup rápido (automatizado)

Na raiz do repositório:

```bash
pnpm setup
```

Equivalentes:

```bash
node scripts/setup.mjs
```

```powershell
# Windows
.\scripts\setup.ps1
```

```bash
# Linux / macOS / WSL
chmod +x scripts/setup.sh
./scripts/setup.sh
```

O script:

1. Verifica Node, pnpm e Docker
2. Cria `.env` a partir de `.env.example` (se ainda não existir)
3. Instala dependências (`pnpm install`)
4. Sobe o Postgres com `docker compose up -d db`
5. Aguarda o banco ficar saudável
6. Roda `prisma generate` e `prisma migrate deploy`

Depois, inicie a API:

```bash
pnpm start:dev
```

A aplicação fica em **http://localhost:3000**.

## Setup manual (passo a passo)

### 1. Clonar e entrar no projeto

```bash
git clone <url-do-repositorio>
cd gaius-api
```

### 2. Instalar dependências

```bash
corepack enable
pnpm install
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Valores padrão em `.env.example`:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Postgres na porta **5433** do host (Docker mapeia `5433 → 5432`) |
| `JWT_SECRET` | Chave para assinar tokens JWT — altere em produção |
| `PORT` | Porta da API (padrão `3000`) |

### 4. Subir o banco de dados

```bash
pnpm db:up
```

Ou:

```bash
docker compose up -d db
```

Aguarde o container ficar saudável (`docker compose ps`).

### 5. Prisma (cliente + migrações)

```bash
pnpm prisma:generate
pnpm exec prisma migrate deploy
```

Para criar novas migrações durante o desenvolvimento:

```bash
pnpm prisma:migrate
```

### 6. Rodar a API

Modo desenvolvimento (hot reload):

```bash
pnpm start:dev
```

Outros comandos:

```bash
pnpm build          # compilar
pnpm start:prod     # produção (após build)
pnpm prisma:studio  # UI do banco
pnpm db:down        # parar Postgres
```

## Rodar tudo com Docker (app + banco)

```bash
docker compose up --build
```

A API e o Postgres sobem juntos; migrações rodam no start do container da app.

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/auth/register` | — | Cadastro |
| `POST` | `/auth/login` | — | Login (retorna JWT) |
| `GET` | `/users/me` | Bearer JWT | Perfil do usuário logado |

### Exemplos

Registrar:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Maria\",\"email\":\"maria@example.com\",\"password\":\"senha12345\"}"
```

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"maria@example.com\",\"password\":\"senha12345\"}"
```

Perfil (substitua `TOKEN`):

```bash
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer TOKEN"
```

## Estrutura do projeto

```
gaius-api/
├── prisma/           # schema e migrações
├── scripts/          # setup automatizado
├── src/
│   ├── auth/         # registro e login
│   ├── users/        # perfil
│   ├── prisma/       # módulo Prisma
│   └── common/       # guards, decorators, config
├── docker-compose.yml
└── Dockerfile
```

## Solução de problemas

**Porta 5433 em uso** — O `docker-compose.yml` usa a porta 5433 no host para evitar conflito com Postgres instalado no Windows (geralmente na 5432). Ajuste o mapeamento em `docker-compose.yml` e o `DATABASE_URL` no `.env` se necessário.

**Docker não está rodando** — Inicie o Docker Desktop antes de `pnpm db:up` ou `pnpm setup`.

**Erro de conexão com o banco** — Confirme que o container está up: `docker compose ps`. O `DATABASE_URL` deve apontar para `localhost:5433` quando a API roda fora do Docker.

**Migrações** — Em ambiente limpo, use `prisma migrate deploy`. Use `prisma migrate dev` apenas quando for alterar o schema localmente.

## Scripts npm

| Script | Ação |
|--------|------|
| `pnpm setup` | Setup completo local |
| `pnpm start:dev` | API em modo watch |
| `pnpm db:up` / `pnpm db:down` | Subir / derrubar Postgres |
| `pnpm prisma:generate` | Gerar Prisma Client |
| `pnpm prisma:migrate` | Migrações em dev (interativo) |
| `pnpm prisma:studio` | Prisma Studio |



--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


# Gaius — Requisitos do Backend
**Versão:** 1.0  
**Stack:** NestJS · Prisma · PostgreSQL · Redis  
**Data:** 2026-05-26

---

## Sumário

1. [Módulo: Users](#1-módulo-users)
2. [Módulo: Assets (Ativos)](#2-módulo-assets-ativos)
3. [Módulo: Wallet (Carteira)](#3-módulo-wallet-carteira)
4. [Módulo: News (Notícias)](#4-módulo-news-notícias)
5. [Módulo: Subscriptions (Assinaturas)](#5-módulo-subscriptions-assinaturas)
6. [Módulo: AI Assistant](#6-módulo-ai-assistant)
7. [Módulo: Market Data (Histórico)](#7-módulo-market-data-histórico)
8. [Requisitos Não Funcionais Globais](#8-requisitos-não-funcionais-globais)
9. [Estratégia Redis — Visão Consolidada](#9-estratégia-redis--visão-consolidada)
10. [Prisma Schema — Entidades por módulo](#10-prisma-schema--entidades-por-módulo)
11. [Backlog de Tarefas por Módulo](#11-backlog-de-tarefas-por-módulo)

---

## 1. Módulo: Users

### RF — Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-USR-01 | O sistema deve permitir cadastro de usuário com nome, e-mail e senha. |
| RF-USR-02 | O sistema deve validar e-mail único no cadastro. |
| RF-USR-03 | O sistema deve armazenar senha com hash bcrypt (salt ≥ 12 rounds). |
| RF-USR-04 | O sistema deve emitir access token JWT (TTL 15min) e refresh token (TTL 7 dias) no login. |
| RF-USR-05 | O sistema deve suportar refresh de access token via endpoint dedicado, invalidando o RT anterior. |
| RF-USR-06 | O sistema deve suportar logout com invalidação imediata do access token via blacklist no Redis. |
| RF-USR-07 | O sistema deve permitir atualização de perfil: nome, avatar, moeda preferida (BRL/USD/EUR). |
| RF-USR-08 | O sistema deve suportar exclusão de conta com remoção em cascata de carteiras e configurações. |
| RF-USR-09 | O sistema deve suportar recuperação de senha via token enviado por e-mail (TTL 30min). |
| RF-USR-10 | O sistema deve registrar data de criação, último login e status da conta (ativo, suspenso, banido). |
| RF-USR-11 | O sistema deve expor endpoint GET /users/me retornando dados do usuário autenticado. |
| RF-USR-12 | O sistema deve permitir configurar preferências: tema, moeda padrão, notificações ativas. |

### RNF — Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF-USR-01 | Senhas nunca devem ser retornadas em nenhum endpoint. |
| RNF-USR-02 | Tokens JWT devem ser assinados com RS256 (par de chaves assimétricas). |
| RNF-USR-03 | Blacklist de tokens deve ser armazenada no Redis com TTL igual ao tempo restante do token. |
| RNF-USR-04 | Rate limit no endpoint de login: máx. 10 tentativas / 15min por IP (Redis sliding window). |
| RNF-USR-05 | Dados do usuário devem ser retornados em ≤ 50ms (cache Redis com TTL 5min). |
| RNF-USR-06 | O módulo deve expor guard `JwtAuthGuard` e decorator `@CurrentUser()` para outros módulos. |

---

## 2. Módulo: Assets (Ativos)

> Responsável por catalogar e manter todos os ativos negociáveis: ações BR, FIIs, ETFs nacionais, stocks EUA, ETFs internacionais e criptomoedas.

### RF — Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-AST-01 | O sistema deve manter um catálogo centralizado de ativos com: ticker, nome, tipo, exchange, moeda base, logo, setor e país. |
| RF-AST-02 | O sistema deve suportar os seguintes tipos de ativo: ACAO_BR, FII, ETF_BR, STOCK_US, ETF_US, ETF_INTL, CRYPTO. |
| RF-AST-03 | O sistema deve buscar e sincronizar ativos brasileiros (ações, FIIs, ETFs) via API da B3 ou provider terceiro (ex: brapi.dev, HG Finance). |
| RF-AST-04 | O sistema deve buscar e sincronizar stocks e ETFs americanos via Yahoo Finance API ou Alpha Vantage. |
| RF-AST-05 | O sistema deve buscar e sincronizar criptomoedas via CoinGecko API (top 500 por market cap). |
| RF-AST-06 | O sistema deve expor endpoint GET /assets/search?q= para busca por ticker ou nome com paginação. |
| RF-AST-07 | O sistema deve expor endpoint GET /assets/:ticker retornando dados completos do ativo. |
| RF-AST-08 | O sistema deve expor endpoint GET /assets com filtros por tipo, exchange, setor e país. |
| RF-AST-09 | O sistema deve executar cron de sincronização de catálogo (novos ativos, delisting) diariamente às 02:00. |
| RF-AST-10 | O sistema deve buscar cotações em tempo real (delay ≤ 15min) para ativos BR via WebSocket ou polling. |
| RF-AST-11 | O sistema deve buscar cotações para ativos US via provider (Yahoo Finance / Polygon.io). |
| RF-AST-12 | O sistema deve buscar preços de cripto em tempo real via CoinGecko ou Binance WebSocket. |
| RF-AST-13 | O sistema deve converter cotações para a moeda preferida do usuário usando taxas de câmbio atualizadas. |
| RF-AST-14 | O sistema deve armazenar taxa de câmbio BRL/USD, BRL/EUR e USD/EUR com atualização a cada 30min. |
| RF-AST-15 | O sistema deve registrar log de erros de sincronização por ativo para monitoramento. |

### RNF — Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF-AST-01 | Cotações devem ser servidas exclusivamente a partir do Redis (cache-first), com TTL de 60s para ativos BR e 300s para cripto. |
| RNF-AST-02 | O catálogo de ativos deve ter índice full-text no PostgreSQL (campo `search_vector` com tsvector) para busca eficiente. |
| RNF-AST-03 | A busca GET /assets/search deve responder em ≤ 100ms usando cache Redis de queries frequentes. |
| RNF-AST-04 | O sistema deve suportar ao menos 5.000 ativos no catálogo sem degradação de performance. |
| RNF-AST-05 | Falha em um provider de cotação deve acionar fallback automático para provider secundário. |
| RNF-AST-06 | Criptomoedas devem ter cache separado no Redis com TTL menor (30s) dado volatilidade. |
| RNF-AST-07 | Taxas de câmbio devem ser armazenadas no Redis com chave `exchange_rate:{from}:{to}` e TTL 1800s. |

---

## 3. Módulo: Wallet (Carteira)

### RF — Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-WAL-01 | O sistema deve permitir que um usuário crie múltiplas carteiras com nome e descrição. |
| RF-WAL-02 | O sistema deve permitir vincular ativos a uma carteira com quantidade, preço médio e data de compra. |
| RF-WAL-03 | O sistema deve permitir registrar operações de compra e venda por ativo (historico de transações). |
| RF-WAL-04 | O sistema deve calcular automaticamente o preço médio ponderado por ativo após cada operação. |
| RF-WAL-05 | O sistema deve calcular rentabilidade total, por ativo e por tipo de ativo em tempo real. |
| RF-WAL-06 | O sistema deve calcular variação diária (valor e percentual) da carteira consolidada. |
| RF-WAL-07 | O sistema deve suportar alternância de moeda (BRL/USD/EUR) para exibição de todos os valores. |
| RF-WAL-08 | O sistema deve expor endpoint GET /wallets retornando todas as carteiras do usuário. |
| RF-WAL-09 | O sistema deve expor endpoint GET /wallets/:id com posições, valores e rentabilidade. |
| RF-WAL-10 | O sistema deve expor endpoint POST /wallets/:id/transactions para registrar operações. |
| RF-WAL-11 | O sistema deve expor endpoint GET /wallets/:id/transactions com histórico paginado. |
| RF-WAL-12 | O sistema deve calcular e expor dividendos recebidos por ativo e total na carteira. |
| RF-WAL-13 | O sistema deve suportar importação de carteira via CSV (formato B3 CEI/nota de corretagem). |
| RF-WAL-14 | O sistema deve expor endpoint GET /wallets/:id/summary com alocação por tipo (pizza chart data). |
| RF-WAL-15 | O sistema deve permitir arquivar (soft delete) uma carteira sem perder o histórico. |
| RF-WAL-16 | O sistema deve suportar carteira consolidada (união de todas as carteiras do usuário). |

### RNF — Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF-WAL-01 | O cálculo de rentabilidade deve usar cotações do Redis (nunca consultar DB para cotações). |
| RNF-WAL-02 | A resposta de GET /wallets/:id deve ser entregue em ≤ 200ms com cache Redis (TTL 30s, invalidado a cada transação). |
| RNF-WAL-03 | Transações devem ser atômicas no PostgreSQL (uso de `prisma.$transaction`). |
| RNF-WAL-04 | O valor total da carteira em múltiplas moedas deve ser calculado no lado do servidor, nunca no cliente. |
| RNF-WAL-05 | Importação CSV deve ser processada de forma assíncrona via queue (BullMQ + Redis), com status consultável. |
| RNF-WAL-06 | O sistema deve garantir consistência eventual: se cotação expirar no Redis, retornar última cotação conhecida com flag `stale: true`. |

---

## 4. Módulo: News (Notícias)

### RF — Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-NEW-01 | O sistema deve agregar notícias de fontes externas via RSS/scraping: G1, Valor Econômico, InfoMoney, Investing.com, Reuters Brasil. |
| RF-NEW-02 | O sistema deve executar cron de coleta a cada 15 minutos durante horário de mercado (09:00–18:30) e a cada 60min fora. |
| RF-NEW-03 | O sistema deve fazer deduplicação de notícias por URL canônica e por similaridade de título (Levenshtein ≥ 90%). |
| RF-NEW-04 | O sistema deve extrair e armazenar: título, resumo, URL, fonte, data de publicação, imagem de capa. |
| RF-NEW-05 | O sistema deve associar notícias a tickers mencionados no título/resumo via NER simples (lista de tickers conhecidos). |
| RF-NEW-06 | O sistema deve categorizar notícias por tag: Dividendos, Resultado, Fusão/Aquisição, Macro, Cripto, Internacional. |
| RF-NEW-07 | O sistema deve expor endpoint GET /news com paginação cursor-based e filtros por source, tag, ticker e data. |
| RF-NEW-08 | O sistema deve expor endpoint GET /news/:id com dados completos da notícia. |
| RF-NEW-09 | O sistema deve expor endpoint GET /news/by-asset/:ticker retornando notícias relacionadas ao ativo. |
| RF-NEW-10 | O sistema deve expor endpoint GET /news/feed personalizado para a carteira do usuário (notícias dos seus ativos). |
| RF-NEW-11 | O sistema deve suportar marcação de notícia como lida por usuário. |
| RF-NEW-12 | O sistema deve manter histórico de notícias por até 90 dias (usuário free) e 1 ano (usuário premium). |

### RNF — Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF-NEW-01 | O feed de notícias deve ser servido a partir do Redis com TTL de 5min para a lista paginada. |
| RNF-NEW-02 | O endpoint GET /news deve responder em ≤ 150ms para requisições cacheadas. |
| RNF-NEW-03 | O scraper deve implementar retry com backoff exponencial (3 tentativas) em caso de falha de rede. |
| RNF-NEW-04 | Fontes com falha contínua por mais de 1h devem ser marcadas como `offline` e monitoradas. |
| RNF-NEW-05 | O cron não deve bloquear o event loop — deve ser executado em worker thread ou processo separado. |
| RNF-NEW-06 | A associação de tickers deve ser feita em background (job assíncrono) após persistência da notícia. |

---

## 5. Módulo: Subscriptions (Assinaturas)

### RF — Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-SUB-01 | O sistema deve suportar os planos: Free, Pro e Premium (valores configuráveis via env/admin). |
| RF-SUB-02 | O plano Free deve ter limites: 1 carteira, 10 ativos, notícias últimas 7 dias, sem IA. |
| RF-SUB-03 | O plano Pro deve incluir: carteiras ilimitadas, ativos ilimitados, notícias 90 dias, IA básica. |
| RF-SUB-04 | O plano Premium deve incluir tudo do Pro mais: integração B3, IA avançada, alertas em tempo real, histórico 1 ano. |
| RF-SUB-05 | O sistema deve integrar com Stripe para pagamentos recorrentes (cartão de crédito). |
| RF-SUB-06 | O sistema deve processar webhooks do Stripe para ativar, renovar e cancelar assinaturas. |
| RF-SUB-07 | O sistema deve aplicar período de trial de 7 dias no plano Pro para novos usuários. |
| RF-SUB-08 | O sistema deve expor endpoint GET /subscriptions/me com plano atual, data de vencimento e limites. |
| RF-SUB-09 | O sistema deve expor endpoint POST /subscriptions/checkout para iniciar sessão de pagamento. |
| RF-SUB-10 | O sistema deve bloquear acesso a recursos premium via guard `SubscriptionGuard` com decorator `@RequiresPlan('PRO')`. |
| RF-SUB-11 | O sistema deve notificar o usuário por e-mail 3 dias antes do vencimento da assinatura. |
| RF-SUB-12 | O sistema deve suportar cancelamento com acesso até o fim do período pago (no immediate cancellation). |
| RF-SUB-13 | Integração B3 (plano Premium): importar automaticamente posições via Open Finance / CEI. |

### RNF — Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF-SUB-01 | O plano do usuário deve ser cacheado no Redis (TTL 1h) para evitar consulta ao DB em cada request. |
| RNF-SUB-02 | Webhooks do Stripe devem ser validados com `stripe.webhooks.constructEvent` antes de qualquer processamento. |
| RNF-SUB-03 | Falha no webhook não deve retornar 2xx para o Stripe — deve retornar 400 para reenvio automático. |
| RNF-SUB-04 | `SubscriptionGuard` deve checar o Redis antes do DB, com fallback para DB em caso de miss. |

---

## 6. Módulo: AI Assistant

### RF — Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-AI-01 | O sistema deve expor endpoint POST /ai/chat para conversa com IA sobre investimentos. |
| RF-AI-02 | A IA deve ter acesso ao contexto da carteira do usuário (posições, rentabilidade, ativos). |
| RF-AI-03 | A IA deve poder consultar dados históricos de ativos para responder perguntas sobre performance. |
| RF-AI-04 | A IA deve poder consultar notícias recentes relacionadas aos ativos da carteira do usuário. |
| RF-AI-05 | A IA deve responder perguntas sobre: fundamentos de ativos, comparação entre ativos, análise de carteira, interpretação de indicadores (P/L, DY, ROE, etc.). |
| RF-AI-06 | O sistema deve armazenar histórico de conversas por usuário com paginação. |
| RF-AI-07 | O sistema deve limitar conversas por plano: Free = 0, Pro = 20 mensagens/dia, Premium = ilimitado. |
| RF-AI-08 | O sistema deve expor endpoint GET /ai/conversations com histórico de chats. |
| RF-AI-09 | A IA deve incluir disclaimer automático que não constitui recomendação de investimento. |
| RF-AI-10 | O sistema deve suportar streaming de resposta via SSE (Server-Sent Events). |

### RNF — Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF-AI-01 | Contexto da carteira injetado no prompt deve ser buscado do Redis (nunca diretamente do DB). |
| RNF-AI-02 | Rate limit de mensagens deve ser controlado via Redis counter com TTL de 24h (sliding window). |
| RNF-AI-03 | Respostas da IA não devem ser cacheadas — cada conversa é única. |
| RNF-AI-04 | O provider de IA deve ser abstraído via interface `AiProviderService` para facilitar troca (OpenAI / Anthropic / Gemini). |
| RNF-AI-05 | Timeout de resposta da IA: 30s. Em caso de timeout, retornar erro amigável sem quebrar o stream. |

---

## 7. Módulo: Market Data (Histórico)

### RF — Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-MKT-01 | O sistema deve armazenar histórico diário de preços (OHLCV) por ativo desde a data de listagem. |
| RF-MKT-02 | O sistema deve executar cron de coleta de dados históricos diariamente após o fechamento do mercado (19:00). |
| RF-MKT-03 | O sistema deve expor endpoint GET /market/:ticker/history com range (1D, 1W, 1M, 3M, 6M, 1Y, 5Y, MAX). |
| RF-MKT-04 | O sistema deve expor endpoint GET /market/:ticker/indicators com indicadores fundamentalistas: P/L, P/VP, DY, ROE, ROIC, EV/EBITDA. |
| RF-MKT-05 | O sistema deve expor endpoint GET /market/:ticker/dividends com histórico de dividendos e JCP. |
| RF-MKT-06 | O sistema deve expor endpoint GET /market/movers com maiores altas e baixas do dia. |
| RF-MKT-07 | O sistema deve expor endpoint GET /market/indices com dados de IBOVESPA, IFIX, S&P500, Nasdaq, BTC. |
| RF-MKT-08 | O sistema deve armazenar splits e agrupamentos de ações para ajuste retroativo de preços. |
| RF-MKT-09 | O sistema deve disponibilizar dados históricos de até 1 ano para usuários Pro e histórico completo para Premium. |

### RNF — Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF-MKT-01 | Séries históricas de curto prazo (1D, 1W) devem ser cacheadas no Redis com TTL 5min. |
| RNF-MKT-02 | Séries de longo prazo (1Y, 5Y, MAX) devem ser cacheadas com TTL 1h. |
| RNF-MKT-03 | O endpoint de histórico deve suportar compressão gzip para reduzir payload. |
| RNF-MKT-04 | Dados OHLCV devem ser particionados por ano no PostgreSQL (table partitioning) para performance em queries longas. |
| RNF-MKT-05 | Indicadores fundamentalistas devem ter cache Redis (TTL 24h) e atualização diária via cron. |

---

## 8. Requisitos Não Funcionais Globais

| ID | Categoria | Requisito |
|----|-----------|-----------|
| RNF-G-01 | Performance | Todos os endpoints protegidos devem responder em ≤ 300ms no percentil P95. |
| RNF-G-02 | Cache | Redis deve ser a camada de leitura primária para dados de alta frequência; PostgreSQL é a fonte da verdade. |
| RNF-G-03 | Segurança | Todas as rotas privadas devem exigir JWT válido via `JwtAuthGuard`. |
| RNF-G-04 | Segurança | CORS configurado para aceitar apenas origens do frontend Gaius. |
| RNF-G-05 | Segurança | Helmet.js ativo em todas as rotas (headers de segurança HTTP). |
| RNF-G-06 | Segurança | Variáveis sensíveis (secrets, API keys) apenas via `.env` com validação via `@nestjs/config` + Joi/Zod. |
| RNF-G-07 | Observabilidade | Logs estruturados em JSON (Winston) com níveis: error, warn, info, debug. |
| RNF-G-08 | Observabilidade | Métricas de latência e throughput por endpoint via Prometheus + `/metrics`. |
| RNF-G-09 | Resiliência | Circuit breaker para chamadas a APIs externas (cotações, notícias, IA) com fallback. |
| RNF-G-10 | Resiliência | Todas as filas BullMQ devem ter DLQ (dead-letter queue) para reprocessamento manual. |
| RNF-G-11 | Escalabilidade | A API deve ser stateless para permitir múltiplas instâncias atrás de load balancer. |
| RNF-G-12 | Banco de dados | Todas as migrations devem ser versionadas via Prisma Migrate e executadas via CI antes do deploy. |
| RNF-G-13 | Testes | Cobertura mínima de 70% nos services críticos (AuthService, WalletService, AssetService). |
| RNF-G-14 | Documentação | Todos os endpoints devem ter decorators `@ApiOperation` e `@ApiResponse` (Swagger/OpenAPI). |
| RNF-G-15 | Rate limiting | Rate limit global: 100 req/min por usuário autenticado via `@nestjs/throttler` + Redis store. |

---

## 9. Estratégia Redis — Visão Consolidada

| Chave | TTL | Módulo | Descrição |
|-------|-----|--------|-----------|
| `user:{id}` | 5min | Users | Dados do perfil do usuário |
| `token:blacklist:{jti}` | resto do TTL do AT | Users | Tokens invalidados (logout) |
| `refresh_token:{userId}` | 7d | Users | Refresh token ativo |
| `rate:login:{ip}` | 15min | Users | Contador de tentativas de login |
| `rate:ai:{userId}` | 24h | AI | Contador de mensagens IA por dia |
| `asset:{ticker}` | 60s | Assets | Cotação em tempo real (BR) |
| `asset:crypto:{symbol}` | 30s | Assets | Cotação de cripto |
| `asset:search:{query}` | 5min | Assets | Cache de busca de ativos |
| `exchange_rate:{from}:{to}` | 30min | Assets | Taxa de câmbio atual |
| `wallet:{id}` | 30s | Wallet | Snapshot da carteira com cotações |
| `subscription:{userId}` | 1h | Subscriptions | Plano e limites do usuário |
| `news:feed:page:{page}` | 5min | News | Feed paginado de notícias |
| `news:asset:{ticker}` | 5min | News | Notícias por ativo |
| `market:{ticker}:1D` | 5min | Market | Histórico intraday |
| `market:{ticker}:1Y` | 1h | Market | Histórico anual |
| `market:fundamentals:{ticker}` | 24h | Market | Indicadores fundamentalistas |
| `market:movers` | 5min | Market | Maiores altas e baixas |
| `market:indices` | 60s | Market | Índices de mercado |

---

## 10. Prisma Schema — Entidades por módulo

```
Users         → id, email, name, passwordHash, avatarUrl, preferredCurrency, plan, status, createdAt, lastLoginAt
Asset         → id, ticker, name, type, exchange, currency, sector, country, logoUrl, isActive, searchVector
AssetPrice    → id, assetId, open, high, low, close, volume, date  [particionado por ano]
AssetFundamentals → id, assetId, pe, pb, dy, roe, roic, evEbitda, updatedAt
Dividend      → id, assetId, type (DIV/JCP), value, exDate, payDate
Wallet        → id, userId, name, description, isArchived, createdAt
WalletAsset   → id, walletId, assetId, quantity, avgPrice, [calculado: currentValue, return%]
Transaction   → id, walletId, assetId, type (BUY/SELL), quantity, price, fee, date
News          → id, title, summary, url, source, imageUrl, publishedAt, tags[], isActive
NewsAsset     → newsId, assetId  [relação many-to-many]
NewsRead      → userId, newsId, readAt
Subscription  → id, userId, plan, status, stripeSubscriptionId, currentPeriodEnd, trialEndsAt
AiConversation → id, userId, createdAt
AiMessage     → id, conversationId, role (user/assistant), content, createdAt
ExchangeRate  → id, from, to, rate, updatedAt
```

---

## 11. Backlog de Tarefas por Módulo

### 🧑 Users

- [x] Criar schema Prisma: `User`, `UserPreferences`
- [x] Implementar `AuthModule` com Passport JWT strategy
- [x] Endpoint POST /auth/register com validação DTO (class-validator)
- [ ] Endpoint POST /auth/login com emissão de AT + RT
- [ ] Endpoint POST /auth/refresh com rotação de refresh token
- [ ] Endpoint POST /auth/logout com blacklist no Redis
- [ ] Endpoint POST /auth/forgot-password com envio de e-mail
- [ ] Endpoint POST /auth/reset-password com validação de token
- [ ] Endpoint GET /users/me
- [ ] Endpoint PATCH /users/me (perfil + preferências)
- [ ] Endpoint DELETE /users/me (soft delete + cascata)
- [ ] `JwtAuthGuard` global com decorator `@Public()` para rotas abertas
- [ ] `@CurrentUser()` decorator para injeção do usuário autenticado
- [ ] Rate limit no login via `ThrottlerModule` + Redis store
- [ ] Testes unitários: AuthService, UsersService

---

### 📈 Assets

- [ ] Criar schema Prisma: `Asset`, `AssetPrice`, `AssetFundamentals`, `Dividend`, `ExchangeRate`
- [ ] Configurar índice full-text tsvector no PostgreSQL via migration raw SQL
- [ ] Implementar `AssetProviderService` (interface + adapters: brapi, Yahoo Finance, CoinGecko)
- [ ] Cron diário (02:00): sincronizar catálogo BR (ações, FIIs, ETFs) via brapi.dev
- [ ] Cron diário (02:30): sincronizar catálogo US stocks + ETFs via Yahoo Finance
- [ ] Cron a cada 30min: atualizar taxa de câmbio BRL/USD/EUR (AwesomeAPI ou ExchangeRate-API)
- [ ] Worker de cotações BR: polling a cada 60s durante horário de mercado → salvar no Redis
- [ ] Worker de cotações US: polling a cada 300s → salvar no Redis
- [ ] Worker de cotações Cripto: polling CoinGecko a cada 30s → salvar no Redis
- [ ] Endpoint GET /assets/search?q= com full-text + cache Redis
- [ ] Endpoint GET /assets/:ticker (dados completos)
- [ ] Endpoint GET /assets com filtros e paginação
- [ ] Circuit breaker para providers externos (opossum ou nestjs-opossum)
- [ ] Fallback automático entre providers (brapi → HG Finance → mock)
- [ ] Testes unitários: AssetProviderService, CacheService

---

### 💼 Wallet

- [ ] Criar schema Prisma: `Wallet`, `WalletAsset`, `Transaction`
- [ ] Endpoint POST /wallets (criar carteira)
- [ ] Endpoint GET /wallets (listar carteiras do usuário)
- [ ] Endpoint GET /wallets/:id (posições + rentabilidade calculada)
- [ ] Endpoint PATCH /wallets/:id (editar nome/descrição)
- [ ] Endpoint DELETE /wallets/:id (soft delete)
- [ ] Endpoint POST /wallets/:id/transactions (registrar compra/venda)
- [ ] Endpoint GET /wallets/:id/transactions (histórico paginado cursor-based)
- [ ] Endpoint GET /wallets/:id/summary (alocação por tipo, dados para gráfico)
- [ ] Endpoint GET /wallets/consolidated (união de todas as carteiras)
- [ ] Lógica de cálculo: preço médio ponderado, rentabilidade, variação diária
- [ ] Lógica de conversão de moeda (BRL/USD/EUR) usando Redis rates
- [ ] Cache Redis do snapshot da carteira com invalidação por transação
- [ ] Job assíncrono BullMQ: importação de CSV (formato B3 CEI)
- [ ] Endpoint POST /wallets/import e GET /wallets/import/:jobId (status)
- [ ] `SubscriptionGuard` + `@RequiresPlan()` decorator para limite de carteiras
- [ ] Testes unitários: WalletService (cálculos de rentabilidade)

---

### 📰 News

- [ ] Criar schema Prisma: `News`, `NewsAsset`, `NewsRead`
- [ ] Implementar `RssParserService` (fontes: G1 Economia, Valor, InfoMoney, Investing BR, Reuters Brasil)
- [ ] Cron de coleta: 15min (09:00–18:30) e 60min (fora do horário)
- [ ] Implementar deduplicação por URL canônica
- [ ] Implementar deduplicação por similaridade de título (distância Levenshtein)
- [ ] Job assíncrono: associação de tickers mencionados nas notícias
- [ ] Job assíncrono: categorização automática por tags via regex/keywords
- [ ] Endpoint GET /news com paginação cursor-based + filtros
- [ ] Endpoint GET /news/:id
- [ ] Endpoint GET /news/by-asset/:ticker
- [ ] Endpoint GET /news/feed (personalizado para carteira do usuário)
- [ ] Endpoint POST /news/:id/read (marcar como lida)
- [ ] Cache Redis dos feeds com invalidação a cada coleta
- [ ] Monitoramento de fontes offline + alerta
- [ ] Testes unitários: NewsService (deduplicação, associação de tickers)

---

### 💳 Subscriptions

- [ ] Criar schema Prisma: `Subscription`
- [ ] Configurar Stripe SDK com webhook secret via env
- [ ] Endpoint POST /subscriptions/checkout (criar sessão Stripe Checkout)
- [ ] Endpoint POST /subscriptions/portal (portal do cliente Stripe)
- [ ] Endpoint GET /subscriptions/me
- [ ] Webhook handler POST /webhooks/stripe (checkout.session.completed, invoice.paid, customer.subscription.deleted)
- [ ] Validação de assinatura Stripe nos webhooks
- [ ] `SubscriptionGuard` e decorator `@RequiresPlan('PRO' | 'PREMIUM')`
- [ ] Cache Redis do plano ativo com invalidação no webhook
- [ ] Cron diário: checar assinaturas vencendo em 3 dias → disparar e-mail de aviso
- [ ] Integração B3 / Open Finance (plano Premium): importar posições automaticamente
- [ ] Testes de integração: fluxo de checkout e webhook

---

### 🤖 AI Assistant

- [ ] Implementar `AiProviderService` com interface abstrata (adapter OpenAI / Anthropic)
- [ ] Criar schema Prisma: `AiConversation`, `AiMessage`
- [ ] Endpoint POST /ai/chat com streaming SSE
- [ ] Context builder: montar prompt com dados da carteira do usuário (do Redis)
- [ ] Context builder: incluir notícias recentes dos ativos da carteira
- [ ] Rate limit por usuário/dia via Redis counter + guard `AiRateLimitGuard`
- [ ] Endpoint GET /ai/conversations
- [ ] Endpoint GET /ai/conversations/:id/messages
- [ ] Disclaimer automático nas respostas
- [ ] Timeout + tratamento de erro no stream
- [ ] Testes unitários: ContextBuilderService, AiRateLimitGuard

---

### 📊 Market Data

- [ ] Criar schema Prisma: `AssetPrice` (particionado), `AssetFundamentals`, `Dividend`
- [ ] Cron pós-fechamento (19:00): coletar OHLCV diário para todos os ativos ativos
- [ ] Cron semanal: atualizar indicadores fundamentalistas (P/L, DY, ROE, etc.)
- [ ] Cron diário: atualizar histórico de dividendos/JCP
- [ ] Endpoint GET /market/:ticker/history?range=
- [ ] Endpoint GET /market/:ticker/indicators
- [ ] Endpoint GET /market/:ticker/dividends
- [ ] Endpoint GET /market/movers (altas e baixas do dia)
- [ ] Endpoint GET /market/indices (IBOV, IFIX, S&P500, Nasdaq, BTC)
- [ ] Cache Redis por range de histórico com TTL diferenciado
- [ ] Lógica de ajuste retroativo por splits/grupamentos
- [ ] Gate de acesso por plano (1Y = Pro, MAX = Premium)
- [ ] Testes: MarketDataService (ajuste por split, cálculo de range)

---

*Documento gerado para o projeto Gaius — revisão recomendada antes de iniciar cada sprint.*
