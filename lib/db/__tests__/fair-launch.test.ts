import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be hoisted, so we define the mock functions inline
vi.mock('../prisma', () => ({
  prisma: {
    fairLaunch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    commitment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}))

// Import the mocked prisma after vi.mock
import { prisma } from '../prisma'

// Helper to get the mocked prisma
const mockPrisma = prisma as {
  fairLaunch: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
    groupBy: ReturnType<typeof vi.fn>
  }
  commitment: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}

import {
  getFairLaunches,
  getActiveFairLaunches,
  getFairLaunchByAddress,
  getFairLaunchByTokenAddress,
  getFairLaunchesByCreator,
  getCommitments,
  getUserCommitment,
  getUserAllCommitments,
  getFairLaunchStats,
  searchFairLaunches,
} from '../fair-launch'

const mockFairLaunch = {
  id: 'fl_1',
  icoAddress: '0x1111111111111111111111111111111111111111',
  tokenAddress: '0x2222222222222222222222222222222222222222',
  treasuryAddress: '0x3333333333333333333333333333333333333333',
  creatorAddress: '0x4444444444444444444444444444444444444444',
  name: 'Test Token',
  symbol: 'TEST',
  imageURI: 'ipfs://test',
  description: 'A test token',
  tokenSupply: '10000000000000000000000000',
  minimumRaise: '10000000000000000000',
  teamTokensBps: 1000,
  startTime: new Date('2024-01-01T00:00:00Z'),
  endTime: new Date('2024-01-08T00:00:00Z'),
  status: 'ACTIVE',
  totalCommitted: '5000000000000000000',
  tokenPrice: '0',
  participantCount: 5,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  finalizedAt: null,
  failedAt: null,
  deployTxHash: '0xabc123',
  finalizeTxHash: null,
  timelockAddress: null,
}

const mockCommitment = {
  id: 'commit_1',
  fairLaunchId: 'fl_1',
  icoAddress: '0x1111111111111111111111111111111111111111',
  userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  amount: '5000000000000000000',
  allocation: '2500000000000000000000000',
  hasClaimed: false,
  hasRefunded: false,
  claimedAt: null,
  refundedAt: null,
  lastTxHash: '0xdef456',
  lastBlockNumber: BigInt(1000),
  lastBlockTime: new Date('2024-01-01T12:00:00Z'),
  createdAt: new Date('2024-01-01T12:00:00Z'),
  updatedAt: new Date('2024-01-01T12:00:00Z'),
}

