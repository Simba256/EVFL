import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export async function GET() {
  const result: Record<string, unknown> = {
    USE_DATABASE: process.env.USE_DATABASE,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_PREVIEW: process.env.DATABASE_URL?.substring(0, 50) + '...',
    NODE_ENV: process.env.NODE_ENV,
  }

  // Try direct pg connection to see the actual error
  const connectionString = process.env.DATABASE_URL
  if (connectionString) {
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })

    try {
      const client = await pool.connect()
      const res = await client.query('SELECT COUNT(*) FROM "Token"')
      result.directConnection = 'SUCCESS'
      result.tokenCount = res.rows[0].count
      client.release()
    } catch (error) {
      result.directConnection = 'FAILED'
      result.error = (error as Error).message
      result.errorStack = (error as Error).stack?.split('\n').slice(0, 5)
    } finally {
      await pool.end()
    }
  }

  return NextResponse.json(result)
}
