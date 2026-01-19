import { prisma } from './prisma'
import { TokenHolder as PrismaHolder, Prisma } from '../generated/prisma'
import type { Holder } from '@/types'

// Type for creating/updating a holder
export interface UpsertHolderInput {
  tokenId: string
  tokenAddress: string
  holderAddress: string
  balance: string
  percentage: number
  blockNumber: bigint
}

// Convert Prisma holder to frontend Holder type
function toFrontendHolder(holder: PrismaHolder): Holder {
  return {
    address: holder.holderAddress,
    amount: holder.balance,
    percentage: holder.percentage,
  }
}

// Upsert a holder (create or update)
export async function upsertHolder(input: UpsertHolderInput): Promise<Holder> {
  const holder = await prisma.tokenHolder.upsert({
    where: {
      tokenId_holderAddress: {
        tokenId: input.tokenId,
        holderAddress: input.holderAddress.toLowerCase(),
      },
    },
    update: {
      balance: input.balance,
      percentage: input.percentage,
      lastUpdatedBlock: input.blockNumber,
      lastUpdatedAt: new Date(),
    },
    create: {
      tokenId: input.tokenId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      holderAddress: input.holderAddress.toLowerCase(),
      balance: input.balance,
      percentage: input.percentage,
      lastUpdatedBlock: input.blockNumber,
    },
  })

  return toFrontendHolder(holder)
}

// Get top holders for a token
export async function getHoldersForToken(
  tokenAddress: string,
  limit: number = 20
): Promise<Holder[]> {
  const holders = await prisma.tokenHolder.findMany({
    where: {
      tokenAddress: tokenAddress.toLowerCase(),
      balance: { not: '0' }, // Exclude zero balances
    },
    orderBy: { percentage: 'desc' },
    take: limit,
  })

  return holders.map(toFrontendHolder)
}

// Get top holders by token ID
export async function getHoldersByTokenId(
  tokenId: string,
  limit: number = 20
): Promise<Holder[]> {
  const holders = await prisma.tokenHolder.findMany({
    where: {
      tokenId,
      balance: { not: '0' },
    },
    orderBy: { percentage: 'desc' },
    take: limit,
  })

  return holders.map(toFrontendHolder)
}

// Get holder count for a token
export async function getHolderCount(tokenAddress: string): Promise<number> {
  return prisma.tokenHolder.count({
    where: {
      tokenAddress: tokenAddress.toLowerCase(),
      balance: { not: '0' },
    },
  })
}

// Get specific holder's balance
export async function getHolderBalance(
  tokenAddress: string,
  holderAddress: string
): Promise<Holder | null> {
  const holder = await prisma.tokenHolder.findFirst({
    where: {
      tokenAddress: tokenAddress.toLowerCase(),
      holderAddress: holderAddress.toLowerCase(),
    },
  })

  return holder ? toFrontendHolder(holder) : null
}

// Delete holder (set balance to 0 is usually better for history)
export async function removeHolder(
  tokenAddress: string,
  holderAddress: string
): Promise<boolean> {
  try {
    await prisma.tokenHolder.updateMany({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        holderAddress: holderAddress.toLowerCase(),
      },
      data: {
        balance: '0',
        percentage: 0,
        lastUpdatedAt: new Date(),
      },
    })
    return true
  } catch {
    return false
  }
}

// Bulk upsert holders (for indexer)
export async function upsertHoldersBatch(holders: UpsertHolderInput[]): Promise<number> {
  let count = 0

  // Use transaction for batch operations
  await prisma.$transaction(async (tx) => {
    for (const holder of holders) {
      await tx.tokenHolder.upsert({
        where: {
          tokenId_holderAddress: {
            tokenId: holder.tokenId,
            holderAddress: holder.holderAddress.toLowerCase(),
          },
        },
        update: {
          balance: holder.balance,
          percentage: holder.percentage,
          lastUpdatedBlock: holder.blockNumber,
          lastUpdatedAt: new Date(),
        },
        create: {
          tokenId: holder.tokenId,
          tokenAddress: holder.tokenAddress.toLowerCase(),
          holderAddress: holder.holderAddress.toLowerCase(),
          balance: holder.balance,
          percentage: holder.percentage,
          lastUpdatedBlock: holder.blockNumber,
        },
      })
      count++
    }
  })

  return count
}

// Recalculate all percentages for a token
export async function recalculatePercentages(
  tokenAddress: string,
  totalSupply: string
): Promise<void> {
  const totalSupplyNum = parseFloat(totalSupply)
  if (totalSupplyNum === 0) return

  const holders = await prisma.tokenHolder.findMany({
    where: { tokenAddress: tokenAddress.toLowerCase() },
  })

  await prisma.$transaction(
    holders.map((holder) =>
      prisma.tokenHolder.update({
        where: { id: holder.id },
        data: {
          percentage: (parseFloat(holder.balance) / totalSupplyNum) * 100,
        },
      })
    )
  )
}
