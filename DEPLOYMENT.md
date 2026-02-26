# WorkChat Deployment Guide

## Quick Reference

| Service | Coolify Resource UUID | Production URL | Dockerfile |
|---------|----------------------|----------------|------------|
| **API** | `e4884ck0w8ww0sokksk4kkok` | `workchatapi.2xg.in` | `packages/api/Dockerfile` |
| **Web** | `aok8s8ks4kcg8ksgso8kcowg` | `workchat.2xg.in` | `apps/web/Dockerfile` |
| **PWA** | `g0w08k0g0gkwgkwcc48kowcw` | `pwa.workchat.2xg.in` | `apps/pwa/Dockerfile` |

---

## Server & Infrastructure

- **OVH VPS IP:** `51.195.46.40`
- **SSH:** `ssh root@51.195.46.40`
- **Coolify Panel:** `http://51.195.46.40:8000`
- **Coolify API Token:** `<COOLIFY_API_TOKEN>`
- **Server Specs:** 6 CPU, 12GB RAM, 97GB disk, Ubuntu

---

## Git Repositories

| Remote | URL | Auth |
|--------|-----|------|
| `origin` | `git@github.com:arsalan507/workchat.git` | SSH key |
| `2xg` | `https://github.com/2xggrowth-art/workchat.git` | PAT below |

- **GitHub PAT (2xggrowth-art):** `<GITHUB_PAT>`
- **Push to 2xg remote:** `git push https://<GITHUB_PAT>@github.com/2xggrowth-art/workchat.git main`

---

## Database

- **Container name:** `vg0o8scg484k4k0ccc0w4ooc`
- **Production DATABASE_URL:** `postgresql://workchat:<DB_PASSWORD>@vg0o8scg484k4k0ccc0w4ooc:5432/workchat`
- **Engine:** PostgreSQL 16

### Running SQL on Production DB
```bash
ssh root@51.195.46.40 "docker exec -i vg0o8scg484k4k0ccc0w4ooc psql -U workchat -d workchat -c 'YOUR SQL HERE'"
```

### Running Prisma Migrations Manually
Since the Dockerfile does NOT auto-run migrations, you must apply schema changes directly:

1. **Create migration file** in `packages/database/prisma/migrations/YYYYMMDDHHMMSS_name/migration.sql`
2. **Run the SQL on production:**
   ```bash
   ssh root@51.195.46.40 "docker exec -i vg0o8scg484k4k0ccc0w4ooc psql -U workchat -d workchat" <<'EOSQL'
   -- paste your migration SQL here
   EOSQL
   ```
3. **Mark migration as applied in Prisma:**
   ```bash
   ssh root@51.195.46.40 "docker exec -i vg0o8scg484k4k0ccc0w4ooc psql -U workchat -d workchat -c \"INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ('$(uuidgen)', 'manual', 'MIGRATION_NAME_HERE', NOW(), 1) ON CONFLICT DO NOTHING;\""
   ```

---

## Deployment Steps (Standard Flow)

### 1. Commit & Push
```bash
cd workchat/
git add <files>
git commit -m "description"
git push origin main
git push https://<GITHUB_PAT>@github.com/2xggrowth-art/workchat.git main
```

### 2. Trigger Coolify Redeploy
Coolify rebuilds from the Dockerfile on each restart.

**API (backend changes, schema changes):**
```bash
curl -s -X POST "http://51.195.46.40:8000/api/v1/applications/e4884ck0w8ww0sokksk4kkok/restart" \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>" \
  -H "Content-Type: application/json"
```

**Web (frontend changes):**
```bash
curl -s -X POST "http://51.195.46.40:8000/api/v1/applications/aok8s8ks4kcg8ksgso8kcowg/restart" \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>" \
  -H "Content-Type: application/json"
```

**PWA (PWA changes):**
```bash
curl -s -X POST "http://51.195.46.40:8000/api/v1/applications/g0w08k0g0gkwgkwcc48kowcw/restart" \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>" \
  -H "Content-Type: application/json"
```

### 3. Check Deployment Status
```bash
# Replace DEPLOYMENT_UUID with the uuid returned from the restart call
curl -s "http://51.195.46.40:8000/api/v1/deployments/DEPLOYMENT_UUID" \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))"
```

