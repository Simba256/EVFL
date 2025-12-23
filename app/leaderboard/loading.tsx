import { Skeleton } from "@/components/ui/skeleton"

export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen">
      {/* Header Skeleton */}
      <div className="h-16 border-b border-primary/20 glass-morph" />

      {/* Trending Ticker Skeleton */}
      <div className="h-12 bg-muted/20 border-b border-border" />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section Skeleton */}
        <Skeleton className="h-32 w-full mb-12 rounded-xl glass-morph" />

        {/* Sort Buttons Skeleton */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-lg" />
          ))}
        </div>

        {/* Leaderboard Cards Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg glass-morph" />
          ))}
        </div>
      </main>
    </div>
  )
}
