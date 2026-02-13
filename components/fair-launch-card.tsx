"use client"

import { Card } from "@/components/ui/card"
import { Clock, Users, Target, CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { formatEther } from "viem"

export interface FairLaunchData {
  id: string
  icoAddress: string
  tokenAddress: string
  name: string
  symbol: string
  imageURI: string
  description: string
  tokenSupply: string
  minimumRaise: string
  startTime: string | Date
  endTime: string | Date
  status: 'PENDING' | 'ACTIVE' | 'FINALIZED' | 'FAILED'
  totalCommitted: string
  participantCount: number
  creatorAddress: string
}

interface FairLaunchCardProps {
  fairLaunch: FairLaunchData
}

function getStatusColor(status: string) {
  switch (status) {
    case 'PENDING':
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
    case 'ACTIVE':
      return 'text-green-500 bg-green-500/10 border-green-500/30'
    case 'FINALIZED':
      return 'text-primary bg-primary/10 border-primary/30'
    case 'FAILED':
      return 'text-red-500 bg-red-500/10 border-red-500/30'
    default:
      return 'text-muted-foreground bg-muted/10 border-muted/30'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'PENDING':
      return <Clock className="h-3 w-3" />
    case 'ACTIVE':
      return <Loader2 className="h-3 w-3 animate-spin" />
    case 'FINALIZED':
      return <CheckCircle className="h-3 w-3" />
    case 'FAILED':
      return <XCircle className="h-3 w-3" />
    default:
      return null
  }
}

function formatTimeRemaining(endTime: Date | string): string {
  const end = new Date(endTime)
  const now = new Date()
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) return 'Ended'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatBnb(value: string | bigint): string {
  try {
    const bn = typeof value === 'string' ? BigInt(value) : value
    const formatted = formatEther(bn)
    const num = parseFloat(formatted)
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    if (num >= 1) return num.toFixed(2)
    return num.toFixed(4)
  } catch {
    return '0'
  }
}

function calculateProgress(totalCommitted: string, minimumRaise: string): number {
  try {
    const committed = BigInt(totalCommitted)
    const minimum = BigInt(minimumRaise)
    if (minimum === BigInt(0)) return 0
    const progress = Number((committed * BigInt(100)) / minimum)
    return Math.min(progress, 100)
  } catch {
    return 0
  }
}

export function FairLaunchCard({ fairLaunch }: FairLaunchCardProps) {
  const progress = calculateProgress(fairLaunch.totalCommitted, fairLaunch.minimumRaise)
  const timeRemaining = formatTimeRemaining(fairLaunch.endTime)
  const isEnded = new Date(fairLaunch.endTime) <= new Date()

  return (
    <Link href={`/fair-launch/${fairLaunch.icoAddress}`}>
      <Card className="border-glow-animated glass-morph backdrop-blur p-5 digital-corners hover:shadow-[0_0_30px_rgba(0,255,255,0.2)] transition-all duration-300 cursor-pointer group">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative">
            {fairLaunch.imageURI ? (
              <img
                src={fairLaunch.imageURI}
                alt={fairLaunch.name}
                className="w-14 h-14 rounded-lg object-cover ring-2 ring-primary/30"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                <span className="text-xl font-bold text-primary">{fairLaunch.symbol.slice(0, 2)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-lg truncate group-hover:text-primary transition-colors">
              {fairLaunch.name}
            </h3>
            <p className="text-primary font-mono text-sm">${fairLaunch.symbol}</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(fairLaunch.status)}`}>
            {getStatusIcon(fairLaunch.status)}
            <span>{fairLaunch.status}</span>
          </div>
        </div>

        {/* Description */}
        {fairLaunch.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {fairLaunch.description}
          </p>
        )}

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-foreground font-medium">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-primary font-mono">{formatBnb(fairLaunch.totalCommitted)} BNB</span>
            <span className="text-muted-foreground">/ {formatBnb(fairLaunch.minimumRaise)} BNB min</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-background/50 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span className="text-xs">Participants</span>
            </div>
            <p className="font-bold text-foreground">{fairLaunch.participantCount}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              <span className="text-xs">Min Raise</span>
            </div>
            <p className="font-bold text-foreground">{formatBnb(fairLaunch.minimumRaise)}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              <span className="text-xs">{isEnded ? 'Status' : 'Time Left'}</span>
            </div>
            <p className={`font-bold ${isEnded ? 'text-muted-foreground' : 'text-primary'}`}>
              {timeRemaining}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function FairLaunchCardSkeleton() {
  return (
    <Card className="glass-morph p-5 digital-corners animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-lg bg-muted" />
        <div className="flex-1">
          <div className="h-5 bg-muted rounded w-3/4 mb-2" />
          <div className="h-4 bg-muted rounded w-1/4" />
        </div>
        <div className="h-6 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-4 bg-muted rounded w-full mb-2" />
      <div className="h-4 bg-muted rounded w-2/3 mb-4" />
      <div className="h-2 bg-muted rounded-full mb-4" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-muted rounded-lg" />
        <div className="h-16 bg-muted rounded-lg" />
        <div className="h-16 bg-muted rounded-lg" />
      </div>
    </Card>
  )
}
