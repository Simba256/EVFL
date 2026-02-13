/**
 * Fair Launch Database Operations
 */

import { prisma } from './prisma'
import type { ICOStatus } from '../generated/prisma'

export interface FairLaunchSummary {
  id: string
  icoAddress: string
  tokenAddress: string
  treasuryAddress: string
  creatorAddress: string
  name: string
  symbol: string
  imageURI: string
  description: string
  tokenSupply: string
  minimumRaise: string
  teamTokensBps: number
  startTime: Date
  endTime: Date
  status: ICOStatus
  totalCommitted: string
  tokenPrice: string
  participantCount: number
  finalizedAt: Date | null
  failedAt: Date | null
  createdAt: Date
}

export interface CommitmentSummary {
  id: string
  userAddress: string
  amount: string
  allocation: string
  hasClaimed: boolean
  hasRefunded: boolean
  claimedAt: Date | null
  refundedAt: Date | null
  createdAt: Date
}

/**
 * Get all Fair Launches with pagination
 */
export async function getFairLaunches(
  offset = 0,
  limit = 20,
  status?: ICOStatus
): Promise<{ fairLaunches: FairLaunchSummary[]; total: number }> {
  const where = status ? { status } : {}

  const [fairLaunches, total] = await Promise.all([
    prisma.fairLaunch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.fairLaunch.count({ where }),
  ])

  return { fairLaunches, total }
}

/**
 * Get active/pending Fair Launches (ICOs that are accepting commitments or haven't started yet)
 */
export async function getActiveFairLaunches(
  offset = 0,
  limit = 20
): Promise<{ fairLaunches: FairLaunchSummary[]; total: number }> {
  const where = {
    status: { in: ['PENDING', 'ACTIVE'] as ICOStatus[] },
  }

  const [fairLaunches, total] = await Promise.all([
    prisma.fairLaunch.findMany({
      where,
      orderBy: { endTime: 'asc' }, // Soonest ending first
      skip: offset,
      take: limit,
    }),
    prisma.fairLaunch.count({ where }),
  ])

  return { fairLaunches, total }
}

/**
 * Get Fair Launch by ICO address
 */
export async function getFairLaunchByAddress(
  icoAddress: string
): Promise<FairLaunchSummary | null> {
  return prisma.fairLaunch.findUnique({
    where: { icoAddress: icoAddress.toLowerCase() },
  })
}

/**
 * Get Fair Launch by token address
 */
export async function getFairLaunchByTokenAddress(
  tokenAddress: string
): Promise<FairLaunchSummary | null> {
  return prisma.fairLaunch.findFirst({
    where: { tokenAddress: tokenAddress.toLowerCase() },
  })
}

/**
 * Get Fair Launches by creator
 */
export async function getFairLaunchesByCreator(
  creatorAddress: string,
  offset = 0,
  limit = 20
): Promise<{ fairLaunches: FairLaunchSummary[]; total: number }> {
  const where = { creatorAddress: creatorAddress.toLowerCase() }

  const [fairLaunches, total] = await Promise.all([
    prisma.fairLaunch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.fairLaunch.count({ where }),
  ])

  return { fairLaunches, total }
}

/**
 * Get commitments for a Fair Launch
 */
export async function getCommitments(
  icoAddress: string,
  offset = 0,
  limit = 50
): Promise<{ commitments: CommitmentSummary[]; total: number }> {
  const fairLaunch = await prisma.fairLaunch.findUnique({
    where: { icoAddress: icoAddress.toLowerCase() },
    select: { id: true },
  })

  if (!fairLaunch) {
    return { commitments: [], total: 0 }
  }

  const where = { fairLaunchId: fairLaunch.id }

  const [commitments, total] = await Promise.all([
    prisma.commitment.findMany({
      where,
      orderBy: { amount: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        userAddress: true,
        amount: true,
        allocation: true,
        hasClaimed: true,
        hasRefunded: true,
        claimedAt: true,
        refundedAt: true,
        createdAt: true,
      },
    }),
    prisma.commitment.count({ where }),
  ])

  return { commitments, total }
}

