import { NextRequest, NextResponse } from 'next/server'
import {
  getTradesForToken,
  getTradeStats,
  isDatabaseAvailable,
  useDatabaseEnabled,
} from '@/lib/db'
import { getRecentTrades } from '@/lib/data/tokens'

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic'

// GET /api/trades/[tokenAddress] - Get trades for a token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    const { tokenAddress } = await params

    if (!tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeStats = searchParams.get('stats') === 'true'

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (dbAvailable) {
      const [trades, stats] = await Promise.all([
        getTradesForToken(tokenAddress, limit, offset),
        includeStats ? getTradeStats(tokenAddress) : null,
      ])

      return NextResponse.json({
        trades,
        stats,
        limit,
        offset,
        source: 'database',
      })
    }

    // Fallback to mock data
    const mockTrades = await getRecentTrades(tokenAddress)

    return NextResponse.json({
      trades: mockTrades.slice(offset, offset + limit),
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
