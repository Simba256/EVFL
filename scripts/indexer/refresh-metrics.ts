/**
 * Token Metrics Refresh Script
 *
 * Updates aggregated metrics for all tokens:
 * - volume24h: 24-hour trading volume in BNB
 * - change24h: 24-hour price change percentage
 * - change7d: 7-day price change percentage
 * - price: Current price from latest trade
 *
 * Can be run standalone or integrated into the main indexer.
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../lib/generated/prisma'
import { formatEther } from 'viem'

// Lazy-initialized Prisma client for standalone mode
let standalonePool: Pool | null = null
let standalonePrisma: PrismaClient | null = null

function getStandalonePrisma(): PrismaClient {
  if (!standalonePrisma) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    standalonePool = new Pool({ connectionString })
    const adapter = new PrismaPg(standalonePool)
    standalonePrisma = new PrismaClient({ adapter })
  }
  return standalonePrisma
}

/**
 * Get 24h volume for a token from trades
 */
async function get24hVolume(prisma: PrismaClient, tokenId: string): Promise<string> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const trades = await prisma.trade.findMany({
    where: {
      tokenId,
      blockTimestamp: { gte: oneDayAgo },
    },
    select: { bnbAmount: true },
  })

  // Sum the bnbAmount strings as BigInts
  const totalWei = trades.reduce((sum, trade) => {
    return sum + BigInt(trade.bnbAmount)
  }, BigInt(0))

  // Convert from wei to BNB string
  return formatEther(totalWei)
}

/**
 * Get price at a specific time ago from price_history
 */
async function getPriceAtTime(prisma: PrismaClient, tokenId: string, timestamp: Date): Promise<number | null> {
  // Look for the closest 1-hour candle before the target time
  const candle = await prisma.priceHistory.findFirst({
    where: {
      tokenId,
      interval: 3600, // 1-hour candles
      timestamp: { lte: timestamp },
    },
    orderBy: { timestamp: 'desc' },
  })

  return candle ? parseFloat(candle.close) : null
}

/**
 * Get current price from latest trade or candle
 */
async function getCurrentPrice(prisma: PrismaClient, tokenId: string): Promise<number | null> {
  // Try latest trade first
  const latestTrade = await prisma.trade.findFirst({
    where: { tokenId },
    orderBy: { blockTimestamp: 'desc' },
    select: { price: true },
  })

  if (latestTrade) {
    return parseFloat(latestTrade.price)
  }

  // Fall back to latest 1-minute candle
  const candle = await prisma.priceHistory.findFirst({
    where: {
      tokenId,
      interval: 60, // 1-minute candles
    },
    orderBy: { timestamp: 'desc' },
  })

  return candle ? parseFloat(candle.close) : null
}

/**
 * Calculate price change percentage
 */
function calculateChange(currentPrice: number, pastPrice: number): number {
  if (pastPrice === 0) return 0
  return ((currentPrice - pastPrice) / pastPrice) * 100
}

/**
 * Refresh metrics for a single token
 */
async function refreshTokenMetrics(
  prisma: PrismaClient,
  tokenId: string,
  tokenAddress: string
): Promise<void> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Get all metrics in parallel
  const [volume24h, currentPrice, price24hAgo, price7dAgo] = await Promise.all([
    get24hVolume(prisma, tokenId),
    getCurrentPrice(prisma, tokenId),
    getPriceAtTime(prisma, tokenId, oneDayAgo),
    getPriceAtTime(prisma, tokenId, sevenDaysAgo),
  ])

  // Calculate changes
  let change24h = 0
  let change7d = 0

  if (currentPrice !== null) {
    if (price24hAgo !== null) {
      change24h = calculateChange(currentPrice, price24hAgo)
    }
    if (price7dAgo !== null) {
      change7d = calculateChange(currentPrice, price7dAgo)
    }
  }

  // Update token
  await prisma.token.update({
    where: { id: tokenId },
    data: {
      volume24h,
      change24h,
      change7d,
      price: currentPrice?.toString() ?? '0',
    },
  })

  console.log(
    `Updated ${tokenAddress}: volume24h=${volume24h} BNB, change24h=${change24h.toFixed(2)}%, change7d=${change7d.toFixed(2)}%`
  )
}

/**
 * Refresh metrics for all tokens
 * @param prismaClient - Optional PrismaClient to use. If not provided, creates its own connection.
 */
export async function refreshAllTokenMetrics(prismaClient?: PrismaClient): Promise<void> {
  const prisma = prismaClient ?? getStandalonePrisma()

  console.log('Starting token metrics refresh...')
  const startTime = Date.now()

  // Get all on-chain tokens
  const tokens = await prisma.token.findMany({
    where: { isOnChain: true },
    select: { id: true, tokenAddress: true, symbol: true },
  })

  console.log(`Found ${tokens.length} tokens to refresh`)

  // Process tokens in batches to avoid overwhelming the database
  const batchSize = 10
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize)
    await Promise.all(
      batch.map((token) => refreshTokenMetrics(prisma, token.id, token.tokenAddress))
    )
  }

  const elapsed = Date.now() - startTime
  console.log(`Metrics refresh complete. Processed ${tokens.length} tokens in ${elapsed}ms`)
}

/**
 * Main function when run as standalone script
 */
async function main(): Promise<void> {
  try {
    await refreshAllTokenMetrics()
  } catch (error) {
    console.error('Error refreshing metrics:', error)
    process.exit(1)
  } finally {
    if (standalonePrisma) {
      await standalonePrisma.$disconnect()
    }
    if (standalonePool) {
      await standalonePool.end()
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}
