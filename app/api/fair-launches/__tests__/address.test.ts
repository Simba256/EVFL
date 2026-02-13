import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../[address]/route'

// Mock the database functions
vi.mock('@/lib/db/fair-launch', () => ({
  getFairLaunchByAddress: vi.fn(),
  getFairLaunchByTokenAddress: vi.fn(),
  getFairLaunchesByCreator: vi.fn(),
}))

import {
  getFairLaunchByAddress,
  getFairLaunchByTokenAddress,
  getFairLaunchesByCreator,
} from '@/lib/db/fair-launch'

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
  status: 'ACTIVE' as const,
  totalCommitted: '5000000000000000000',
  tokenPrice: '0',
  participantCount: 5,
  createdAt: new Date('2024-01-01T00:00:00Z'),
}

describe('GET /api/fair-launches/[address]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Get by ICO address (default)', () => {
    it('should return fair launch by ICO address', async () => {
      vi.mocked(getFairLaunchByAddress).mockResolvedValue(mockFairLaunch)

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('Test Token')
      expect(data.symbol).toBe('TEST')
      expect(getFairLaunchByAddress).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111')
    })

    it('should return 404 when fair launch not found', async () => {
      vi.mocked(getFairLaunchByAddress).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Fair Launch not found')
    })

    it('should return 400 for invalid address format', async () => {
      const request = new NextRequest('http://localhost:3000/api/fair-launches/invalid-address')
      const response = await GET(request, {
        params: Promise.resolve({ address: 'invalid-address' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid address format')
    })
  })

  describe('Get by token address (type=token)', () => {
    it('should return fair launch by token address', async () => {
      vi.mocked(getFairLaunchByTokenAddress).mockResolvedValue(mockFairLaunch)

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x2222222222222222222222222222222222222222?type=token')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x2222222222222222222222222222222222222222' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('Test Token')
      expect(getFairLaunchByTokenAddress).toHaveBeenCalledWith('0x2222222222222222222222222222222222222222')
    })

    it('should return 404 when not found by token address', async () => {
      vi.mocked(getFairLaunchByTokenAddress).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x9999999999999999999999999999999999999999?type=token')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x9999999999999999999999999999999999999999' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Fair Launch not found')
    })
  })

  describe('Get by creator address (type=creator)', () => {
    it('should return fair launches by creator with pagination', async () => {
      vi.mocked(getFairLaunchesByCreator).mockResolvedValue({
        fairLaunches: [mockFairLaunch],
        total: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x4444444444444444444444444444444444444444?type=creator')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x4444444444444444444444444444444444444444' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.fairLaunches).toHaveLength(1)
      expect(data.total).toBe(1)
      expect(getFairLaunchesByCreator).toHaveBeenCalledWith(
        '0x4444444444444444444444444444444444444444',
        0,
        20
      )
    })

    it('should respect pagination for creator query', async () => {
      vi.mocked(getFairLaunchesByCreator).mockResolvedValue({
        fairLaunches: [],
        total: 10,
      })

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x4444444444444444444444444444444444444444?type=creator&offset=5&limit=5')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x4444444444444444444444444444444444444444' }),
      })

      expect(response.status).toBe(200)
      expect(getFairLaunchesByCreator).toHaveBeenCalledWith(
        '0x4444444444444444444444444444444444444444',
        5,
        5
      )
    })
  })

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      vi.mocked(getFairLaunchByAddress).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch fair launch')
    })
  })
})
