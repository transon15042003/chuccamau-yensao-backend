/**
 * Prove online payment providers register + mock payUrl initiate.
 * Usage: PUBLISHABLE_API_KEY=pk_... node scripts/checkout-online.mjs [vnpay|momo]
 */
const base = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
const key = process.env.PUBLISHABLE_API_KEY;
const which = (process.argv[2] || "vnpay").toLowerCase();
const providerId = which === "momo" ? "pp_momo_momo" : "pp_vnpay_vnpay";

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
  const data = await res.json().catch(() => ({}));
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

const providers = await req(
  "GET",
  `/store/payment-providers?region_id=${region.id}`
);
const ids = (providers.payment_providers || []).map((p) => p.id);
if (!ids.includes(providerId)) {
  throw new Error(`Missing ${providerId} on region. Got: ${ids.join(",")}`);
}
if (!ids.includes("pp_system_default")) {
  throw new Error("COD pp_system_default missing");
}

const products = await req(
  "GET",
  `/store/products?limit=5&region_id=${region.id}&fields=*variants`
);
const product = (products.products || []).find((p) => p.variants?.length);
const variant = product.variants[0];

const { cart } = await req("POST", "/store/carts", { region_id: region.id });
await req("POST", `/store/carts/${cart.id}/line-items`, {
  variant_id: variant.id,
  quantity: 1,
});
await req("POST", `/store/carts/${cart.id}`, {
  email: "online-proof@example.com",
  shipping_address: {
    first_name: "Online",
    last_name: "Proof",
    phone: "0900000000",
    address_1: "1 Test",
    city: "Ca Mau",
    country_code: "vn",
  },
  billing_address: {
    first_name: "Online",
    last_name: "Proof",
    phone: "0900000000",
    address_1: "1 Test",
    city: "Ca Mau",
    country_code: "vn",
  },
  metadata: { payment_method: which.toUpperCase() },
});

const shipping = await req(
  "GET",
  `/store/shipping-options?cart_id=${cart.id}`
);
const option =
  (shipping.shipping_options || []).find((o) => o.type?.code === "STANDARD") ||
  shipping.shipping_options[0];
await req("POST", `/store/carts/${cart.id}/shipping-methods`, {
  option_id: option.id,
});

await req("POST", "/store/payment-collections", { cart_id: cart.id });
const { cart: cart2 } = await req(
  "GET",
  `/store/carts/${cart.id}?fields=*payment_collection.payment_sessions`
);
const pcId = cart2.payment_collection?.id;
await req("POST", `/store/payment-collections/${pcId}/payment-sessions`, {
  provider_id: providerId,
  data: { cart_id: cart.id },
});

const { cart: cart3 } = await req(
  "GET",
  `/store/carts/${cart.id}?fields=*payment_collection.payment_sessions`
);
const session = cart3.payment_collection?.payment_sessions?.[0];
const payUrl = session?.data?.payUrl;
if (!payUrl) {
  console.error("No payUrl in session", session);
  process.exit(1);
}

console.log("online initiate ok", {
  provider: providerId,
  session_id: session.id,
  cart_id: cart.id,
  payUrl,
  providers: ids,
});

// Mock confirm end-to-end when PAYMENT_MOCK
if (String(payUrl).includes("/payment/mock")) {
  const confirm = await req("POST", "/store/payment/confirm", {
    provider: which === "momo" ? "momo" : "vnpay",
    session_id: session.id,
    cart_id: cart.id,
    mock: true,
  });
  console.log("online mock complete ok", confirm);
}
