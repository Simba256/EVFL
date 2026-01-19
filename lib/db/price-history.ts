import { prisma } from './prisma'
import { PriceHistory as PrismaPriceHistory } from '../generated/prisma'

// Candle intervals in seconds
export const CANDLE_INTERVALS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
} as const

export type CandleInterval = keyof typeof CANDLE_INTERVALS

// OHLCV candle type for frontend
export interface OHLCVCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Input for creating/updating a candle
export interface UpsertCandleInput {
  tokenId: string
  interval: number
  timestamp: Date
  open: string
  high: string
  low: string
  close: string
  volume: string
  volumeUsd?: number
  tradeCount?: number
}

// Convert Prisma price history to frontend OHLCV candle
function toOHLCVCandle(candle: PrismaPriceHistory): OHLCVCandle {
  return {
    timestamp: candle.timestamp.getTime(),
    open: parseFloat(candle.open),
    high: parseFloat(candle.high),
    low: parseFloat(candle.low),
    close: parseFloat(candle.close),
    volume: parseFloat(candle.volume),
  }
}

// Get price history for a token
export async function getPriceHistory(
  tokenId: string,
  interval: CandleInterval,
  limit: number = 100
): Promise<OHLCVCandle[]> {
  const intervalSeconds = CANDLE_INTERVALS[interval]

  const candles = await prisma.priceHistory.findMany({
    where: {
      tokenId,
      interval: intervalSeconds,
    },
    orderBy: { timestamp: 'asc' },
    take: limit,
  })

  return candles.map(toOHLCVCandle)
}

// Get price history by token address
export async function getPriceHistoryByAddress(
  tokenAddress: string,
  interval: CandleInterval,
  limit: number = 100
): Promise<OHLCVCandle[]> {
  const intervalSeconds = CANDLE_INTERVALS[interval]

  // First find the token
  const token = await prisma.token.findUnique({
    where: { tokenAddress: tokenAddress.toLowerCase() },
    select: { id: true },
  })

  if (!token) return []

  return getPriceHistory(token.id, interval, limit)
}

// Get price history within a time range
export async function getPriceHistoryRange(
  tokenId: string,
  interval: CandleInterval,
  startTime: Date,
  endTime: Date
): Promise<OHLCVCandle[]> {
  const intervalSeconds = CANDLE_INTERVALS[interval]

  const candles = await prisma.priceHistory.findMany({
    where: {
      tokenId,
      interval: intervalSeconds,
      timestamp: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: { timestamp: 'asc' },
  })

  return candles.map(toOHLCVCandle)
}

// Upsert a candle (create or update)
export async function upsertCandle(input: UpsertCandleInput): Promise<void> {
  await prisma.priceHistory.upsert({
    where: {
      tokenId_interval_timestamp: {
        tokenId: input.tokenId,
        interval: input.interval,
        timestamp: input.timestamp,
      },
    },
    update: {
      high: input.high,
      low: input.low,
      close: input.close,
      volume: input.volume,
      volumeUsd: input.volumeUsd ?? 0,
      tradeCount: { increment: input.tradeCount ?? 1 },
    },
    create: {
      tokenId: input.tokenId,
      interval: input.interval,
      timestamp: input.timestamp,
      open: input.open,
      high: input.high,
      low: input.low,
      close: input.close,
      volume: input.volume,
      volumeUsd: input.volumeUsd ?? 0,
      tradeCount: input.tradeCount ?? 1,
    },
  })
}

// Update candle with a new trade
export async function updateCandleWithTrade(
  tokenId: string,
  price: string,
  volume: string,
  timestamp: Date
): Promise<void> {
  const priceNum = parseFloat(price)

  // Update candles for all intervals
  for (const [, intervalSeconds] of Object.entries(CANDLE_INTERVALS)) {
    // Calculate the candle start time
    const candleStart = new Date(
      Math.floor(timestamp.getTime() / (intervalSeconds * 1000)) * intervalSeconds * 1000
    )

    const existing = await prisma.priceHistory.findUnique({
      where: {
        tokenId_interval_timestamp: {
          tokenId,
          interval: intervalSeconds,
          timestamp: candleStart,
        },
      },
    })

    if (existing) {
      // Update existing candle
      const newHigh = Math.max(parseFloat(existing.high), priceNum).toString()
      const newLow = Math.min(parseFloat(existing.low), priceNum).toString()
      const newVolume = (parseFloat(existing.volume) + parseFloat(volume)).toString()

      await prisma.priceHistory.update({
        where: { id: existing.id },
        data: {
          high: newHigh,
          low: newLow,
          close: price,
          volume: newVolume,
          tradeCount: { increment: 1 },
        },
      })
    } else {
      // Create new candle
      await prisma.priceHistory.create({
        data: {
          tokenId,
          interval: intervalSeconds,
          timestamp: candleStart,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
          tradeCount: 1,
        },
      })
    }
  }
}

// Get latest price from candles
export async function getLatestPrice(tokenId: string): Promise<number | null> {
  const candle = await prisma.priceHistory.findFirst({
    where: {
      tokenId,
      interval: CANDLE_INTERVALS['1m'],
    },
    orderBy: { timestamp: 'desc' },
  })

  return candle ? parseFloat(candle.close) : null
}

// Delete old candles (cleanup)
export async function deleteOldCandles(
  interval: number,
  olderThan: Date
): Promise<number> {
  const result = await prisma.priceHistory.deleteMany({
    where: {
      interval,
      timestamp: { lt: olderThan },
    },
  })

  return result.count
}
