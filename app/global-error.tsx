'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html className="dark">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-center space-y-6 max-w-md mx-auto p-8">
            <h1 className="text-4xl font-black text-red-500">
              Critical System Failure
            </h1>
            <p className="text-gray-400">
              {error.message || 'A critical error has occurred'}
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
            >
              Attempt Recovery
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
