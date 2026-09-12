# Medusa Backend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a local Medusa v2 + Postgres backend that serves the existing `chuccamau-yensao` storefront catalog and completes COD checkout via `pp_system_default`.

**Architecture:** Sibling repo scaffolded from Medusa starter; Docker Postgres; idempotent `seed.ts` builds VN commerce foundation then imports frontend JSON catalog (6 categories, ~20 products, ~64 variants) through a pure mapper; storefront only gets URL + publishable key updates.

**Tech Stack:** Medusa v2 (align with storefront `@medusajs/js-sdk` ^2.8.x), Postgres 16 (Docker), Node ≥ 20, TypeScript, Jest (Medusa starter unit harness).

**Spec:** `docs/superpowers/specs/2026-09-12-medusa-backend-mvp-design.md`

## Global Constraints

- No custom Medusa modules; no VNPay/MoMo; no SendGrid order mail; no cloud deploy.
- Do not rewrite storefront `src/lib/data/*`; keep Store API contract.
- Currency default: `vnd`. Region country: `vn`. Payment provider id: `pp_system_default`.
- Seed source of truth: copy of `chuccamau-yensao/src/data/**` into `seed/data/`.
- Image URLs remain storefront-relative paths (`/images/...`); no binary upload.
- Seed must be idempotent by category `handle`, product `handle`, and skip re-create when already present.
- Prefer Medusa workflows (`createProductsWorkflow`, etc.) over raw SQL.
- Preserve existing `docs/` when scaffolding into this non-empty repo.

---

## File Structure (target)

| Path | Responsibility |
|------|----------------|
| `docker-compose.yml` | Postgres 16 only |
| `.env` / `.env.template` | `DATABASE_URL`, CORS, secrets, admin |
| `medusa-config.ts` | Medusa modules + DB (from scaffold; CORS via env) |
| `package.json` | scripts: `dev`, `seed`, `smoke` |
| `seed/data/product-categories.json` | Copied categories |
| `seed/data/products/*.json` | Copied product files (6) |
| `src/lib/seed/types.ts` | Frontend JSON types for seed |
| `src/lib/seed/map-product.ts` | Pure JSON → Medusa product input |
| `src/lib/seed/map-product.test.ts` | Unit tests for mapper |
| `src/lib/seed/load-catalog.ts` | Load + validate JSON from `seed/data` |
| `src/lib/seed/load-catalog.test.ts` | Validation tests |
| `src/scripts/seed.ts` | Foundation + catalog seed entry (`medusa exec`) |
| `scripts/smoke-store.mjs` | HTTP smoke against Store API |
| `README.md` | Local runbook + storefront env checklist |

---

