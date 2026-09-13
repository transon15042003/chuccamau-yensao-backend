# Medusa backend on Render (Phase 6)

## Blueprint (nhanh nhất)
Repo có `render.yaml` — Dashboard → **New → Blueprint** → chọn repo/branch `feat/medusa-backend-mvp`.  
Tạo Postgres `chuccamau-yensao-db` + Web Service; điền các env `sync: false`.

## Service type (thủ công)
Web Service · Node · region Singapore (or nearest)

## Build
```
corepack enable && corepack yarn install && corepack yarn build
```

## Start
```
corepack yarn medusa db:migrate && medusa start
```
Medusa must listen `0.0.0.0:$PORT` (framework default with `PORT` env).

## Required env
| Key | Notes |
|-----|--------|
| `DATABASE_URL` | Supabase/Neon Postgres connection string (`?sslmode=require`) |
| `JWT_SECRET` | long random |
| `COOKIE_SECRET` | long random |
| `STORE_CORS` | `https://<storefront-domain>` |
| `ADMIN_CORS` | `https://<backend-domain>` |
| `AUTH_CORS` | storefront + backend origins |
| `STORE_URL` / `STORE_PUBLIC_URL` | storefront public URL |
| `MEDUSA_BACKEND_URL` | this service public URL |
| `MEDUSA_FILE_URL` | `$MEDUSA_BACKEND_URL/static` |
| `PAYMENT_MOCK` | `0` on prod |
| `SENDGRID_*` / `ORDER_NOTIFY_OWNER_EMAIL` | if mail on |
| `VNPAY_*` / `MOMO_*` | if online pay on |

## After first deploy
1. Open `https://<service>/app` · create admin: `medusa user` via Render shell, or seed script.
2. `yarn seed` once (or run migrate+seed job).
3. Copy publishable key into storefront env.
4. Re-run `sync:catalog` / `sync:inventory` if catalog empty.

## Free tier notes
- Web spins down after idle (~15 min).
- Free Postgres: **1 per workspace**, **expires after 30 days** (upgrade or lose data).
- Ephemeral disk: do **not** rely on `static/` uploads — use `STORE_PUBLIC_URL` or S3.
- Managed Postgres preferred over disk SQLite.
