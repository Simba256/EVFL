import type { Metadata } from 'next'
import { Header } from "@/components/header"
import { TrendingTicker } from "@/components/trending-ticker"
import { ArrowLeft, TrendingUp, TrendingDown, Users, Activity, DollarSign, BarChart3, Clock, Award } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import Image from "next/image"
import { getTokenBySymbol, getTopHolders, getRecentTrades } from "@/lib/data/tokens"

// Generate dynamic metadata for token pages
export async function generateMetadata({
  params
}: {
  params: Promise<{ symbol: string }>
}): Promise<Metadata> {
  const { symbol } = await params
  const token = await getTokenBySymbol(symbol)

  if (!token) {
    return {
      title: 'Token Not Found',
      description: 'The requested token could not be found',
    }
  }

  return {
    title: `${token.name} (${token.symbol})`,
    description: `${token.description} | Market Cap: ${token.marketCap}, Price: ${token.price}, 24h Change: ${token.change24h > 0 ? '+' : ''}${token.change24h}%`,
    keywords: ['crypto', token.name, token.symbol, 'robotics', 'AI', 'memecoin', 'token', 'trading'],
    openGraph: {
      title: `${token.name} (${token.symbol}) - RoboLaunch`,
      description: token.description,
      images: [
        {
          url: token.image,
          width: 1200,
          height: 630,
          alt: token.name,
        }
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${token.name} (${token.symbol})`,
      description: token.description,
      images: [token.image],
    },
  }
}

export default async function TokenPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params

  // Fetch token data and related information
  const [token, topHolders, recentTrades] = await Promise.all([
    getTokenBySymbol(symbol),
    getTopHolders(symbol),
    getRecentTrades(symbol),
  ])

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <TrendingTicker />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <h1 className="text-3xl font-bold text-foreground mb-4">Token Not Found</h1>
            <p className="text-muted-foreground mb-6">The token you're looking for doesn't exist.</p>
            <Link
              href="/"
              className="px-6 py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg inline-block"
            >
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />
      <TrendingTicker />

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
            <div className="relative h-24 w-24 rounded-xl overflow-hidden border-2 border-primary/30 shadow-[0_0_20px_rgba(0,255,255,0.3)]">
              <Image src={token.image || "/placeholder.svg"} alt={token.name} fill className="object-cover" />
            </div>

            <div className="flex-1 min-w-[300px]">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-black text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                  {token.name}
                </h1>
                <span className="text-xl text-primary font-mono">{token.symbol}</span>
                {token.status === "graduated" && (
                  <div className="flex items-center gap-1 rounded-full bg-chart-2/90 px-3 py-1 text-xs font-bold backdrop-blur border border-chart-2 shadow-[0_0_10px_rgba(0,255,100,0.5)]">
                    <Award className="h-3 w-3" />
                    GRADUATED
                  </div>
                )}
              </div>

              <p className="text-muted-foreground mb-4 max-w-2xl text-pretty">{token.description}</p>

              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Price</div>
                  <div className="text-2xl font-bold text-foreground">{token.price}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">24h Change</div>
                  <div
                    className={`text-2xl font-bold flex items-center gap-1 ${token.change24h > 0 ? "text-chart-2" : "text-destructive"}`}
                  >
                    {token.change24h > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    {token.change24h > 0 ? "+" : ""}
                    {token.change24h}%
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="px-6 py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg">
                Buy {token.symbol}
              </button>
              <button className="px-6 py-3 btn-metallic text-foreground font-bold rounded-lg">
                Sell {token.symbol}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2">
            <Card className="border-glow-animated glass-morph p-6 scanlines">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                  Trading Chart
                </h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs btn-metallic rounded">1H</button>
                  <button className="px-3 py-1 text-xs btn-metallic-primary rounded">24H</button>
                  <button className="px-3 py-1 text-xs btn-metallic rounded">7D</button>
                  <button className="px-3 py-1 text-xs btn-metallic rounded">30D</button>
                </div>
              </div>

              {/* DEX Chart Embed */}
              <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-primary/20">
                <iframe
                  src="https://dexscreener.com/solana/8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj?embed=1&theme=dark&trades=0&info=0"
                  className="w-full h-full"
                />
              </div>
            </Card>

            {/* Recent Trades */}
            <Card className="border-glow-animated glass-morph p-6 mt-6 scanlines">
              <h2
                className="text-xl font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <Activity className="h-5 w-5 text-primary" />
                Recent Trades
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="text-left py-3 text-sm text-muted-foreground font-semibold">Type</th>
                      <th className="text-left py-3 text-sm text-muted-foreground font-semibold">Amount</th>
                      <th className="text-left py-3 text-sm text-muted-foreground font-semibold">Price</th>
                      <th className="text-left py-3 text-sm text-muted-foreground font-semibold">Trader</th>
                      <th className="text-right py-3 text-sm text-muted-foreground font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade, i) => (
                      <tr key={i} className="border-b border-primary/10 hover:bg-primary/5 transition-colors">
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${trade.type === "buy" ? "bg-chart-2/20 text-chart-2" : "bg-destructive/20 text-destructive"}`}
                          >
                            {trade.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-sm">{trade.amount}</td>
                        <td className="py-3 font-bold text-sm">{trade.price}</td>
                        <td className="py-3 font-mono text-sm text-primary">{trade.trader}</td>
                        <td className="py-3 text-right text-sm text-muted-foreground">{trade.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Stats & Info Sidebar */}
          <div className="space-y-6">
            {/* Token Stats */}
            <Card className="border-glow-animated glass-morph p-6 scanlines digital-corners">
              <h2
                className="text-lg font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <BarChart3 className="h-5 w-5 text-primary" />
                Token Stats
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                  <span className="text-sm text-muted-foreground">Market Cap</span>
                  <span className="font-bold">{token.marketCap}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                  <span className="text-sm text-muted-foreground">24h Volume</span>
                  <span className="font-bold">{token.volume24h}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                  <span className="text-sm text-muted-foreground">Liquidity</span>
                  <span className="font-bold">{token.liquidity}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                  <span className="text-sm text-muted-foreground">FDV</span>
                  <span className="font-bold">{token.fdv}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                  <span className="text-sm text-muted-foreground">Total Supply</span>
                  <span className="font-bold font-mono">{token.totalSupply}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                  <span className="text-sm text-muted-foreground">Circulating</span>
                  <span className="font-bold font-mono">{token.circulatingSupply}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Holders
                  </span>
                  <span className="font-bold">{token.holders.toLocaleString()}</span>
                </div>
              </div>
            </Card>

            {/* Token Info */}
            <Card className="border-glow-animated glass-morph p-6 scanlines">
              <h2
                className="text-lg font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <DollarSign className="h-5 w-5 text-primary" />
                Token Info
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Creator</div>
                  <div className="font-mono text-sm text-primary">{token.creator}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created
                  </div>
                  <div className="text-sm font-semibold">{token.createdAt}</div>
                </div>
              </div>
            </Card>

            {/* Top Holders */}
            <Card className="border-glow-animated glass-morph p-6 scanlines">
              <h2
                className="text-lg font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <Users className="h-5 w-5 text-primary" />
                Top Holders
              </h2>
              <div className="space-y-3">
                {topHolders.map((holder, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between pb-3 border-b border-primary/10 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <span className="font-mono text-sm text-muted-foreground">{holder.address}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{holder.amount}</div>
                      <div className="text-xs text-primary">{holder.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
