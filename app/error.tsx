'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto p-8 glass-morph border-glow-animated rounded-xl">
        <div className="flex justify-center">
          <div className="relative">
            <AlertTriangle className="h-20 w-20 text-destructive drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
            <div className="absolute inset-0 animate-ping opacity-20">
              <AlertTriangle className="h-20 w-20 text-destructive" />
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black mb-3 neon-text" style={{ fontFamily: "var(--font-heading)" }}>
            System Malfunction
          </h1>
          <p className="text-muted-foreground mb-2">
            {error.message || 'An unexpected error occurred in the matrix'}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            onClick={reset}
            className="w-full btn-metallic-primary text-primary-foreground font-bold"
            size="lg"
          >
            Reboot System
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="w-full btn-metallic"
            size="lg"
          >
            Return to Base
          </Button>
        </div>
      </div>
    </div>
  )
}
