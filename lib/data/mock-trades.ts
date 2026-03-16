/**
 * Generates realistic mock trade data for demo/showcase purposes.
 * Trades are deterministic per token symbol and have proper field formats
 * matching what the TradeHistory component expects from the DB.
 */

interface MockTrade {
  type: "buy" | "sell"
  amount: string    // raw token amount (will be divided by 1e18 in display)
  price: string     // price in BNB as decimal string
  time: string      // ISO timestamp
  trader: string    // full hex address
}

// Seeded PRNG
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

// Generate a deterministic fake address from seed
function fakeAddress(rand: () => number): string {
  const hex = "0123456789abcdef"
  let addr = "0x"
  for (let i = 0; i < 40; i++) {
    addr += hex[Math.floor(rand() * 16)]
  }
  return addr
}

interface TokenTradeProfile {
  basePrice: number
  avgTradeSize: number  // in token units (pre-1e18)
  buyPressure: number   // 0-1, probability of buy vs sell
}

const TRADE_PROFILES: Record<string, TokenTradeProfile> = {
  ROBOWAR:  { basePrice: 0.0042,  avgTradeSize: 1500,  buyPressure: 0.65 },
  CTRL:     { basePrice: 0.0089,  avgTradeSize: 800,   buyPressure: 0.55 },
  AINFLU:   { basePrice: 0.0156,  avgTradeSize: 2200,  buyPressure: 0.70 },
  MECHA:    { basePrice: 0.0023,  avgTradeSize: 3500,  buyPressure: 0.45 },
  AUTOBOT:  { basePrice: 0.0091,  avgTradeSize: 1200,  buyPressure: 0.60 },
  SYNTH:    { basePrice: 0.0067,  avgTradeSize: 1800,  buyPressure: 0.58 },
  ROBWAR:   { basePrice: 0.0001,  avgTradeSize: 50000, buyPressure: 0.50 },
  TT1:      { basePrice: 0.000000009, avgTradeSize: 100000, buyPressure: 0.50 },
  OLL:      { basePrice: 0.0005,  avgTradeSize: 20000, buyPressure: 0.52 },
  R8:       { basePrice: 0.00014, avgTradeSize: 5000,  buyPressure: 0.55 },
}

function getProfile(symbol: string): TokenTradeProfile {
  const clean = symbol.replace(/^\$/, "").toUpperCase()
  return TRADE_PROFILES[clean] || {
    basePrice: 0.005,
    avgTradeSize: 2000,
    buyPressure: 0.55,
  }
}

export function generateMockTrades(
  tokenSymbol: string,
  count: number = 20
): MockTrade[] {
  const profile = getProfile(tokenSymbol)
  const seed = hashString(tokenSymbol + "trades")
  const rand = seededRandom(seed)

  const now = Date.now()
  const trades: MockTrade[] = []

  // Generate a set of unique trader addresses
  const traderPool: string[] = []
  for (let i = 0; i < 12; i++) {
    traderPool.push(fakeAddress(rand))
  }

  let price = profile.basePrice

  for (let i = 0; i < count; i++) {
    // Time: spread trades over last ~2 hours, more recent = more frequent
    const minutesAgo = Math.floor(rand() * rand() * 120) + 1
    const timestamp = new Date(now - minutesAgo * 60_000)

    // Type: weighted by buy pressure
    const isBuy = rand() < profile.buyPressure
    const type = isBuy ? "buy" as const : "sell" as const

    // Price jitter
    const priceChange = (rand() - 0.48) * 0.03
    price = price * (1 + priceChange)

    // Amount: varies around average, scaled to 1e18 (like ERC-20 tokens)
    const sizeMultiplier = 0.2 + rand() * 2.5
    const tokenAmount = Math.floor(profile.avgTradeSize * sizeMultiplier)
    const rawAmount = BigInt(tokenAmount) * BigInt("1000000000000000000")

    // Pick a trader from the pool (some repeat = realistic)
    const trader = traderPool[Math.floor(rand() * traderPool.length)]

    trades.push({
      type,
      amount: rawAmount.toString(),
      price: price.toFixed(10),
      time: timestamp.toISOString(),
      trader,
    })
  }

  // Sort by time descending (most recent first)
  trades.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return trades
}
