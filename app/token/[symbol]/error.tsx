'use client'

import { useEffect } from 'react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function TokenError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Token page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center space-y-6 max-w-md mx-auto p-8 glass-morph border-glow-animated rounded-xl scanlines">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />

          <div>
            <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
              Token Not Found
            </h1>
            <p className="text-muted-foreground">
              {error.message || "This token doesn't exist in our database"}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={reset}
              className="w-full btn-metallic-primary"
              size="lg"
            >
              Try Again
            </Button>
            <Link href="/" className="block">
              <Button
                variant="outline"
                className="w-full btn-metallic"
                size="lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tokens
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
