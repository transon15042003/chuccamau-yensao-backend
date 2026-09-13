/**
 * Phase 0 checkout proof: Store API COD flow.
 * Usage (Medusa must be running):
 *   PUBLISHABLE_API_KEY=pk_... node scripts/checkout-cod.mjs
 */
const base = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
const key = process.env.PUBLISHABLE_API_KEY;
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
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

const regions = await req("GET", "/store/regions");
const region = (regions.regions || []).find((r) =>
  (r.countries || []).some((c) => c.iso_2 === "vn")
);
if (!region) throw new Error("No VN region");

const products = await req(
  "GET",
  `/store/products?limit=5&region_id=${region.id}&fields=*variants`
);
const product = (products.products || []).find((p) => p.variants?.length);
if (!product) throw new Error("No product with variants");
const variant = product.variants[0];

const { cart } = await req("POST", "/store/carts", {
  region_id: region.id,
});

await req("POST", `/store/carts/${cart.id}/line-items`, {
  variant_id: variant.id,
  quantity: 1,
});

await req("POST", `/store/carts/${cart.id}`, {
  email: "checkout-proof@example.com",
  shipping_address: {
    first_name: "Nguyen",
    last_name: "Van A",
    phone: "0900000000",
    address_1: "123 Duong Test",
    city: "Ca Mau",
    country_code: "vn",
    province: "Ca Mau",
  },
  billing_address: {
    first_name: "Nguyen",
    last_name: "Van A",
    phone: "0900000000",
    address_1: "123 Duong Test",
    city: "Ca Mau",
    country_code: "vn",
    province: "Ca Mau",
  },
  metadata: {
    payment_method: "COD",
    shipping_method: "STANDARD",
    note: "Phase 0 checkout proof",
  },
});

const shipping = await req(
  "GET",
  `/store/shipping-options?cart_id=${cart.id}`
);
const options = shipping.shipping_options || [];
const codes = options.map((o) => o.type?.code).filter(Boolean);
const option =
  options.find((o) => o.type?.code === "STANDARD") || options[0];
if (!option) throw new Error("No shipping options");
if (!codes.includes("STANDARD") || !codes.includes("WORKING_HOURS")) {
  throw new Error(
    `Expected STANDARD + WORKING_HOURS shipping options, got: ${codes.join(",")}`
  );
}

await req("POST", `/store/carts/${cart.id}/shipping-methods`, {
  option_id: option.id,
});

await req("POST", `/store/payment-collections`, {
  cart_id: cart.id,
});

// Refresh cart for payment collection id
const { cart: cart2 } = await req(
  "GET",
  `/store/carts/${cart.id}?fields=*payment_collection`
);
const pcId = cart2.payment_collection?.id;
if (!pcId) throw new Error("No payment_collection on cart");

await req("POST", `/store/payment-collections/${pcId}/payment-sessions`, {
  provider_id: "pp_system_default",
});

const completed = await req("POST", `/store/carts/${cart.id}/complete`, {});
const order = completed.order || completed.data?.order || completed;
if (!order?.id) {
  console.error("Unexpected complete payload", completed);
  throw new Error("Complete cart did not return order");
}

// Default complete payload omits metadata; confirm via Admin (or DB).
const { Client } = await import("pg");
const db = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://medusa:medusa@127.0.0.1:5432/medusa",
});
await db.connect();
const { rows } = await db.query(
  `select metadata from "order" where id = $1`,
  [order.id]
);
await db.end();
const meta = rows[0]?.metadata || {};
if (meta.payment_method !== "COD" || meta.shipping_method !== "STANDARD") {
  throw new Error(
    `Order metadata not copied from cart: ${JSON.stringify(meta)}`
  );
}

console.log("checkout ok", {
  order_id: order.id,
  display_id: order.display_id,
  email: order.email,
  variant: variant.sku || variant.id,
  shipping: option.name,
  shipping_code: option.type?.code,
  metadata: meta,
});
