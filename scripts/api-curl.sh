#!/usr/bin/env bash
# =============================================================================
# Gaius API — curls de referência para o frontend
#
# Base:    http://localhost:8080
# Swagger: http://localhost:8080/docs
# Arquivo: scripts/api-curl.sh
#
# Como usar: copie o curl que precisa (os comandos estão comentados de propósito).
# Substitua as variáveis abaixo antes de colar no terminal.
#
# Fluxo no front:
#   1. POST /auth/register ou /auth/login → guardar accessToken + refreshToken
#   2. Header: Authorization: Bearer <accessToken>
#   3. Assets = público | Users + Wallets + logout = Bearer
#
# Enums:
#   PreferredCurrency: BRL | USD | EUR
#   CatalogAssetType:  ACAO_BR | FII | ETF_BR | STOCK_US | ETF_US | ETF_INTL | CRYPTO
#   TransactionType:   BUY | SELL
# =============================================================================

cat <<'EOF'
Variáveis de exemplo:
  BASE_URL=http://localhost:8080
  ACCESS_TOKEN=...
  REFRESH_TOKEN=...
  WALLET_ID=uuid-da-carteira
  ASSET_ID=uuid-do-ativo   # NÃO use ticker aqui — pegue o id em GET /assets
  TICKER=PETR4

──────────────────────────────────────────────────────────────────────────────
AUTH
──────────────────────────────────────────────────────────────────────────────

# POST /auth/register  (público)  → 201
curl -sS -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "password": "senha12345"
  }'

# POST /auth/login  (público)  → 200  | rate limit: 10 tentativas / 15min por IP
curl -sS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@example.com",
    "password": "senha12345"
  }'
# Response traz accessToken + refreshToken

# POST /auth/google  (público)  → 200  | troca idToken Google por JWT Gaius
curl -sS -X POST "$BASE_URL/auth/google" \
  -H "Content-Type: application/json" \
  -d '{"idToken":"GOOGLE_ID_TOKEN"}'

# POST /auth/refresh  (público)  → 200
curl -sS -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"SEU_REFRESH_TOKEN"}'

# POST /auth/logout  (Bearer)  → 200  | refreshToken no body é opcional
curl -sS -X POST "$BASE_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d '{"refreshToken":"SEU_REFRESH_TOKEN"}'

# POST /auth/forgot-password  (público)  → 200  | sempre {"ok":true}
curl -sS -X POST "$BASE_URL/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@example.com"}'

# POST /auth/reset-password  (público)  → 200
curl -sS -X POST "$BASE_URL/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TOKEN_DO_EMAIL",
    "password": "novaSenha12345"
  }'

──────────────────────────────────────────────────────────────────────────────
USERS (Bearer)
──────────────────────────────────────────────────────────────────────────────

# GET /users/me  → 200
curl -sS "$BASE_URL/users/me" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"

# PATCH /users/me  → 200  | todos os campos opcionais
curl -sS -X PATCH "$BASE_URL/users/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d '{
    "name": "Maria Silva",
    "avatarUrl": "https://cdn.example.com/avatar.png",
    "preferredCurrency": "BRL",
    "theme": "dark",
    "defaultCurrency": "BRL",
    "notificationsEnabled": true
  }'

# DELETE /users/me  → 204  (soft delete)
curl -sS -X DELETE "$BASE_URL/users/me" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"

──────────────────────────────────────────────────────────────────────────────
ASSETS (público)
──────────────────────────────────────────────────────────────────────────────

# GET /assets  → listar (filtros/paginação opcionais)
curl -sS -G "$BASE_URL/assets" \
  --data-urlencode "type=ACAO_BR" \
  --data-urlencode "exchange=B3" \
  --data-urlencode "sector=Financeiro" \
  --data-urlencode "country=BR" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=20"

# GET /assets/search  → q obrigatório
curl -sS -G "$BASE_URL/assets/search" \
  --data-urlencode "q=PETR" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=20"

