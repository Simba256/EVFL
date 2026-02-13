"use client"

import { useState, useEffect } from 'react'
import { Header } from "@/components/header"
import { Card } from "@/components/ui/card"
import {
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import Link from "next/link"
import { formatEther } from "viem"

interface FairLaunchData {
  id: string
  icoAddress: string
  name: string
  symbol: string
  imageURI: string
  status: 'PENDING' | 'ACTIVE' | 'FINALIZED' | 'FAILED'
  endTime: string
}

interface CommitmentWithLaunch {
  id: string
  userAddress: string
  amount: string
  allocation: string
  hasClaimed: boolean
  hasRefunded: boolean
  fairLaunch: FairLaunchData
}

function formatBnb(value: string | bigint): string {
  try {
    const bn = typeof value === 'string' ? BigInt(value) : value
    return parseFloat(formatEther(bn)).toFixed(4)
  } catch {
    return '0'
  }
}

function formatTokens(value: string | bigint): string {
  try {
    const bn = typeof value === 'string' ? BigInt(value) : value
    const num = parseFloat(formatEther(bn))
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  } catch {
    return '0'
  }
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    PENDING: { icon: Clock, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
    ACTIVE: { icon: Loader2, color: 'text-green-500 bg-green-500/10 border-green-500/30', spin: true },
    FINALIZED: { icon: CheckCircle, color: 'text-primary bg-primary/10 border-primary/30' },
    FAILED: { icon: XCircle, color: 'text-red-500 bg-red-500/10 border-red-500/30' },
  }[status] || { icon: Clock, color: 'text-muted-foreground bg-muted/10 border-muted/30' }

  const Icon = config.icon

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className={`h-3 w-3 ${(config as any).spin ? 'animate-spin' : ''}`} />
      <span>{status}</span>
    </div>
  )
}

function CommitmentCard({ commitment }: { commitment: CommitmentWithLaunch }) {
  const { fairLaunch } = commitment
  const canClaim = fairLaunch.status === 'FINALIZED' && !commitment.hasClaimed && BigInt(commitment.allocation) > 0
  const canRefund = fairLaunch.status === 'FAILED' && !commitment.hasRefunded && BigInt(commitment.amount) > 0

  return (
    <Card className="glass-morph p-5 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)] transition-all duration-300">
      <div className="flex items-start gap-4">
        {/* Image */}
        <div className="flex-shrink-0">
          {fairLaunch.imageURI ? (
            <img
              src={fairLaunch.imageURI}
              alt={fairLaunch.name}
              className="w-12 h-12 rounded-lg object-cover ring-2 ring-primary/30"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
              <span className="text-lg font-bold text-primary">{fairLaunch.symbol.slice(0, 2)}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-foreground truncate">{fairLaunch.name}</h3>
            <StatusBadge status={fairLaunch.status} />
          </div>
          <p className="text-primary font-mono text-sm mb-3">${fairLaunch.symbol}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Your Commitment</p>
              <p className="font-bold text-foreground">{formatBnb(commitment.amount)} BNB</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Token Allocation</p>
              <p className="font-bold text-primary">
                {formatTokens(commitment.allocation)} {fairLaunch.symbol}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          <Link
            href={`/fair-launch/${fairLaunch.icoAddress}`}
            className="px-4 py-2 btn-metallic text-foreground text-sm font-medium rounded-lg inline-flex items-center gap-1"
          >
            View
            <ExternalLink className="h-3 w-3" />
          </Link>
          {canClaim && (
            <Link
              href={`/fair-launch/${fairLaunch.icoAddress}`}
              className="px-4 py-2 btn-metallic-primary text-primary-foreground text-sm font-medium rounded-lg text-center"
            >
              Claim
            </Link>
          )}
          {canRefund && (
            <Link
              href={`/fair-launch/${fairLaunch.icoAddress}`}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg text-center"
            >
              Refund
            </Link>
          )}
          {commitment.hasClaimed && (
            <span className="px-4 py-2 text-green-500 text-sm font-medium flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Claimed
            </span>
          )}
          {commitment.hasRefunded && (
            <span className="px-4 py-2 text-muted-foreground text-sm font-medium flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Refunded
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function PortfolioPage() {
  const { isConnected, address } = useAccount()
  const [commitments, setCommitments] = useState<CommitmentWithLaunch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({
    totalCommitted: '0',
    totalAllocations: 0,
    pendingClaims: 0,
    pendingRefunds: 0,
  })

  useEffect(() => {
    async function fetchCommitments() {
      if (!address) return

      setIsLoading(true)
      try {
        const response = await fetch(`/api/commitments/${address}`)
        if (!response.ok) throw new Error('Failed to fetch')

        const data = await response.json()
        setCommitments(data.commitments || [])

        // Calculate stats
        const total = data.commitments?.reduce(
          (sum: bigint, c: CommitmentWithLaunch) => sum + BigInt(c.amount),
          BigInt(0)
        ) || BigInt(0)

        const pendingClaims = data.commitments?.filter(
          (c: CommitmentWithLaunch) => c.fairLaunch.status === 'FINALIZED' && !c.hasClaimed
        ).length || 0

        const pendingRefunds = data.commitments?.filter(
          (c: CommitmentWithLaunch) => c.fairLaunch.status === 'FAILED' && !c.hasRefunded
        ).length || 0

        setStats({
          totalCommitted: total.toString(),
          totalAllocations: data.commitments?.length || 0,
          pendingClaims,
          pendingRefunds,
        })
      } catch (error) {
        console.error('Error fetching commitments:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCommitments()
  }, [address])

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl md:text-4xl font-black mb-3 neon-text"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            My <span className="text-primary">Portfolio</span>
          </h1>
          <p className="text-muted-foreground">
            Track your Fair Launch commitments and claim your tokens
          </p>
        </div>

        {!isConnected ? (
          <Card className="glass-morph p-12 text-center">
            <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to view your Fair Launch commitments
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="glass-morph p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{formatBnb(stats.totalCommitted)}</p>
                <p className="text-sm text-muted-foreground">Total Committed (BNB)</p>
              </Card>
              <Card className="glass-morph p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.totalAllocations}</p>
                <p className="text-sm text-muted-foreground">Fair Launches</p>
              </Card>
              <Card className="glass-morph p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats.pendingClaims}</p>
                <p className="text-sm text-muted-foreground">Pending Claims</p>
              </Card>
              <Card className="glass-morph p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{stats.pendingRefunds}</p>
                <p className="text-sm text-muted-foreground">Pending Refunds</p>
              </Card>
            </div>

            {/* Commitments List */}
            {commitments.length === 0 ? (
              <Card className="glass-morph p-12 text-center">
                <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">No Commitments Yet</h2>
                <p className="text-muted-foreground mb-6">
                  You haven't participated in any Fair Launches yet
                </p>
                <Link
                  href="/fair-launch"
                  className="px-6 py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg inline-block"
                >
                  Explore Fair Launches
                </Link>
              </Card>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-foreground">Your Commitments</h2>
                {commitments.map((commitment) => (
                  <CommitmentCard key={commitment.id} commitment={commitment} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
