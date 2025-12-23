import type { TrendingToken } from '@/types'

// Mock trending tokens data
export const MOCK_TRENDING_TOKENS: TrendingToken[] = [
  { symbol: "$ROBOWAR", price: "$0.0042", change: 156.8 },
  { symbol: "$CTRL", price: "$0.0089", change: 89.3 },
  { symbol: "$AINFLU", price: "$0.0156", change: 234.5 },
  { symbol: "$MECHA", price: "$0.0023", change: 67.2 },
  { symbol: "$AUTOBOT", price: "$0.0091", change: 145.1 },
  { symbol: "$SYNTH", price: "$0.0067", change: 98.4 },
  { symbol: "$NEURON", price: "$0.0134", change: 178.9 },
  { symbol: "$CIRCUIT", price: "$0.0045", change: 123.6 },
]

/**
 * Get trending tokens for the ticker
 * @returns Promise<TrendingToken[]>
 *
 * Future: Replace with API call
 * const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/trending`, { next: { revalidate: 30 } })
 * return res.json()
 */
export async function getTrendingTokens(): Promise<TrendingToken[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))
  return MOCK_TRENDING_TOKENS
}
