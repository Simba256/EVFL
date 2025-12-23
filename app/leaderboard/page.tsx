import { Header } from "@/components/header"
import { TrendingTicker } from "@/components/trending-ticker"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { Trophy } from "lucide-react"

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <TrendingTicker />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-black text-balance" style={{ fontFamily: "var(--font-heading)" }}>
              <span className="text-primary">LEADERBOARD</span>
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Track the top performing robotics AI tokens. Real-time rankings based on market cap, volume, and holder
            growth.
          </p>
        </div>

        <LeaderboardTable />
      </main>
    </div>
  )
}
