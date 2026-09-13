/**
 * Prove out-of-stock blocks cart completion (Medusa may still allow add-to-cart).
 * Requires Medusa up + PUBLISHABLE_API_KEY.
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

async function checkoutFlow(variantId, expectCompleteOk) {
  const regions = await req("GET", "/store/regions");
  const region = regions.data.regions.find((r) =>
    (r.countries || []).some((c) => c.iso_2 === "vn")
  );
  const { data: cartWrap } = await req("POST", "/store/carts", {
    region_id: region.id,
  });
  const cartId = cartWrap.cart.id;

  const add = await req("POST", `/store/carts/${cartId}/line-items`, {
    variant_id: variantId,
    quantity: 1,
  });
  if (!add.ok) {
    return { stage: "add", ...add };
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

  const shipping = await req(
    "GET",
    `/store/shipping-options?cart_id=${cartId}`
  );
  const option = shipping.data.shipping_options[0];
  await req("POST", `/store/carts/${cartId}/shipping-methods`, {
    option_id: option.id,
  });

  await req("POST", "/store/payment-collections", { cart_id: cartId });
  const { data: cart2 } = await req(
    "GET",
    `/store/carts/${cartId}?fields=*payment_collection`
  );
  const pcId = cart2.cart.payment_collection.id;
  await req("POST", `/store/payment-collections/${pcId}/payment-sessions`, {
    provider_id: "pp_system_default",
  });

  const complete = await req("POST", `/store/carts/${cartId}/complete`, {});
  return { stage: "complete", expectCompleteOk, ...complete };
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
await client.query(
  `update inventory_level set stocked_quantity = 0
   where inventory_item_id = $1 and location_id = $2`,
  [row.inventory_item_id, row.location_id]
);

const oos = await checkoutFlow(row.variant_id, false);

await client.query(
  `update inventory_level set stocked_quantity = $3
   where inventory_item_id = $1 and location_id = $2`,
  [row.inventory_item_id, row.location_id, previous > 0 ? previous : 100]
);
await client.end();

// OOS: complete should fail OR return type error (not a successful order)
const oosOrder = oos.data?.order || oos.data?.data?.order;
const oosBlocked = !oos.ok || !oosOrder?.id;

if (!oosBlocked) {
  console.error("Expected complete to fail when stock=0", oos);
  process.exit(1);
}

console.log("oos proof ok", {
  sku: row.sku,
  note: "Medusa may allow add-to-cart; complete blocked when stocked_quantity=0",
  complete_status: oos.status,
  stage: oos.stage,
});