/**
 * Get user's commitment for a Fair Launch
 */
export async function getUserCommitment(
  icoAddress: string,
  userAddress: string
): Promise<CommitmentSummary | null> {
  const fairLaunch = await prisma.fairLaunch.findUnique({
    where: { icoAddress: icoAddress.toLowerCase() },
    select: { id: true },
  })

  if (!fairLaunch) {
    return null
  }

  return prisma.commitment.findUnique({
    where: {
      fairLaunchId_userAddress: {
        fairLaunchId: fairLaunch.id,
        userAddress: userAddress.toLowerCase(),
      },
    },
    select: {
      id: true,
      userAddress: true,
      amount: true,
      allocation: true,
      hasClaimed: true,
      hasRefunded: true,
      claimedAt: true,
      refundedAt: true,
      createdAt: true,
    },
  })
}

/**
 * Get all commitments by a user across all Fair Launches
 */
export async function getUserAllCommitments(
  userAddress: string,
  offset = 0,
  limit = 20
): Promise<{
  commitments: (CommitmentSummary & { fairLaunch: FairLaunchSummary })[]
  total: number
}> {
  const where = { userAddress: userAddress.toLowerCase() }

  const [commitments, total] = await Promise.all([
    prisma.commitment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        userAddress: true,
        amount: true,
        allocation: true,
        hasClaimed: true,
        hasRefunded: true,
        claimedAt: true,
        refundedAt: true,
        createdAt: true,
        fairLaunch: {
          select: {
            id: true,
            icoAddress: true,
            name: true,
            symbol: true,
            imageURI: true,
            status: true,
            endTime: true,
          },
        },
      },
    }),
    prisma.commitment.count({ where }),
  ])

  return { commitments, total }
}

/**
 * Get Fair Launch statistics
 */
export async function getFairLaunchStats(): Promise<{
  totalLaunches: number
  activeLaunches: number
  totalRaised: string
  totalParticipants: number
  successfulLaunches: number
  failedLaunches: number
}> {
  const [counts, finalized] = await Promise.all([
    prisma.fairLaunch.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.fairLaunch.findMany({
      where: { status: 'FINALIZED' },
      select: { totalCommitted: true, participantCount: true },
    }),
  ])

  const statusCounts = counts.reduce(
    (acc, c) => {
      acc[c.status] = c._count.status
      return acc
    },
    {} as Record<string, number>
  )

  const totalRaised = finalized.reduce(
    (sum, fl) => sum + BigInt(fl.totalCommitted),
    BigInt(0)
  )

  const totalParticipants = finalized.reduce(
    (sum, fl) => sum + fl.participantCount,
    0
  )

  return {
    totalLaunches:
      (statusCounts.PENDING || 0) +
      (statusCounts.ACTIVE || 0) +
      (statusCounts.FINALIZED || 0) +
      (statusCounts.FAILED || 0),
    activeLaunches: (statusCounts.PENDING || 0) + (statusCounts.ACTIVE || 0),
    totalRaised: totalRaised.toString(),
    totalParticipants,
    successfulLaunches: statusCounts.FINALIZED || 0,
    failedLaunches: statusCounts.FAILED || 0,
  }
}

/**
 * Search Fair Launches by name or symbol
 */
export async function searchFairLaunches(
  query: string,
  offset = 0,
  limit = 20
): Promise<{ fairLaunches: FairLaunchSummary[]; total: number }> {
  const where = {
    OR: [
      { name: { contains: query, mode: 'insensitive' as const } },
      { symbol: { contains: query, mode: 'insensitive' as const } },
    ],
  }

  const [fairLaunches, total] = await Promise.all([
    prisma.fairLaunch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.fairLaunch.count({ where }),
  ])

  return { fairLaunches, total }
}