### 4. Run Database Migrations (if schema changed)
See the "Running Prisma Migrations Manually" section above.

---

## Which Services to Redeploy

| What Changed | Redeploy |
|-------------|----------|
| `packages/database/prisma/schema.prisma` | API + run migration SQL on DB |
| `packages/api/src/**` | API only |
| `packages/shared/src/**` | API + Web + PWA (all use shared) |
| `apps/web/src/**` | Web only |
| `apps/pwa/src/**` | PWA only |

---

## Dockerfiles Summary

### API (`packages/api/Dockerfile`)
- Base: `node:20-slim` (needs OpenSSL for Prisma)
- Installs: wget, openssl, ca-certificates
- Build: pnpm install → prisma generate → build database → build shared → build api
- Runs: `node dist/server.js` on port 3000
- Healthcheck: `GET /health`

### Web (`apps/web/Dockerfile`)
- Multi-stage: Node 20-alpine (build) → nginx:alpine (serve)
- Build args: `VITE_API_URL`, `VITE_WS_URL`
- Build: pnpm install → build shared → build web (Vite)
- Serves: nginx with SPA routing on port 80
- Gzip + asset caching enabled

### PWA (`apps/pwa/Dockerfile`)
- Identical to Web Dockerfile
- Build args: `VITE_API_URL`, `VITE_WS_URL`
- Serves: nginx on port 80

---

## Environment Variables (Production)

### API Container
| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | `postgresql://workchat:<DB_PASSWORD>@vg0o8scg484k4k0ccc0w4ooc:5432/workchat` |
| `REDIS_URL` | (internal redis container) |
| `JWT_SECRET` | (set in Coolify) |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `MINIO_ENDPOINT` | (internal minio container or workchat-downloads) |
| `CORS_ORIGIN` | `https://workchat.2xg.in` |

### Web/PWA Build Args
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://workchatapi.2xg.in` |
| `VITE_WS_URL` | `wss://workchatapi.2xg.in` |

### Get ENV vars from Coolify API
```bash
curl -s "http://51.195.46.40:8000/api/v1/applications/RESOURCE_UUID/envs" \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>"
```

---

## Checking Running Containers

```bash
# Find WorkChat containers
ssh root@51.195.46.40 "docker ps --format '{{.Names}}' | grep -E 'e4884|aok8s|g0w08|vg0o8'"

# Get env from running API container
ssh root@51.195.46.40 "docker exec CONTAINER_NAME printenv DATABASE_URL"

# Check API health
curl -s https://workchatapi.2xg.in/health

# View API logs
ssh root@51.195.46.40 "docker logs --tail 50 CONTAINER_NAME"
```

---

## Troubleshooting

### Build fails with TypeScript errors
- Check that `packages/shared` types are up to date
- Ensure all imports resolve correctly
- Run `pnpm typecheck` locally before pushing

### API won't start (Prisma errors)
- Prisma needs OpenSSL — use `node:20-slim` not `node:20-alpine`
- Ensure `DATABASE_URL` env var is set in Coolify
- Run `prisma generate` during build (it's in the Dockerfile)

### Migration not applied
- The Dockerfile does NOT run `prisma migrate deploy`
- Must manually run SQL on the production DB container
- Mark it in `_prisma_migrations` table so Prisma knows

### Push to 2xggrowth-art fails (403)
- SSH key doesn't work for this repo
- Must use HTTPS with PAT: `git push https://<GITHUB_PAT>@github.com/2xggrowth-art/workchat.git main`

### WebSocket not connecting
- Check `VITE_WS_URL` uses `wss://` (not `ws://`) for HTTPS
- Ensure Coolify/nginx proxies `/socket.io/` path correctly

---

## Critical Rules

1. **Never share the WorkChat DB** with other projects (each project gets its own PostgreSQL)
2. **Always push to both repos** — origin (arsalan507) and 2xg (2xggrowth-art)
3. **Run migrations manually** on production DB — Dockerfile doesn't auto-migrate
4. **Only redeploy what changed** — don't restart all 3 services if only API code changed
5. **Check deployment status** before assuming it's live — Coolify builds can take 2-5 minutes
