import type { Token, TokenDetail, Holder, Trade, TokenFilter } from '@/types'
import {
  getTokensFromDb,
  getTokenByAddress,
  getTokenBySymbolFromDb,
  getHoldersForToken,
  getTradesForToken,
  isDatabaseAvailable,
  useDatabaseEnabled,
} from '@/lib/db'

// Mock token data - matches what's currently in components
export const MOCK_TOKENS: Token[] = [
  {
    id: "1",
    name: "RoboWar Arena",
    symbol: "$ROBOWAR",
    description: "Battle-ready combat robots competing in the ultimate AI arena. Deploy, strategize, dominate.",
    image: "/futuristic-battle-robot-with-weapons.jpg",
    marketCap: "$2.4M",
    volume24h: "$890K",
    holders: 1243,
    price: "$0.0042",
    change24h: 156.8,
    createdAt: "2h ago",
    creator: "0x742d...92f8",
    status: "new",
  },
  {
    id: "2",
    name: "Control Protocol",
    symbol: "$CTRL",
    description: "Take full control of your personal robot agent. Command, customize, conquer the metaverse.",
    image: "/humanoid-robot-with-glowing-cyan-interface.jpg",
    marketCap: "$5.1M",
    volume24h: "$1.2M",
    holders: 2891,
    price: "$0.0089",
    change24h: 89.3,
    createdAt: "5h ago",
    creator: "0x9a3c...1b4d",
    status: "rising",
  },
  {
    id: "3",
    name: "AI Influencer Network",
    symbol: "$AINFLU",
    description: "The first AI-powered influencer collective. Synthetic personalities, real engagement, infinite reach.",
    image: "/ai-robot-influencer-with-social-media-hologram.jpg",
    marketCap: "$8.7M",
    volume24h: "$2.8M",
    holders: 4567,
    price: "$0.0156",
    change24h: 234.5,
    createdAt: "12h ago",
    creator: "0x3f8b...7c2a",
    status: "graduated",
  },
  {
    id: "4",
    name: "MechaSyndicate",
    symbol: "$MECHA",
    description: "Elite mechanized warriors forming an unstoppable decentralized army of steel and silicon.",
    image: "/giant-mecha-robot-with-metallic-armor.jpg",
    marketCap: "$1.8M",
    volume24h: "$456K",
    holders: 892,
    price: "$0.0023",
    change24h: 67.2,
    createdAt: "3h ago",
    creator: "0x5d2f...8e9c",
    status: "new",
  },
  {
    id: "5",
    name: "AutoBot Collective",
    symbol: "$AUTOBOT",
    description: "Self-organizing robot swarms executing complex tasks autonomously. Efficiency meets intelligence.",
    image: "/swarm-of-small-autonomous-robots.jpg",
    marketCap: "$4.2M",
    volume24h: "$980K",
    holders: 2134,
    price: "$0.0091",
    change24h: 145.1,
    createdAt: "8h ago",
    creator: "0x7c8a...4b3f",
    status: "rising",
  },
  {
    id: "6",
    name: "Synthetic Dreams",
    symbol: "$SYNTH",
    description: "AI entities experiencing consciousness. The first truly sentient robot token.",
    image: "/ethereal-robot-with-glowing-neural-network.jpg",
    marketCap: "$3.5M",
    volume24h: "$723K",
    holders: 1678,
    price: "$0.0067",
    change24h: 98.4,
    createdAt: "6h ago",
    creator: "0x2b9d...6a5e",
    status: "rising",
  },
]

// Extended token details for detail pages
export const MOCK_TOKEN_DETAILS: Record<string, TokenDetail> = {
  robowar: {
    ...MOCK_TOKENS[0],
    priceUSD: 0.0042,
    liquidity: "$1.2M",
    fdv: "$4.8M",
    totalSupply: "385,000",
    circulatingSupply: "192,500",
  },
  ctrl: {
    ...MOCK_TOKENS[1],
    priceUSD: 0.0089,
    liquidity: "$2.5M",
    fdv: "$10.2M",
    totalSupply: "572,000",
    circulatingSupply: "286,000",
  },
  ainflu: {
    ...MOCK_TOKENS[2],
    priceUSD: 0.0156,
    liquidity: "$4.2M",
    fdv: "$17.4M",
    totalSupply: "1,115,000",
    circulatingSupply: "557,500",
  },
  mecha: {
    ...MOCK_TOKENS[3],
    priceUSD: 0.0023,
    liquidity: "$890K",
    fdv: "$3.6M",
    totalSupply: "782,000",
    circulatingSupply: "391,000",
  },
  autobot: {
    ...MOCK_TOKENS[4],
    priceUSD: 0.0091,
    liquidity: "$1.8M",
    fdv: "$8.4M",
    totalSupply: "461,000",
    circulatingSupply: "230,500",
  },
  synth: {
    ...MOCK_TOKENS[5],
    priceUSD: 0.0067,
    liquidity: "$1.4M",
    fdv: "$7.0M",
    totalSupply: "522,000",
    circulatingSupply: "261,000",
  },
}

// Mock top holders
export const MOCK_TOP_HOLDERS: Holder[] = [
  { address: "0xD4a3...8Bc2", amount: "12,450", percentage: 6.47 },
  { address: "0x8F2c...3Da1", amount: "9,823", percentage: 5.1 },
  { address: "0x5Ec9...4Bf7", amount: "8,234", percentage: 4.28 },
  { address: "0x2Fa8...6Cd9", amount: "6,891", percentage: 3.58 },
  { address: "0xBc45...9Ae3", amount: "5,672", percentage: 2.95 },
  { address: "0x7Ed2...1Fb4", amount: "4,893", percentage: 2.54 },
  { address: "0x3Af6...8Dc7", amount: "4,123", percentage: 2.14 },
  { address: "0x9Cb1...5Ef2", amount: "3,567", percentage: 1.85 },
]

