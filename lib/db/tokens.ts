import { prisma } from './prisma'
import { Token as PrismaToken, TokenStatus, Prisma } from '../generated/prisma'
import type { Token, TokenDetail, TokenFilter, LeaderboardSortBy, LeaderboardToken } from '@/types'

// Type for creating a new token
export interface CreateTokenInput {
  name: string
  symbol: string
  description?: string
  image?: string
  tokenAddress: string
  poolAddress?: string
  creatorAddress: string
  totalSupply: string
  decimals?: number
  initialBnbLiquidity?: string
  tokenWeight?: number
  deployTxHash?: string
  deployedAt?: Date
}

// Type for updating token metrics
export interface UpdateTokenMetricsInput {
  price?: string
  priceUSD?: number
  marketCap?: string
  volume24h?: string
  liquidity?: string
  fdv?: string
  circulatingSupply?: string
  holdersCount?: number
  change24h?: number
  change7d?: number
  status?: TokenStatus
  graduatedAt?: Date
}

// Convert Prisma token to frontend Token type
function toFrontendToken(token: PrismaToken): Token {
  return {
    id: token.id,
    name: token.name,
    symbol: token.symbol,
    description: token.description,
    image: token.image,
    marketCap: token.marketCap,
    volume24h: token.volume24h,
    holders: token.holdersCount,
    price: token.price,
    change24h: token.change24h,
    createdAt: token.createdAt.toISOString(),
    creator: token.creatorAddress,
    status: token.status as 'new' | 'rising' | 'graduated',
    tokenAddress: token.tokenAddress as `0x${string}`,
    poolAddress: token.poolAddress as `0x${string}` | undefined,
    isOnChain: token.isOnChain,
  }
}

// Convert Prisma token to frontend TokenDetail type
function toFrontendTokenDetail(token: PrismaToken): TokenDetail {
  return {
    ...toFrontendToken(token),
    priceUSD: token.priceUSD,
    liquidity: token.liquidity,
    fdv: token.fdv,
    totalSupply: token.totalSupply,
    circulatingSupply: token.circulatingSupply,
  }
}

// Convert Prisma token to LeaderboardToken type
function toLeaderboardToken(token: PrismaToken, rank: number): LeaderboardToken {
  return {
    rank,
    name: token.name,
    symbol: token.symbol,
    image: token.image,
    marketCap: parseFloat(token.marketCap) || 0,
    volume24h: parseFloat(token.volume24h) || 0,
    holders: token.holdersCount,
    price: token.priceUSD,
    change24h: token.change24h,
    change7d: token.change7d,
  }
}

// Create a new token
export async function createToken(input: CreateTokenInput): Promise<Token> {
  const token = await prisma.token.create({
    data: {
      name: input.name,
      symbol: input.symbol.toUpperCase(),
      description: input.description || '',
      image: input.image || '',
      tokenAddress: input.tokenAddress.toLowerCase(),
      poolAddress: input.poolAddress?.toLowerCase(),
      creatorAddress: input.creatorAddress.toLowerCase(),
      totalSupply: input.totalSupply,
      decimals: input.decimals ?? 18,
      initialBnbLiquidity: input.initialBnbLiquidity || '0',
      tokenWeight: input.tokenWeight ?? 80,
      deployTxHash: input.deployTxHash,
      deployedAt: input.deployedAt,
      status: 'new',
      isOnChain: true,
    },
  })

  return toFrontendToken(token)
}

// Get all tokens with optional filtering
export async function getTokensFromDb(
  filter?: TokenFilter,
  limit?: number,
  offset?: number
): Promise<Token[]> {
  const where: Prisma.TokenWhereInput = {}

  if (filter && filter !== 'all') {
    where.status = filter as TokenStatus
  }

  const tokens = await prisma.token.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })

  return tokens.map(toFrontendToken)
}

// Get token by address
export async function getTokenByAddress(address: string): Promise<TokenDetail | null> {
  const token = await prisma.token.findUnique({
    where: { tokenAddress: address.toLowerCase() },
  })

  return token ? toFrontendTokenDetail(token) : null
}

// Get token by symbol
export async function getTokenBySymbolFromDb(symbol: string): Promise<TokenDetail | null> {
  const token = await prisma.token.findUnique({
    where: { symbol: symbol.toUpperCase() },
  })

  return token ? toFrontendTokenDetail(token) : null
}

// Update token metrics
export async function updateTokenMetrics(
  tokenAddress: string,
  metrics: UpdateTokenMetricsInput
): Promise<Token | null> {
  try {
    const token = await prisma.token.update({
      where: { tokenAddress: tokenAddress.toLowerCase() },
      data: metrics,
    })
    return toFrontendToken(token)
  } catch {
    return null
  }
}

// Get tokens for leaderboard
export async function getLeaderboardFromDb(
  sortBy: LeaderboardSortBy = 'marketCap',
  limit: number = 50
): Promise<LeaderboardToken[]> {
  let orderBy: Prisma.TokenOrderByWithRelationInput

  switch (sortBy) {
    case 'volume':
      orderBy = { volume24h: 'desc' }
      break
    case 'holders':
      orderBy = { holdersCount: 'desc' }
      break
    case 'marketCap':
    default:
      orderBy = { marketCap: 'desc' }
  }

  const tokens = await prisma.token.findMany({
    orderBy,
    take: limit,
  })

  return tokens.map((token, index) => toLeaderboardToken(token, index + 1))
}

// Search tokens by name or symbol
export async function searchTokens(query: string, limit: number = 20): Promise<Token[]> {
  const tokens = await prisma.token.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { symbol: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { marketCap: 'desc' },
    take: limit,
  })

  return tokens.map(toFrontendToken)
}

// Check if token exists
export async function tokenExists(tokenAddress: string): Promise<boolean> {
  const count = await prisma.token.count({
    where: { tokenAddress: tokenAddress.toLowerCase() },
  })
  return count > 0
}

// Get token count
export async function getTokenCount(filter?: TokenFilter): Promise<number> {
  const where: Prisma.TokenWhereInput = {}

  if (filter && filter !== 'all') {
    where.status = filter as TokenStatus
  }

  return prisma.token.count({ where })
}

// Get recently created tokens
export async function getRecentTokens(limit: number = 10): Promise<Token[]> {
  const tokens = await prisma.token.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return tokens.map(toFrontendToken)
}

// Get tokens by creator
export async function getTokensByCreator(creatorAddress: string): Promise<Token[]> {
  const tokens = await prisma.token.findMany({
    where: { creatorAddress: creatorAddress.toLowerCase() },
    orderBy: { createdAt: 'desc' },
  })

  return tokens.map(toFrontendToken)
}

// Update token status
export async function updateTokenStatus(
  tokenAddress: string,
  status: TokenStatus
): Promise<Token | null> {
  try {
    const updateData: Prisma.TokenUpdateInput = { status }

    if (status === 'graduated') {
      updateData.graduatedAt = new Date()
    }

    const token = await prisma.token.update({
      where: { tokenAddress: tokenAddress.toLowerCase() },
      data: updateData,
    })
    return toFrontendToken(token)
  } catch {
    return null
  }
}
