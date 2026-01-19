import type { LeaderboardToken, LeaderboardSortBy } from '@/types'
import {
  getLeaderboardFromDb,
  isDatabaseAvailable,
  useDatabaseEnabled,
} from '@/lib/db'

// Mock leaderboard data
export const MOCK_LEADERBOARD_DATA: LeaderboardToken[] = [
  {
    rank: 1,
    name: "AI Influencer Network",
    symbol: "$AINFLU",
    image: "/ai-robot-influencer-with-social-media-hologram.jpg",
    marketCap: 8700000,
    volume24h: 2800000,
    holders: 4567,
    price: 0.0156,
    change24h: 234.5,
    change7d: 567.8,
  },
  {
    rank: 2,
    name: "Control Protocol",
    symbol: "$CTRL",
    image: "/humanoid-robot-with-glowing-cyan-interface.jpg",
    marketCap: 5100000,
    volume24h: 1200000,
    holders: 2891,
    price: 0.0089,
    change24h: 89.3,
    change7d: 234.1,
  },
  {
    rank: 3,
    name: "AutoBot Collective",
    symbol: "$AUTOBOT",
    image: "/swarm-of-small-autonomous-robots.jpg",
    marketCap: 4200000,
    volume24h: 980000,
    holders: 2134,
    price: 0.0091,
    change24h: 145.1,
    change7d: 312.4,
  },
  {
    rank: 4,
    name: "Synthetic Dreams",
    symbol: "$SYNTH",
    image: "/ethereal-robot-with-glowing-neural-network.jpg",
    marketCap: 3500000,
    volume24h: 723000,
    holders: 1678,
    price: 0.0067,
    change24h: 98.4,
    change7d: 189.2,
  },
  {
    rank: 5,
    name: "RoboWar Arena",
    symbol: "$ROBOWAR",
    image: "/futuristic-battle-robot-with-weapons.jpg",
    marketCap: 2400000,
    volume24h: 890000,
    holders: 1243,
    price: 0.0042,
    change24h: 156.8,
    change7d: 278.5,
  },
  {
    rank: 6,
    name: "MechaSyndicate",
    symbol: "$MECHA",
    image: "/giant-mecha-robot-with-metallic-armor.jpg",
    marketCap: 1800000,
    volume24h: 456000,
    holders: 892,
    price: 0.0023,
    change24h: 67.2,
    change7d: 145.3,
  },
]

/**
 * Get leaderboard data with database fallback
 * @param sortBy - Sort criterion (marketCap, volume, holders)
 * @returns Promise<LeaderboardToken[]>
 */
export async function getLeaderboard(sortBy: LeaderboardSortBy = 'marketCap'): Promise<LeaderboardToken[]> {
  // Check if database is enabled and available
  if (useDatabaseEnabled()) {
    try {
      const dbAvailable = await isDatabaseAvailable()
      if (dbAvailable) {
        const leaderboard = await getLeaderboardFromDb(sortBy)
        if (leaderboard.length > 0) {
          return leaderboard
        }
      }
    } catch (error) {
      console.warn('Database query failed, falling back to mock data:', error)
    }
  }

  // Fallback to mock data
  const sorted = [...MOCK_LEADERBOARD_DATA].sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return b.volume24h - a.volume24h
      case 'holders':
        return b.holders - a.holders
      case 'marketCap':
      default:
        return b.marketCap - a.marketCap
    }
  })

  // Update ranks after sorting
  return sorted.map((token, index) => ({
    ...token,
    rank: index + 1,
  }))
}

/**
 * Format number to currency string
 * @param num - Number to format
 * @returns Formatted string (e.g., "$2.4M", "$890K")
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`
  return `$${num.toFixed(4)}`
}
