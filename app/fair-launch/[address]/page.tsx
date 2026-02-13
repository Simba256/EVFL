import { Suspense } from 'react'
import { Header } from "@/components/header"
import { FairLaunchDetail } from "./fair-launch-detail"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

async function getFairLaunch(address: string) {
  try {
    const { getFairLaunchByAddress } = await import('@/lib/db/fair-launch')
    return getFairLaunchByAddress(address)
  } catch (error) {
    console.error('Error fetching fair launch:', error)
    return null
  }
}

async function getCommitments(address: string) {
  try {
    const { getCommitments: dbGetCommitments } = await import('@/lib/db/fair-launch')
    return dbGetCommitments(address, 0, 100)
  } catch {
    return { commitments: [], total: 0 }
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 rounded-xl glass-morph" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-96 rounded-xl glass-morph" />
        </div>
        <div>
          <Skeleton className="h-96 rounded-xl glass-morph" />
        </div>
      </div>
    </div>
  )
}

async function FairLaunchContent({ address }: { address: string }) {
  const [fairLaunch, { commitments }] = await Promise.all([
    getFairLaunch(address),
    getCommitments(address),
  ])

  if (!fairLaunch) {
    notFound()
  }

  return <FairLaunchDetail fairLaunch={fairLaunch} commitments={commitments} />
}

export default async function FairLaunchDetailPage({
  params,
}: {
  params: Promise<{ address: string }>
}) {
  const { address } = await params

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/fair-launch"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Fair Launches
        </Link>

        <Suspense fallback={<DetailSkeleton />}>
          <FairLaunchContent address={address} />
        </Suspense>
      </main>
    </div>
  )
}
