"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Loader2, TrendingUp, TrendingDown } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface PriceChartProps {
  tokenAddress: string
  tokenSymbol: string
}

interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d"

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1M", value: "1m" },
  { label: "5M", value: "5m" },
  { label: "15M", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
]

export function PriceChart({ tokenAddress, tokenSymbol }: PriceChartProps) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [interval, setInterval] = useState<Interval>("1h")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const isInitialLoad = useRef(true)

  useEffect(() => {
    const fetchPriceHistory = async () => {
      // Only show loading on initial load, keep existing chart visible otherwise
      if (isInitialLoad.current) {
        setIsLoading(true)
      }
      setError("")

      try {
        const res = await fetch(
          `/api/price-history/${tokenAddress}?interval=${interval}&limit=100`
        )
        const data = await res.json()

        if (data.error) {
          // Only show error if we have no existing data
          if (candles.length === 0) {
            setError(data.error)
          }
        } else {
          setCandles(data.candles || [])
        }
      } catch (e) {
        console.error("Error fetching price history:", e)
        // Only show error if we have no existing data
        if (candles.length === 0) {
          setError("Failed to load price data")
        }
      } finally {
        setIsLoading(false)
        isInitialLoad.current = false
      }
    }

    fetchPriceHistory()
  }, [tokenAddress, interval])

  // Calculate price change
  const priceChange =
    candles.length >= 2
      ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
      : 0

  const isPositive = priceChange >= 0
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0

  // Format data for chart
  const chartData = candles.map((c) => ({
    time: new Date(c.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    price: c.close,
    volume: c.volume,
  }))

  // Format price for display
  const formatPrice = (price: number) => {
    if (price < 0.00001) {
      return price.toExponential(4)
    }
    return price.toFixed(8)
  }

  return (
    <Card className="border-glow-animated glass-morph p-6 scanlines">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            {tokenSymbol} Price
          </h2>
          {candles.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">
                {formatPrice(currentPrice)} BNB
              </span>
              <span
                className={`flex items-center gap-1 text-sm font-semibold ${
                  isPositive ? "text-chart-2" : "text-destructive"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {isPositive ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Interval selector */}
        <div className="flex gap-1 bg-background/50 rounded-lg p-1">
          {INTERVALS.map((i) => (
            <button
              key={i.value}
              onClick={() => setInterval(i.value)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                interval === i.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            {error}
          </div>
        ) : candles.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No price data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isPositive ? "#00ff88" : "#ff4444"}
                    stopOpacity={0.5}
                  />
                  <stop
                    offset="50%"
                    stopColor={isPositive ? "#00ff88" : "#ff4444"}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor={isPositive ? "#00ff88" : "#ff4444"}
                    stopOpacity={0.05}
                  />
                </linearGradient>
                {/* Glow filter for the line */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickFormatter={(v) => v.toExponential(1)}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [formatPrice(value) + " BNB", "Price"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive ? "#00ff88" : "#ff4444"}
                strokeWidth={2.5}
                fill="url(#priceGradient)"
                filter="url(#glow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume info */}
      {candles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-primary/10">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">24h Volume</span>
            <span className="font-semibold">
              {candles
                .slice(-24)
                .reduce((sum, c) => sum + c.volume, 0)
                .toFixed(4)}{" "}
              BNB
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
