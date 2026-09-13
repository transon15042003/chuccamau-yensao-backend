# Deploy free-forever (Phase 6) — không dùng Render / Supabase

Mục tiêu: Postgres + Medusa Node cho shop nhỏ, **tier miễn phí không hết hạn 30 ngày**.

| Vai trò | Dịch vụ | Ghi chú |
|--------|---------|---------|
| Postgres | **[Neon](https://neon.tech)** Free | Free mãi · scale-to-zero · 0.5 GB/project · không dùng slot Supabase |
| App Medusa | **[Northflank](https://northflank.com)** Developer Sandbox | Free · 2 services + 1 addon · Git deploy · cần payment method để verify |
| (Tuỳ chọn always-on) | **Oracle Cloud Always Free** ARM VM | VM thật 24/7 · capacity ARM hay hết · setup nặng hơn |

**Không dùng:** Render Blueprint/Postgres free (DB hết hạn 30 ngày), Supabase (đã đủ project free), Koyeb Starter (đóng signup mới).

---

## 1) Neon — tạo DB

1. [console.neon.tech](https://console.neon.tech) → New project · region gần VN (`ap-southeast-1` nếu có).
2. Copy **connection string** (pooled hoặc direct) → thêm `?sslmode=require` nếu chưa có.
3. Đó là `DATABASE_URL` cho Medusa.

Cold start vài giây sau idle ~5 phút — ổn với MVP.

---

## 2A) Northflank — deploy Medusa (khuyến nghị)

1. Đăng ký · chọn **Developer Sandbox**.
2. New project → **Combined service** (hoặc Build from Git) → repo `chuccamau-yensao-backend`, branch `feat/medusa-backend-mvp`.
3. Runtime: Dockerfile trong repo (hoặc buildpack Node 20).
4. Env (Secrets):

| Key | Giá trị |
|-----|---------|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` / `COOKIE_SECRET` | random dài |
| `NODE_ENV` | `production` |
| `STORE_CORS` / `AUTH_CORS` | origin FE (`http://localhost:3000` + domain prod) |
| `ADMIN_CORS` | URL public của service này |
| `STORE_URL` / `STORE_PUBLIC_URL` | URL storefront |
| `MEDUSA_BACKEND_URL` | URL public service |
| `MEDUSA_FILE_URL` | `{MEDUSA_BACKEND_URL}/static` |
| `PAYMENT_MOCK` | `1` đến khi có VNPay/MoMo thật |
| `PORT` | do platform set (Medusa bind `0.0.0.0:$PORT`) |

5. Start / CMD đã có trong Dockerfile: migrate rồi `medusa start`.
6. Sau deploy xanh: mở shell Northflank → `yarn medusa user …` · `yarn seed` · copy `pk_…` vào FE.

Addon Postgres của Northflank cũng free trong sandbox — nhưng **Neon** tách DB rõ hơn và không phụ thuộc 1 addon slot.

---

## 2B) Oracle Always Free — nếu cần 24/7 không sleep

1. [cloud.oracle.com](https://cloud.oracle.com) → Always Free · shape `VM.Standard.A1.Flex` (ARM).
2. Ubuntu ARM · mở security list 80/443 · cài Docker · clone repo · `docker compose` hoặc `docker build` + run với env như bảng trên + Neon `DATABASE_URL`.
3. Caddy/Nginx reverse proxy + HTTPS (Let’s Encrypt).

ARM capacity thường thiếu — có thể phải retry tạo instance.

---

## Sau deploy

1. Health: `GET /health`
2. Admin `/app` · seed catalog nếu chưa
3. FE prod: `MEDUSA_BACKEND_URL` + publishable key
4. Ảnh: dùng `STORE_PUBLIC_URL` (disk container ephemeral)

---

## Giới hạn thực tế

- Neon Free: storage 0.5 GB/project · CU-hours · scale-to-zero.
- Northflank Sandbox: không dành production lớn; đủ MVP/hobby.
- Oracle: free forever nhưng tự ops (SSH, firewall, cập nhật).
