"use client"

import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Clock,
  Users,
  Target,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Wallet,
  AlertCircle,
  Copy,
  TrendingUp,
} from "lucide-react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useFairLaunch, type ICOInfo } from "@/lib/blockchain/hooks/useFairLaunch"
import { formatEther, parseEther, type Address } from "viem"
import { toast } from "sonner"

interface FairLaunchData {
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
  startTime: string
  endTime: string
  status: 'PENDING' | 'ACTIVE' | 'FINALIZED' | 'FAILED'
  totalCommitted: string
  tokenPrice: string
  participantCount: number
}

interface CommitmentData {
  id: string
  userAddress: string
  amount: string
  allocation: string
  hasClaimed: boolean
  hasRefunded: boolean
}

interface Props {
  fairLaunch: FairLaunchData
  commitments: CommitmentData[]
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

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getTimeInfo(startTime: string, endTime: string): { label: string; value: string; isLive: boolean; hasEnded: boolean } {
  const now = Date.now()
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()

  if (now < start) {
    const diff = start - now
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { label: 'Starts in', value: `${hours}h ${minutes}m`, isLive: false, hasEnded: false }
  }

  if (now < end) {
    const diff = end - now
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (days > 0) return { label: 'Ends in', value: `${days}d ${hours}h`, isLive: true, hasEnded: false }
    if (hours > 0) return { label: 'Ends in', value: `${hours}h ${minutes}m`, isLive: true, hasEnded: false }
    return { label: 'Ends in', value: `${minutes}m`, isLive: true, hasEnded: false }
  }

  return { label: 'Ended', value: new Date(endTime).toLocaleDateString(), isLive: false, hasEnded: true }
}

export function FairLaunchDetail({ fairLaunch, commitments }: Props) {
  const { isConnected, address } = useAccount()
  const {
    commit,
    claimTokens,
    refund,
    finalize,
    markFailed,
    getICOInfo,
    getUserCommitment,
    hasUserClaimed,
    getUserAllocation,
    canFinalize: checkCanFinalize,
    canMarkFailed: checkCanMarkFailed,
  } = useFairLaunch()

  const [commitAmount, setCommitAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string>("")
  const [error, setError] = useState("")

  // On-chain state
  const [onChainInfo, setOnChainInfo] = useState<ICOInfo | null>(null)
  const [userCommitment, setUserCommitment] = useState<bigint>(BigInt(0))
  const [userAllocation, setUserAllocation] = useState<bigint>(BigInt(0))
  const [hasClaimed, setHasClaimed] = useState(false)
  const [canFinalizeICO, setCanFinalizeICO] = useState(false)
  const [canMarkFailedICO, setCanMarkFailedICO] = useState(false)

  // Fetch on-chain state
  useEffect(() => {
    const fetchOnChainState = async () => {
      try {
        const icoAddress = fairLaunch.icoAddress as Address
        const info = await getICOInfo(icoAddress)
        setOnChainInfo(info)

        if (address) {
          const [commitment, allocation, claimed, canFin, canFail] = await Promise.all([
            getUserCommitment(icoAddress, address),
            getUserAllocation(icoAddress, address),
            hasUserClaimed(icoAddress, address),
            checkCanFinalize(icoAddress),
            checkCanMarkFailed(icoAddress),
          ])
          setUserCommitment(commitment)
          setUserAllocation(allocation)
          setHasClaimed(claimed)
          setCanFinalizeICO(canFin)
          setCanMarkFailedICO(canFail)
        }
      } catch (e) {
        console.error('Error fetching on-chain state:', e)
      }
    }

    fetchOnChainState()
    const interval = setInterval(fetchOnChainState, 15000) // Refresh every 15s
    return () => clearInterval(interval)
  }, [fairLaunch.icoAddress, address])

  const timeInfo = getTimeInfo(fairLaunch.startTime, fairLaunch.endTime)
  const progress = onChainInfo
    ? Number((onChainInfo.totalCommitted * BigInt(100)) / onChainInfo.minimumRaise)
    : 0

  const handleCommit = async () => {
    if (!commitAmount || parseFloat(commitAmount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setError("")
    setIsLoading(true)
    setLoadingAction("commit")

    try {
      const result = await commit(fairLaunch.icoAddress as Address, commitAmount)
      toast.success("Commitment successful!", {
        description: `You committed ${commitAmount} BNB`,
      })
      setCommitAmount("")
      // Refresh state
      const newCommitment = await getUserCommitment(fairLaunch.icoAddress as Address, address)
      setUserCommitment(newCommitment)
    } catch (e: any) {
      setError(e.message || "Failed to commit")
      toast.error("Commitment failed", { description: e.message })
    } finally {
      setIsLoading(false)
      setLoadingAction("")
    }
  }

  const handleClaim = async () => {
    setError("")
    setIsLoading(true)
    setLoadingAction("claim")

    try {
      await claimTokens(fairLaunch.icoAddress as Address)
      toast.success("Tokens claimed!", {
        description: `You received ${formatTokens(userAllocation)} ${fairLaunch.symbol}`,
      })
      setHasClaimed(true)
    } catch (e: any) {
      setError(e.message || "Failed to claim")
      toast.error("Claim failed", { description: e.message })
    } finally {
      setIsLoading(false)
      setLoadingAction("")
    }
  }

  const handleRefund = async () => {
    setError("")
    setIsLoading(true)
    setLoadingAction("refund")

    try {
      await refund(fairLaunch.icoAddress as Address)
      toast.success("Refund successful!", {
        description: `You received ${formatBnb(userCommitment)} BNB`,
      })
      setUserCommitment(BigInt(0))
    } catch (e: any) {
      setError(e.message || "Failed to refund")
      toast.error("Refund failed", { description: e.message })
    } finally {
      setIsLoading(false)
      setLoadingAction("")
    }
  }

  const handleFinalize = async () => {
    setError("")
    setIsLoading(true)
    setLoadingAction("finalize")

    try {
      await finalize(fairLaunch.icoAddress as Address)
      toast.success("ICO Finalized!", {
        description: "Tokens can now be claimed",
      })
    } catch (e: any) {
      setError(e.message || "Failed to finalize")
      toast.error("Finalization failed", { description: e.message })
    } finally {
      setIsLoading(false)
      setLoadingAction("")
    }
  }

  const handleMarkFailed = async () => {
    setError("")
    setIsLoading(true)
    setLoadingAction("markFailed")

    try {
      await markFailed(fairLaunch.icoAddress as Address)
      toast.success("ICO marked as failed", {
        description: "Refunds are now available",
      })
    } catch (e: any) {
      setError(e.message || "Failed to mark as failed")
      toast.error("Failed", { description: e.message })
    } finally {
      setIsLoading(false)
      setLoadingAction("")
    }
  }

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr)
    toast.success("Address copied!")
  }

  const status = onChainInfo
    ? ['PENDING', 'ACTIVE', 'FINALIZED', 'FAILED'][onChainInfo.status]
    : fairLaunch.status

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-glow-animated glass-morph p-6 md:p-8 digital-corners">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="flex-shrink-0">
            {fairLaunch.imageURI ? (
              <img
                src={fairLaunch.imageURI}
                alt={fairLaunch.name}
                className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover ring-4 ring-primary/30"
              />
            ) : (
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl bg-primary/20 flex items-center justify-center ring-4 ring-primary/30">
                <span className="text-3xl font-bold text-primary">{fairLaunch.symbol.slice(0, 2)}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-foreground mb-1">{fairLaunch.name}</h1>
                <p className="text-primary font-mono text-lg">${fairLaunch.symbol}</p>
              </div>
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border ${
                status === 'ACTIVE' ? 'text-green-500 bg-green-500/10 border-green-500/30' :
                status === 'FINALIZED' ? 'text-primary bg-primary/10 border-primary/30' :
                status === 'FAILED' ? 'text-red-500 bg-red-500/10 border-red-500/30' :
                'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
              }`}>
                {status === 'ACTIVE' && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === 'FINALIZED' && <CheckCircle className="h-4 w-4" />}
                {status === 'FAILED' && <XCircle className="h-4 w-4" />}
                {status === 'PENDING' && <Clock className="h-4 w-4" />}
                <span>{status}</span>
              </div>
            </div>

            {fairLaunch.description && (
              <p className="text-muted-foreground mb-4">{fairLaunch.description}</p>
            )}

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-foreground font-medium">{Math.min(progress, 100).toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-primary font-mono">
                  {onChainInfo ? formatBnb(onChainInfo.totalCommitted) : formatBnb(fairLaunch.totalCommitted)} BNB raised
                </span>
                <span className="text-muted-foreground">
                  {formatBnb(fairLaunch.minimumRaise)} BNB minimum
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-bold text-foreground">
                  {onChainInfo ? Number(onChainInfo.participantCount) : fairLaunch.participantCount}
                </p>
                <p className="text-xs text-muted-foreground">Participants</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <Target className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-bold text-foreground">{formatTokens(fairLaunch.tokenSupply)}</p>
                <p className="text-xs text-muted-foreground">Token Supply</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-bold text-foreground">{fairLaunch.teamTokensBps / 100}%</p>
                <p className="text-xs text-muted-foreground">Team Allocation</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <Clock className={`h-4 w-4 mx-auto mb-1 ${timeInfo.isLive ? 'text-green-500' : 'text-muted-foreground'}`} />
                <p className={`font-bold ${timeInfo.isLive ? 'text-green-500' : 'text-foreground'}`}>{timeInfo.value}</p>
                <p className="text-xs text-muted-foreground">{timeInfo.label}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Position */}
          {isConnected && userCommitment > BigInt(0) && (
            <Card className="glass-morph p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Your Position
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Your Commitment</p>
                  <p className="text-xl font-bold text-primary">{formatBnb(userCommitment)} BNB</p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Est. Allocation</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatTokens(userAllocation)} {fairLaunch.symbol}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Commit Form */}
          {(status === 'ACTIVE' || (status === 'PENDING' && !timeInfo.hasEnded)) && (
            <Card className="glass-morph p-6">
              <h3 className="font-bold text-lg mb-4">Commit BNB</h3>

              {!isConnected ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">Connect your wallet to participate</p>
                  <ConnectButton />
                </div>
              ) : status === 'PENDING' && !timeInfo.isLive ? (
                <div className="text-center py-4">
                  <Clock className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
                  <p className="text-muted-foreground">ICO starts in {timeInfo.value}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount (BNB)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.0"
                        value={commitAmount}
                        onChange={(e) => setCommitAmount(e.target.value)}
                        className="bg-background border-border font-mono flex-1"
                        disabled={isLoading}
                      />
                      <button
                        onClick={handleCommit}
                        disabled={isLoading || !commitAmount}
                        className="px-6 py-2 btn-metallic-primary text-primary-foreground font-bold rounded-lg disabled:opacity-50 flex items-center gap-2"
                      >
                        {isLoading && loadingAction === 'commit' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Commit'
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your allocation is calculated at ICO end: (Your BNB / Total BNB) * Token Supply
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Claim/Refund Actions */}
          {status === 'FINALIZED' && isConnected && userCommitment > BigInt(0) && (
            <Card className="glass-morph p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Claim Your Tokens
              </h3>
              {hasClaimed ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p className="text-muted-foreground">You have already claimed your tokens</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    You can now claim <span className="text-primary font-bold">{formatTokens(userAllocation)} {fairLaunch.symbol}</span>
                  </p>
                  <button
                    onClick={handleClaim}
                    disabled={isLoading}
                    className="w-full py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading && loadingAction === 'claim' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Claim Tokens
                      </>
                    )}
                  </button>
                </div>
              )}
            </Card>
          )}

          {status === 'FAILED' && isConnected && userCommitment > BigInt(0) && (
            <Card className="glass-morph p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Refund Available
              </h3>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  The ICO failed to meet the minimum raise. You can refund your{' '}
                  <span className="text-primary font-bold">{formatBnb(userCommitment)} BNB</span>
                </p>
                <button
                  onClick={handleRefund}
                  disabled={isLoading}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading && loadingAction === 'refund' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="h-5 w-5" />
                      Refund BNB
                    </>
                  )}
                </button>
              </div>
            </Card>
          )}

          {/* Finalize/Mark Failed Actions */}
          {timeInfo.hasEnded && (status === 'ACTIVE' || status === 'PENDING') && isConnected && (
            <Card className="glass-morph p-6">
              <h3 className="font-bold text-lg mb-4">Finalize ICO</h3>
              <div className="space-y-4">
                {canFinalizeICO && (
                  <button
                    onClick={handleFinalize}
                    disabled={isLoading}
                    className="w-full py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading && loadingAction === 'finalize' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Finalize ICO (Minimum Met)
                      </>
                    )}
                  </button>
                )}
                {canMarkFailedICO && (
                  <button
                    onClick={handleMarkFailed}
                    disabled={isLoading}
                    className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading && loadingAction === 'markFailed' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="h-5 w-5" />
                        Mark as Failed (Minimum Not Met)
                      </>
                    )}
                  </button>
                )}
                {!canFinalizeICO && !canMarkFailedICO && (
                  <p className="text-muted-foreground text-center">
                    Waiting for ICO state to be determined...
                  </p>
                )}
              </div>
            </Card>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contract Addresses */}
          <Card className="glass-morph p-5">
            <h3 className="font-bold mb-4">Contract Addresses</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">ICO Contract</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                    {fairLaunch.icoAddress}
                  </code>
                  <button onClick={() => copyAddress(fairLaunch.icoAddress)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`https://testnet.bscscan.com/address/${fairLaunch.icoAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Token</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                    {fairLaunch.tokenAddress}
                  </code>
                  <button onClick={() => copyAddress(fairLaunch.tokenAddress)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`https://testnet.bscscan.com/token/${fairLaunch.tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Treasury</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                    {fairLaunch.treasuryAddress}
                  </code>
                  <button onClick={() => copyAddress(fairLaunch.treasuryAddress)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`https://testnet.bscscan.com/address/${fairLaunch.treasuryAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </Card>

          {/* Top Commitments */}
          <Card className="glass-morph p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Top Commitments
            </h3>
            {commitments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No commitments yet</p>
            ) : (
              <div className="space-y-2">
                {commitments.slice(0, 10).map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{i + 1}</span>
                      <code className="text-xs">{shortenAddress(c.userAddress)}</code>
                    </div>
                    <span className="font-mono text-primary">{formatBnb(c.amount)} BNB</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
