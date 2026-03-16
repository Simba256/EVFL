import { NextRequest, NextResponse } from 'next/server'
import {
  getPriceHistoryByAddress,
  isDatabaseAvailable,
  useDatabaseEnabled,
  CANDLE_INTERVALS,
  type CandleInterval,
} from '@/lib/db'
import { generateMockCandles } from '@/lib/data/mock-candles'

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic'

// Map known token addresses to symbols for mock data generation
const KNOWN_TOKENS: Record<string, string> = {
  // On-chain tokens (BSC Testnet) - will be resolved via DB when available
}

// GET /api/price-history/[tokenAddress] - Get price history (OHLCV candles)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    const { tokenAddress } = await params

    const searchParams = request.nextUrl.searchParams
    const interval = (searchParams.get('interval') || '1h') as CandleInterval
    const limit = parseInt(searchParams.get('limit') || '100')
    const symbol = searchParams.get('symbol') || ''

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

      // If DB has candles, return them
      if (candles.length > 0) {
        return NextResponse.json({
          candles,
          interval,
          intervalSeconds: CANDLE_INTERVALS[interval],
          source: 'database',
        })
      }
    }

    // Generate mock candles for demo/showcase
    // Use symbol from query param, known mapping, or derive from address
    const tokenSymbol = symbol || KNOWN_TOKENS[tokenAddress.toLowerCase()] || tokenAddress.slice(2, 10)
    const mockCandles = generateMockCandles(tokenSymbol, interval, limit)

    return NextResponse.json({
      candles: mockCandles,
      interval,
      intervalSeconds: CANDLE_INTERVALS[interval],
      source: 'mock',
    })
  } catch (error) {
    console.error('Error fetching price history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price history' },
      { status: 500 }
    )
  }
}
