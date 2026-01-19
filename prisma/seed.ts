/**
 * Prisma Seed Script
 *
 * Seeds the database with mock data for development and testing.
 *
 * Usage:
 *   npx prisma db seed
 */

import 'dotenv/config'
import { PrismaClient, TokenStatus } from '../lib/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Create database connection
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Mock token data matching the frontend mock data
const mockTokens = [
  {
    name: "RoboWar Arena",
    symbol: "ROBOWAR",
    description: "Battle-ready combat robots competing in the ultimate AI arena. Deploy, strategize, dominate.",
    image: "/futuristic-battle-robot-with-weapons.jpg",
    tokenAddress: "0x1000000000000000000000000000000000000001",
    poolAddress: "0x2000000000000000000000000000000000000001",
    creatorAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f92f8",
    totalSupply: "385000000000000000000000",
    price: "0.0042",
    priceUSD: 0.0042,
    marketCap: "2400000",
    volume24h: "890000",
    liquidity: "1200000",
    fdv: "4800000",
    circulatingSupply: "192500000000000000000000",
    holdersCount: 1243,
    change24h: 156.8,
    change7d: 278.5,
    status: 'new' as TokenStatus,
  },
  {
    name: "Control Protocol",
    symbol: "CTRL",
    description: "Take full control of your personal robot agent. Command, customize, conquer the metaverse.",
    image: "/humanoid-robot-with-glowing-cyan-interface.jpg",
    tokenAddress: "0x1000000000000000000000000000000000000002",
    poolAddress: "0x2000000000000000000000000000000000000002",
    creatorAddress: "0x9a3c7b8e2f1d4a5c6b7e8f9a0b1c2d3e4f5a1b4d",
    totalSupply: "572000000000000000000000",
    price: "0.0089",
    priceUSD: 0.0089,
    marketCap: "5100000",
    volume24h: "1200000",
    liquidity: "2500000",
    fdv: "10200000",
    circulatingSupply: "286000000000000000000000",
    holdersCount: 2891,
    change24h: 89.3,
    change7d: 234.1,
    status: 'rising' as TokenStatus,
  },
  {
    name: "AI Influencer Network",
    symbol: "AINFLU",
    description: "The first AI-powered influencer collective. Synthetic personalities, real engagement, infinite reach.",
    image: "/ai-robot-influencer-with-social-media-hologram.jpg",
    tokenAddress: "0x1000000000000000000000000000000000000003",
    poolAddress: "0x2000000000000000000000000000000000000003",
    creatorAddress: "0x3f8b5c9d2e1a4f7b6c8d9e0f1a2b3c4d5e6f7c2a",
    totalSupply: "1115000000000000000000000",
    price: "0.0156",
    priceUSD: 0.0156,
    marketCap: "8700000",
    volume24h: "2800000",
    liquidity: "4200000",
    fdv: "17400000",
    circulatingSupply: "557500000000000000000000",
    holdersCount: 4567,
    change24h: 234.5,
    change7d: 567.8,
    status: 'graduated' as TokenStatus,
  },
  {
    name: "MechaSyndicate",
    symbol: "MECHA",
    description: "Elite mechanized warriors forming an unstoppable decentralized army of steel and silicon.",
    image: "/giant-mecha-robot-with-metallic-armor.jpg",
    tokenAddress: "0x1000000000000000000000000000000000000004",
    poolAddress: "0x2000000000000000000000000000000000000004",
    creatorAddress: "0x5d2f8a9b3c4e5f6a7b8c9d0e1f2a3b4c5d6e8e9c",
    totalSupply: "782000000000000000000000",
    price: "0.0023",
    priceUSD: 0.0023,
    marketCap: "1800000",
    volume24h: "456000",
    liquidity: "890000",
    fdv: "3600000",
    circulatingSupply: "391000000000000000000000",
    holdersCount: 892,
    change24h: 67.2,
    change7d: 145.3,
    status: 'new' as TokenStatus,
  },
  {
    name: "AutoBot Collective",
    symbol: "AUTOBOT",
    description: "Self-organizing robot swarms executing complex tasks autonomously. Efficiency meets intelligence.",
    image: "/swarm-of-small-autonomous-robots.jpg",
    tokenAddress: "0x1000000000000000000000000000000000000005",
    poolAddress: "0x2000000000000000000000000000000000000005",
    creatorAddress: "0x7c8a5b9d3e2f4a6b7c8d9e0f1a2b3c4d5e6f4b3f",
    totalSupply: "461000000000000000000000",
    price: "0.0091",
    priceUSD: 0.0091,
    marketCap: "4200000",
    volume24h: "980000",
    liquidity: "1800000",
    fdv: "8400000",
    circulatingSupply: "230500000000000000000000",
    holdersCount: 2134,
    change24h: 145.1,
    change7d: 312.4,
    status: 'rising' as TokenStatus,
  },
  {
    name: "Synthetic Dreams",
    symbol: "SYNTH",
    description: "AI entities experiencing consciousness. The first truly sentient robot token.",
    image: "/ethereal-robot-with-glowing-neural-network.jpg",
    tokenAddress: "0x1000000000000000000000000000000000000006",
    poolAddress: "0x2000000000000000000000000000000000000006",
    creatorAddress: "0x2b9d8c7e5f4a3b2c1d0e9f8a7b6c5d4e3f2a6a5e",
    totalSupply: "522000000000000000000000",
    price: "0.0067",
    priceUSD: 0.0067,
    marketCap: "3500000",
    volume24h: "723000",
    liquidity: "1400000",
    fdv: "7000000",
    circulatingSupply: "261000000000000000000000",
    holdersCount: 1678,
    change24h: 98.4,
    change7d: 189.2,
    status: 'rising' as TokenStatus,
  },
]

