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
const vn = (regions.regions || []).some((r) =>
  (r.countries || []).some((c) => c.iso_2 === "vn")
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
const payments = await get(`/store/payment-providers?region_id=${regionId}`);
const ok = (payments.payment_providers || []).some(
  (p) => p.id === "pp_system_default"
);
if (!ok) throw new Error("pp_system_default missing");

console.log("smoke ok", {
  categories: cats.product_categories.length,
  products: products.products.length,
});
