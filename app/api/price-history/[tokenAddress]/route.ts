import { NextRequest, NextResponse } from 'next/server'
import {
  getPriceHistoryByAddress,
  isDatabaseAvailable,
  useDatabaseEnabled,
  CANDLE_INTERVALS,
  type CandleInterval,
} from '@/lib/db'

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic'

// GET /api/price-history/[tokenAddress] - Get price history (OHLCV candles)
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
    const interval = (searchParams.get('interval') || '1h') as CandleInterval
    const limit = parseInt(searchParams.get('limit') || '100')

    // Validate interval parameter
    if (!CANDLE_INTERVALS[interval]) {
      return NextResponse.json(
        { error: `Invalid interval. Use: ${Object.keys(CANDLE_INTERVALS).join(', ')}` },
        { status: 400 }
      )
    }

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (dbAvailable) {
      const candles = await getPriceHistoryByAddress(tokenAddress, interval, limit)

      return NextResponse.json({
        candles,
        interval,
        intervalSeconds: CANDLE_INTERVALS[interval],
        source: 'database',
      })
    }

    // No mock data for price history - return empty array
    return NextResponse.json({
      candles: [],
      interval,
      intervalSeconds: CANDLE_INTERVALS[interval],
      source: 'mock',
      message: 'Price history not available without database',
    })
  } catch (error) {
    console.error('Error fetching price history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price history' },
      { status: 500 }
    )
  }
}
