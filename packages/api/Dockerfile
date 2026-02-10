# WorkChat API Dockerfile
# Single stage build for reliability with pnpm monorepo
# Using Debian slim instead of Alpine for Prisma OpenSSL compatibility

FROM node:20-slim

WORKDIR /app

# Install wget for healthcheck, openssl for Prisma, and enable pnpm
RUN apt-get update && apt-get install -y --no-install-recommends wget openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy entire workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @workchat/database prisma generate

# Build database package (exports prisma client)
RUN pnpm --filter @workchat/database build

# Build shared package
RUN pnpm --filter @workchat/shared build

# Build API
RUN pnpm --filter @workchat/api build

# Create entrypoint inline
RUN printf '#!/bin/sh\nset -e\necho "Running Prisma migrations..."\ncd /app/packages/database\nnpx prisma migrate deploy\nif [ "$SEED_DB" = "true" ]; then\n  echo "Seeding database..."\n  npx prisma db seed\nfi\necho "Starting API server..."\ncd /app/packages/api\nexec node dist/server.js\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set working directory to api
WORKDIR /app/packages/api

# Expose port
EXPOSE 3000

# Health check - generous start period for migrations
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["/app/entrypoint.sh"]
