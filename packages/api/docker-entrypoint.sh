#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/packages/database
npx prisma migrate deploy

# Run seed only if SEED_DB=true
if [ "$SEED_DB" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

echo "Starting API server..."
cd /app/packages/api
exec node dist/server.js
