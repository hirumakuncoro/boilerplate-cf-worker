# Boilerplate CF Worker

Hono + Cloudflare Workers + Drizzle ORM. Support agnostic DB (D1 / PostgreSQL) dan Storage (R2 / MinIO).

---

## Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **ORM:** Drizzle
- **DB:** D1 (default) atau PostgreSQL via Hyperdrive
- **Storage:** R2 (default) atau MinIO
- **Auth:** JWT (access token 15 menit + refresh token 7 hari via KV)

---

## Struktur Folder

```
src/
├── server.ts               # Entry point
├── app.ts                  # Hono instance + middleware
├── config/env.ts           # Type environment
├── routes/index.ts         # Register semua routes
├── modules/
│   ├── auth/               # Register, login, logout, refresh, me
│   └── upload/             # Upload file
├── db/
│   ├── schema/             # Drizzle schema
│   ├── client.ts           # DB client factory (D1 / PG)
│   └── index.ts
├── storage/
│   ├── IStorage.ts         # Interface
│   ├── r2.storage.ts
│   └── minio.storage.ts
├── middlewares/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   └── rate-limit.middleware.ts
└── lib/
    ├── auth.ts             # bcrypt + JWT utils
    ├── response.ts         # Standard response helper
    └── errors.ts           # Custom error classes
```

---

## Setup Awal

```bash
bun install
bun run cf-typegen   # generate CloudflareBindings types
```

> Jalankan ulang `cf-typegen` setiap kali ubah `wrangler.jsonc`.

---

## Mode Development

### 1. Buat file `.dev.vars` di root project

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=dev-secret-key
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

> File ini dibaca otomatis oleh Wrangler saat `dev`. Jangan di-commit ke git!

### 2. Pilih DB Driver di `wrangler.jsonc`

```jsonc
"vars": {
  "DB_DRIVER": "pg"   // ganti ke "d1" untuk pakai D1 local
}
```

### 3. Pilih Storage Driver di `wrangler.jsonc`

```jsonc
"vars": {
  "STORAGE_DRIVER": "minio"   // ganti ke "r2" untuk pakai R2
}
```

### 4. Jalankan dev server

```bash
bun run dev
```

### 5. Migration database

```bash
bun run db:generate   # generate migration files
bun run db:migrate    # jalankan migration ke DB
bun run db:studio     # GUI untuk lihat data (opsional)
```

---

## Mode Production

### Pertama kali setup (sekali saja)

**1. Set secrets:**

```bash
bun run setup:secrets
# Akan prompt input nilai satu per satu
```

Atau satu per satu manual:

```bash
wrangler secret put DATABASE_URL --env production
wrangler secret put JWT_SECRET --env production
wrangler secret put MINIO_ACCESS_KEY --env production
wrangler secret put MINIO_SECRET_KEY --env production
```

**2. Setup Hyperdrive (kalau pakai PostgreSQL di VPS):**

```bash
wrangler hyperdrive create my-hyperdrive \
  --connection-string="postgresql://user:pass@VPS_IP:5432/dbname"
```

Masukkan ID yang didapat ke `wrangler.jsonc`:

```jsonc
"env": {
  "production": {
    "hyperdrive": [
      {
        "binding": "HYPERDRIVE",
        "id": "id-dari-output-wrangler"
      }
    ]
  }
}
```

**3. Jalankan migration ke DB production:**

```bash
# Ganti DATABASE_URL di .env ke DB production dulu
bun run db:migrate
```

### Deploy

```bash
bun run deploy
```

### Update secret production

```bash
# Update semua
bun run setup:secrets

# Update satu
wrangler secret put DATABASE_URL --env production

# Lihat daftar secrets
wrangler secret list --env production
```

---

## Pilih DB: D1 vs PostgreSQL

| | D1 | PostgreSQL |
|---|---|---|
| Config | `DB_DRIVER=d1` | `DB_DRIVER=pg` |
| Cocok untuk | App kecil-medium | App besar, data kompleks |
| Koneksi prod | Langsung (binding) | Via Hyperdrive |
| Setup | Zero config | Butuh Hyperdrive |

Ganti driver cukup ubah `DB_DRIVER` di `wrangler.jsonc` — tidak perlu ubah kode apapun.

---

## Pilih Storage: R2 vs MinIO

| | R2 | MinIO |
|---|---|---|
| Config | `STORAGE_DRIVER=r2` | `STORAGE_DRIVER=minio` |
| Cocok untuk | Production CF | Self-hosted / local dev |
| Setup | Binding di wrangler | Butuh endpoint + credentials |

Ganti driver cukup ubah `STORAGE_DRIVER` di `wrangler.jsonc`.

---

## Tambah Module Baru

Copy pattern dari `src/modules/auth/`:

```
src/modules/nama-module/
├── nama-module.route.ts      # Router + Zod validation
├── nama-module.service.ts    # Business logic
├── nama-module.repository.ts # DB access
└── nama-module.schema.ts     # Zod schemas
```

Daftarkan di `src/routes/index.ts`:

```ts
import { namaModuleRouter } from '../modules/nama-module/nama-module.route'

routes.route('/nama-module', namaModuleRouter)
```

---

## Endpoints

```
GET  /health              # Health check
POST /auth/register       # Register
POST /auth/login          # Login
POST /auth/logout         # Logout (butuh refreshToken)
POST /auth/refresh        # Refresh access token
GET  /auth/me             # Data user login (butuh Bearer token)
POST /upload              # Upload file (butuh Bearer token)
```

---

## Environment Variables

| Variable | Keterangan | Secret? |
|---|---|---|
| `DB_DRIVER` | `d1` atau `pg` | ❌ |
| `DATABASE_URL` | Connection string PostgreSQL | ✅ |
| `JWT_SECRET` | Secret untuk JWT | ✅ |
| `STORAGE_DRIVER` | `r2` atau `minio` | ❌ |
| `STORAGE_PUBLIC_URL` | Base URL public storage | ❌ |
| `MINIO_ENDPOINT` | Endpoint MinIO | ❌ |
| `MINIO_BUCKET` | Nama bucket MinIO | ❌ |
| `MINIO_ACCESS_KEY` | Access key MinIO | ✅ |
| `MINIO_SECRET_KEY` | Secret key MinIO | ✅ |
