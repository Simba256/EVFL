import { NextRequest, NextResponse } from 'next/server'
import {
  getTradesForToken,
  getTradeStats,
  isDatabaseAvailable,
  useDatabaseEnabled,
} from '@/lib/db'
import { generateMockTrades } from '@/lib/data/mock-trades'

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic'

// GET /api/trades/[tokenAddress] - Get trades for a token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    const { tokenAddress } = await params

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeStats = searchParams.get('stats') === 'true'
    const symbol = searchParams.get('symbol') || ''

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (dbAvailable) {
      const [trades, stats] = await Promise.all([
        getTradesForToken(tokenAddress, limit, offset),
        includeStats ? getTradeStats(tokenAddress) : null,
      ])

      if (trades.length > 0) {
        return NextResponse.json({
          trades,
          stats,
          limit,
          offset,
          source: 'database',
        })
      }
    }

    // Fallback to generated mock trades
    const tokenSymbol = symbol || tokenAddress.slice(2, 10)
    const allMockTrades = generateMockTrades(tokenSymbol, 30)

    return NextResponse.json({
      trades: allMockTrades.slice(offset, offset + limit),
      stats: null,
      limit,
      offset,
      source: 'mock',
    })
  } catch (error) {
    console.error('Error fetching trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    )
  }
}
