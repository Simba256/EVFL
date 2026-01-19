import { prisma } from './prisma'
import { Trade as PrismaTrade, TradeType, Prisma } from '../generated/prisma'
import type { Trade } from '@/types'

// Type for creating a new trade
export interface CreateTradeInput {
  tokenId: string
  tokenAddress: string
  type: 'buy' | 'sell'
  traderAddress: string
  tokenAmount: string
  bnbAmount: string
  price: string
  priceUSD?: number
  txHash: string
  blockNumber: bigint
  blockTimestamp: Date
  logIndex: number
}

// Convert Prisma trade to frontend Trade type
function toFrontendTrade(trade: PrismaTrade): Trade {
  return {
    type: trade.type as 'buy' | 'sell',
    amount: trade.tokenAmount,
    price: trade.price,
    time: trade.blockTimestamp.toISOString(),
    trader: trade.traderAddress,
  }
}

// Create a new trade
export async function createTrade(input: CreateTradeInput): Promise<Trade> {
  const trade = await prisma.trade.create({
    data: {
      tokenId: input.tokenId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      type: input.type as TradeType,
      traderAddress: input.traderAddress.toLowerCase(),
      tokenAmount: input.tokenAmount,
      bnbAmount: input.bnbAmount,
      price: input.price,
      priceUSD: input.priceUSD ?? 0,
      txHash: input.txHash.toLowerCase(),
      blockNumber: input.blockNumber,
      blockTimestamp: input.blockTimestamp,
      logIndex: input.logIndex,
    },
  })

  return toFrontendTrade(trade)
}

// Get trades for a token
export async function getTradesForToken(
  tokenAddress: string,
  limit: number = 50,
  offset: number = 0
): Promise<Trade[]> {
  const trades = await prisma.trade.findMany({
    where: { tokenAddress: tokenAddress.toLowerCase() },
    orderBy: { blockTimestamp: 'desc' },
    take: limit,
    skip: offset,
  })

  return trades.map(toFrontendTrade)
}

// Get trades by token ID
export async function getTradesByTokenId(
  tokenId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Trade[]> {
  const trades = await prisma.trade.findMany({
    where: { tokenId },
    orderBy: { blockTimestamp: 'desc' },
    take: limit,
    skip: offset,
  })

  return trades.map(toFrontendTrade)
}

// Get recent trades across all tokens
export async function getRecentTrades(limit: number = 20): Promise<(Trade & { tokenAddress: string })[]> {
  const trades = await prisma.trade.findMany({
    orderBy: { blockTimestamp: 'desc' },
    take: limit,
  })

  return trades.map(trade => ({
    ...toFrontendTrade(trade),
    tokenAddress: trade.tokenAddress,
  }))
}

// Get trades by trader
export async function getTradesByTrader(
  traderAddress: string,
  limit: number = 50
): Promise<(Trade & { tokenAddress: string })[]> {
  const trades = await prisma.trade.findMany({
    where: { traderAddress: traderAddress.toLowerCase() },
    orderBy: { blockTimestamp: 'desc' },
    take: limit,
  })

  return trades.map(trade => ({
    ...toFrontendTrade(trade),
    tokenAddress: trade.tokenAddress,
  }))
}

// Get trade count for a token
export async function getTradeCount(tokenAddress: string): Promise<number> {
  return prisma.trade.count({
    where: { tokenAddress: tokenAddress.toLowerCase() },
  })
}

// Check if trade exists by tx hash
export async function tradeExists(txHash: string): Promise<boolean> {
  const count = await prisma.trade.count({
    where: { txHash: txHash.toLowerCase() },
  })
  return count > 0
}

// Get 24h volume for a token
export async function get24hVolume(tokenAddress: string): Promise<string> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Since bnbAmount is a string, we need to fetch and sum manually
  const trades = await prisma.trade.findMany({
    where: {
      tokenAddress: tokenAddress.toLowerCase(),
      blockTimestamp: { gte: oneDayAgo },
    },
    select: { bnbAmount: true },
  })

  // Sum the bnbAmount strings as BigInts
  const total = trades.reduce((sum, trade) => {
    return sum + BigInt(trade.bnbAmount)
  }, BigInt(0))

  return total.toString()
}

// Get trade stats for a token
export async function getTradeStats(tokenAddress: string): Promise<{
  totalTrades: number
  buyCount: number
  sellCount: number
  volume24h: string
}> {
  const address = tokenAddress.toLowerCase()

  const [totalTrades, buyCount, sellCount, volume24h] = await Promise.all([
    prisma.trade.count({ where: { tokenAddress: address } }),
    prisma.trade.count({ where: { tokenAddress: address, type: 'buy' } }),
    prisma.trade.count({ where: { tokenAddress: address, type: 'sell' } }),
    get24hVolume(address),
  ])

  return {
    totalTrades,
    buyCount,
    sellCount,
    volume24h,
  }
}

// Bulk create trades (for indexer)
export async function createTradesBatch(trades: CreateTradeInput[]): Promise<number> {
  const result = await prisma.trade.createMany({
    data: trades.map(trade => ({
      tokenId: trade.tokenId,
      tokenAddress: trade.tokenAddress.toLowerCase(),
      type: trade.type as TradeType,
      traderAddress: trade.traderAddress.toLowerCase(),
      tokenAmount: trade.tokenAmount,
      bnbAmount: trade.bnbAmount,
      price: trade.price,
      priceUSD: trade.priceUSD ?? 0,
      txHash: trade.txHash.toLowerCase(),
      blockNumber: trade.blockNumber,
      blockTimestamp: trade.blockTimestamp,
      logIndex: trade.logIndex,
    })),
    skipDuplicates: true,
  })

  return result.count
}
