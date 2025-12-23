/**
 * Wagmi Configuration
 * React hooks for blockchain interaction
 * Using RainbowKit's getDefaultConfig for simplicity
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { chains } from './chains'

// Get WalletConnect Project ID from environment
// Get one free at: https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Warn if Project ID is missing (only in development)
if (!projectId && typeof window !== 'undefined') {
  console.warn(
    '⚠️ WalletConnect Project ID is missing!\n' +
    'Get one free at: https://cloud.walletconnect.com\n' +
    'Add to .env.local: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id'
  )
}

// Wagmi configuration using RainbowKit's defaults
export const config = getDefaultConfig({
  appName: 'RoboLaunch',
  projectId: projectId || '0000000000000000000000000000000', // Fallback (won't work for WalletConnect)
  chains: chains as any,
  ssr: true, // Enable server-side rendering
})

// Type exports
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
