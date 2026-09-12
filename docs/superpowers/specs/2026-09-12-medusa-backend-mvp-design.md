# Medusa Backend MVP — Chúc Cà Mau Yến Sào

**Date:** 2026-09-12  
**Status:** Approved (conversation) — awaiting written-spec review  
**Storefront:** `chuccamau-yensao` (Next.js 15 + `@medusajs/js-sdk` v2)  
**Backend repo:** `chuccamau-yensao-backend` (this repo)

## Goal

Stand up a Medusa v2 + Postgres backend so the existing storefront can list catalog data, manage cart, and complete a COD/manual checkout end-to-end locally.

## Non-goals (MVP)

- Online payment gateways (VNPay, MoMo, Stripe)
- SendGrid / order email automation
- Custom Medusa modules or Store API shape changes
- Blog, policy pages, or CMS (remain in Next.js)
- Cloud deploy / production hardening
- Rewriting storefront `src/lib/data/*` (must keep Medusa Store API contract)

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Stack | Medusa v2 + Postgres |
| Scope | Region VN, categories, products + seed, cart, checkout via `pp_system_default` |
| Layout | Sibling repo `chuccamau-yensao-backend` |
| Seed source | Frontend JSON under `chuccamau-yensao/src/data/` |
| Local infra | Docker Compose Postgres + official Medusa app scaffold |

## Architecture

```
Browser → Next.js storefront (:3000)
            │  JS SDK + publishable API key
            ▼
         Medusa Store API (:9000)
            │
            ▼
         Postgres (Docker :5432)

Medusa Admin (local) — verify catalog + orders after seed
```

- `STORE_CORS` / related CORS env includes `http://localhost:3000`
- Storefront env: `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000` and a real `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` from this backend
- Default country code remains `vn`

## Components

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `docker-compose.yml` | Postgres service | Docker |
| Medusa app (default modules) | Store + Admin APIs, migrations | Postgres, env |
| `src/scripts/seed.ts` + `seed/data/*.json` | Commerce foundation + catalog | Medusa APIs / workflows |
| `.env.template` + README | Local runbook, CORS, keys | — |
| Storefront `.env*` (keys/URL only) | Point UI at this backend | Seeded backend |

No custom Medusa modules in MVP.

## Commerce foundation (seed)

Create once (idempotent on re-run):

1. Region **Vietnam**, currency **vnd**, country **vn**
2. Default sales channel + stock location (VN)
3. One flat shipping option (e.g. “Giao tiêu chuẩn”) — storefront selects the first option
4. Payment provider **`pp_system_default`** (matches `updateCartAndTakeOrderFlow` in storefront)

## Catalog seed mapping

Source files (copied into `seed/data/`):

- `product-categories.json` (6 categories)
- `products/*.json` (6 files: yến chưng, set quà, cháo/súp, tinh chế, thô, topping)

| Frontend JSON | Medusa |
|---------------|--------|
| category `slug` / `name` | Product category `handle` / `name` |
| product `name` / `slug` / `description` | `title` / `handle` / `description` |
| `ingredient[]` | `metadata.ingredient` as JSON string (storefront adapter already `JSON.parse`s) |
| `specs[].key` + values | Product options + option values |
| `variants[]` (sku, price, stock, specs) | Variants + VND prices + inventory levels |
| variant thumbnail paths | Product images; `metadata[sku]` = image rank (1-based) for `getProductVariantThumbnail` |
| `isNew`, `totalSold` (optional) | Product `metadata` |

Image URLs stay as storefront-relative paths (`/images/...`). MVP does not upload binary assets into Medusa file storage.

Seed is **idempotent** by product `handle` and variant `sku`: re-run must not duplicate catalog rows.

## Storefront checkout flow (contract to satisfy)

1. `GET /store/regions` → region for `vn`
2. `GET /store/product-categories` + `GET /store/products`
3. Create cart, add line items
4. Set shipping address + cart metadata (`payment_method`, `shipping_method`, optional invoice fields, `note`)
5. `GET /store/shipping-options?cart_id=` → use first option
6. Initiate payment session with `provider_id: pp_system_default`
7. Complete cart → order created

## Error handling

- Seed aborts early on missing foundation (region/currency/channel) or invalid product JSON (missing `slug` / `variants`); log file + handle, no partial silent catalog
- Rely on Medusa HTTP errors; no custom error envelope (storefront already maps Medusa errors)
- Misconfigured CORS or publishable key documented in README checklist
- Variant `stock` from JSON maps to inventory; out-of-stock rejects add-to-cart via Medusa rules

## Acceptance criteria

1. `docker compose up` → Postgres healthy
2. Migrations + seed succeed; second seed run does not duplicate products
3. Smoke checks: regions include `vn`; ≥ 6 categories; products count > 0; shipping options exist; payment providers include `pp_system_default`
4. Manual: storefront lists products by category, product detail works, COD checkout completes; Admin shows the order

## Out of scope follow-ups

- VNPay / MoMo providers and storefront payment result pages
- Order notification email (SendGrid already used for contact/quote on storefront)
- Production deploy (Render/Railway/etc.), secrets management, backups
- Richer shipping (WORKING_HOURS as separate fulfillment option) beyond metadata passthrough

## Implementation notes (for planning)

- Scaffold with current Medusa v2 create/starter matching storefront SDK major (`@medusajs/js-sdk` ^2.8.x)
- Prefer Medusa seed/workflow APIs over raw SQL
- Keep README as the single local onboarding path: clone → docker → env → migrate → seed → run → wire storefront keys
