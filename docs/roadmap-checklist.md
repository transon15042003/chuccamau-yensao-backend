# Lộ trình phát triển backend — Chúc Cà Mau Yến Sào

Checklist quản lý sau MVP. Đánh dấu `[x]` khi xong; ghi ngày/commit nếu cần.

**Repos:** `chuccamau-yensao` (Next.js) · `chuccamau-yensao-backend` (Medusa 2.8)  
**MVP baseline (đã xong):** Postgres local · migrate · seed VN · 6 categories · 20 products · smoke Store API · `.env.local` storefront

Mỗi phase có mục **Để hệ thống chạy đủ** — việc bắt buộc ngoài code (env, tài khoản, deploy, cấu hình shop).

---

## Phase 0 — Vận hành local ổn định

- [x] Scaffold Medusa 2.8 + Postgres
- [x] Seed region `vn` / `vnd` / `pp_system_default`
- [x] Seed catalog từ JSON storefront
- [x] Smoke: regions, categories, products, payment provider
- [x] **Checkout COD end-to-end** — `scripts/checkout-cod.mjs`
- [x] Admin user + xem order — `admin@chuccamau.local` · `yarn admin:orders`
- [x] Đồng bộ inventory theo SKU — `yarn sync:inventory` · `yarn verify:stock`
- [x] Chặn hết hàng lúc complete — middleware + `yarn verify:oos`
- [x] README onboarding (Postgres local **hoặc** Docker Compose)
- [x] Commit/push + PR — https://github.com/transon15042003/chuccamau-yensao-backend/pull/1

**Để hệ thống chạy đủ:** Postgres chạy + `DATABASE_URL`; `corepack yarn medusa db:migrate` + `yarn seed`; copy `pk_…` vào storefront `.env.local` (`NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`); `yarn dev` backend :9000 và storefront :3000; CORS khớp origin FE.

---

## Phase 1 — Checkout & fulfillment cứng

- [x] Enforce inventory khi complete cart
- [x] Shipping `STANDARD` / `WORKING_HOURS`
- [x] Cart metadata → order metadata
- [x] Guest checkout COD (cart transfer khi login → Phase 5)
- [x] Order retrieve by id + FE `+metadata`
- [x] Hủy đơn Admin — `yarn admin:cancel`
- [x] Tax region VN tối thiểu (`tp_system`)

**Để hệ thống chạy đủ:** Seed lại nếu thiếu shipping options; FE chọn option theo `type.code` (đã có trên `release`); admin đổi mật khẩu mặc định trước khi share máy; VAT chi tiết chỉ khi kế toán yêu cầu.

---

## Phase 2 — Thanh toán online

- [x] VNPay + MoMo providers (`pp_vnpay_vnpay`, `pp_momo_momo`)
- [x] IPN + return pages storefront
- [x] Đối soát pending / paid (capture → `paid` trên FE)
- [x] COD song song; `PAYMENT_MOCK=1` local
- [x] Proof: `yarn checkout:online vnpay|momo`

**Để hệ thống chạy đủ (local):** `PAYMENT_MOCK=1`, `STORE_URL=http://localhost:3000`, `yarn seed` gắn providers lên region.  
**Để hệ thống chạy đủ (sandbox/prod):** `PAYMENT_MOCK=0`; điền `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` / return+IPN public URL; điền `MOMO_PARTNER_CODE` / `ACCESS_KEY` / `SECRET_KEY` / redirect+IPN; gateway whitelist IPN URL (HTTPS); FE env publishable key trỏ đúng backend; test 1 đơn thật số tiền nhỏ trước go-live.

---

## Phase 3 — Thông báo & vận hành đơn

- [x] Email xác nhận đơn cho khách (SendGrid, subscriber `order.placed`)
- [x] Email nội bộ shop owner khi có đơn mới
- [x] Template HTML + text tiếng Việt (`src/lib/order-mail-templates.ts`)
- [ ] (Tuỳ chọn / defer) SMS / Zalo OA

**Để hệ thống chạy đủ:** Tài khoản SendGrid + verify sender domain; set trên **backend** `SENDGRID_API_KEY`, `SENDGRID_SENDER_EMAIL`, `ORDER_NOTIFY_OWNER_EMAIL` (comma-ok); đơn COD và online đều emit `order.placed` → subscriber gửi mail (không phụ thuộc tab trình duyệt). FE vẫn có template/API cũ cho contact form — giữ `SENDGRID_*` / `OWNER_EMAIL` trên storefront nếu còn dùng form liên hệ.

