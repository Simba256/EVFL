import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen">
      {/* Header Skeleton */}
      <div className="h-16 border-b border-primary/20 glass-morph" />

      {/* Trending Ticker Skeleton */}
      <div className="h-12 bg-muted/20 border-b border-border" />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section Skeleton */}
        <Skeleton className="h-64 w-full mb-12 rounded-xl glass-morph" />

        <div className="h-4 bg-border/50 my-8" />

        {/* Filter Tabs Skeleton */}
        <div className="flex gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-lg" />
          ))}
        </div>

        {/* Token Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[500px] rounded-xl glass-morph" />
          ))}
        </div>
      </main>
    </div>
  )
}
