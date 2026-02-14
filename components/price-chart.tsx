"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Loader2, TrendingUp, TrendingDown, BarChart2, LineChart } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Customized,
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
type ChartType = "area" | "candle"

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1M", value: "1m" },
  { label: "5M", value: "5m" },
  { label: "15M", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
]

// Types for recharts Customized component props
interface CandlesticksProps {
  formattedGraphicalItems?: Array<{
    item?: { type?: { displayName?: string } }
    props?: { data?: CandleDataPoint[] }
  }>
  xAxisMap?: Record<string, { scale?: (value: string) => number; x?: number; width?: number; bandSize?: number }>
  yAxisMap?: Record<string, { scale?: (value: number) => number }>
}

interface CandleDataPoint {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: CandleDataPoint }>
  label?: string
}

// Custom candlestick renderer
const Candlesticks = (props: CandlesticksProps) => {
  const { formattedGraphicalItems, xAxisMap, yAxisMap } = props

  if (!formattedGraphicalItems || !xAxisMap || !yAxisMap) return null

  const xAxis = Object.values(xAxisMap)[0]
  const yAxis = Object.values(yAxisMap)[0]

  if (!xAxis?.scale || !yAxis?.scale) return null

  const barItems = formattedGraphicalItems.find((item) => item?.item?.type?.displayName === 'Bar')
  if (!barItems?.props?.data) return null

  const data = barItems.props.data
  const bandWidth = xAxis.bandSize || ((xAxis.width ?? 0) / data.length)

  return (
    <g className="candlesticks">
      {data.map((entry, index: number) => {
        const { open, high, low, close } = entry

        const x = xAxis.scale(entry.time) ?? (xAxis.x + index * bandWidth + bandWidth / 2)
        const highY = yAxis.scale(high)
        const lowY = yAxis.scale(low)
        const openY = yAxis.scale(open)
        const closeY = yAxis.scale(close)

        const isGreen = close >= open
        const color = isGreen ? "#00ff88" : "#ff4444"

        const bodyTop = Math.min(openY, closeY)
        const bodyHeight = Math.max(Math.abs(closeY - openY), 2)
        const candleWidth = Math.max(bandWidth * 0.6, 6)

        return (
          <g key={`candle-${index}`}>
            {/* Wick */}
            <line
              x1={x}
              y1={highY}
              x2={x}
              y2={lowY}
              stroke={color}
              strokeWidth={1.5}
              style={{ filter: "drop-shadow(0 0 3px " + color + ")" }}
            />
            {/* Body */}
            <rect
              x={x - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={isGreen ? color : "#1a1a2e"}
              stroke={color}
              strokeWidth={1.5}
              rx={1}
              style={{ filter: "drop-shadow(0 0 3px " + color + ")" }}
            />
          </g>
        )
      })}
    </g>
  )
}

export function PriceChart({ tokenAddress, tokenSymbol }: PriceChartProps) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [interval, setInterval] = useState<Interval>("1h")
  const [chartType, setChartType] = useState<ChartType>("area")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const isInitialLoad = useRef(true)

  useEffect(() => {
    const fetchPriceHistory = async () => {
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
          if (candles.length === 0) {
            setError(data.error)
          }
        } else {
          setCandles(data.candles || [])
        }
      } catch (e) {
        console.error("Error fetching price history:", e)
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

  const priceChange =
    candles.length >= 2
      ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
      : 0

  const isPositive = priceChange >= 0
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0

  const areaChartData = useMemo(() => candles.map((c) => ({
    time: new Date(c.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    price: c.close,
    volume: c.volume,
  })), [candles])

  const candleChartData = useMemo(() => candles.map((c) => ({
    time: new Date(c.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    range: [c.low, c.high],
  })), [candles])

  const [priceMin, priceMax] = useMemo(() => {
    if (candles.length === 0) return [0, 1]
    const min = Math.min(...candles.map(c => c.low))
    const max = Math.max(...candles.map(c => c.high))
    const padding = (max - min) * 0.05
    return [min - padding, max + padding]
  }, [candles])

  const formatPrice = (price: number) => {
    if (price < 0.00001) {
      return price.toExponential(4)
    }
    return price.toFixed(8)
  }

  const CandleTooltip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload || !payload[0]) return null
    const data = payload[0].payload
    const isUp = data.close >= data.open
    return (
      <div className="bg-background/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Open:</span>
          <span className="font-mono text-right">{formatPrice(data.open)}</span>
          <span className="text-muted-foreground">High:</span>
          <span className="font-mono text-right text-green-400">{formatPrice(data.high)}</span>
          <span className="text-muted-foreground">Low:</span>
          <span className="font-mono text-right text-red-400">{formatPrice(data.low)}</span>
          <span className="text-muted-foreground">Close:</span>
          <span className={`font-mono text-right ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(data.close)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card className="border-glow-animated glass-morph p-6 scanlines">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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

        <div className="flex items-center gap-2">
          {/* Chart type toggle */}
          <div className="flex gap-1 bg-background/50 rounded-lg p-1">
            <button
              onClick={() => setChartType("area")}
              className={`p-1.5 rounded transition-colors ${
                chartType === "area"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Area Chart"
            >
              <LineChart className="h-4 w-4" />
            </button>
            <button
              onClick={() => setChartType("candle")}
              className={`p-1.5 rounded transition-colors ${
                chartType === "candle"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Candlestick Chart"
            >
              <BarChart2 className="h-4 w-4" />
            </button>
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
        ) : chartType === "area" ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaChartData}>
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
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candleChartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                interval="preserveStartEnd"
                type="category"
              />
              <YAxis
                domain={[priceMin, priceMax]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickFormatter={(v) => v.toExponential(1)}
                width={60}
              />
              <Tooltip content={<CandleTooltip />} />
              {/* Invisible bar just to make the chart work with Customized */}
              <Bar dataKey="high" fill="transparent" />
              <Customized component={Candlesticks} />
            </ComposedChart>
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
