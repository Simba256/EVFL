// Core Token interface
export interface Token {
  id: string
  name: string
  symbol: string
  description: string
  image: string
  marketCap: string
  volume24h: string
  holders: number
  price: string
  change24h: number
  createdAt: string
  creator: string
  status: "new" | "rising" | "graduated"
}

// Extended Token interface for detail pages
export interface TokenDetail extends Token {
  priceUSD: number
  liquidity: string
  fdv: string
  totalSupply: string
  circulatingSupply: string
}

// Trending ticker token
export interface TrendingToken {
  symbol: string
  price: string
  change: number
}

// Leaderboard token
export interface LeaderboardToken {
  rank: number
  name: string
  symbol: string
  image: string
  marketCap: number
  volume24h: number
  holders: number
  price: number
  change24h: number
  change7d: number
}

// Token holder
export interface Holder {
  address: string
  amount: string
  percentage: number
}

// Token trade
export interface Trade {
  type: 'buy' | 'sell'
  amount: string
  price: string
  time: string
  trader: string
}

// Leaderboard sort options
export type LeaderboardSortBy = 'marketCap' | 'volume' | 'holders'

// Filter tabs
export type TokenFilter = 'all' | 'new' | 'rising' | 'graduated'
