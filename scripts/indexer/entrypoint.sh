#!/bin/sh
set -e

# Note: Database migrations should be run manually using direct connection (port 5432)
# not the pooler connection (port 6543). Run: DATABASE_URL="..." npx prisma db push

echo "Starting indexer..."
exec pnpm exec tsx scripts/indexer/index.ts