# GET /assets/:ticker
curl -sS "$BASE_URL/assets/PETR4"

# GET /assets/:ticker/quote  → cache Redis (404 se ainda não refreshou)
curl -sS "$BASE_URL/assets/PETR4/quote"

# POST /assets/:ticker/quote/refresh
curl -sS -X POST "$BASE_URL/assets/PETR4/quote/refresh"

# POST /assets/:ticker/sync
curl -sS -X POST "$BASE_URL/assets/PETR4/sync"

# POST /assets/quotes/refresh  → lote (~30)
curl -sS -X POST "$BASE_URL/assets/quotes/refresh"

# POST /assets/sync  → catálogo completo (pesado)
curl -sS -X POST "$BASE_URL/assets/sync"

──────────────────────────────────────────────────────────────────────────────
WALLETS (Bearer)
──────────────────────────────────────────────────────────────────────────────

# POST /wallets  → criar
curl -sS -X POST "$BASE_URL/wallets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d '{
    "name": "Carteira principal",
    "description": "Ações BR de longo prazo"
  }'

# GET /wallets
curl -sS "$BASE_URL/wallets" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"

# GET /wallets/consolidated
curl -sS "$BASE_URL/wallets/consolidated" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"

# GET /wallets/:id
curl -sS "$BASE_URL/wallets/UUID_DA_CARTEIRA" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"

# GET /wallets/:id/summary  → alocação por tipo (pizza)
curl -sS "$BASE_URL/wallets/UUID_DA_CARTEIRA/summary" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"

# PATCH /wallets/:id
curl -sS -X PATCH "$BASE_URL/wallets/UUID_DA_CARTEIRA" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d '{
    "name": "Carteira principal",
    "description": "Atualizada"
  }'

# POST /wallets/:id/transactions  → BUY | SELL
# assetId = UUID do catálogo (GET /assets), NÃO o ticker
curl -sS -X POST "$BASE_URL/wallets/UUID_DA_CARTEIRA/transactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d '{
    "assetId": "UUID_DO_ATIVO",
    "type": "BUY",
    "quantity": 100,
    "price": 32.5,
    "fee": 0,
    "date": "2026-05-26T12:00:00.000Z"
  }'

# GET /wallets/:id/transactions  → cursor pagination
curl -sS -G "$BASE_URL/wallets/UUID_DA_CARTEIRA/transactions" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  --data-urlencode "limit=20"
# próxima página: --data-urlencode "cursor=<id_da_ultima_tx>"

# DELETE /wallets/:id  → soft delete  → 204
curl -sS -X DELETE "$BASE_URL/wallets/UUID_DA_CARTEIRA" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"

──────────────────────────────────────────────────────────────────────────────
ÍNDICE
──────────────────────────────────────────────────────────────────────────────
POST   /auth/register                 público
POST   /auth/login                    público
POST   /auth/google                   público
POST   /auth/refresh                  público
POST   /auth/logout                   Bearer
POST   /auth/forgot-password          público
POST   /auth/reset-password           público
GET    /users/me                      Bearer
PATCH  /users/me                      Bearer
DELETE /users/me                      Bearer
GET    /assets                        público
GET    /assets/search?q=              público
GET    /assets/:ticker                público
GET    /assets/:ticker/quote          público
POST   /assets/:ticker/quote/refresh  público
POST   /assets/:ticker/sync           público
POST   /assets/quotes/refresh         público
POST   /assets/sync                   público
POST   /wallets                       Bearer
GET    /wallets                       Bearer
GET    /wallets/consolidated          Bearer
GET    /wallets/:id                   Bearer
GET    /wallets/:id/summary           Bearer
PATCH  /wallets/:id                   Bearer
DELETE /wallets/:id                   Bearer
POST   /wallets/:id/transactions      Bearer
GET    /wallets/:id/transactions      Bearer
EOF
