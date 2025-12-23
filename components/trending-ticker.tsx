"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"

interface TrendingToken {
  symbol: string
  price: string
  change: number
}

const TRENDING_TOKENS: TrendingToken[] = [
  { symbol: "$ROBOWAR", price: "$0.0042", change: 156.8 },
  { symbol: "$CTRL", price: "$0.0089", change: 89.3 },
  { symbol: "$AINFLU", price: "$0.0156", change: 234.5 },
  { symbol: "$MECHA", price: "$0.0023", change: 67.2 },
  { symbol: "$AUTOBOT", price: "$0.0091", change: 145.1 },
  { symbol: "$SYNTH", price: "$0.0067", change: 98.4 },
  { symbol: "$NEURON", price: "$0.0134", change: 178.9 },
  { symbol: "$CIRCUIT", price: "$0.0045", change: 123.6 },
]

export function TrendingTicker() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-12 bg-muted/20 border-b border-border" />
  }

  return (
    <div className="relative overflow-hidden border-b border-primary/20 bg-muted/20 backdrop-blur">
      <div className="flex items-center gap-1 py-3 animate-scroll-left">
        {[...TRENDING_TOKENS, ...TRENDING_TOKENS].map((token, index) => (
          <div key={index} className="flex items-center gap-2 px-4 whitespace-nowrap border-r border-border/50">
            <span className="font-bold text-primary" style={{ fontFamily: "var(--font-heading)" }}>
              {token.symbol}
            </span>
            <span className="text-sm text-foreground/80">{token.price}</span>
            <span
              className={`flex items-center gap-1 text-sm font-semibold ${
                token.change > 0 ? "text-chart-2" : "text-destructive"
              }`}
            >
              {token.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {token.change > 0 ? "+" : ""}
              {token.change}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