// Mock recent trades
export const MOCK_RECENT_TRADES: Trade[] = [
  { type: "buy", amount: "1,234", price: "$0.0042", time: "2m ago", trader: "0xD4a3...8Bc2" },
  { type: "sell", amount: "892", price: "$0.0041", time: "5m ago", trader: "0x8F2c...3Da1" },
  { type: "buy", amount: "2,456", price: "$0.0043", time: "8m ago", trader: "0x5Ec9...4Bf7" },
  { type: "buy", amount: "678", price: "$0.0040", time: "12m ago", trader: "0x2Fa8...6Cd9" },
  { type: "sell", amount: "1,567", price: "$0.0039", time: "15m ago", trader: "0xBc45...9Ae3" },
]

/**
 * Get all tokens with database fallback to mock data
 * @param filter - Optional filter for token status
 * @returns Promise<Token[]>
 */
export async function getTokens(filter?: TokenFilter): Promise<Token[]> {
  // Check if database is enabled and available
  if (useDatabaseEnabled()) {
    try {
      const dbAvailable = await isDatabaseAvailable()
      if (dbAvailable) {
        const tokens = await getTokensFromDb(filter)
        // If database has tokens, return them
        if (tokens.length > 0) {
          return tokens
        }
        // Fall through to mock data if DB is empty
      }
    } catch (error) {
      console.warn('Database query failed, falling back to mock data:', error)
    }
  }

  // Fallback to mock data
  let tokens = MOCK_TOKENS
  if (filter && filter !== 'all') {
    tokens = tokens.filter(t => t.status === filter)
  }
  return tokens
}

/**
 * Get token by symbol with database fallback
 * @param symbol - Token symbol (e.g., "robowar", "ctrl", "$ROBOWAR")
 * @returns Promise<TokenDetail | null>
 */
export async function getTokenBySymbol(symbol: string): Promise<TokenDetail | null> {
  // Normalize symbol (remove $ prefix if present)
  const normalizedSymbol = symbol.replace(/^\$/, '').toUpperCase()

  // Check if database is enabled and available
  if (useDatabaseEnabled()) {
    try {
      const dbAvailable = await isDatabaseAvailable()
      if (dbAvailable) {
        const token = await getTokenBySymbolFromDb(normalizedSymbol)
        if (token) {
          return token
        }
      }
    } catch (error) {
      console.warn('Database query failed, falling back to mock data:', error)
    }
  }

  // Fallback to mock data (uses lowercase key without $)
  const mockKey = normalizedSymbol.toLowerCase()
  return MOCK_TOKEN_DETAILS[mockKey] || null
}

/**
 * Get top holders for a token with database fallback
 * @param symbolOrAddress - Token symbol or address
 * @returns Promise<Holder[]>
 */
export async function getTopHolders(symbolOrAddress: string): Promise<Holder[]> {
  // Check if it's an address
  const isAddress = symbolOrAddress.match(/^0x[a-fA-F0-9]{40}$/)

  // Check if database is enabled and available
  if (useDatabaseEnabled() && isAddress) {
    try {
      const dbAvailable = await isDatabaseAvailable()
      if (dbAvailable) {
        const holders = await getHoldersForToken(symbolOrAddress)
        if (holders.length > 0) {
          return holders
        }
      }
    } catch (error) {
      console.warn('Database query failed, falling back to mock data:', error)
    }
  }

  // Fallback to mock data
  return MOCK_TOP_HOLDERS
}

/**
 * Get recent trades for a token with database fallback
 * @param symbolOrAddress - Token symbol or address
 * @returns Promise<Trade[]>
 */
export async function getRecentTrades(symbolOrAddress: string): Promise<Trade[]> {
  // Check if it's an address
  const isAddress = symbolOrAddress.match(/^0x[a-fA-F0-9]{40}$/)

  // Check if database is enabled and available
  if (useDatabaseEnabled() && isAddress) {
    try {
      const dbAvailable = await isDatabaseAvailable()
      if (dbAvailable) {
        const trades = await getTradesForToken(symbolOrAddress)
        if (trades.length > 0) {
          return trades
        }
      }
    } catch (error) {
      console.warn('Database query failed, falling back to mock data:', error)
    }
  }

  // Fallback to mock data
  return MOCK_RECENT_TRADES
}

/**
 * Filter tokens by status
 * @param status - Token status filter
 * @returns Promise<Token[]>
 */
export async function getTokensByStatus(status: 'new' | 'rising' | 'graduated'): Promise<Token[]> {
  return getTokens(status)
}

/**
 * Get token by address with database fallback
 * @param address - Token contract address
 * @returns Promise<TokenDetail | null>
 */
export async function getTokenByAddressWithFallback(address: string): Promise<TokenDetail | null> {
  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return null
  }

  // Check if database is enabled and available
  if (useDatabaseEnabled()) {
    try {
      const dbAvailable = await isDatabaseAvailable()
      if (dbAvailable) {
        const token = await getTokenByAddress(address)
        if (token) {
          return token
        }
      }
    } catch (error) {
      console.warn('Database query failed:', error)
    }
  }

  // No mock fallback for address lookup
  return null
}
