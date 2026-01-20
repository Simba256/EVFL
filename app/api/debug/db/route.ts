import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const maxDuration = 10 // 10 second timeout

export async function GET() {
  const connectionString = process.env.DATABASE_URL

  const result: Record<string, unknown> = {
    USE_DATABASE: process.env.USE_DATABASE,
    DATABASE_URL_SET: !!connectionString,
    DATABASE_URL_PREVIEW: connectionString?.substring(0, 60) + '...',
    hasPooler: connectionString?.includes('pooler'),
    NODE_ENV: process.env.NODE_ENV,
  }

  if (!connectionString) {
    return NextResponse.json(result)
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 5000,
  })

  try {
    const res = await pool.query('SELECT 1 as test')
    result.connection = 'SUCCESS'
    result.testResult = res.rows[0]

    // List all tables
    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `)
    result.tables = tablesRes.rows.map(r => r.table_name)

    // Try different table name formats
    for (const tableName of ['Token', 'token', 'tokens', 'Tokens']) {
      try {
        const tokenRes = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`)
        result.tokenCount = tokenRes.rows[0].count
        result.foundTable = tableName
        break
      } catch (e) {
        // continue trying
      }
    }
  } catch (error) {
    result.connection = 'FAILED'
    result.error = (error as Error).message
  } finally {
    await pool.end().catch(() => {})
  }

  return NextResponse.json(result)
}
