import { NextResponse } from 'next/server'
import { getOnChainTokens } from '@/lib/data/onchain-tokens'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tokens = await getOnChainTokens()
    return NextResponse.json({
      count: tokens.length,
      tokens: tokens.map(t => ({
        symbol: t.symbol,
        holders: t.holders,
        name: t.name,
      })),
      env: {
        USE_DATABASE: process.env.USE_DATABASE,
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      env: {
        USE_DATABASE: process.env.USE_DATABASE,
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      }
    }, { status: 500 })
  }
}
