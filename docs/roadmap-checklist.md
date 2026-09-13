# Lộ trình phát triển backend — Chúc Cà Mau Yến Sào

Checklist quản lý sau MVP. Đánh dấu `[x]` khi xong; ghi ngày/commit nếu cần.

**Repos:** `chuccamau-yensao` (Next.js) · `chuccamau-yensao-backend` (Medusa 2.8)  
**MVP baseline (đã xong):** Postgres local · migrate · seed VN · 6 categories · 20 products · smoke Store API · `.env.local` storefront

---

## Phase 0 — Vận hành local ổn định

- [x] Scaffold Medusa 2.8 + Postgres
- [x] Seed region `vn` / `vnd` / `pp_system_default`
- [x] Seed catalog từ JSON storefront
- [x] Smoke: regions, categories, products, payment provider
- [x] **Checkout COD end-to-end** (cart → address → shipping → payment session → order) — `scripts/checkout-cod.mjs` · order `display_id: 1`
- [x] Tạo admin user Medusa (`/app`) và xem order trên Admin — `admin@chuccamau.local` · `yarn admin:orders`
- [x] Đồng bộ inventory theo SKU từ JSON — `yarn sync:inventory` · `yarn verify:stock` (64/64)
- [x] Bật chặn hết hàng lúc complete order — middleware `src/api/middlewares.ts` + hook · `yarn verify:oos` (400)
- [x] README onboarding (Postgres local **hoặc** Docker Compose)
- [x] Commit/push nhánh `feat/medusa-backend-mvp` + mở PR — https://github.com/transon15042003/chuccamau-yensao-backend/pull/1

---

## Phase 1 — Checkout & fulfillment cứng

- [x] **Enforce inventory** khi complete cart (middleware + hook; add-to-cart đã confirm sẵn của Medusa)
- [x] Shipping option tách `STANDARD` vs `WORKING_HOURS` (seed + store API; FE chọn theo `type.code`)
- [x] Cart metadata: `payment_method`, `shipping_method`, invoice, `note` — Medusa copy `cart.metadata` → `order.metadata` (prove trong `checkout:cod`)
- [x] Guest checkout ổn định (cookie/cart transfer nếu có login sau) — COD guest đã chạy; transfer khi login để Phase 5
- [x] Order retrieve by id cho trang cảm ơn — `GET /store/orders/:id` (guest OK) · FE `+metadata`
- [x] Hủy đơn cơ bản từ Admin — `POST /admin/orders/:id/cancel` · `yarn admin:cancel`
- [x] Tax region VN tối thiểu (`tp_system` trong seed) — VAT rates chỉ khi shop cần

---

## Phase 2 — Thanh toán online

- [x] VNPay + MoMo Medusa payment providers (`pp_vnpay_vnpay`, `pp_momo_momo`)
- [x] IPN routes `/hooks/vnpay/ipn`, `/hooks/momo/ipn` + return pages storefront
- [x] Đối soát: authorize → order; FE map `payment_status` captured → `paid`
- [x] Giữ COD (`pp_system_default`); `PAYMENT_MOCK=1` local; sandbox env trong `.env.template`
- [x] Proof: `yarn checkout:online vnpay|momo` (mock complete)

---

## Phase 3 — Thông báo & vận hành đơn

- [ ] Email xác nhận đơn (SendGrid — storefront đã có key cho mail khác)
- [ ] Email nội bộ cho shop owner khi có đơn mới
- [ ] Template HTML/text (tiếng Việt)
- [ ] (Tuỳ chọn) SMS / Zalo OA thông báo giao hàng

---

## Phase 4 — Catalog & media

- [ ] Upload ảnh sản phẩm lên Medusa file storage (bỏ phụ thuộc path `/images` storefront)
- [ ] Đồng bộ / re-seed an toàn khi JSON catalog đổi
- [ ] Collections / tags / SEO fields (`handle`, description)
- [ ] Giá khuyến mãi / price list (nếu storefront dùng discount)
- [ ] Inventory multi-location (nếu mở kho thứ 2)

---

## Phase 5 — Khách hàng & tài khoản

- [ ] Customer auth (email/password) khớp `src/lib/data/customer.ts`
- [ ] Địa chỉ sổ địa chỉ; tỉnh/huyện (provinces API đã có phía FE)
- [ ] Lịch sử đơn của khách
- [ ] (Tuỳ chọn) OTP / social login

---

## Phase 6 — Deploy & môi trường

- [ ] Postgres managed (Render / Neon / RDS…)
- [ ] Deploy Medusa (Render Web Service / Railway / Fly…) — bind `0.0.0.0:$PORT`
- [ ] Secrets: `DATABASE_URL`, JWT/COOKIE, publishable + secret API keys
- [ ] `STORE_CORS` / `ADMIN_CORS` production domains
- [ ] Storefront env staging + production
- [ ] Backup DB + restore drill
- [ ] Health check + logs cơ bản
- [ ] (Tuỳ chọn) Redis cho event bus / cache khi có traffic

---

## Phase 7 — Chất lượng & bảo mật

- [ ] Integration test: create cart → complete order
- [ ] CI: lint + unit seed mapper + (tuỳ chọn) migrate dry-run
- [ ] Rate limit / bot (reCAPTCHA đã có trên FE order/contact)
- [ ] Audit quyền Admin; tắt publishable key cũ khi lộ
- [ ] Không commit `.env` / publishable production vào git

---

## Phase 8 — Mở rộng sản phẩm (sau khi core ổn)

- [ ] Báo cáo bán hàng đơn giản (Admin hoặc Metabase)
- [ ] Chương trình affiliate / mã giảm giá nâng cao
- [ ] Đa ngôn ngữ / đa tiền tệ (chỉ khi có nhu cầu thật)
- [ ] App mobile / headless thêm kênh bán

---

## Cách dùng checklist

1. Làm lần lượt theo phase; đừng nhảy Phase 6 trước khi Phase 0–1 xanh.
2. Mỗi mục xong: tick + ghi 1 dòng trong PR / `docs/superpowers/sdd/progress.md`.
3. Scope creep: mục mới thêm vào phase phù hợp, không xen vào MVP đã đóng.

**Cập nhật lần này:** 2026-09-14 — Phase 1 đóng; Phase 2 VNPay+MoMo (mock E2E).
