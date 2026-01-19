import { NextRequest, NextResponse } from 'next/server'
import {
  getTokenByAddress,
  updateTokenMetrics,
  isDatabaseAvailable,
  useDatabaseEnabled,
  type UpdateTokenMetricsInput,
} from '@/lib/db'
import { getTokenBySymbol } from '@/lib/data/tokens'

// GET /api/tokens/[address] - Get single token by address
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params

    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      )
    }

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (dbAvailable) {
      const token = await getTokenByAddress(address)

      if (!token) {
        return NextResponse.json(
          { error: 'Token not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ token, source: 'database' })
    }

    // Fallback: try to find by address in mock data
    // Mock data uses symbol lookup, so we can't directly find by address
    // In production, this would need on-chain lookup
    return NextResponse.json(
      { error: 'Token not found (database unavailable)' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error fetching token:', error)
    return NextResponse.json(
      { error: 'Failed to fetch token' },
      { status: 500 }
    )
  }
}

// PATCH /api/tokens/[address] - Update token metrics
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params

    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (!dbAvailable) {
      return NextResponse.json(
        { error: 'Database is not available' },
        { status: 503 }
      )
    }

    // Validate and extract updatable fields
    const metrics: UpdateTokenMetricsInput = {}

    if (body.price !== undefined) metrics.price = body.price
    if (body.priceUSD !== undefined) metrics.priceUSD = body.priceUSD
    if (body.marketCap !== undefined) metrics.marketCap = body.marketCap
    if (body.volume24h !== undefined) metrics.volume24h = body.volume24h
    if (body.liquidity !== undefined) metrics.liquidity = body.liquidity
    if (body.fdv !== undefined) metrics.fdv = body.fdv
    if (body.circulatingSupply !== undefined) metrics.circulatingSupply = body.circulatingSupply
    if (body.holdersCount !== undefined) metrics.holdersCount = body.holdersCount
    if (body.change24h !== undefined) metrics.change24h = body.change24h
    if (body.change7d !== undefined) metrics.change7d = body.change7d
    if (body.status !== undefined) {
      if (!['new', 'rising', 'graduated'].includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status value' },
          { status: 400 }
        )
      }
      metrics.status = body.status
    }
    if (body.graduatedAt !== undefined) {
      metrics.graduatedAt = new Date(body.graduatedAt)
    }

    if (Object.keys(metrics).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const token = await updateTokenMetrics(address, metrics)

    if (!token) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error updating token:', error)
    return NextResponse.json(
      { error: 'Failed to update token' },
      { status: 500 }
    )
  }
}
