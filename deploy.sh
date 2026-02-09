#!/bin/bash
set -e

echo "========================================="
echo "  WorkChat Production Deployment"
echo "========================================="

# Pull latest code
echo "[1/5] Pulling latest code..."
git pull origin main

# Build all services
echo "[2/5] Building Docker images..."
docker compose -f docker/docker-compose.prod.yml build

# Run database migrations
echo "[3/5] Running database migrations..."
docker compose -f docker/docker-compose.prod.yml run --rm api npx prisma migrate deploy

# Start all services
echo "[4/5] Starting services..."
docker compose -f docker/docker-compose.prod.yml up -d

# Health check
echo "[5/5] Checking health..."
sleep 10
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "API health check passed."
else
    echo "WARNING: API health check failed. Check logs with:"
    echo "  docker logs workchat-api"
    exit 1
fi

echo ""
echo "========================================="
echo "  Deploy complete!"
echo "========================================="
echo ""
echo "Services:"
docker compose -f docker/docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
