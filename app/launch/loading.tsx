import { Skeleton } from "@/components/ui/skeleton"

export default function LaunchLoading() {
  return (
    <div className="min-h-screen">
      {/* Header Skeleton */}
      <div className="h-16 border-b border-primary/20 glass-morph" />

      {/* Trending Ticker Skeleton */}
      <div className="h-12 bg-muted/20 border-b border-border" />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section Skeleton */}
        <Skeleton className="h-40 w-full max-w-4xl mx-auto mb-12 rounded-xl glass-morph" />

        {/* Form Skeleton */}
        <div className="max-w-4xl mx-auto glass-morph border-glow-animated rounded-xl p-8">
          <div className="space-y-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  )
}
