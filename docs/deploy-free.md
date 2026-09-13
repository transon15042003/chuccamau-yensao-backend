# Deploy free-forever (Phase 6) — Neon + Render

Mục tiêu: Postgres + Medusa Node, **free không hết hạn 30 ngày** (DB).

| Vai trò | Dịch vụ | Ghi chú |
|--------|---------|---------|
| Postgres | **[Neon](https://neon.tech)** Free | Đã tạo · scale-to-zero · Singapore |
| App Medusa | **[Render](https://render.com)** Free **Web Service** | Sleep ~15 phút idle · **không** dùng Render Postgres |
| (Tuỳ chọn 24/7) | Oracle Always Free ARM | Nặng hơn |

**Không dùng:** Render Blueprint/Postgres (DB hết hạn 30 ngày), Northflank, Supabase (hết slot).

---

## 1) Neon — Postgres (đã xong)

| | |
|--|--|
| Project | `chuccamau-yensao-medusa` |
| ID | `morning-waterfall-43478669` |
| Region | `aws-ap-southeast-1` |
| Database / role | `medusa` / `medusa` |

`DATABASE_URL`: Neon Console → Connection details (agent store `neon-chuccamau-yensao.md`).  
Direct host cho migrate; `sslmode=require`. **Không commit** password.

Đã chạy: `medusa db:migrate` + `yarn seed` (20 products + publishable key).

---

## 2) Render — Web Service (Medusa)

### Qua MCP Cursor (khi auth OK)

`create_web_service` · runtime **node** (không Docker) · plan **free** · region **singapore** · repo GitHub · branch `feat/medusa-backend-mvp`.

### Qua dashboard

1. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service**
2. Connect `transon15042003/chuccamau-yensao-backend`
3. Branch: `feat/medusa-backend-mvp` · Runtime: **Node**
4. Build / Start:

```text
Build:  node .yarn/releases/yarn-4.12.0.cjs install && node .yarn/releases/yarn-4.12.0.cjs build
# (package.json build also copies .medusa/server/public → public for medusa start)
Start:  node .yarn/releases/yarn-4.12.0.cjs medusa db:migrate && node .yarn/releases/yarn-4.12.0.cjs medusa start
```

(Không dùng `corepack enable` trên Render — EROFS. Dùng Yarn binary trong repo.)
Node: `20.x` (`.node-version` / `engines`).

5. Plan: **Free** · Region: **Singapore**
6. Env: xem `docs/render-env.template` — dán `DATABASE_URL` Neon + JWT/COOKIE.

Sau deploy: URL dạng `https://chuccamau-yensao-backend.onrender.com`  
→ cập nhật `MEDUSA_BACKEND_URL`, `ADMIN_CORS`, `MEDUSA_FILE_URL` cho khớp URL thật.

**Tạo admin (không cần Render Shell — Free không có Shell):** chạy trên máy local, trỏ `DATABASE_URL` = Neon (cùng DB prod):

```bash
export DATABASE_URL='postgresql://…neon…/medusa?sslmode=require'
node .yarn/releases/yarn-4.12.0.cjs medusa user -e admin@chuccamau.local -p 'YourStrongPass1!'
```

Đăng nhập Admin: `https://chuccamau-yensao-backend.onrender.com/app`

FE: publishable key từ seed Neon.

### Giới hạn Render Free

- Sleep sau ~15 phút không traffic (cold start + Neon wake).
- RAM ~512MB — Medusa có thể chặt; nếu OOM → cân nhắc starter hoặc Oracle VM.

---

## Sau deploy

1. `GET /health`
2. Admin `/app`
3. FE: backend URL + `pk_…`
4. Ảnh: `STORE_PUBLIC_URL` (disk ephemeral)
