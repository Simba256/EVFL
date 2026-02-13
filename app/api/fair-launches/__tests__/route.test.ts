import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'

// Mock the database functions
vi.mock('@/lib/db/fair-launch', () => ({
  getFairLaunches: vi.fn(),
  getActiveFairLaunches: vi.fn(),
  searchFairLaunches: vi.fn(),
  getFairLaunchStats: vi.fn(),
}))

import {
  getFairLaunches,
  getActiveFairLaunches,
  searchFairLaunches,
  getFairLaunchStats,
} from '@/lib/db/fair-launch'

const mockFairLaunches = [
  {
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
    status: 'ACTIVE' as const,
    totalCommitted: '5000000000000000000',
    tokenPrice: '0',
    participantCount: 5,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'fl_2',
    icoAddress: '0x5555555555555555555555555555555555555555',
    tokenAddress: '0x6666666666666666666666666666666666666666',
    treasuryAddress: '0x7777777777777777777777777777777777777777',
    creatorAddress: '0x8888888888888888888888888888888888888888',
    name: 'Another Token',
    symbol: 'ANOTHER',
    imageURI: '',
    description: '',
    tokenSupply: '5000000000000000000000000',
    minimumRaise: '20000000000000000000',
    teamTokensBps: 0,
    startTime: new Date('2024-01-02T00:00:00Z'),
    endTime: new Date('2024-01-09T00:00:00Z'),
    status: 'PENDING' as const,
    totalCommitted: '0',
    tokenPrice: '0',
    participantCount: 0,
    createdAt: new Date('2024-01-02T00:00:00Z'),
  },
]

const mockStats = {
  totalLaunches: 10,
  activeLaunches: 3,
  totalRaised: '100000000000000000000',
  totalParticipants: 50,
  successfulLaunches: 5,
  failedLaunches: 2,
}

describe('GET /api/fair-launches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all fair launches with default pagination', async () => {
    vi.mocked(getFairLaunches).mockResolvedValue({
      fairLaunches: mockFairLaunches,
      total: 2,
    })

    const request = new NextRequest('http://localhost:3000/api/fair-launches')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fairLaunches).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(getFairLaunches).toHaveBeenCalledWith(0, 20)
  })

  it('should respect pagination parameters', async () => {
    vi.mocked(getFairLaunches).mockResolvedValue({
      fairLaunches: [mockFairLaunches[1]],
      total: 2,
    })

    const request = new NextRequest('http://localhost:3000/api/fair-launches?offset=1&limit=1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fairLaunches).toHaveLength(1)
    expect(getFairLaunches).toHaveBeenCalledWith(1, 1)
  })

  it('should cap limit at 100', async () => {
    vi.mocked(getFairLaunches).mockResolvedValue({
      fairLaunches: mockFairLaunches,
      total: 2,
    })

    const request = new NextRequest('http://localhost:3000/api/fair-launches?limit=500')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(getFairLaunches).toHaveBeenCalledWith(0, 100)
  })

  it('should filter by status=active', async () => {
    vi.mocked(getActiveFairLaunches).mockResolvedValue({
      fairLaunches: [mockFairLaunches[0]],
      total: 1,
    })

    const request = new NextRequest('http://localhost:3000/api/fair-launches?status=active')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fairLaunches).toHaveLength(1)
    expect(getActiveFairLaunches).toHaveBeenCalledWith(0, 20)
  })

  it('should filter by specific status (FINALIZED)', async () => {
    vi.mocked(getFairLaunches).mockResolvedValue({
      fairLaunches: [],
      total: 0,
    })

    const request = new NextRequest('http://localhost:3000/api/fair-launches?status=FINALIZED')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(getFairLaunches).toHaveBeenCalledWith(0, 20, 'FINALIZED')
  })

  it('should search by name/symbol', async () => {
    vi.mocked(searchFairLaunches).mockResolvedValue({
      fairLaunches: [mockFairLaunches[0]],
      total: 1,
    })

    const request = new NextRequest('http://localhost:3000/api/fair-launches?search=TEST')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fairLaunches).toHaveLength(1)
    expect(searchFairLaunches).toHaveBeenCalledWith('TEST', 0, 20)
  })

  it('should return stats when stats=true', async () => {
    vi.mocked(getFairLaunchStats).mockResolvedValue(mockStats)

    const request = new NextRequest('http://localhost:3000/api/fair-launches?stats=true')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalLaunches).toBe(10)
    expect(data.activeLaunches).toBe(3)
    expect(data.successfulLaunches).toBe(5)
    expect(getFairLaunchStats).toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    vi.mocked(getFairLaunches).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/fair-launches')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch fair launches')
  })

  it('should handle negative offset', async () => {
    vi.mocked(getFairLaunches).mockResolvedValue({
      fairLaunches: mockFairLaunches,
      total: 2,
    })

    const request = new NextRequest('http://localhost:3000/api/fair-launches?offset=-5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(getFairLaunches).toHaveBeenCalledWith(0, 20) // Should be clamped to 0
  })
})
