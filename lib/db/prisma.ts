import { PrismaClient } from '../generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Prevent multiple instances of Prisma Client in development
// https://www.prisma.io/docs/support/help-articles/nextjs-prisma-client-dev-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPrismaClient(): PrismaClient {
  // Create a PostgreSQL connection pool
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.warn('DATABASE_URL not set, Prisma will not be able to connect to the database')
    // Throw error - caller should check for DATABASE_URL before using prisma
    throw new Error('DATABASE_URL is required to use the database')
  }

  // Enable SSL for Supabase/cloud databases
  const isCloudDb = connectionString.includes('supabase') || connectionString.includes('pooler.supabase') || connectionString.includes('neon') || connectionString.includes('railway')
  const pool = new Pool({
    connectionString,
    ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
    max: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  })
  globalForPrisma.pool = pool

  // Create the Prisma adapter
  const adapter = new PrismaPg(pool)

  // Create and return the Prisma client with the adapter
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })
}

// Lazy initialization - only create client when actually accessed
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Export a proxy that lazily initializes prisma on first use
// This prevents initialization during build time
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getPrismaClient()[prop as keyof PrismaClient]
  }
})

// Helper to check if database is available
export async function isDatabaseAvailable(): Promise<boolean> {
  // Quick check - if no DATABASE_URL, database is definitely not available
  if (!process.env.DATABASE_URL) {
    return false
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

// Helper to check if USE_DATABASE is enabled
export function useDatabaseEnabled(): boolean {
  return process.env.USE_DATABASE === 'true'
}

export default prisma
