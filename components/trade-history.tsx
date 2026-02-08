"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface TradeHistoryProps {
  tokenAddress: string
  tokenSymbol: string
}

interface Trade {
  type: "buy" | "sell"
  amount: string
  price: string
  time: string
  trader: string
}

export function TradeHistory({ tokenAddress, tokenSymbol }: TradeHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const isInitialLoad = useRef(true)

  useEffect(() => {
    const fetchTrades = async () => {
      // Only show loading spinner on initial load
      if (isInitialLoad.current) {
        setIsLoading(true)
      }
      setError("")

      try {
        const res = await fetch(`/api/trades/${tokenAddress}?limit=20`)
        const data = await res.json()

        if (data.error) {
          // Only show error if we have no existing trades
          if (trades.length === 0) {
            setError(data.error)
          }
        } else {
          setTrades(data.trades || [])
        }
      } catch (e) {
        console.error("Error fetching trades:", e)
        // Only show error if we have no existing trades
        if (trades.length === 0) {
          setError("Failed to load trades")
        }
      } finally {
        setIsLoading(false)
        isInitialLoad.current = false
      }
    }

    fetchTrades()

    // Poll for new trades every 10 seconds
    const interval = setInterval(fetchTrades, 10000)
    return () => clearInterval(interval)
  }, [tokenAddress])

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount) / 1e18
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M"
    if (num >= 1000) return (num / 1000).toFixed(2) + "K"
    return num.toFixed(2)
  }

  const formatPrice = (price: string) => {
    const num = parseFloat(price)
    if (num < 0.00001) return num.toExponential(2)
    return num.toFixed(8)
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <Card className="border-glow-animated glass-morph p-6 scanlines">
      <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
        Recent Trades
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-muted-foreground">{error}</div>
      ) : trades.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No trades yet
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {trades.map((trade, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 bg-background/50 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-1.5 rounded-full ${
                    trade.type === "buy"
                      ? "bg-chart-2/20 text-chart-2"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {trade.type === "buy" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${
                        trade.type === "buy" ? "text-chart-2" : "text-destructive"
                      }`}
                    >
                      {trade.type.toUpperCase()}
                    </span>
                    <span className="text-foreground">
                      {formatAmount(trade.amount)} {tokenSymbol}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @ {formatPrice(trade.price)} BNB
                  </div>
                </div>
              </div>

              <div className="text-right">
                <a
                  href={`https://testnet.bscscan.com/address/${trade.trader}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-mono"
                >
                  {formatAddress(trade.trader)}
                </a>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(trade.time), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
