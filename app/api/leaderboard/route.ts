import { NextRequest, NextResponse } from 'next/server'
import {
  getLeaderboardFromDb,
  isDatabaseAvailable,
  useDatabaseEnabled,
} from '@/lib/db'
import { getLeaderboard } from '@/lib/data/leaderboard'
import type { LeaderboardSortBy } from '@/types'

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic'

// GET /api/leaderboard - Get token leaderboard
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sortBy = (searchParams.get('sortBy') || 'marketCap') as LeaderboardSortBy
    const limit = parseInt(searchParams.get('limit') || '50')

    // Validate sortBy parameter
    if (!['marketCap', 'volume', 'holders'].includes(sortBy)) {
      return NextResponse.json(
        { error: 'Invalid sortBy parameter. Use: marketCap, volume, or holders' },
        { status: 400 }
      )
    }

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (dbAvailable) {
      const leaderboard = await getLeaderboardFromDb(sortBy, limit)

      return NextResponse.json({
        leaderboard,
        sortBy,
        source: 'database',
      })
    }

    // Fallback to mock data
    const leaderboard = await getLeaderboard(sortBy)

    return NextResponse.json({
      leaderboard: leaderboard.slice(0, limit),
      sortBy,
      source: 'mock',
    })
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
