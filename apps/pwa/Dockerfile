# WorkChat PWA Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./

# Copy package.json files
COPY apps/pwa/package.json ./apps/pwa/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/pwa ./apps/pwa
COPY packages/shared ./packages/shared

# Build shared package first
RUN pnpm --filter @workchat/shared build

# Build arguments for environment variables
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build PWA app
RUN pnpm --filter @workchat/pwa build

# Production stage - serve static files via nginx
FROM nginx:alpine AS runner

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy built assets
COPY --from=builder /app/apps/pwa/dist /usr/share/nginx/html

# Copy nginx configuration for SPA
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; \
    \
    # SPA routing - serve index.html for all routes \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
