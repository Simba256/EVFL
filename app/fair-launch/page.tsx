import { Suspense } from 'react'
import { Header } from "@/components/header"
import { FairLaunchCard, FairLaunchCardSkeleton, type FairLaunchData } from "@/components/fair-launch-card"
import Link from "next/link"
import { Rocket, TrendingUp, CheckCircle, XCircle } from "lucide-react"

export const dynamic = 'force-dynamic'

async function getFairLaunches(status?: string): Promise<{ fairLaunches: FairLaunchData[], total: number }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const url = status
      ? `${baseUrl}/api/fair-launches?status=${status}&limit=50`
      : `${baseUrl}/api/fair-launches?limit=50`

    const response = await fetch(url, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Failed to fetch fair launches:', response.status)
      return { fairLaunches: [], total: 0 }
    }

    return response.json()
  } catch (error) {
    console.error('Error fetching fair launches:', error)
    return { fairLaunches: [], total: 0 }
  }
}

async function getStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/fair-launches?stats=true`, {
      cache: 'no-store',
    })

    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

function FairLaunchGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <FairLaunchCardSkeleton key={i} />
      ))}
    </div>
  )
}

interface TabProps {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
  count?: number
}

function Tab({ href, active, icon, label, count }: TabProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          active ? 'bg-primary-foreground/20' : 'bg-muted'
        }`}>
          {count}
        </span>
      )}
    </Link>
  )
}

async function FairLaunchContent({ status }: { status?: string }) {
  const [{ fairLaunches, total }, stats] = await Promise.all([
    getFairLaunches(status),
    getStats(),
  ])

  return (
    <>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-morph rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalLaunches}</p>
            <p className="text-sm text-muted-foreground">Total Launches</p>
          </div>
          <div className="glass-morph rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.activeLaunches}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
          <div className="glass-morph rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.successfulLaunches}</p>
            <p className="text-sm text-muted-foreground">Successful</p>
          </div>
          <div className="glass-morph rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {(Number(stats.totalRaised) / 1e18).toFixed(2)} BNB
            </p>
            <p className="text-sm text-muted-foreground">Total Raised</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Tab
          href="/fair-launch"
          active={!status}
          icon={<Rocket className="h-4 w-4" />}
          label="All"
          count={stats?.totalLaunches}
        />
        <Tab
          href="/fair-launch?status=active"
          active={status === 'active'}
          icon={<TrendingUp className="h-4 w-4" />}
          label="Active"
          count={stats?.activeLaunches}
        />
        <Tab
          href="/fair-launch?status=FINALIZED"
          active={status === 'FINALIZED'}
          icon={<CheckCircle className="h-4 w-4" />}
          label="Successful"
          count={stats?.successfulLaunches}
        />
        <Tab
          href="/fair-launch?status=FAILED"
          active={status === 'FAILED'}
          icon={<XCircle className="h-4 w-4" />}
          label="Failed"
          count={stats?.failedLaunches}
        />
      </div>

      {/* Grid */}
      {fairLaunches.length === 0 ? (
        <div className="text-center py-16 glass-morph rounded-xl">
          <Rocket className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">No Fair Launches Yet</h3>
          <p className="text-muted-foreground mb-6">Be the first to create a Fair Launch ICO!</p>
          <Link
            href="/fair-launch/create"
            className="px-6 py-3 btn-metallic-primary text-primary-foreground font-bold rounded-lg inline-block"
          >
            Create Fair Launch
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Showing {fairLaunches.length} of {total} fair launches
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fairLaunches.map((fl) => (
              <FairLaunchCard key={fl.id} fairLaunch={fl} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default async function FairLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero */}
        <div className="relative mb-8 rounded-xl border-glow-animated glass-morph p-8 md:p-12 overflow-hidden digital-corners scanlines">
          <div className="grid-bg circuit-bg absolute inset-0 opacity-30" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1
                className="text-3xl md:text-5xl font-black mb-3 neon-text"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Fair Launch <span className="text-primary">ICOs</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Unruggable capital formation. Commit BNB, receive pro-rata token allocation.
                No presales, no VCs, just fair distribution.
              </p>
            </div>
            <Link
              href="/fair-launch/create"
              className="px-8 py-4 btn-metallic-primary text-primary-foreground font-bold text-lg rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Rocket className="h-5 w-5" />
              Create Fair Launch
            </Link>
          </div>
        </div>

        {/* Content */}
        <Suspense fallback={<FairLaunchGridSkeleton />}>
          <FairLaunchContent status={status} />
        </Suspense>
      </main>
    </div>
  )
}
