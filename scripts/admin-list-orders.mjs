/**
 * Login as admin and list latest orders (proves Admin can see checkout order).
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... PUBLISHABLE_API_KEY=... node scripts/admin-list-orders.mjs
 */
const base = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
const email = process.env.ADMIN_EMAIL || "admin@chuccamau.local";
const password = process.env.ADMIN_PASSWORD || "LocalDev_ChangeMe1!";

const authRes = await fetch(`${base}/auth/user/emailpass`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const authText = await authRes.text();
let auth;
try {
  auth = JSON.parse(authText);
} catch {
  auth = { raw: authText };
}
if (!authRes.ok) {
  console.error("Admin login failed", authRes.status, auth);
  process.exit(1);
}
const token = auth.token;
if (!token) {
  console.error("No token in auth response", auth);
  process.exit(1);
}

const ordersRes = await fetch(`${base}/admin/orders?limit=5`, {
  headers: { authorization: `Bearer ${token}` },
});
const ordersBody = await ordersRes.json();
if (!ordersRes.ok) {
  console.error("List orders failed", ordersRes.status, ordersBody);
  process.exit(1);
}

const orders = ordersBody.orders || [];
console.log("admin orders ok", {
  count: ordersBody.count ?? orders.length,
  latest: orders.slice(0, 3).map((o) => ({
    id: o.id,
    display_id: o.display_id,
    email: o.email,
    status: o.status,
  })),
});

if (!orders.length) {
  console.error("Expected at least one order from checkout proof");
  process.exit(1);
}
