import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { getUserAllCommitments } from '@/lib/db/fair-launch'

/**
 * GET /api/commitments/[userAddress]
 *
 * Get all commitments by a user across all Fair Launches
 *
 * Query params:
 * - offset: number (default 0)
 * - limit: number (default 20, max 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userAddress: string }> }
) {
  try {
    const { userAddress } = await params
    const { searchParams } = new URL(request.url)

    // Validate user address
    if (!isAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address format' },
        { status: 400 }
      )
    }

    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const result = await getUserAllCommitments(userAddress, offset, limit)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching user commitments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user commitments' },
      { status: 500 }
    )
  }
}