describe('Fair Launch Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFairLaunches', () => {
    it('should return fair launches with pagination', async () => {
      mockPrisma.fairLaunch.findMany.mockResolvedValue([mockFairLaunch])
      mockPrisma.fairLaunch.count.mockResolvedValue(1)

      const result = await getFairLaunches(0, 20)

      expect(result.fairLaunches).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(mockPrisma.fairLaunch.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
    })

    it('should filter by status', async () => {
      mockPrisma.fairLaunch.findMany.mockResolvedValue([mockFairLaunch])
      mockPrisma.fairLaunch.count.mockResolvedValue(1)

      await getFairLaunches(0, 20, 'ACTIVE')

      expect(mockPrisma.fairLaunch.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
    })
  })

  describe('getActiveFairLaunches', () => {
    it('should return only PENDING and ACTIVE launches', async () => {
      mockPrisma.fairLaunch.findMany.mockResolvedValue([mockFairLaunch])
      mockPrisma.fairLaunch.count.mockResolvedValue(1)

      await getActiveFairLaunches(0, 20)

      expect(mockPrisma.fairLaunch.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['PENDING', 'ACTIVE'] } },
        orderBy: { endTime: 'asc' },
        skip: 0,
        take: 20,
      })
    })
  })

  describe('getFairLaunchByAddress', () => {
    it('should find fair launch by ICO address', async () => {
      mockPrisma.fairLaunch.findUnique.mockResolvedValue(mockFairLaunch)

      const result = await getFairLaunchByAddress('0x1111111111111111111111111111111111111111')

      expect(result).toEqual(mockFairLaunch)
      expect(mockPrisma.fairLaunch.findUnique).toHaveBeenCalledWith({
        where: { icoAddress: '0x1111111111111111111111111111111111111111' },
      })
    })

    it('should return null when not found', async () => {
      mockPrisma.fairLaunch.findUnique.mockResolvedValue(null)

      const result = await getFairLaunchByAddress('0x9999999999999999999999999999999999999999')

      expect(result).toBeNull()
    })

    it('should lowercase the address', async () => {
      mockPrisma.fairLaunch.findUnique.mockResolvedValue(mockFairLaunch)

      await getFairLaunchByAddress('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')

      expect(mockPrisma.fairLaunch.findUnique).toHaveBeenCalledWith({
        where: { icoAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      })
    })
  })

  describe('getFairLaunchByTokenAddress', () => {
    it('should find fair launch by token address', async () => {
      mockPrisma.fairLaunch.findFirst.mockResolvedValue(mockFairLaunch)

      const result = await getFairLaunchByTokenAddress('0x2222222222222222222222222222222222222222')

      expect(result).toEqual(mockFairLaunch)
      expect(mockPrisma.fairLaunch.findFirst).toHaveBeenCalledWith({
        where: { tokenAddress: '0x2222222222222222222222222222222222222222' },
      })
    })
  })

  describe('getFairLaunchesByCreator', () => {
    it('should return fair launches by creator', async () => {
      mockPrisma.fairLaunch.findMany.mockResolvedValue([mockFairLaunch])
      mockPrisma.fairLaunch.count.mockResolvedValue(1)

      const result = await getFairLaunchesByCreator('0x4444444444444444444444444444444444444444', 0, 20)

      expect(result.fairLaunches).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(mockPrisma.fairLaunch.findMany).toHaveBeenCalledWith({
        where: { creatorAddress: '0x4444444444444444444444444444444444444444' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
    })
  })

  describe('getCommitments', () => {
    it('should return commitments for a fair launch', async () => {
      mockPrisma.fairLaunch.findUnique.mockResolvedValue({ id: 'fl_1' })
      mockPrisma.commitment.findMany.mockResolvedValue([mockCommitment])
      mockPrisma.commitment.count.mockResolvedValue(1)

      const result = await getCommitments('0x1111111111111111111111111111111111111111', 0, 50)

      expect(result.commitments).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('should return empty when fair launch not found', async () => {
      mockPrisma.fairLaunch.findUnique.mockResolvedValue(null)

      const result = await getCommitments('0x9999999999999999999999999999999999999999', 0, 50)

      expect(result.commitments).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('getUserCommitment', () => {
    it('should return user commitment for a fair launch', async () => {
      mockPrisma.fairLaunch.findUnique.mockResolvedValue({ id: 'fl_1' })
      mockPrisma.commitment.findUnique.mockResolvedValue(mockCommitment)

      const result = await getUserCommitment(
        '0x1111111111111111111111111111111111111111',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )

      expect(result).toBeTruthy()
      expect(result?.userAddress).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    })

    it('should return null when fair launch not found', async () => {
      mockPrisma.fairLaunch.findUnique.mockResolvedValue(null)

      const result = await getUserCommitment(
        '0x9999999999999999999999999999999999999999',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )

      expect(result).toBeNull()
    })
  })

  describe('getUserAllCommitments', () => {
    it('should return all commitments by a user', async () => {
      const commitmentWithFairLaunch = {
        ...mockCommitment,
        fairLaunch: mockFairLaunch,
      }
      mockPrisma.commitment.findMany.mockResolvedValue([commitmentWithFairLaunch])
      mockPrisma.commitment.count.mockResolvedValue(1)

      const result = await getUserAllCommitments('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 0, 20)

      expect(result.commitments).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(mockPrisma.commitment.findMany).toHaveBeenCalledWith({
        where: { userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: { fairLaunch: true },
      })
    })
  })

  describe('getFairLaunchStats', () => {
    it('should return aggregated statistics', async () => {
      mockPrisma.fairLaunch.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { status: 2 } },
        { status: 'ACTIVE', _count: { status: 3 } },
        { status: 'FINALIZED', _count: { status: 5 } },
        { status: 'FAILED', _count: { status: 1 } },
      ])
      mockPrisma.fairLaunch.findMany.mockResolvedValue([
        { totalCommitted: '50000000000000000000', participantCount: 25 },
        { totalCommitted: '30000000000000000000', participantCount: 15 },
      ])

      const result = await getFairLaunchStats()

      expect(result.totalLaunches).toBe(11)
      expect(result.activeLaunches).toBe(5)
      expect(result.successfulLaunches).toBe(5)
      expect(result.failedLaunches).toBe(1)
      expect(result.totalParticipants).toBe(40)
      expect(result.totalRaised).toBe('80000000000000000000')
    })
  })

  describe('searchFairLaunches', () => {
    it('should search by name or symbol', async () => {
      mockPrisma.fairLaunch.findMany.mockResolvedValue([mockFairLaunch])
      mockPrisma.fairLaunch.count.mockResolvedValue(1)

      const result = await searchFairLaunches('TEST', 0, 20)

      expect(result.fairLaunches).toHaveLength(1)
      expect(mockPrisma.fairLaunch.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'TEST', mode: 'insensitive' } },
            { symbol: { contains: 'TEST', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
    })
  })
})
