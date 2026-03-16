/**
 * Generates realistic mock OHLCV candle data for demo/showcase purposes.
 * Uses a seeded random walk with trend bias to create believable price action.
 */

interface MockCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Seeded PRNG for deterministic output per token
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// Interval durations in milliseconds
const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
}

// Token-specific profiles for varied, realistic behavior
interface TokenProfile {
  basePrice: number
  volatility: number
  trend: number       // -1 to 1, bias direction
  volumeBase: number  // base volume in BNB per candle
}

const TOKEN_PROFILES: Record<string, TokenProfile> = {
  ROBOWAR:  { basePrice: 0.0042,  volatility: 0.04,  trend: 0.15,  volumeBase: 2.5 },
  CTRL:     { basePrice: 0.0089,  volatility: 0.03,  trend: 0.08,  volumeBase: 4.2 },
  AINFLU:   { basePrice: 0.0156,  volatility: 0.05,  trend: 0.25,  volumeBase: 8.1 },
  MECHA:    { basePrice: 0.0023,  volatility: 0.06,  trend: -0.05, volumeBase: 1.8 },
  AUTOBOT:  { basePrice: 0.0091,  volatility: 0.035, trend: 0.12,  volumeBase: 3.5 },
  SYNTH:    { basePrice: 0.0067,  volatility: 0.045, trend: 0.10,  volumeBase: 2.8 },
}

function getProfile(symbol: string): TokenProfile {
  const clean = symbol.replace(/^\$/, "").toUpperCase()
  return TOKEN_PROFILES[clean] || {
    basePrice: 0.005,
    volatility: 0.04,
    trend: 0.05,
    volumeBase: 2.0,
  }
}

export function generateMockCandles(
  tokenSymbol: string,
  interval: string,
  limit: number = 100
): MockCandle[] {
  const profile = getProfile(tokenSymbol)
  const intervalMs = INTERVAL_MS[interval] || INTERVAL_MS["1h"]
  const seed = hashString(tokenSymbol + interval)
  const rand = seededRandom(seed)

  const now = Date.now()
  // Align to interval boundary
  const alignedNow = Math.floor(now / intervalMs) * intervalMs
  const startTime = alignedNow - (limit - 1) * intervalMs

  // Scale volatility by interval (larger intervals = more movement per candle)
  const intervalScale = Math.sqrt(intervalMs / 3_600_000)
  const vol = profile.volatility * intervalScale

  // Start price: walk backwards from current price to find a plausible start
  // Use the trend to determine starting price relative to current
  const trendFactor = 1 - profile.trend * 0.3 // If bullish, start lower
  let price = profile.basePrice * trendFactor

  const candles: MockCandle[] = []

  for (let i = 0; i < limit; i++) {
    const timestamp = startTime + i * intervalMs

    // Generate intra-candle price movements
    const open = price
    const r1 = rand()
    const r2 = rand()
    const r3 = rand()
    const r4 = rand()

    // Box-Muller for normally distributed returns
    const normalReturn = Math.sqrt(-2 * Math.log(r1 + 0.0001)) * Math.cos(2 * Math.PI * r2)
    const trendComponent = profile.trend * vol * 0.15
    const change = normalReturn * vol + trendComponent

    const close = open * (1 + change)

    // High and low extend beyond open/close
    const wickUp = Math.abs(normalReturn * vol * 0.5 * r3)
    const wickDown = Math.abs(normalReturn * vol * 0.5 * r4)

    const high = Math.max(open, close) * (1 + wickUp)
    const low = Math.min(open, close) * (1 - wickDown)

    // Volume varies with volatility and has its own randomness
    const volMultiplier = 0.3 + r1 * 1.4 + Math.abs(change) * 10
    const volume = profile.volumeBase * volMultiplier * intervalScale

    candles.push({
      timestamp,
      open: Math.max(open, 1e-12),
      high: Math.max(high, 1e-12),
      low: Math.max(low, 1e-12),
      close: Math.max(close, 1e-12),
      volume: Math.max(volume, 0.001),
    })

    price = close
  }

  return candles
}
