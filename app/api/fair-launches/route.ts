import { NextRequest, NextResponse } from 'next/server'
import {
  getFairLaunches,
  getActiveFairLaunches,
  searchFairLaunches,
  getFairLaunchStats,
} from '@/lib/db/fair-launch'

/**
 * GET /api/fair-launches
 *
 * Query params:
 * - offset: number (default 0)
 * - limit: number (default 20, max 100)
 * - status: 'PENDING' | 'ACTIVE' | 'FINALIZED' | 'FAILED' | 'active' (for pending+active)
 * - search: string (search by name/symbol)
 * - stats: boolean (return stats only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const stats = searchParams.get('stats')

    // Return stats only
    if (stats === 'true') {
      const statsData = await getFairLaunchStats()
      return NextResponse.json(statsData)
    }

    // Search
    if (search) {
      const result = await searchFairLaunches(search, offset, limit)
      return NextResponse.json(result)
    }

    // Filter by status
    if (status === 'active') {
      const result = await getActiveFairLaunches(offset, limit)
      return NextResponse.json(result)
    }

    if (status && ['PENDING', 'ACTIVE', 'FINALIZED', 'FAILED'].includes(status)) {
      const result = await getFairLaunches(offset, limit, status as any)
      return NextResponse.json(result)
    }

    // Default: return all
    const result = await getFairLaunches(offset, limit)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching fair launches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fair launches' },
      { status: 500 }
    )
  }
}
