import { Skeleton } from "@/components/ui/skeleton"

export default function TokenLoading() {
  return (
    <div className="min-h-screen">
      {/* Header Skeleton */}
      <div className="h-16 border-b border-primary/20 glass-morph" />

      {/* Trending Ticker Skeleton */}
      <div className="h-12 bg-muted/20 border-b border-border" />

      <main className="container mx-auto px-4 py-8">
        {/* Back Button Skeleton */}
        <Skeleton className="h-6 w-32 mb-6" />

        {/* Token Header Skeleton */}
        <Skeleton className="h-48 w-full mb-6 rounded-xl glass-morph" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section Skeleton */}
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[600px] w-full rounded-xl glass-morph" />
            <Skeleton className="h-80 w-full rounded-xl glass-morph" />
          </div>

          {/* Sidebar Skeleton */}
          <div className="space-y-6">
            <Skeleton className="h-96 w-full rounded-xl glass-morph" />
            <Skeleton className="h-40 w-full rounded-xl glass-morph" />
            <Skeleton className="h-80 w-full rounded-xl glass-morph" />
          </div>
        </div>
      </main>
    </div>
  )
}
