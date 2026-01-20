import { NextResponse } from 'next/server'
import { prisma, isDatabaseAvailable, useDatabaseEnabled } from '@/lib/db'

export async function GET() {
  const result: Record<string, unknown> = {
    USE_DATABASE: process.env.USE_DATABASE,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_PREVIEW: process.env.DATABASE_URL?.substring(0, 50) + '...',
    NODE_ENV: process.env.NODE_ENV,
    useDatabaseEnabled: useDatabaseEnabled(),
  }

  try {
    result.isDatabaseAvailable = await isDatabaseAvailable()
  } catch (error) {
    result.isDatabaseAvailable = false
    result.availabilityError = (error as Error).message
  }

  if (result.isDatabaseAvailable) {
    try {
      const count = await prisma.token.count()
      result.tokenCount = count
    } catch (error) {
      result.tokenCountError = (error as Error).message
    }
  }

  return NextResponse.json(result)
}
