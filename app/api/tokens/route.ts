import { NextRequest, NextResponse } from 'next/server'
import {
  getTokensFromDb,
  createToken,
  searchTokens,
  getTokenCount,
  isDatabaseAvailable,
  useDatabaseEnabled,
  type CreateTokenInput,
} from '@/lib/db'
import { getTokens } from '@/lib/data/tokens'
import type { TokenFilter } from '@/types'

// GET /api/tokens - List tokens with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = (searchParams.get('filter') || 'all') as TokenFilter
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Check if database is available and enabled
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (dbAvailable) {
      // Use database
      if (search) {
        const tokens = await searchTokens(search, limit)
        return NextResponse.json({
          tokens,
          total: tokens.length,
          source: 'database',
        })
      }

      const [tokens, total] = await Promise.all([
        getTokensFromDb(filter, limit, offset),
        getTokenCount(filter),
      ])

      return NextResponse.json({
        tokens,
        total,
        limit,
        offset,
        source: 'database',
      })
    }

    // Fallback to mock data
    let tokens = await getTokens()

    if (filter && filter !== 'all') {
      tokens = tokens.filter((t) => t.status === filter)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      tokens = tokens.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.symbol.toLowerCase().includes(searchLower)
      )
    }

    // Apply pagination
    const paginatedTokens = tokens.slice(offset, offset + limit)

    return NextResponse.json({
      tokens: paginatedTokens,
      total: tokens.length,
      limit,
      offset,
      source: 'mock',
    })
  } catch (error) {
    console.error('Error fetching tokens:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    )
  }
}

// POST /api/tokens - Create a new token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['name', 'symbol', 'tokenAddress', 'creatorAddress', 'totalSupply']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate address formats
    if (!body.tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      )
    }

    if (!body.creatorAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid creator address format' },
        { status: 400 }
      )
    }

    // Check database availability
    const dbEnabled = useDatabaseEnabled()
    const dbAvailable = dbEnabled ? await isDatabaseAvailable() : false

    if (!dbAvailable) {
      return NextResponse.json(
        { error: 'Database is not available' },
        { status: 503 }
      )
    }

    const tokenInput: CreateTokenInput = {
      name: body.name,
      symbol: body.symbol,
      description: body.description || '',
      image: body.image || '',
      tokenAddress: body.tokenAddress,
      poolAddress: body.poolAddress,
      creatorAddress: body.creatorAddress,
      totalSupply: body.totalSupply,
      decimals: body.decimals || 18,
      initialBnbLiquidity: body.initialBnbLiquidity || '0',
      tokenWeight: body.tokenWeight || 80,
      deployTxHash: body.deployTxHash,
      deployedAt: body.deployedAt ? new Date(body.deployedAt) : new Date(),
    }

    const token = await createToken(tokenInput)

    return NextResponse.json({ token }, { status: 201 })
  } catch (error) {
    console.error('Error creating token:', error)

    // Handle unique constraint violation
    if ((error as Error).message?.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Token with this address or symbol already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create token' },
      { status: 500 }
    )
  }
}