### Task 1: Scaffold Medusa app + Postgres Docker

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.template`
- Create: `.gitignore` (if missing from scaffold)
- Modify: preserve `docs/**` already in repo
- Produce: runnable Medusa app at repo root (`package.json`, `medusa-config.ts`, `src/`)

**Interfaces:**
- Consumes: empty/working tree with `docs/` only (+ git)
- Produces: `pnpm`/`npm`/`yarn` scripts `dev`, `build`, `seed`; Postgres at `localhost:5432`; Medusa default port `9000`

- [ ] **Step 1: Scaffold into a temp folder then merge (repo is non-empty)**

```bash
cd /c/Users/trans/OneDrive/Desktop/GitHub
npx create-medusa-app@latest chuccamau-yensao-backend-tmp \
  --db-url "postgres://medusa:medusa@localhost:5432/medusa" \
  --skip-db \
  --no-browser || true
```

If the CLI flags differ on the installed version, use interactive create with **Postgres**, skip seed demo when asked, then:

```bash
# Copy scaffold files into existing repo without deleting docs/
rsync -a --exclude '.git' --exclude 'docs' \
  chuccamau-yensao-backend-tmp/ chuccamau-yensao-backend/
rm -rf chuccamau-yensao-backend-tmp
cd chuccamau-yensao-backend
```

Ensure Medusa packages are **v2.x** matching storefront major (`2.8.x` preferred).

- [ ] **Step 2: Add Docker Compose for Postgres only**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: medusa
      POSTGRES_PASSWORD: medusa
      POSTGRES_DB: medusa
    volumes:
      - medusa_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U medusa -d medusa"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  medusa_pg:
```

- [ ] **Step 3: Write `.env.template` and local `.env`**

```env
DATABASE_URL=postgres://medusa:medusa@localhost:5432/medusa
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:7001,http://localhost:9000
AUTH_CORS=http://localhost:3000,http://localhost:7001,http://localhost:9000
JWT_SECRET=supersecret_jwt_change_me
COOKIE_SECRET=supersecret_cookie_change_me
```

Copy to `.env`. Confirm `medusa-config.ts` reads these env vars (starter default).

- [ ] **Step 4: Start Postgres and migrate**

```bash
docker compose up -d
docker compose ps
# Expected: postgres healthy

# Use the package manager the scaffold chose, e.g.:
npm run db:migrate
# or: npx medusa db:migrate
# or: npx medusa db:setup
```

Expected: migrations succeed, no connection refused.

- [ ] **Step 5: Boot Medusa once**

```bash
npm run dev
```

Expected: listening on `:9000` (or printed port). Hit `http://localhost:9000/health` (or starter health route) → OK. Stop after verify.

- [ ] **Step 6: Commit**

```bash
git add -A
git status
# Do NOT commit .env (secrets). Ensure .gitignore has .env
git commit -m "$(cat <<'EOF'
chore: scaffold Medusa v2 app with Docker Postgres

Add compose, env template, and merge starter into repo while keeping design docs.
EOF
)"
```

---

### Task 2: Catalog JSON types, loader, and product mapper (TDD)

**Files:**
- Create: `src/lib/seed/types.ts`
- Create: `src/lib/seed/load-catalog.ts`
- Create: `src/lib/seed/load-catalog.test.ts`
- Create: `src/lib/seed/map-product.ts`
- Create: `src/lib/seed/map-product.test.ts`
- Create: `seed/data/product-categories.json` (copy)
- Create: `seed/data/products/*.json` (copy 6 files)

**Interfaces:**
- Consumes: frontend-shaped JSON on disk under `seed/data/`
- Produces:
  - `loadCatalog(seedDataDir: string): { categories: SeedCategory[]; products: SeedProduct[] }`
  - `mapSeedProductToMedusaInput(product: SeedProduct, ctx: MapProductContext): CreateProductWorkflowInputItem`
  - Throws `Error` with file/handle context if `slug` missing or `variants` empty

- [ ] **Step 1: Copy seed data from storefront**

```bash
mkdir -p seed/data/products
cp ../chuccamau-yensao/src/data/product-categories.json seed/data/
cp ../chuccamau-yensao/src/data/products/*.json seed/data/products/
ls seed/data/products | wc -l
# Expected: 6
```

- [ ] **Step 2: Write failing tests for loader validation**

Create `src/lib/seed/types.ts`:

```typescript
export type SeedCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SeedProductVariant = {
  sku: string;
  name: string;
  specs: Record<string, string>;
  price: number;
  stock?: number;
  isActive?: boolean;
  thumbnail?: string;
};

export type SeedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  thumbnail: string;
  description: string;
  categories: string[];
  ingredient: string[];
  specs: { key: string; value: string[] }[];
  variants: SeedProductVariant[];
  isNew?: boolean;
  totalSold?: number;
  createdAt?: string;
};
```

Create `src/lib/seed/load-catalog.test.ts` (adjust Jest import style to match starter):

```typescript
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadCatalog } from "./load-catalog";

describe("loadCatalog", () => {
  it("throws when a product is missing slug", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-"));
    fs.mkdirSync(path.join(dir, "products"));
    fs.writeFileSync(
      path.join(dir, "product-categories.json"),
      JSON.stringify([{ id: "c1", name: "A", slug: "a" }])
    );
    fs.writeFileSync(
      path.join(dir, "products", "bad.json"),
      JSON.stringify([
        {
          id: "p1",
          name: "No slug",
          description: "",
          thumbnail: "/x.jpg",
          categories: ["a"],
          ingredient: [],
          specs: [],
          variants: [{ sku: "s", name: "s", specs: {}, price: 1 }],
        },
      ])
    );
    expect(() => loadCatalog(dir)).toThrow(/slug/i);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npm run test:unit -- src/lib/seed/load-catalog.test.ts
# Expected: FAIL — cannot find module ./load-catalog OR loadCatalog undefined
```

- [ ] **Step 4: Implement `load-catalog.ts`**

```typescript
import * as fs from "fs";
import * as path from "path";
import type { SeedCategory, SeedProduct } from "./types";

export function loadCatalog(seedDataDir: string): {
  categories: SeedCategory[];
  products: SeedProduct[];
} {
  const categoriesPath = path.join(seedDataDir, "product-categories.json");
  if (!fs.existsSync(categoriesPath)) {
    throw new Error(`Missing categories file: ${categoriesPath}`);
  }
  const categories = JSON.parse(
    fs.readFileSync(categoriesPath, "utf8")
  ) as SeedCategory[];
  for (const c of categories) {
    if (!c.slug || !c.name) {
      throw new Error(`Invalid category (need name+slug): ${JSON.stringify(c)}`);
    }
  }

  const productsDir = path.join(seedDataDir, "products");
  const files = fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"));
  const products: SeedProduct[] = [];
  for (const file of files) {
    const full = path.join(productsDir, file);
    const batch = JSON.parse(fs.readFileSync(full, "utf8")) as SeedProduct[];
    for (const p of batch) {
      if (!p.slug) {
        throw new Error(`Product missing slug in ${file}: id=${p.id}`);
      }
      if (!p.variants?.length) {
        throw new Error(`Product missing variants in ${file}: handle=${p.slug}`);
      }
      products.push(p);
    }
  }
  return { categories, products };
}
```

- [ ] **Step 5: Run loader test — expect PASS**

```bash
npm run test:unit -- src/lib/seed/load-catalog.test.ts
# Expected: PASS
```

- [ ] **Step 6: Write failing mapper tests**

Create `src/lib/seed/map-product.test.ts`:

```typescript
import { mapSeedProductToMedusaInput } from "./map-product";
import type { SeedProduct } from "./types";

const sample: SeedProduct = {
  id: "chan-yen-tho",
  name: "Chân Yến Thô",
  slug: "chan-yen-tho",
  price: 450000,
  thumbnail: "/images/products/yen-sao-tho/chan-yen-tho-100g.jpg",
  description: "Chân yến thô",
  categories: ["yen-sao-tho"],
  ingredient: ["Nguyên chất 100%"],
  specs: [
    { key: "size", value: ["25g", "50g"] },
    { key: "savour", value: ["chân yến thô"] },
  ],
  variants: [
    {
      sku: "chan-tho-25g",
      name: "Chân yến thô - 25 gram",
      specs: { size: "25g", savour: "chân yến thô" },
      price: 450000,
      stock: 112,
      thumbnail: "/images/products/yen-sao-tho/chan-yen-tho-25g.jpg",
    },
    {
      sku: "chan-tho-50g",
      name: "Chân yến thô - 50 gram",
      specs: { size: "50g", savour: "chân yến thô" },
      price: 900000,
      stock: 45,
      thumbnail: "/images/products/yen-sao-tho/chan-yen-tho-50g.jpg",
    },
  ],
  isNew: false,
  totalSold: 201,
};

describe("mapSeedProductToMedusaInput", () => {
  it("maps handle, VND prices, options, images, and sku metadata ranks", () => {
    const out = mapSeedProductToMedusaInput(sample, {
      categoryIdByHandle: new Map([["yen-sao-tho", "cat_123"]]),
      shippingProfileId: "sp_1",
      salesChannelId: "sc_1",
    });
    expect(out.handle).toBe("chan-yen-tho");
    expect(out.title).toBe("Chân Yến Thô");
    expect(out.category_ids).toEqual(["cat_123"]);
    expect(out.metadata).toMatchObject({
      ingredient: JSON.stringify(["Nguyên chất 100%"]),
      isNew: false,
      totalSold: 201,
      "chan-tho-25g": 1,
      "chan-tho-50g": 2,
    });
    expect(out.images?.map((i) => i.url)).toEqual([
      "/images/products/yen-sao-tho/chan-yen-tho-25g.jpg",
      "/images/products/yen-sao-tho/chan-yen-tho-50g.jpg",
    ]);
    expect(out.options).toEqual([
      { title: "size", values: ["25g", "50g"] },
      { title: "savour", values: ["chân yến thô"] },
    ]);
    expect(out.variants?.[0]).toMatchObject({
      sku: "chan-tho-25g",
      options: { size: "25g", savour: "chân yến thô" },
      prices: [{ amount: 450000, currency_code: "vnd" }],
    });
  });
});
```

- [ ] **Step 7: Run mapper test — expect FAIL**

```bash
npm run test:unit -- src/lib/seed/map-product.test.ts
# Expected: FAIL — module/function missing
```

- [ ] **Step 8: Implement `map-product.ts`**

```typescript
import type { SeedProduct } from "./types";

export type MapProductContext = {
  categoryIdByHandle: Map<string, string>;
  shippingProfileId: string;
  salesChannelId: string;
};

export type MedusaSeedProductInput = {
  title: string;
  handle: string;
  description: string;
  status: "published";
  shipping_profile_id: string;
  category_ids: string[];
  images: { url: string }[];
  options: { title: string; values: string[] }[];
  variants: {
    title: string;
    sku: string;
    options: Record<string, string>;
    prices: { amount: number; currency_code: "vnd" }[];
    manage_inventory?: boolean;
  }[];
  sales_channels: { id: string }[];
  metadata: Record<string, string | number | boolean>;
};

export function mapSeedProductToMedusaInput(
  product: SeedProduct,
  ctx: MapProductContext
): MedusaSeedProductInput {
  const category_ids = product.categories
    .map((handle) => ctx.categoryIdByHandle.get(handle))
    .filter((id): id is string => Boolean(id));
  if (!category_ids.length) {
    throw new Error(
      `No Medusa category ids for product handle=${product.slug} categories=${product.categories.join(",")}`
    );
  }

  const images: { url: string }[] = [];
  const metadata: Record<string, string | number | boolean> = {
    ingredient: JSON.stringify(product.ingredient ?? []),
  };
  if (typeof product.isNew === "boolean") metadata.isNew = product.isNew;
  if (typeof product.totalSold === "number") metadata.totalSold = product.totalSold;

  for (const variant of product.variants) {
    const url = variant.thumbnail || product.thumbnail;
    if (!url) continue;
    const existing = images.findIndex((i) => i.url === url);
    const rank = existing >= 0 ? existing + 1 : images.push({ url }) && images.length;
    metadata[variant.sku] = rank as number;
  }

  return {
    title: product.name,
    handle: product.slug,
    description: product.description ?? "",
    status: "published",
    shipping_profile_id: ctx.shippingProfileId,
    category_ids,
    images,
    options: product.specs.map((s) => ({ title: s.key, values: s.value })),
    variants: product.variants.map((v) => ({
      title: v.name,
      sku: v.sku,
      options: v.specs,
      manage_inventory: true,
      prices: [{ amount: v.price, currency_code: "vnd" }],
    })),
    sales_channels: [{ id: ctx.salesChannelId }],
    metadata,
  };
}
```

- [ ] **Step 9: Run mapper test — expect PASS**

```bash
npm run test:unit -- src/lib/seed/map-product.test.ts
# Expected: PASS
```

- [ ] **Step 10: Commit**

```bash
git add seed/data src/lib/seed
git commit -m "$(cat <<'EOF'
feat: add catalog seed loader and product mapper

Copy storefront JSON and unit-test validation plus Medusa product mapping including sku image ranks.
EOF
)"
```

---

### Task 3: Idempotent commerce foundation seed (VN)

**Files:**
- Replace/Modify: `src/scripts/seed.ts` (replace demo Europe seed)
- Optionally keep helpers in `src/lib/seed/foundation.ts` if `seed.ts` grows large — prefer one file until >400 lines

**Interfaces:**
- Consumes: Medusa `container` via `ExecArgs`
- Produces after run:
  - Region named `Vietnam`, currency `vnd`, country `vn`, `payment_providers: ["pp_system_default"]`
  - Default sales channel linked to publishable API key
  - Stock location VN + fulfillment set geo `vn` + one shipping option named `Giao tiêu chuẩn`
  - Logs publishable API key token/id for README (starter returns key on create — print `api_key` / token field available from workflow result)

- [ ] **Step 1: Replace demo seed with VN foundation (skip products for now)**

Implement `src/scripts/seed.ts` by adapting [medusa-starter-default seed.ts](https://github.com/medusajs/medusa-starter-default/blob/master/src/scripts/seed.ts):

1. Ensure default sales channel exists (same pattern as starter).
2. `updateStoreCurrencies` with `{ currency_code: "vnd", is_default: true }` only.
3. If no region contains country `vn`, `createRegionsWorkflow` with:

```typescript
{
  name: "Vietnam",
  currency_code: "vnd",
  countries: ["vn"],
  payment_providers: ["pp_system_default"],
}
```

4. `createTaxRegionsWorkflow` for `[{ country_code: "vn", provider_id: "tp_system" }]` if not present.
5. Stock location `Kho Cà Mau` / `country_code: "vn"`.
6. Link stock location ↔ `manual_manual` fulfillment provider (starter pattern).
7. Fulfillment set with service zone geo `vn` only; shipping option:

```typescript
{
  name: "Giao tiêu chuẩn",
  price_type: "flat",
  provider_id: "manual_manual",
  // service_zone_id, shipping_profile_id from created entities
  type: {
    label: "Standard",
    description: "Giao hàng tiêu chuẩn",
    code: "standard",
  },
  prices: [
    { currency_code: "vnd", amount: 0 },
    { region_id: region.id, amount: 0 },
  ],
  rules: [
    { attribute: "enabled_in_store", value: "true", operator: "eq" },
    { attribute: "is_return", value: "false", operator: "eq" },
  ],
}
```

8. Create publishable API key if none; link to sales channel; **logger.info the key value** for storefront env.
9. **Do not** create demo T-shirt products in this task.
10. Idempotency: before each create, `list*` / `query.graph` — if Vietnam region / shipping option name / publishable key already exist, skip create.

- [ ] **Step 2: Run seed**

```bash
npm run seed
# or: npx medusa exec ./src/scripts/seed.ts
```

Expected: completes; logs publishable key; no Europe countries.

- [ ] **Step 3: Re-run seed — expect no duplicate region error**

```bash
npm run seed
# Expected: success / skips; NOT "Countries with codes: vn are already assigned"
```

- [ ] **Step 4: Commit**

```bash
git add src/scripts/seed.ts src/lib/seed
git commit -m "$(cat <<'EOF'
feat: seed Vietnam region, shipping, and publishable key

Replace Europe demo foundation with idempotent VN + COD provider setup.
EOF
)"
```

---

### Task 4: Seed categories, products, inventory from JSON

**Files:**
- Modify: `src/scripts/seed.ts` — call catalog import after foundation
- Uses: `loadCatalog`, `mapSeedProductToMedusaInput`

**Interfaces:**
- Consumes: foundation ids (shipping profile, sales channel, stock location); `seed/data`
- Produces: ≥6 product categories with handles = slugs; all seed products published; inventory levels from variant `stock` (default `0` if missing)

- [ ] **Step 1: Extend seed.ts catalog section**

Pseudocode to implement concretely in `seed.ts`:

```typescript
import * as path from "path";
import { loadCatalog } from "../lib/seed/load-catalog";
import { mapSeedProductToMedusaInput } from "../lib/seed/map-product";
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows";
import { ProductStatus } from "@medusajs/framework/utils";

const seedDataDir = path.join(process.cwd(), "seed", "data");
const { categories, products } = loadCatalog(seedDataDir);

// Categories: create only missing handles
const existingCats = await productModule.listProductCategories({}, { take: 1000 });
// or query.graph entity product_category
const categoryIdByHandle = new Map<string, string>();
// fill from existing; for missing:
await createProductCategoriesWorkflow(container).run({
  input: {
    product_categories: missing.map((c) => ({
      name: c.name,
      handle: c.slug,
      is_active: true,
    })),
  },
});
// refresh map

for (const product of products) {
  const existing = await productModule.listProducts({ handle: product.slug });
  if (existing.length) {
    logger.info(`Skip existing product ${product.slug}`);
    continue;
  }
  const input = mapSeedProductToMedusaInput(product, {
    categoryIdByHandle,
    shippingProfileId: shippingProfile.id,
    salesChannelId: defaultSalesChannel[0].id,
  });
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          ...input,
          status: ProductStatus.PUBLISHED,
        },
      ],
    },
  });
}

// Inventory: for each created variant inventory item, set stocked_quantity
// Prefer matching via sku → inventory item when possible.
// Fallback: after product create, query variants with inventory_items and set levels
// using SeedProduct.variants[].stock ?? 0 at the matching sku.
```

Use Medusa starter inventory pattern (`createInventoryLevelsWorkflow`) but **per-sku quantities** from JSON, not `1000000`.

If linking inventory by sku is awkward in one pass: after all products created, `query.graph` variants with `sku` + `inventory_items`, build levels array.

- [ ] **Step 2: Run seed on DB that already has foundation**

```bash
npm run seed
```

Expected: creates categories + products; skips on second product pass.

- [ ] **Step 3: Verify counts via Admin or query script**

```bash
# While medusa dev is running, with publishable key from seed log:
curl -s "http://localhost:9000/store/product-categories" \
  -H "x-publishable-api-key: $PUBLISHABLE_KEY" | head
curl -s "http://localhost:9000/store/products?limit=100" \
  -H "x-publishable-api-key: $PUBLISHABLE_KEY"
```

Expected: ≥6 categories; product count ≈ 20.

- [ ] **Step 4: Second seed run — no duplicate products**

```bash
npm run seed
# Expected: "Skip existing product ..." lines; same product count
```

- [ ] **Step 5: Commit**

```bash
git add src/scripts/seed.ts
git commit -m "$(cat <<'EOF'
feat: seed categories and products from storefront JSON

Import idempotent catalog with VND prices, options, inventory, and image metadata ranks.
EOF
)"
```

---

### Task 5: Smoke script, README, wire storefront env

**Files:**
- Create: `scripts/smoke-store.mjs`
- Create/Replace: `README.md`
- Modify: storefront `chuccamau-yensao/.env.dev` (URL + publishable key only — do not commit secrets if repo tracks env; prefer documenting values for the user)

**Interfaces:**
- Consumes: `MEDUSA_BACKEND_URL`, `PUBLISHABLE_API_KEY` env
- Produces: exit `0` if regions has `vn`, categories ≥ 6, products > 0, payment providers include `pp_system_default`; else exit `1`

- [ ] **Step 1: Write `scripts/smoke-store.mjs`**

```javascript
const base = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const key = process.env.PUBLISHABLE_API_KEY;
if (!key) {
  console.error("PUBLISHABLE_API_KEY required");
  process.exit(1);
}
const headers = { "x-publishable-api-key": key };

async function get(path) {
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

const regions = await get("/store/regions");
const vn = (regions.regions || []).some(
  (r) => (r.countries || []).some((c) => c.iso_2 === "vn")
);
if (!vn) throw new Error("No region with country vn");

const cats = await get("/store/product-categories?limit=100");
if ((cats.product_categories || []).length < 6) {
  throw new Error("Expected >= 6 categories");
}

const products = await get("/store/products?limit=100");
if ((products.products || []).length < 1) {
  throw new Error("Expected products > 0");
}

const regionId = regions.regions.find((r) =>
  (r.countries || []).some((c) => c.iso_2 === "vn")
).id;
const payments = await get(
  `/store/payment-providers?region_id=${regionId}`
);
const ok = (payments.payment_providers || []).some(
  (p) => p.id === "pp_system_default"
);
if (!ok) throw new Error("pp_system_default missing");

console.log("smoke ok", {
  categories: cats.product_categories.length,
  products: products.products.length,
});
```

Add to `package.json`:

```json
"smoke": "node scripts/smoke-store.mjs"
```

- [ ] **Step 2: Run smoke**

```bash
# start: npm run dev (separate terminal)
export PUBLISHABLE_API_KEY='pk_...'   # from seed log
npm run smoke
# Expected: smoke ok { categories: 6, products: 20 } (approx)
```

- [ ] **Step 3: Write README runbook**

Include exactly:

1. `docker compose up -d`
2. Copy `.env.template` → `.env`
3. Install deps + `db:migrate`
4. `npm run seed` (save publishable key from logs)
5. `npm run dev`
6. `PUBLISHABLE_API_KEY=... npm run smoke`
7. Storefront `.env.dev`:

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<paste>
NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=vn
```

8. Manual acceptance: open storefront products → add cart → COD checkout → confirm order in Medusa Admin.

Troubleshooting checklist: CORS, wrong key, Postgres not healthy, seed not run.

- [ ] **Step 4: Wire storefront local env (user machine)**

Update `chuccamau-yensao/.env.dev` keys above. Do **not** commit storefront secrets unless that repo already tracks `.env.dev` (it currently has committed env files — only change Medusa URL/key values).

- [ ] **Step 5: Manual COD checkout proof**

With both servers running, place one order from storefront. Confirm order appears in Admin.

- [ ] **Step 6: Commit backend docs/scripts**

```bash
git add README.md scripts/smoke-store.mjs package.json
git commit -m "$(cat <<'EOF'
docs: add local runbook and Store API smoke check

Document seed → key → storefront wiring and automate MVP acceptance probes.
EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Medusa v2 + Postgres Docker | Task 1 |
| Sibling repo scaffold, keep docs | Task 1 |
| Region VN / vnd / `pp_system_default` | Task 3 |
| Shipping option for checkout | Task 3 |
| Publishable key + CORS localhost:3000 | Task 1 + 3 |
| Seed from frontend JSON + mapping table | Task 2 + 4 |
| Idempotent seed | Task 3 + 4 |
| Image path + `metadata[sku]` rank | Task 2 |
| Smoke + manual COD acceptance | Task 5 |
| Non-goals (no MoMo, no custom modules) | Global Constraints |

**Placeholder scan:** none intentional.  
**Type consistency:** `SeedProduct` / `mapSeedProductToMedusaInput` / `loadCatalog` names shared across Tasks 2–4.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-12-medusa-backend-mvp.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
