import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { getCommitments, getUserCommitment } from '@/lib/db/fair-launch'

/**
 * GET /api/fair-launches/[address]/commitments
 *
 * Get commitments for a Fair Launch ICO
 *
 * Query params:
 * - offset: number (default 0)
 * - limit: number (default 50, max 100)
 * - user: address (get specific user's commitment)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address: icoAddress } = await params
    const { searchParams } = new URL(request.url)
    const user = searchParams.get('user')

    // Validate ICO address
    if (!isAddress(icoAddress)) {
      return NextResponse.json(
        { error: 'Invalid ICO address format' },
        { status: 400 }
      )
    }

    // Get specific user's commitment
    if (user) {
      if (!isAddress(user)) {
        return NextResponse.json(
          { error: 'Invalid user address format' },
          { status: 400 }
        )
      }
      const commitment = await getUserCommitment(icoAddress, user)
      if (!commitment) {
        return NextResponse.json(
          { error: 'Commitment not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(commitment)
    }

    // Get all commitments with pagination
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    const result = await getCommitments(icoAddress, offset, limit)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching commitments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch commitments' },
      { status: 500 }
    )
  }
}
