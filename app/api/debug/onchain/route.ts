import { NextResponse } from 'next/server'
import { getOnChainTokens } from '@/lib/data/onchain-tokens'
import { getTokenByAddress, isDatabaseAvailable } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test database directly
    const dbAvailable = await isDatabaseAvailable()

    // Test a specific token lookup
    const testAddr = '0x687f4980635a846c28196e966F020A9C4b78F1E8'
    const dbToken = await getTokenByAddress(testAddr)

    const tokens = await getOnChainTokens()
    return NextResponse.json({
      count: tokens.length,
      tokens: tokens.map(t => ({
        symbol: t.symbol,
        holders: t.holders,
        name: t.name,
        tokenAddress: t.tokenAddress,
      })),
      debug: {
        dbAvailable,
        testLookup: {
          address: testAddr,
          found: !!dbToken,
          holdersCount: dbToken?.holdersCount,
          symbol: dbToken?.symbol,
        }
      },
      env: {
        USE_DATABASE: process.env.USE_DATABASE,
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        USE_DATABASE: process.env.USE_DATABASE,
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      }
    }, { status: 500 })
  }
}