---

## Phase 4 — Catalog & media

- [ ] Upload ảnh sản phẩm lên Medusa file storage (bỏ phụ thuộc path `/images` storefront)
- [ ] Đồng bộ / re-seed an toàn khi JSON catalog đổi
- [ ] Collections / tags / SEO fields (`handle`, description)
- [ ] Giá khuyến mãi / price list (nếu storefront dùng discount)
- [ ] Inventory multi-location (nếu mở kho thứ 2)

**Để hệ thống chạy đủ:** Chọn file storage (S3/R2/local upload module) + env credentials; quyết định nguồn sự thật catalog (JSON seed vs Admin-only); CDN/public URL ảnh khớp FE; nếu dùng price list — cấu hình trong Admin và FE đọc `calculated_price`.

---

## Phase 5 — Khách hàng & tài khoản

- [ ] Customer auth (email/password) khớp `src/lib/data/customer.ts`
- [ ] Địa chỉ sổ địa chỉ; tỉnh/huyện (provinces API đã có phía FE)
- [ ] Lịch sử đơn của khách
- [ ] (Tuỳ chọn) OTP / social login

**Để hệ thống chạy đủ:** Bật customer auth Medusa + CORS/cookie giữa FE↔BE (same-site hoặc proxy); map guest cart → customer khi login; trang “đơn của tôi” gọi `GET /store/orders` với session; không lộ order id người khác.

---

## Phase 6 — Deploy & môi trường

- [ ] Postgres managed (Render / Neon / RDS…)
- [ ] Deploy Medusa — bind `0.0.0.0:$PORT`
- [ ] Secrets: `DATABASE_URL`, JWT/COOKIE, API keys
- [ ] `STORE_CORS` / `ADMIN_CORS` production domains
- [ ] Storefront env staging + production
- [ ] Backup DB + restore drill
- [ ] Health check + logs cơ bản
- [ ] (Tuỳ chọn) Redis khi có traffic

**Để hệ thống chạy đủ:** HTTPS public URL backend + storefront; migrate trên CI/CD trước start; secrets chỉ trên host (không commit); CORS đúng domain; IPN/return payment trỏ URL prod; health check cho orchestrator; backup schedule + thử restore 1 lần.

---

## Phase 7 — Chất lượng & bảo mật

- [ ] Integration test: create cart → complete order
- [ ] CI: lint + unit seed mapper + (tuỳ chọn) migrate dry-run
- [ ] Rate limit / bot (reCAPTCHA đã có trên FE order/contact)
- [ ] Audit quyền Admin; rotate publishable key nếu lộ
- [ ] Không commit `.env` / publishable production

**Để hệ thống chạy đủ:** CI xanh trên PR; reCAPTCHA keys prod; admin chỉ tài khoản nội bộ; secret API key không đưa lên FE; review CORS và Admin URL không public index nếu không cần.

---

## Phase 8 — Mở rộng sản phẩm (sau khi core ổn)

- [ ] Báo cáo bán hàng đơn giản (Admin hoặc Metabase)
- [ ] Affiliate / mã giảm giá nâng cao
- [ ] Đa ngôn ngữ / đa tiền tệ (chỉ khi có nhu cầu thật)
- [ ] App mobile / headless thêm kênh bán

**Để hệ thống chạy đủ:** Chỉ làm khi Phase 0–6 ổn định prod; mỗi mục cần spec riêng (KPI báo cáo, rule affiliate, locale/currency strategy) trước khi code.

---

## Cách dùng checklist

1. Làm lần lượt theo phase; đừng nhảy Phase 6 trước khi Phase 0–2 xanh.
2. Mỗi mục xong: tick + ghi 1 dòng trong PR.
3. Scope creep: mục mới thêm vào phase phù hợp, không xen vào MVP đã đóng.
4. Đọc **Để hệ thống chạy đủ** trước khi coi phase “xong trên production”.

**Cập nhật lần này:** 2026-09-14 — chú thích “chạy đủ” theo phase; Phase 3 email `order.placed`.
