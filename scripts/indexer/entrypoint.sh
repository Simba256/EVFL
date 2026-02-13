#!/bin/sh
set -e

echo "Running database migrations..."
pnpm exec prisma db push --skip-generate

echo "Starting indexer..."
exec pnpm exec tsx scripts/indexer/index.ts