// Mock holders (42 character addresses: 0x + 40 hex chars)
const mockHolders = [
  { holderAddress: "0xD4a35a8Bc2f9e3d4c5b6a7f8e9d0c1b2a3f48Bc2", percentage: 6.47 },
  { holderAddress: "0x8F2c9b3a4e5f6d7c8b9a0e1f2d3c4b5a6e7f3Da1", percentage: 5.1 },
  { holderAddress: "0x5Ec98d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a4Bf7", percentage: 4.28 },
  { holderAddress: "0x2Fa87c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2f6Cd9", percentage: 3.58 },
  { holderAddress: "0xBc458a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d9Ae3", percentage: 2.95 },
  { holderAddress: "0x7Ed29b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e1Fb4", percentage: 2.54 },
  { holderAddress: "0x3Af68c7b6d5e4f3a2b1c0d9e8f7a6b5c4d3e8Dc7", percentage: 2.14 },
  { holderAddress: "0x9Cb19a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d5Ef2", percentage: 1.85 },
]

async function main() {
  console.log('Starting database seed...')

  // Clear existing data
  console.log('Clearing existing data...')
  await prisma.trade.deleteMany()
  await prisma.tokenHolder.deleteMany()
  await prisma.priceHistory.deleteMany()
  await prisma.indexerState.deleteMany()
  await prisma.token.deleteMany()

  // Seed tokens
  console.log('Seeding tokens...')
  for (const tokenData of mockTokens) {
    const token = await prisma.token.create({
      data: {
        ...tokenData,
        decimals: 18,
        tokenWeight: 80,
        isOnChain: false, // Mock data is not on-chain
        deployedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date in last 7 days
      },
    })

    console.log(`Created token: ${token.symbol}`)

    // Create holders for this token
    console.log(`Creating holders for ${token.symbol}...`)
    const totalSupplyBigInt = BigInt(tokenData.totalSupply)

    for (const holder of mockHolders) {
      // Calculate balance using BigInt math to avoid floating point issues
      const balanceBigInt = (totalSupplyBigInt * BigInt(Math.floor(holder.percentage * 100))) / BigInt(10000)
      const balance = balanceBigInt.toString()

      await prisma.tokenHolder.create({
        data: {
          tokenId: token.id,
          tokenAddress: token.tokenAddress,
          holderAddress: holder.holderAddress.toLowerCase(),
          balance,
          percentage: holder.percentage,
          lastUpdatedBlock: BigInt(0),
        },
      })
    }

    // Create some mock trades
    console.log(`Creating trades for ${token.symbol}...`)
    const tradeTypes = ['buy', 'sell'] as const
    const traders = mockHolders.map((h) => h.holderAddress)

    for (let i = 0; i < 10; i++) {
      const type = tradeTypes[Math.floor(Math.random() * 2)]
      const trader = traders[Math.floor(Math.random() * traders.length)]
      const tokenAmount = (Math.random() * 10000 + 100).toFixed(0) + '000000000000000000'
      const bnbAmount = (Math.random() * 0.5 + 0.01).toFixed(4) + '000000000000000000'

      await prisma.trade.create({
        data: {
          tokenId: token.id,
          tokenAddress: token.tokenAddress,
          type,
          traderAddress: trader.toLowerCase(),
          tokenAmount,
          bnbAmount,
          price: tokenData.price,
          priceUSD: tokenData.priceUSD,
          txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 66),
          blockNumber: BigInt(Math.floor(Math.random() * 1000000)),
          blockTimestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          logIndex: i,
        },
      })
    }

    // Create price history candles (1h interval for last 24 hours)
    console.log(`Creating price history for ${token.symbol}...`)
    const basePrice = parseFloat(tokenData.price)
    const now = new Date()

    for (let i = 24; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      // Round to start of hour
      timestamp.setMinutes(0, 0, 0)

      const variance = (Math.random() - 0.5) * 0.2 // +/- 10% variance
      const open = basePrice * (1 + variance)
      const close = basePrice * (1 + (Math.random() - 0.5) * 0.2)
      const high = Math.max(open, close) * (1 + Math.random() * 0.05)
      const low = Math.min(open, close) * (1 - Math.random() * 0.05)
      const volume = Math.random() * 100000 + 10000

      await prisma.priceHistory.create({
        data: {
          tokenId: token.id,
          interval: 3600, // 1 hour
          timestamp,
          open: open.toString(),
          high: high.toString(),
          low: low.toString(),
          close: close.toString(),
          volume: volume.toString(),
          volumeUsd: volume * basePrice,
          tradeCount: Math.floor(Math.random() * 50) + 5,
        },
      })
    }
  }

  console.log('Seed completed successfully!')
  console.log(`Created ${mockTokens.length} tokens with holders, trades, and price history.`)
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
