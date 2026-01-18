"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { TradingPanel } from "@/components/trading-panel"
import { ArrowLeft, Users, BarChart3, Clock, ExternalLink, Loader2 } from "lucide-react"
import Link from "next/link"
import { formatEther } from "viem"
import { bscTestnetClient } from "@/lib/blockchain/client"
import { TokenFactoryABI, WeightedPoolABI } from "@/lib/blockchain/abis"
import { getContractAddresses } from "@/lib/blockchain/config/contracts"

interface OnChainTokenViewProps {
  tokenAddress: `0x${string}`
}

interface TokenData {
  name: string
  symbol: string
  token: `0x${string}`
  pool: `0x${string}`
  creator: `0x${string}`
  initialSupply: bigint
  createdAt: bigint
  poolBalances?: [bigint, bigint]
  poolWeights?: [bigint, bigint]
}

export function OnChainTokenView({ tokenAddress }: OnChainTokenViewProps) {
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const addresses = getContractAddresses(97) // BSC Testnet

        // Fetch token info from factory
        const info = await bscTestnetClient.readContract({
          address: addresses.tokenFactory,
          abi: TokenFactoryABI,
          functionName: 'getTokenInfo',
          args: [tokenAddress],
        }) as any

        if (!info || !info.token || info.token === '0x0000000000000000000000000000000000000000') {
          setError("Token not found")
          setIsLoading(false)
          return
        }

        // Fetch pool info
        let poolBalances: [bigint, bigint] | undefined
        let poolWeights: [bigint, bigint] | undefined

        if (info.pool && info.pool !== '0x0000000000000000000000000000000000000000') {
          try {
            const [balances, weights] = await Promise.all([
              bscTestnetClient.readContract({
                address: info.pool,
                abi: WeightedPoolABI,
                functionName: 'getBalances',
              }),
              bscTestnetClient.readContract({
                address: info.pool,
                abi: WeightedPoolABI,
                functionName: 'getWeights',
              }),
            ])
            poolBalances = balances as [bigint, bigint]
            poolWeights = weights as [bigint, bigint]
          } catch (e) {
            console.error("Error fetching pool info:", e)
          }
        }

        setTokenData({
          name: info.name,
          symbol: info.symbol,
          token: info.token,
          pool: info.pool,
          creator: info.creator,
          initialSupply: info.initialSupply,
          createdAt: info.createdAt,
          poolBalances,
          poolWeights,
        })
      } catch (e: any) {
        console.error("Error fetching token:", e)
        setError(e.message || "Failed to load token")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [tokenAddress])

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </main>
    )
  }

  if (error || !tokenData) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold text-foreground mb-4">Token Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "The token you're looking for doesn't exist."}</p>
          <Link
            href="/"
            className="px-6 py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg inline-block"
          >
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const createdDate = new Date(Number(tokenData.createdAt) * 1000).toLocaleString()

  // Calculate price from pool balances
  let tokenPrice = "N/A"
  let liquidity = "N/A"
  if (tokenData.poolBalances && tokenData.poolWeights) {
    const tokenBalance = tokenData.poolBalances[0]
    const bnbBalance = tokenData.poolBalances[1]
    const tokenWeight = tokenData.poolWeights[0]
    const bnbWeight = tokenData.poolWeights[1]

    // Spot price = (bnbBalance / bnbWeight) / (tokenBalance / tokenWeight)
    if (tokenBalance > 0n && bnbBalance > 0n) {
      const price = (Number(bnbBalance) / Number(bnbWeight)) / (Number(tokenBalance) / Number(tokenWeight))
      tokenPrice = `${price.toFixed(10)} BNB`
      liquidity = `${parseFloat(formatEther(bnbBalance)).toFixed(4)} BNB`
    }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-primary hover:text-primary/80 transition-colors font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tokens
      </Link>

      {/* Token Header */}
      <div className="border-glow-animated glass-morph p-6 rounded-xl mb-6 scanlines digital-corners">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="relative h-24 w-24 rounded-xl overflow-hidden border-2 border-primary/30 shadow-[0_0_20px_rgba(0,255,255,0.3)] bg-primary/20 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">{tokenData.symbol.slice(0, 2)}</span>
          </div>

          <div className="flex-1 min-w-[300px]">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {tokenData.name}
              </h1>
              <span className="text-xl text-primary font-mono">${tokenData.symbol}</span>
              <span className="px-2 py-1 bg-chart-2/20 text-chart-2 text-xs font-bold rounded">ON-CHAIN</span>
            </div>

            <p className="text-muted-foreground mb-4">
              Launched on RoboLaunch with Balancer-style weighted pool.
            </p>

            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Price</div>
                <div className="text-xl font-bold text-foreground">{tokenPrice}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Liquidity</div>
                <div className="text-xl font-bold text-foreground">{liquidity}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Supply</div>
                <div className="text-xl font-bold text-foreground">
                  {Number(tokenData.initialSupply / BigInt(10**18)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Info */}
          <Card className="border-glow-animated glass-morph p-6 scanlines">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
              Contract Information
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                <span className="text-sm text-muted-foreground">Token Address</span>
                <a
                  href={`https://testnet.bscscan.com/address/${tokenData.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {formatAddress(tokenData.token)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                <span className="text-sm text-muted-foreground">Pool Address</span>
                <a
                  href={`https://testnet.bscscan.com/address/${tokenData.pool}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {formatAddress(tokenData.pool)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                <span className="text-sm text-muted-foreground">Creator</span>
                <a
                  href={`https://testnet.bscscan.com/address/${tokenData.creator}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {formatAddress(tokenData.creator)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Created
                </span>
                <span className="font-semibold">{createdDate}</span>
              </div>
              {tokenData.poolWeights && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pool Weights</span>
                  <span className="font-semibold">
                    {Math.round(Number(tokenData.poolWeights[0]) / 1e16)}% / {Math.round(Number(tokenData.poolWeights[1]) / 1e16)}%
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Pool Balances */}
          {tokenData.poolBalances && (
            <Card className="border-glow-animated glass-morph p-6 scanlines">
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                <BarChart3 className="h-5 w-5 inline mr-2 text-primary" />
                Pool Reserves
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/50 rounded-lg p-4 border border-primary/20">
                  <div className="text-sm text-muted-foreground mb-1">{tokenData.symbol}</div>
                  <div className="text-2xl font-bold">
                    {parseFloat(formatEther(tokenData.poolBalances[0])).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-background/50 rounded-lg p-4 border border-primary/20">
                  <div className="text-sm text-muted-foreground mb-1">WBNB</div>
                  <div className="text-2xl font-bold">
                    {parseFloat(formatEther(tokenData.poolBalances[1])).toFixed(4)}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Trading */}
        <div className="space-y-6">
          <TradingPanel
            tokenAddress={tokenData.token}
            poolAddress={tokenData.pool}
            tokenSymbol={tokenData.symbol}
            tokenName={tokenData.name}
          />
        </div>
      </div>
    </main>
  )
}
