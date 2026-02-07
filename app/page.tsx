import { Suspense } from 'react'
import { Header } from "@/components/header"
import { TrendingTicker } from "@/components/trending-ticker"
import { TokenGrid } from "@/components/token-grid"
import { FilterTabs } from "@/components/filter-tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { getTokens } from "@/lib/data/tokens"
import { getOnChainTokens } from "@/lib/data/onchain-tokens"
import Link from "next/link"

// Force dynamic rendering to always fetch fresh on-chain data
export const dynamic = 'force-dynamic'

function TokenGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-[500px] rounded-xl glass-morph" />
      ))}
    </div>
  )
}

async function TokenGridWrapper() {
  // Fetch on-chain tokens (now enriched with database metadata)
  let onChainTokens: Awaited<ReturnType<typeof getOnChainTokens>> = []
  let fetchError = false

  try {
    onChainTokens = await getOnChainTokens()
  } catch (e) {
    console.error('[TokenGridWrapper] Error:', e)
    fetchError = true
  }

  // Only show mock tokens if there are no on-chain tokens (for demo purposes)
  let allTokens = onChainTokens
  let mockTokens: Awaited<ReturnType<typeof getTokens>> = []

  if (onChainTokens.length === 0) {
    mockTokens = await getTokens()
    allTokens = mockTokens
  }

  return (
    <>
      {fetchError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
          Failed to load on-chain tokens. Showing demo tokens instead.
        </div>
      )}
      {onChainTokens.length > 0 ? (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {onChainTokens.length} on-chain token{onChainTokens.length !== 1 ? 's' : ''}
        </div>
      ) : mockTokens.length > 0 && !fetchError && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {mockTokens.length} demo tokens (no on-chain tokens found)
        </div>
      )}
      <TokenGrid tokens={allTokens} />
    </>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <TrendingTicker />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="relative mb-12 rounded-xl border-glow-animated glass-morph p-8 md:p-12 overflow-hidden digital-corners scanlines">
          <div className="grid-bg circuit-bg absolute inset-0 opacity-30" />
          <div className="relative z-10">
            <h1
              className="text-4xl md:text-6xl font-black mb-4 text-balance neon-text"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              The Future is <span className="text-primary">Automated</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl text-pretty mb-6">
              Launch, trade, and govern robotics AI tokens on the most advanced memecoin launchpad. Where silicon meets
              speculation.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/launch"
                className="px-8 py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg inline-block"
              >
                Launch Token
              </Link>
              <a
                href="#tokens"
                className="px-8 py-3 btn-metallic text-foreground font-bold rounded-lg inline-block"
              >
                Explore Tokens
              </a>
            </div>
          </div>
        </div>

        <div className="tech-divider my-8" />

        {/* Filter Tabs */}
        <FilterTabs />

        {/* Token Grid */}
        <div id="tokens">
          <Suspense fallback={<TokenGridSkeleton />}>
            <TokenGridWrapper />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
