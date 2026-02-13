import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../[userAddress]/route'

// Mock the database functions
vi.mock('@/lib/db/fair-launch', () => ({
  getUserAllCommitments: vi.fn(),
}))

import { getUserAllCommitments } from '@/lib/db/fair-launch'

const mockCommitmentsWithLaunches = [
  {
    id: 'commit_1',
    userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    amount: '5000000000000000000',
    allocation: '2500000000000000000000000',
    hasClaimed: false,
    hasRefunded: false,
    claimedAt: null,
    refundedAt: null,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    fairLaunch: {
      id: 'fl_1',
      icoAddress: '0x1111111111111111111111111111111111111111',
      name: 'Test Token',
      symbol: 'TEST',
      imageURI: 'ipfs://test',
      status: 'ACTIVE' as const,
      endTime: new Date('2024-01-08T00:00:00Z'),
    },
  },
  {
    id: 'commit_2',
    userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    amount: '3000000000000000000',
    allocation: '1500000000000000000000000',
    hasClaimed: true,
    hasRefunded: false,
    claimedAt: new Date('2024-01-10T12:00:00Z'),
    refundedAt: null,
    createdAt: new Date('2024-01-02T12:00:00Z'),
    fairLaunch: {
      id: 'fl_2',
      icoAddress: '0x2222222222222222222222222222222222222222',
      name: 'Another Token',
      symbol: 'ANOTHER',
      imageURI: '',
      status: 'FINALIZED' as const,
      endTime: new Date('2024-01-09T00:00:00Z'),
    },
  },
]

describe('GET /api/commitments/[userAddress]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Get all user commitments', () => {
    it('should return all commitments for a user', async () => {
      vi.mocked(getUserAllCommitments).mockResolvedValue({
        commitments: mockCommitmentsWithLaunches,
        total: 2,
      })

      const request = new NextRequest('http://localhost:3000/api/commitments/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.commitments).toHaveLength(2)
      expect(data.total).toBe(2)
      expect(data.commitments[0].fairLaunch.name).toBe('Test Token')
      expect(data.commitments[1].fairLaunch.name).toBe('Another Token')
      expect(getUserAllCommitments).toHaveBeenCalledWith(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        0,
        20
      )
    })

    it('should respect pagination parameters', async () => {
      vi.mocked(getUserAllCommitments).mockResolvedValue({
        commitments: [mockCommitmentsWithLaunches[1]],
        total: 2,
      })

      const request = new NextRequest('http://localhost:3000/api/commitments/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?offset=1&limit=1')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.commitments).toHaveLength(1)
      expect(getUserAllCommitments).toHaveBeenCalledWith(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        1,
        1
      )
    })

    it('should cap limit at 100', async () => {
      vi.mocked(getUserAllCommitments).mockResolvedValue({
        commitments: [],
        total: 0,
      })

      const request = new NextRequest('http://localhost:3000/api/commitments/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?limit=500')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      })

      expect(response.status).toBe(200)
      expect(getUserAllCommitments).toHaveBeenCalledWith(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        0,
        100
      )
    })

    it('should return empty array when user has no commitments', async () => {
      vi.mocked(getUserAllCommitments).mockResolvedValue({
        commitments: [],
        total: 0,
      })

      const request = new NextRequest('http://localhost:3000/api/commitments/0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.commitments).toHaveLength(0)
      expect(data.total).toBe(0)
    })
  })

  describe('Validation', () => {
    it('should return 400 for invalid user address', async () => {
      const request = new NextRequest('http://localhost:3000/api/commitments/invalid-address')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: 'invalid-address' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid user address format')
    })

    it('should return 400 for short address', async () => {
      const request = new NextRequest('http://localhost:3000/api/commitments/0x1234')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: '0x1234' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid user address format')
    })
  })

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      vi.mocked(getUserAllCommitments).mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/commitments/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch user commitments')
    })
  })

  describe('Data structure', () => {
    it('should include fair launch details in commitments', async () => {
      vi.mocked(getUserAllCommitments).mockResolvedValue({
        commitments: mockCommitmentsWithLaunches,
        total: 2,
      })

      const request = new NextRequest('http://localhost:3000/api/commitments/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      const response = await GET(request, {
        params: Promise.resolve({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)

      // First commitment (active, not claimed)
      const first = data.commitments[0]
      expect(first.hasClaimed).toBe(false)
      expect(first.fairLaunch.status).toBe('ACTIVE')
      expect(first.fairLaunch.icoAddress).toBe('0x1111111111111111111111111111111111111111')

      // Second commitment (finalized, claimed)
      const second = data.commitments[1]
      expect(second.hasClaimed).toBe(true)
      expect(second.fairLaunch.status).toBe('FINALIZED')
    })
  })
})
