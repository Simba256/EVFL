#!/bin/sh
set -e

echo "Running database migrations..."
pnpm exec prisma db push || echo "Migration failed or already up to date, continuing..."

echo "Starting indexer..."
exec pnpm exec tsx scripts/indexer/index.ts
