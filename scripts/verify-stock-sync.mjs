/**
 * Verify inventory_level.stocked_quantity matches seed JSON by SKU.
 */
import fs from "fs";
import path from "path";
import pg from "pg";

const dbUrl =
  process.env.DATABASE_URL ||
  "postgres://medusa:medusa@127.0.0.1:5432/medusa";

const stock = new Map();
const dir = path.join(process.cwd(), "seed", "data", "products");
for (const f of fs.readdirSync(dir)) {
  for (const p of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
    for (const v of p.variants) {
      stock.set(v.sku, typeof v.stock === "number" ? v.stock : 0);
    }
  }
}

const client = new pg.Client({
  connectionString: dbUrl,
  connectionTimeoutMillis: 3000,
});
await client.connect();
const { rows } = await client.query(`
  select pv.sku, il.stocked_quantity::int as qty
  from product_variant pv
  join product_variant_inventory_item pvii on pvii.variant_id = pv.id
  join inventory_level il on il.inventory_item_id = pvii.inventory_item_id
  where pv.sku is not null and pv.deleted_at is null
`);
await client.end();

let ok = 0;
const mismatches = [];
for (const row of rows) {
  if (!stock.has(row.sku)) continue;
  const expected = stock.get(row.sku);
  if (expected !== row.qty) mismatches.push({ sku: row.sku, db: row.qty, json: expected });
  else ok++;
}

if (mismatches.length) {
  console.error("stock sync FAIL", { ok, mismatches: mismatches.slice(0, 10) });
  process.exit(1);
}
console.log("stock sync ok", { matched: ok, skus_in_seed: stock.size });
