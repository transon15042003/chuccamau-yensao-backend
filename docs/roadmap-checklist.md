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
- [ ] Tạo admin user Medusa (`/app`) và xem order trên Admin
- [ ] Xác nhận inventory theo SKU (stock đúng / hết hàng chặn add-to-cart) — *đã backfill 64 levels; còn tinh chỉnh stock từ JSON*
- [ ] README onboarding chạy được trên máy mới (Docker **hoặc** Postgres local)
- [ ] Commit/push nhánh `feat/medusa-backend-mvp` + mở PR

---

## Phase 1 — Checkout & fulfillment cứng

- [ ] Shipping option tách `STANDARD` vs `WORKING_HOURS` (không chỉ metadata)
- [ ] Cart metadata: `payment_method`, `shipping_method`, invoice, `note` — map rõ sang order
- [ ] Guest checkout ổn định (cookie/cart transfer nếu có login sau)
- [ ] Order retrieve by id/display_id cho trang cảm ơn storefront
- [ ] Hủy / hoàn đơn cơ bản từ Admin
- [ ] Tax region VN (nếu cần VAT; hiện seed tối thiểu)

---

## Phase 2 — Thanh toán online

- [ ] Chọn gateway ưu tiên: VNPay và/hoặc MoMo (storefront types đã có)
- [ ] Medusa payment provider plugin + webhook
- [ ] Return/IPN URL + trang kết quả thanh toán storefront
- [ ] Đối soát `pending` / `paid` / `failed` với `OrderPaymentStatus`
- [ ] Giữ COD song song; cấu hình bật/tắt theo env

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

**Cập nhật lần này:** 2026-09-13 — tạo checklist; bắt đầu Phase 0 checkout E2E.
