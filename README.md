# Chúc Cà Mau Yến Sào — Medusa backend

Medusa v2.8.4 + Postgres for the `chuccamau-yensao` storefront.

## Prerequisites

- Node ≥ 20
- Yarn via Corepack (`corepack enable`)
- PostgreSQL (local service **or** Docker Compose below)
- DB role/database: `medusa` / `medusa` (see `scripts/bootstrap-medusa-db.ps1` if needed)

## Deploy (free forever)

Phase 6: **Neon** (Postgres) + **Render Free Web Service** (Medusa) — see [`docs/deploy-free.md`](docs/deploy-free.md).  
Không dùng Render Postgres / Blueprint / Northflank / Supabase cho path này.

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

### Admin (local)

```bash
# already created on this machine; recreate with:
corepack yarn medusa user -e admin@chuccamau.local -p 'LocalDev_ChangeMe1!'

# list orders via API (server must be running)
corepack yarn admin:orders
```

Open `http://localhost:9000/app` and sign in with the same email/password. Change the password after first login.

### Inventory

```bash
corepack yarn sync:inventory   # stock from seed JSON by SKU
corepack yarn verify:stock     # assert DB matches JSON
```

### Catalog & images (Phase 4)

```bash
# .env: STORE_PUBLIC_URL=http://localhost:3000
corepack yarn sync:catalog   # upsert products + collection san-pham-noi-bat
corepack yarn sync:images    # optional: copy FE public/images → Medusa static/
```

After `sync:catalog`, product `images[].url` are absolute (`STORE_PUBLIC_URL` + `/images/...`).  
After `sync:images`, URLs point at Medusa `http://localhost:9000/static/...`.

> Note: OOS at complete is blocked by `src/api/middlewares.ts` — prove with `yarn verify:oos`.

## Checkout COD proof

```bash
corepack yarn dev   # terminal A
PUBLISHABLE_API_KEY=pk_... corepack yarn checkout:cod
```

## Online payment (VNPay + MoMo)

Local mock (no sandbox keys):

```bash
# .env: PAYMENT_MOCK=1
corepack yarn seed   # attaches pp_vnpay_vnpay + pp_momo_momo to VN region
PUBLISHABLE_API_KEY=pk_... corepack yarn checkout:online vnpay
PUBLISHABLE_API_KEY=pk_... corepack yarn checkout:online momo
```

Sandbox: set `VNPAY_*` / `MOMO_*` in `.env`, set `PAYMENT_MOCK=0`, restart. IPN:
- VNPay → `POST/GET /hooks/vnpay/ipn`
- MoMo → `POST /hooks/momo/ipn`

Storefront radios COD / VNPay / MoMo; online redirects to `payUrl` then `/payment/mock` (mock) or gateway return pages.

If add-to-cart fails with sales-channel/stock errors:

```bash
corepack yarn fix:inventory
```

## Order emails (Phase 3)

Set in backend `.env` (restart `yarn dev`):

```bash
SENDGRID_API_KEY=SG....
SENDGRID_SENDER_EMAIL=noreply@your-verified-domain.com
ORDER_NOTIFY_OWNER_EMAIL=owner@shop.com,backup@shop.com
```

On every `order.placed` (COD + online), subscriber `src/subscribers/order-placed.ts` sends HTML+text mail to owner and customer. Without API key, it only logs skip.

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
