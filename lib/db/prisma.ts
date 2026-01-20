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
    // Return a client that will fail on actual queries
    return new PrismaClient()
  }

  // Enable SSL for Supabase/cloud databases
  const isCloudDb = connectionString.includes('supabase') || connectionString.includes('neon') || connectionString.includes('railway')
  const pool = new Pool({
    connectionString,
    ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Helper to check if database is available
export async function isDatabaseAvailable(): Promise<boolean> {
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
