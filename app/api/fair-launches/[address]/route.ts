import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import {
  getFairLaunchByAddress,
  getFairLaunchByTokenAddress,
  getFairLaunchesByCreator,
} from '@/lib/db/fair-launch'

/**
 * GET /api/fair-launches/[address]
 *
 * Get Fair Launch by ICO address, token address, or creator address
 *
 * Query params:
 * - type: 'ico' | 'token' | 'creator' (default 'ico')
 * - offset: number (for creator, default 0)
 * - limit: number (for creator, default 20)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'ico'

    // Validate address
    if (!isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      )
    }

    // Get by creator
    if (type === 'creator') {
      const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
      const result = await getFairLaunchesByCreator(address, offset, limit)
      return NextResponse.json(result)
    }

    // Get by token address
    if (type === 'token') {
      const fairLaunch = await getFairLaunchByTokenAddress(address)
      if (!fairLaunch) {
        return NextResponse.json(
          { error: 'Fair Launch not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(fairLaunch)
    }

    // Get by ICO address (default)
    const fairLaunch = await getFairLaunchByAddress(address)
    if (!fairLaunch) {
      return NextResponse.json(
        { error: 'Fair Launch not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(fairLaunch)
  } catch (error) {
    console.error('Error fetching fair launch:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fair launch' },
      { status: 500 }
    )
  }
}
