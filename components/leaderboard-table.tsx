"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, Users, Activity } from "lucide-react"
import { Card } from "@/components/ui/card"
import Image from "next/image"

interface LeaderboardToken {
  rank: number
  name: string
  symbol: string
  image: string
  marketCap: number
  volume24h: number
  holders: number
  price: number
  change24h: number
  change7d: number
}

const LEADERBOARD_DATA: LeaderboardToken[] = [
  {
    rank: 1,
    name: "AI Influencer Network",
    symbol: "$AINFLU",
    image: "/ai-robot-influencer-with-social-media-hologram.jpg",
    marketCap: 8700000,
    volume24h: 2800000,
    holders: 4567,
    price: 0.0156,
    change24h: 234.5,
    change7d: 567.8,
  },
  {
    rank: 2,
    name: "Control Protocol",
    symbol: "$CTRL",
    image: "/humanoid-robot-with-glowing-cyan-interface.jpg",
    marketCap: 5100000,
    volume24h: 1200000,
    holders: 2891,
    price: 0.0089,
    change24h: 89.3,
    change7d: 234.1,
  },
  {
    rank: 3,
    name: "AutoBot Collective",
    symbol: "$AUTOBOT",
    image: "/swarm-of-small-autonomous-robots.jpg",
    marketCap: 4200000,
    volume24h: 980000,
    holders: 2134,
    price: 0.0091,
    change24h: 145.1,
    change7d: 312.4,
  },
  {
    rank: 4,
    name: "Synthetic Dreams",
    symbol: "$SYNTH",
    image: "/ethereal-robot-with-glowing-neural-network.jpg",
    marketCap: 3500000,
    volume24h: 723000,
    holders: 1678,
    price: 0.0067,
    change24h: 98.4,
    change7d: 189.2,
  },
  {
    rank: 5,
    name: "RoboWar Arena",
    symbol: "$ROBOWAR",
    image: "/futuristic-battle-robot-with-weapons.jpg",
    marketCap: 2400000,
    volume24h: 890000,
    holders: 1243,
    price: 0.0042,
    change24h: 156.8,
    change7d: 278.5,
  },
  {
    rank: 6,
    name: "MechaSyndicate",
    symbol: "$MECHA",
    image: "/giant-mecha-robot-with-metallic-armor.jpg",
    marketCap: 1800000,
    volume24h: 456000,
    holders: 892,
    price: 0.0023,
    change24h: 67.2,
    change7d: 145.3,
  },
]

export function LeaderboardTable() {
  const [sortBy, setSortBy] = useState<"marketCap" | "volume" | "holders">("marketCap")

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`
    return `$${num.toFixed(4)}`
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setSortBy("marketCap")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            sortBy === "marketCap"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border hover:bg-card/80"
          }`}
        >
          Market Cap
        </button>
        <button
          onClick={() => setSortBy("volume")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            sortBy === "volume" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-card/80"
          }`}
        >
          24h Volume
        </button>
        <button
          onClick={() => setSortBy("holders")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            sortBy === "holders"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border hover:bg-card/80"
          }`}
        >
          Holders
        </button>
      </div>

      <div className="space-y-4">
        {LEADERBOARD_DATA.map((token) => (
          <Card
            key={token.rank}
            className="overflow-hidden border-border/50 bg-card/50 backdrop-blur hover:border-primary/50 transition-all"
          >
            <div className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-center">
                {/* Rank */}
                <div className="flex-shrink-0 flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-xl ${
                      token.rank === 1
                        ? "bg-chart-4/20 text-chart-4"
                        : token.rank === 2
                          ? "bg-muted text-foreground"
                          : token.rank === 3
                            ? "bg-chart-5/20 text-chart-5"
                            : "bg-muted/50 text-muted-foreground"
                    }`}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    #{token.rank}
                  </div>

                  {/* Token Info */}
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-border">
                      <Image src={token.image || "/placeholder.svg"} alt={token.name} fill className="object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                        {token.name}
                      </h3>
                      <p className="text-sm text-primary font-mono">{token.symbol}</p>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Price</div>
                    <div className="font-bold text-foreground">${token.price.toFixed(4)}</div>
                    <div
                      className={`flex items-center gap-1 text-xs font-semibold ${
                        token.change24h > 0 ? "text-chart-2" : "text-destructive"
                      }`}
                    >
                      {token.change24h > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {token.change24h > 0 ? "+" : ""}
                      {token.change24h}%
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
                    <div className="font-bold text-foreground">{formatNumber(token.marketCap)}</div>
                    <div className="text-xs text-muted-foreground">7d: +{token.change7d}%</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      24h Volume
                    </div>
                    <div className="font-bold text-foreground">{formatNumber(token.volume24h)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Holders
                    </div>
                    <div className="font-bold text-foreground">{token.holders.toLocaleString()}</div>
                  </div>
                </div>

                {/* Trade Button */}
                <div className="flex-shrink-0">
                  <button className="w-full md:w-auto px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-all">
                    Trade
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
