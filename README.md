# Chúc Cà Mau Yến Sào — Medusa backend

Medusa v2.8.4 + Postgres for the `chuccamau-yensao` storefront.

## Prerequisites

- Node ≥ 20
- Yarn via Corepack (`corepack enable`)
- PostgreSQL (local service **or** Docker Compose below)
- DB role/database: `medusa` / `medusa` (see `scripts/bootstrap-medusa-db.ps1` if needed)

## Quick start

```bash
# 1) Postgres (pick one)
docker compose up -d
# or use local PostgreSQL 18 with DATABASE_URL below

# 2) Env
cp .env.template .env
# DATABASE_URL=postgres://medusa:medusa@127.0.0.1:5432/medusa

# 3) Install + migrate + seed
corepack yarn install
corepack yarn medusa db:migrate
corepack yarn seed
# Copy the publishable key printed in seed logs (pk_...)

# 4) Dev server
corepack yarn dev
# Store API http://localhost:9000  Admin http://localhost:9000/app
```

## Checkout COD proof

```bash
corepack yarn dev   # terminal A
PUBLISHABLE_API_KEY=pk_... corepack yarn checkout:cod
```

If add-to-cart fails with sales-channel/stock errors:

```bash
corepack yarn fix:inventory
```

## Smoke check

```bash
# terminal A
corepack yarn dev

# terminal B
PUBLISHABLE_API_KEY=pk_... corepack yarn smoke
```

Expect: `smoke ok` with ≥6 categories and products > 0; region `vn`; payment `pp_system_default`.

## Storefront wiring

In `chuccamau-yensao` (prefer `.env.local` so remote `.env.dev` stays untouched):

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<paste pk_ from seed>
NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=vn
```

## Troubleshooting

- **CORS / 401**: check `STORE_CORS=http://localhost:3000` and publishable key
- **DB auth failed**: ensure role `medusa` exists; run bootstrap script elevated if needed
- **Medusa restarts in a loop**: do not write logs under the project while `medusa develop` is running (file watcher)
- **Seed twice**: safe — skips existing categories/products by handle

## Notes

- Catalog seed reads `seed/data/` (copied from storefront JSON)
- Image URLs stay storefront-relative (`/images/...`)
- Payment MVP: `pp_system_default` (COD/manual)
