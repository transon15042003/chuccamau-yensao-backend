# Lộ trình backend — Chúc Cà Mau Yến Sào

Checklist sau MVP. Tick `[x]` khi xong.

| | |
|---|---|
| Storefront | `chuccamau-yensao` (Next.js) |
| Backend | `chuccamau-yensao-backend` (Medusa 2.8) |
| Nhánh backend | `feat/medusa-backend-mvp` |

Mỗi phase có hai phần:

1. **Việc đã / cần làm** — checklist kỹ thuật  
2. **Setup** — hướng dẫn từng bước để phase đó chạy được trên máy bạn (env, lệnh, kiểm tra)

Làm phase theo thứ tự. Đừng deploy (Phase 6) trước khi Phase 0–2 xanh.

---

## Phase 0 — Vận hành local ổn định

### Việc đã làm

- [x] Scaffold Medusa 2.8 + Postgres
- [x] Seed region `vn` / `vnd` / `pp_system_default`
- [x] Seed catalog từ JSON storefront
- [x] Smoke Store API
- [x] Checkout COD E2E — `yarn checkout:cod`
- [x] Admin user — `admin@chuccamau.local` · `yarn admin:orders`
- [x] Sync inventory — `yarn sync:inventory` · `yarn verify:stock`
- [x] Chặn OOS lúc complete — `yarn verify:oos`
- [x] README + PR

### Setup Phase 0

**Mục tiêu:** Backend :9000 và storefront :3000 nói chuyện được; xem sản phẩm + đặt COD thử.

1. **Postgres**  
   - Docker: `docker compose up -d` trong repo backend, **hoặc**  
   - Postgres local: tạo DB/user `medusa`/`medusa` (script `scripts/bootstrap-medusa-db.ps1` nếu cần).

2. **Env backend**  
   ```bash
   cd chuccamau-yensao-backend
   cp .env.template .env
   ```  
   Bắt buộc tối thiểu:
   ```env
   DATABASE_URL=postgres://medusa:medusa@127.0.0.1:5432/medusa
   STORE_CORS=http://localhost:3000
   ADMIN_CORS=http://localhost:7001,http://localhost:9000
   AUTH_CORS=http://localhost:3000,http://localhost:7001,http://localhost:9000
   JWT_SECRET=...
   COOKIE_SECRET=...
   ```

3. **Cài + migrate + seed**  
   ```bash
   corepack enable
   corepack yarn install
   corepack yarn medusa db:migrate
   corepack yarn seed
   ```  
   Copy token `pk_…` in log seed (hoặc Admin → Settings → Publishable API Keys).

4. **Chạy backend**  
   ```bash
   corepack yarn dev
   ```  
   Kiểm tra: `http://localhost:9000/app` · Store API `http://localhost:9000`.

5. **Admin**  
   ```bash
   corepack yarn medusa user -e admin@chuccamau.local -p 'LocalDev_ChangeMe1!'
   ```  
   Đăng nhập `/app`, đổi mật khẩu nếu máy dùng chung.

6. **Storefront** — file `.env.local`:  
   ```env
   NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
   NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
   NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=vn
   ```  
   ```bash
   cd chuccamau-yensao && yarn dev
   ```

7. **Kiểm tra**  
   ```bash
   # backend đang chạy
   PUBLISHABLE_API_KEY=pk_... yarn smoke
   PUBLISHABLE_API_KEY=pk_... yarn checkout:cod
   ```

---

## Phase 1 — Checkout & fulfillment

### Việc đã làm

- [x] Enforce inventory lúc complete
- [x] Shipping `STANDARD` / `WORKING_HOURS`
- [x] Metadata cart → order
- [x] Guest COD + retrieve order (`+metadata`)
- [x] Hủy đơn Admin — `yarn admin:cancel`
- [x] Tax region `tp_system` tối thiểu

### Setup Phase 1

**Mục tiêu:** Checkout chọn đúng loại giao hàng; hết hàng thì complete bị 400; Admin hủy được đơn.

1. Seed lại nếu thiếu shipping (sau pull code mới):  
   ```bash
   corepack yarn seed
   ```
2. Storefront nhánh có fix chọn `type.code` (đã push `release`).
3. Chứng minh OOS (server đang chạy, stock > 0 trước khi chạy):  
   ```bash
   PUBLISHABLE_API_KEY=pk_... yarn verify:oos
   ```  
   Kỳ vọng: `oos proof ok` · status `400`.
4. Hủy đơn thử:  
   ```bash
   DISPLAY_ID=8 yarn admin:cancel
   ```
5. VAT chi tiết: chưa cần trừ khi kế toán yêu cầu (chỉ có tax region trống).

