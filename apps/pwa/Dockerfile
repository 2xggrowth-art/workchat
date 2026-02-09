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
FROM nginx:alpine

COPY --from=builder /app/apps/pwa/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
