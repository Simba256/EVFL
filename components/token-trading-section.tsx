"use client"

import { useState, useEffect } from "react"
import { TradingPanel } from "./trading-panel"
import { useTokenFactory } from "@/lib/blockchain/hooks"
import { Card } from "./ui/card"
import { Loader2, AlertCircle } from "lucide-react"

interface TokenTradingSectionProps {
  tokenSymbol: string
  tokenName: string
  // If provided, use these addresses directly (for on-chain tokens)
  tokenAddress?: string
  poolAddress?: string
}

export function TokenTradingSection({
  tokenSymbol,
  tokenName,
  tokenAddress: providedTokenAddress,
  poolAddress: providedPoolAddress,
}: TokenTradingSectionProps) {
  const [tokenAddress, setTokenAddress] = useState<`0x${string}` | null>(
    providedTokenAddress as `0x${string}` | null
  )
  const [poolAddress, setPoolAddress] = useState<`0x${string}` | null>(
    providedPoolAddress as `0x${string}` | null
  )
  const [isLoading, setIsLoading] = useState(!providedTokenAddress)
  const [error, setError] = useState("")

  const { getAllTokens, getTokenInfo, isConfigured } = useTokenFactory()

  // Try to find on-chain token by symbol if no address provided
  useEffect(() => {
    const findToken = async () => {
      if (providedTokenAddress || !isConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const tokens = await getAllTokens()

        for (const addr of tokens) {
          const info = await getTokenInfo(addr)
          if (info && info.symbol.toLowerCase() === tokenSymbol.replace('$', '').toLowerCase()) {
            setTokenAddress(addr)
            setPoolAddress(info.pool)
            break
          }
        }
      } catch (e) {
        console.error('Error finding token:', e)
      } finally {
        setIsLoading(false)
      }
    }

    findToken()
  }, [providedTokenAddress, tokenSymbol, getAllTokens, getTokenInfo, isConfigured])

  if (isLoading) {
    return (
      <Card className="border-glow-animated glass-morph p-6 scanlines digital-corners">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    )
  }

  if (!tokenAddress || !poolAddress) {
    return (
      <Card className="border-glow-animated glass-morph p-6 scanlines digital-corners">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Trading Not Available</h3>
          <p className="text-sm text-muted-foreground">
            This token is not deployed on-chain yet or trading is disabled.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Demo tokens are for display only. Launch a real token to enable trading.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <TradingPanel
      tokenAddress={tokenAddress}
      poolAddress={poolAddress}
      tokenSymbol={tokenSymbol.replace('$', '')}
      tokenName={tokenName}
    />
  )
}