---

## Phase 2 — Thanh toán online (VNPay + MoMo)

### Việc đã làm

- [x] Providers `pp_vnpay_vnpay`, `pp_momo_momo`
- [x] IPN `/hooks/vnpay/ipn`, `/hooks/momo/ipn`
- [x] Return pages storefront + mock pay
- [x] COD song song
- [x] Proof `yarn checkout:online`

### Setup Phase 2 — local (mock)

**Mục tiêu:** Không cần tài khoản gateway; vẫn tạo đơn online.

1. Backend `.env`:
   ```env
   PAYMENT_MOCK=1
   STORE_URL=http://localhost:3000
   ```
2. ```bash
   corepack yarn seed
   corepack yarn dev
   ```
3. Proof:
   ```bash
   PUBLISHABLE_API_KEY=pk_... yarn checkout:online vnpay
   PUBLISHABLE_API_KEY=pk_... yarn checkout:online momo
   ```  
   Kỳ vọng: có `payUrl` mock + `order_id`.
4. Trên UI: chọn VNPay/MoMo → redirect `/payment/mock` → trang cảm ơn.

### Setup Phase 2 — sandbox / production

**Mục tiêu:** Thanh toán thật với VNPay/MoMo test hoặc live.

1. Backend `.env`:
   ```env
   PAYMENT_MOCK=0
   VNPAY_TMN_CODE=...
   VNPAY_HASH_SECRET=...
   VNPAY_RETURN_URL=https://<storefront>/payment/vnpay/return
   VNPAY_IPN_URL=https://<backend>/hooks/vnpay/ipn
   MOMO_PARTNER_CODE=...
   MOMO_ACCESS_KEY=...
   MOMO_SECRET_KEY=...
   MOMO_REDIRECT_URL=https://<storefront>/payment/momo/return
   MOMO_IPN_URL=https://<backend>/hooks/momo/ipn
   ```
2. Trên cổng gateway: khai báo đúng return/IPN **HTTPS**; whitelist IP nếu bắt buộc.
3. Restart Medusa; `yarn seed` (gắn provider lên region).
4. Test 1 đơn số tiền nhỏ; đối soát Admin order + capture/pending.
5. Storefront env trỏ đúng backend/publishable key môi trường đó.

---

## Phase 3 — Thông báo đơn (email)

### Việc đã / cần làm

- [x] Email khách khi `order.placed`
- [x] Email owner khi đơn mới
- [x] Template HTML + text VN — `src/lib/order-mail-templates.ts`
- [ ] (Defer) SMS / Zalo OA

### Setup Phase 3

**Mục tiêu:** Mỗi đơn COD hoặc online đều gửi mail, không phụ thuộc browser.

1. Tạo SendGrid; verify **sender domain** / single sender.
2. Backend `.env`:
   ```env
   SENDGRID_API_KEY=SG....
   SENDGRID_SENDER_EMAIL=noreply@domain-da-verify.com
   ORDER_NOTIFY_OWNER_EMAIL=owner@shop.com,backup@shop.com
   ```
3. Restart `yarn dev`.
4. Chạy `yarn checkout:cod` với email khách thật trong script/cart.  
   - Có key: log `owner mail sent` / `customer mail sent`.  
   - Chưa key: log `skip email (set SENDGRID_API_KEY…)`.
5. Form liên hệ storefront (nếu còn dùng): giữ `SENDGRID_*` + `OWNER_EMAIL` trên **FE** `.env` — tách với mail đơn hàng backend.

---

## Phase 4 — Catalog & media

### Việc đã / cần làm

- [x] Ảnh: URL tuyệt đối qua `STORE_PUBLIC_URL` + (tuỳ chọn) `yarn sync:images` → file-local `static/`
- [x] Re-seed an toàn — `yarn sync:catalog` (upsert handle, không skip cứng)
- [x] Collection `san-pham-noi-bat` + SEO metadata tối thiểu (`title`/`description` trong metadata)
- [ ] (Defer) Price list / khuyến mãi — FE checkout discount còn stub
- [ ] (Defer) Multi-location — mới 1 kho «Kho Ca Mau»

### Setup Phase 4

**Mục tiêu:** Sửa JSON catalog → sync lên Medusa; homepage có “Sản phẩm nổi bật”; ảnh mở được từ URL Medusa trả về.

1. Đặt URL gốc ảnh (storefront public) trong backend `.env`:
   ```env
   STORE_PUBLIC_URL=http://localhost:3000
   ```
   Prod: `https://ten-mien-shop.com` (nơi host `public/images/...`).
