import { NextRequest, NextResponse } from 'next/server'
import {
  getHoldersForToken,
  getHolderCount,
  isDatabaseAvailable,
  useDatabaseEnabled,
} from '@/lib/db'
import { getTopHolders } from '@/lib/data/tokens'

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic'

// GET /api/holders/[tokenAddress] - Get holders for a token
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
    const limit = parseInt(searchParams.get('limit') || '20')

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (dbAvailable) {
      const [holders, totalCount] = await Promise.all([
        getHoldersForToken(tokenAddress, limit),
        getHolderCount(tokenAddress),
      ])

      return NextResponse.json({
        holders,
        totalCount,
        limit,
        source: 'database',
      })
    }

    // Fallback to mock data
    // Mock data uses symbol, but we'll return the mock data anyway
    const mockHolders = await getTopHolders('')

    return NextResponse.json({
      holders: mockHolders.slice(0, limit),
      totalCount: mockHolders.length,
      limit,
      source: 'mock',
    })
  } catch (error) {
    console.error('Error fetching holders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holders' },
      { status: 500 }
    )
  }
}
