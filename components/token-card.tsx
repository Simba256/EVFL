import { Users, TrendingUp, TrendingDown, Award } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { Token } from "@/types"
import Image from "next/image"
import Link from "next/link"

interface TokenCardProps {
  token: Token
}

export function TokenCard({ token }: TokenCardProps) {
  const symbolSlug = token.symbol.replace("$", "").toLowerCase()

  return (
    <Link href={`/token/${symbolSlug}`}>
      <Card className="group overflow-hidden border-glow-animated glass-morph backdrop-blur transition-all hover:shadow-lg hover:shadow-primary/20 scanlines cursor-pointer">
        <div className="relative h-48 overflow-hidden bg-muted/30">
          <Image
            src={token.image || "/placeholder.svg"}
            alt={token.name}
            fill
            className="object-cover transition-transform group-hover:scale-110"
          />
          <div className="absolute top-3 right-3">
            {token.status === "graduated" && (
              <div className="flex items-center gap-1 rounded-full bg-chart-2/90 px-3 py-1 text-xs font-bold backdrop-blur border border-chart-2 shadow-[0_0_10px_rgba(0,255,100,0.5)]">
                <Award className="h-3 w-3" />
                GRADUATED
              </div>
            )}
            {token.status === "rising" && (
              <div className="flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold backdrop-blur border border-primary shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                <TrendingUp className="h-3 w-3" />
                RISING
              </div>
            )}
            {token.status === "new" && (
              <div className="rounded-full bg-chart-5/90 px-3 py-1 text-xs font-bold backdrop-blur border border-chart-5 shadow-[0_0_10px_rgba(255,150,50,0.5)]">
                NEW
              </div>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-bold text-lg text-foreground mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                  {token.name}
                </h3>
                <p className="text-sm text-primary font-mono">{token.symbol}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-foreground">{token.price}</div>
                <div
                  className={`flex items-center gap-1 text-sm font-semibold ${
                    token.change24h > 0 ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {token.change24h > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {token.change24h > 0 ? "+" : ""}
                  {token.change24h}%
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{token.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 rounded-lg glass-morph p-3 border border-primary/10">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
              <div className="font-bold text-foreground">{token.marketCap}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">24h Volume</div>
              <div className="font-bold text-foreground">{token.volume24h}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Holders
              </div>
              <div className="font-bold text-foreground">{token.holders.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Created</div>
              <div className="font-bold text-foreground">{token.createdAt}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <span>Creator: {token.creator}</span>
          </div>

          <button className="w-full py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg">
            Trade Now
          </button>
        </div>
      </Card>
    </Link>
  )
}