2. File local (Admin upload / script upload):
   ```env
   MEDUSA_BACKEND_URL=http://localhost:9000
   ```
   Ảnh upload lưu `static/` (gitignore), serve qua backend.
3. Lệnh:
   ```bash
   corepack yarn sync:catalog    # upsert sản phẩm/collection từ seed/data
   corepack yarn sync:inventory  # stock theo SKU
   corepack yarn sync:images     # upload ảnh local vào file module (tuỳ chọn)
   ```
4. Kiểm tra: Store API product `images[].url` là URL tuyệt đối; FE homepage section nổi bật có sản phẩm.
5. Khi deploy tách host FE/BE: chuyển `file-s3` (Phase 6) hoặc giữ `STORE_PUBLIC_URL` trỏ CDN/FE.

---

## Phase 5 — Khách hàng & tài khoản

### Việc đã / cần làm

- [x] Customer auth email/password — UI `/account/login` · `/account/register`
- [x] Sổ địa chỉ — `/account/addresses` + provinces API
- [x] Lịch sử đơn — `/account/orders` (`listOrders` + JWT)
- [x] Nav «TÀI KHOẢN» · fix `signout` → `/account/login`
- [ ] (Defer) OTP / social login

### Setup Phase 5

**Mục tiêu:** Đăng ký/đăng nhập; xem đơn; sổ địa chỉ; guest checkout vẫn chạy.

1. Backend đang chạy (`yarn dev`); CORS đã có `http://localhost:3000`.
2. Storefront `.env.local` đủ Medusa URL + publishable key.
3. Mở `http://localhost:3000/account/register` → tạo tài khoản.
4. Vào **Tài khoản** → **Đơn hàng** / **Sổ địa chỉ**.
5. Guest đặt COD không login vẫn OK; sau login, `transferCart` gắn cart guest (nếu còn).

---

## Phase 6 — Deploy & môi trường

### Việc đã / cần làm

- [x] Hướng free-forever: **Neon** (Postgres) + **Northflank** (Medusa) — `docs/deploy-free.md` + `Dockerfile`
- [x] Bỏ Render Blueprint / Supabase cho Phase 6 (Render DB hết hạn 30 ngày; Supabase hết slot free)
- [x] Tạo Neon project `chuccamau-yensao-medusa` (`morning-waterfall-43478669`, Singapore)
- [x] Migrate + seed trên Neon (catalog sẵn)
- [ ] Deploy Medusa lên Northflank (trỏ `DATABASE_URL` Neon)
- [ ] Secrets / CORS + publishable key → FE
- [ ] (Tuỳ chọn) Redis / backup

### Setup Phase 6

Xem chi tiết: **`docs/deploy-free.md`**.

1. Neon Free → copy connection string (`sslmode=require`).
2. Northflank Developer Sandbox → Git deploy branch `feat/medusa-backend-mvp` (Dockerfile).
3. Env: `DATABASE_URL`, JWT/COOKIE, CORS, `MEDUSA_BACKEND_URL`, `PAYMENT_MOCK=1`.
4. Shell: `medusa user` · `yarn seed` · đưa `pk_…` vào storefront.
---

## Phase 7 — Chất lượng & bảo mật

### Việc cần làm

- [ ] Integration test checkout
- [ ] CI lint + unit
- [ ] Rate limit / reCAPTCHA prod
- [ ] Audit Admin + rotate key nếu lộ
- [ ] Không commit `.env` / key prod

### Setup Phase 7

1. Bật CI trên PR (lint, `yarn test:unit`).
2. reCAPTCHA keys **prod** trên FE.
3. Chỉ account nội bộ vào `/app`; secret API key không đưa lên browser.
4. Nếu `pk_` lộ: tạo key mới, gắn sales channel, tắt key cũ.

---

## Phase 8 — Mở rộng (sau core ổn)

### Việc cần làm

- [ ] Báo cáo bán hàng
- [ ] Affiliate / coupon nâng cao
- [ ] i18n / đa tiền tệ khi có nhu cầu
- [ ] App / kênh headless thêm

### Setup Phase 8

Chỉ bắt đầu khi Phase 0–6 ổn định trên production. Mỗi mục cần spec riêng (KPI, rule affiliate, locale) trước khi code.

---

## Quy ước

1. Tick checklist khi code + Setup của phase đó đã chạy được trên máy (hoặc staging).  
2. Ghi ngắn trong PR khi đóng phase.  
3. Scope mới → đúng phase; không nhét vào MVP đã đóng.

**Cập nhật:** 2026-09-14 — Phase 6 chuyển Neon + Northflank (free-forever); bỏ Render Blueprint.
