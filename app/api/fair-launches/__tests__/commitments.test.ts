import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../[address]/commitments/route'

// Mock the database functions
vi.mock('@/lib/db/fair-launch', () => ({
  getCommitments: vi.fn(),
  getUserCommitment: vi.fn(),
}))

import { getCommitments, getUserCommitment } from '@/lib/db/fair-launch'

const mockCommitments = [
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
  },
  {
    id: 'commit_2',
    userAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    amount: '3000000000000000000',
    allocation: '1500000000000000000000000',
    hasClaimed: true,
    hasRefunded: false,
    claimedAt: new Date('2024-01-09T12:00:00Z'),
    refundedAt: null,
    createdAt: new Date('2024-01-02T12:00:00Z'),
  },
]

const mockSingleCommitment = {
  id: 'commit_1',
  userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  amount: '5000000000000000000',
  allocation: '2500000000000000000000000',
  hasClaimed: false,
  hasRefunded: false,
  claimedAt: null,
  refundedAt: null,
  createdAt: new Date('2024-01-01T12:00:00Z'),
}

describe('GET /api/fair-launches/[address]/commitments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Get all commitments for an ICO', () => {
    it('should return all commitments with default pagination', async () => {
      vi.mocked(getCommitments).mockResolvedValue({
        commitments: mockCommitments,
        total: 2,
      })

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.commitments).toHaveLength(2)
      expect(data.total).toBe(2)
      expect(getCommitments).toHaveBeenCalledWith(
        '0x1111111111111111111111111111111111111111',
        0,
        50
      )
    })

    it('should respect pagination parameters', async () => {
      vi.mocked(getCommitments).mockResolvedValue({
        commitments: [mockCommitments[1]],
        total: 2,
      })

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments?offset=1&limit=1')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.commitments).toHaveLength(1)
      expect(getCommitments).toHaveBeenCalledWith(
        '0x1111111111111111111111111111111111111111',
        1,
        1
      )
    })

    it('should cap limit at 100', async () => {
      vi.mocked(getCommitments).mockResolvedValue({
        commitments: mockCommitments,
        total: 2,
      })

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments?limit=500')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })

      expect(response.status).toBe(200)
      expect(getCommitments).toHaveBeenCalledWith(
        '0x1111111111111111111111111111111111111111',
        0,
        100
      )
    })

    it('should return empty array when no commitments', async () => {
      vi.mocked(getCommitments).mockResolvedValue({
        commitments: [],
        total: 0,
      })

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.commitments).toHaveLength(0)
      expect(data.total).toBe(0)
    })
  })

  describe('Get specific user commitment', () => {
    it('should return user commitment when user param provided', async () => {
      vi.mocked(getUserCommitment).mockResolvedValue(mockSingleCommitment)

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments?user=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.userAddress).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      expect(data.amount).toBe('5000000000000000000')
      expect(getUserCommitment).toHaveBeenCalledWith(
        '0x1111111111111111111111111111111111111111',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )
    })

    it('should return 404 when user commitment not found', async () => {
      vi.mocked(getUserCommitment).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments?user=0xcccccccccccccccccccccccccccccccccccccccc')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Commitment not found')
    })

    it('should return 400 for invalid user address', async () => {
      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments?user=invalid')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid user address format')
    })
  })

  describe('Validation', () => {
    it('should return 400 for invalid ICO address', async () => {
      const request = new NextRequest('http://localhost:3000/api/fair-launches/not-an-address/commitments')
      const response = await GET(request, {
        params: Promise.resolve({ address: 'not-an-address' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid ICO address format')
    })
  })

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      vi.mocked(getCommitments).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/fair-launches/0x1111111111111111111111111111111111111111/commitments')
      const response = await GET(request, {
        params: Promise.resolve({ address: '0x1111111111111111111111111111111111111111' }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch commitments')
    })
  })
})
