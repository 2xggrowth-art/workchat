# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WorkChat is a WhatsApp-style workplace chat application with enforced task execution. It features real-time messaging, group chats with role-based permissions, task management tied to messages, and multi-tenancy via organizations.

## Monorepo Structure

pnpm workspaces + Turborepo monorepo. All packages use `workspace:*` protocol for internal dependencies.

- **packages/api** (`@workchat/api`) — Fastify + Socket.io backend API server, built with tsup
- **packages/database** (`@workchat/database`) — Prisma ORM package (PostgreSQL), exports `prisma` client instance
- **packages/shared** (`@workchat/shared`) — Shared types, constants, and utilities; exports subpaths: `@workchat/shared/types`, `/constants`, `/utils`
- **apps/web** (`@workchat/web`) — React admin portal (Vite + Tailwind CSS)
- **apps/pwa** (`@workchat/pwa`) — Progressive Web App, the primary end-user chat client (Vite + Tailwind CSS)
- **apps/mobile** (`@workchat/mobile`) — React Native Expo app (SDK 50, NativeWind for styling)

## Common Commands

```bash
# Install dependencies
pnpm install

# Start all services in dev mode
pnpm dev

# Start individual services
pnpm dev:api          # API on :3000
pnpm dev:web          # Web admin on :5173
pnpm dev:mobile       # Expo dev server

# Build
pnpm build            # Build all packages
pnpm build:api        # Build API only
pnpm build:web        # Build web only

# Type checking & linting
pnpm typecheck        # Typecheck all packages
pnpm lint             # Lint all packages

# Database (Prisma)
pnpm db:generate      # Regenerate Prisma client after schema changes
pnpm db:migrate       # Create and apply a new migration (dev)
pnpm db:migrate:deploy # Apply pending migrations (production)
pnpm db:push          # Push schema changes without migration (prototyping)
pnpm db:seed          # Seed database
pnpm db:studio        # Open Prisma Studio GUI

# Docker (local dev infra: Postgres, Redis, MinIO)
pnpm docker:up        # Start Postgres, Redis, MinIO containers
pnpm docker:down      # Stop containers
```

## Architecture

### API Server (`packages/api`)
- **Framework**: Fastify with plugins for JWT auth, CORS, rate limiting, multipart uploads
- **Routes** registered at: `/api/auth`, `/api/users`, `/api/chats`, `/api/tasks`, `/api/upload`, `/api/org`
- **Real-time**: Socket.io runs on the same HTTP server. Socket handlers are in `packages/api/src/socket/index.ts`
- **Socket events**: `join_chat`, `leave_chat`, `typing`, `send_message`, `mark_read`, `mark_chat_read`, `new_message`, `user_online/offline`
- **Auth flow**: JWT access tokens (15m) + refresh tokens stored in DB. Socket auth uses the same JWT via `handshake.auth.token`
- **File storage**: Dual-mode — MinIO/S3 when `MINIO_ENDPOINT` is set, otherwise local filesystem (`UPLOAD_DIR`)
- **Scheduler**: `node-cron` for recurring task creation (daily check)
- **Auth middleware chain**: `authenticate` → `requireChatMember` → `requireGroupPermission`/`requireGroupAdmin`/`requireGroupOwner`

### Database (`packages/database`)
- PostgreSQL via Prisma. Schema at `packages/database/prisma/schema.prisma`
- Key models: Organization → User → Chat → Message → Task (with TaskStep, TaskProof, TaskActivity)
- Multi-tenancy: Users and Chats scoped to an Organization via `orgId`
- Tasks are linked 1:1 to Messages (`message.isTask` + `task.messageId`)
- Chat member roles: OWNER > ADMIN > MEMBER (WhatsApp-style)
- User roles (app-level): SUPER_ADMIN, ADMIN, STAFF
- Prisma uses `@@map()` for snake_case table/column names

### Frontend Apps
- **State management**: Zustand stores (`authStore`, `chatStore`, `taskStore`)
- **API client**: Axios with interceptors for JWT refresh
- **Real-time**: socket.io-client, connects with JWT token
- **Web admin** (`apps/web`): Admin portal with user approval, org settings. Uses React Router, TanStack Query
- **PWA** (`apps/pwa`): Primary chat interface with all user-facing screens (chat, tasks, groups, profiles). Uses React Router, Lucide icons
- **Mobile** (`apps/mobile`): React Native with Expo, `@react-navigation/native-stack`, NativeWind (Tailwind for RN)

### Build & Dev
- TypeScript strict mode, target ES2022, `noUncheckedIndexedAccess` enabled
- All packages build to `dist/` via tsup (API, database, shared) or Vite (web, PWA)
- API dev uses `tsx watch` with `--env-file=../../.env` (env file lives at repo root)
- Production: Docker Compose with Postgres, Redis; API image built from `Dockerfile.api`
- Deployment: Coolify on OVH VPS, or manual via `deploy.sh`

## Environment Setup

Copy `.env.example` to `.env` at repo root. Key services needed for local dev:
- PostgreSQL (port 5432) — use `pnpm docker:up`
- Redis (port 6379)
- MinIO (port 9000/9001) — optional, falls back to local filesystem uploads
- Twilio Verify — for OTP auth in production; optional for dev
