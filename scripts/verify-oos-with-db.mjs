/**
 * Prove OOS blocks POST /store/carts/:id/complete.
 * Add line item while in stock, then zero stock (both stocked + raw_stocked),
 * then complete must fail. Avoids `medusa exec` mid-flight (kills develop on Win).
 */
import pg from "pg";

const base = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
const key = process.env.PUBLISHABLE_API_KEY;
const dbUrl =
  process.env.DATABASE_URL ||
  "postgres://medusa:medusa@127.0.0.1:5432/medusa";

if (!key) {
  console.error("PUBLISHABLE_API_KEY required");
  process.exit(1);
}

const headers = {
  "content-type": "application/json",
  "x-publishable-api-key": key,
};

async function setQty(client, inventoryItemId, locationId, qty) {
  // Must update raw_stocked_quantity — confirmInventory reads the BigNumber raw field.
  const q = Number(qty);
  await client.query(
    `update inventory_level
     set stocked_quantity = $3::numeric,
         raw_stocked_quantity = jsonb_build_object('value', $4::text, 'precision', 20)
     where inventory_item_id = $1 and location_id = $2`,
    [inventoryItemId, locationId, q, String(q)]
  );
}

async function req(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

const client = new pg.Client({
  connectionString: dbUrl,
  connectionTimeoutMillis: 3000,
});
await client.connect();
const row = (
  await client.query(`
  select pv.id as variant_id, pv.sku, il.inventory_item_id, il.location_id, il.stocked_quantity
  from product_variant pv
  join product_variant_inventory_item pvii on pvii.variant_id = pv.id
  join inventory_level il on il.inventory_item_id = pvii.inventory_item_id
  where pv.deleted_at is null and pv.sku is not null
  limit 1
`)
).rows[0];

const previous = Number(row.stocked_quantity);
if (previous <= 0) {
  await setQty(client, row.inventory_item_id, row.location_id, 100);
}

const regions = await req("GET", "/store/regions");
const region = regions.data.regions.find((r) =>
  (r.countries || []).some((c) => c.iso_2 === "vn")
);
const { data: cartWrap, ok: cartOk } = await req("POST", "/store/carts", {
  region_id: region.id,
});
if (!cartOk) {
  console.error("create cart failed", cartWrap);
  process.exit(1);
}
const cartId = cartWrap.cart.id;

const add = await req("POST", `/store/carts/${cartId}/line-items`, {
  variant_id: row.variant_id,
  quantity: 1,
});
if (!add.ok || !(add.data.cart?.items?.length > 0)) {
  console.error("add line item failed (need stock > 0 first)", {
    status: add.status,
    message: add.data?.message || add.data,
  });
  process.exit(1);
}

await req("POST", `/store/carts/${cartId}`, {
  email: "oos-proof@example.com",
  shipping_address: {
    first_name: "OOS",
    last_name: "Test",
    phone: "0900000001",
    address_1: "1 Test",
    city: "Ca Mau",
    country_code: "vn",
  },
  billing_address: {
    first_name: "OOS",
    last_name: "Test",
    phone: "0900000001",
    address_1: "1 Test",
    city: "Ca Mau",
    country_code: "vn",
  },
});
const shipping = await req("GET", `/store/shipping-options?cart_id=${cartId}`);
await req("POST", `/store/carts/${cartId}/shipping-methods`, {
  option_id: shipping.data.shipping_options[0].id,
});
await req("POST", "/store/payment-collections", { cart_id: cartId });
const { data: cart2 } = await req(
  "GET",
  `/store/carts/${cartId}?fields=*payment_collection`
);
await req(
  "POST",
  `/store/payment-collections/${cart2.cart.payment_collection.id}/payment-sessions`,
  { provider_id: "pp_system_default" }
);

// Zero after cart is fully ready — this is the OOS-at-complete case
await setQty(client, row.inventory_item_id, row.location_id, 0);

const complete = await req("POST", `/store/carts/${cartId}/complete`, {});

await setQty(
  client,
  row.inventory_item_id,
  row.location_id,
  previous > 0 ? previous : 100
);
await client.end();

if (complete.ok && complete.data?.order?.id) {
  console.error("Expected complete to fail when stock=0", {
    status: complete.status,
    order_id: complete.data.order.id,
  });
  process.exit(1);
}

console.log("oos proof ok", {
  sku: row.sku,
  complete_status: complete.status,
  message: complete.data?.message || complete.data?.code || complete.data?.type,
});
