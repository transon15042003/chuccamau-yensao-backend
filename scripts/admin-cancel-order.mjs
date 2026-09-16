/**
 * Cancel an admin order (Phase 1 proof).
 * Usage:
 *   ORDER_ID=order_... node scripts/admin-cancel-order.mjs
 *   DISPLAY_ID=8 node scripts/admin-cancel-order.mjs
 */
const base = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
const email = process.env.ADMIN_EMAIL || "admin@chuccamau.local";
const password = process.env.ADMIN_PASSWORD || "LocalDev_ChangeMe1!";
const orderId = process.env.ORDER_ID;
const displayId = process.env.DISPLAY_ID
  ? Number(process.env.DISPLAY_ID)
  : undefined;

const authRes = await fetch(`${base}/auth/user/emailpass`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const auth = await authRes.json();
if (!authRes.ok || !auth.token) {
  console.error("Admin login failed", authRes.status, auth);
  process.exit(1);
}
const headers = {
  authorization: `Bearer ${auth.token}`,
  "content-type": "application/json",
};

let id = orderId;
if (!id) {
  const list = await fetch(`${base}/admin/orders?limit=50`, {
    headers,
  }).then((r) => r.json());
  const hit = (list.orders || []).find((o) =>
    displayId != null
      ? o.display_id === displayId
      : o.status === "pending"
  );
  if (!hit) {
    console.error("No matching order to cancel");
    process.exit(1);
  }
  id = hit.id;
}

const res = await fetch(`${base}/admin/orders/${id}/cancel`, {
  method: "POST",
  headers,
  body: "{}",
});
const body = await res.json();
if (!res.ok) {
  console.error("Cancel failed", res.status, body);
  process.exit(1);
}

console.log("admin cancel ok", {
  id: body.order?.id,
  display_id: body.order?.display_id,
  status: body.order?.status,
});
