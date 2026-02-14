"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function FairLaunchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Fair Launch Error:", error)
  }, [error])

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="container mx-auto px-4 py-8 relative z-10 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full p-8 border-destructive/50 bg-destructive/5">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Failed to Load Fair Launch
            </h1>
            <p className="text-muted-foreground mb-6">
              {error.message || "An unexpected error occurred while loading this fair launch."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={reset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/fair-launch" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Fair Launches
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
