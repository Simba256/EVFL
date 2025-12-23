'use client'

/**
 * Wallet Connection Hook
 * Simplified hook for wallet state and connection management
 */

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import type { WalletState } from '@/types/blockchain'
import { defaultChain } from '../config/chains'

export function useWalletConnection(): WalletState & {
  connect: () => void
  disconnect: () => void
  switchToBSC: () => void
} {
  const account = useAccount()
  const chainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  // Wallet state
  const walletState: WalletState = {
    address: account.address,
    isConnected: account.isConnected,
    isConnecting: account.isConnecting,
    isDisconnected: account.isDisconnected,
    chain: account.chain
      ? {
          id: account.chain.id,
          name: account.chain.name,
          unsupported: account.chain.unsupported || false,
        }
      : undefined,
  }

  // Connect wallet (opens RainbowKit modal)
  const connect = () => {
    openConnectModal?.()
  }

  // Switch to BSC if on wrong chain
  const switchToBSC = () => {
    if (chainId !== defaultChain.id) {
      switchChain?.({ chainId: defaultChain.id })
    }
  }

  return {
    ...walletState,
    connect,
    disconnect,
    switchToBSC,
  }
}

// Hook to check if wallet is connected and on correct chain
export function useIsWalletReady(): boolean {
  const { isConnected, chain } = useAccount()
  return isConnected && chain?.id === defaultChain.id && !chain?.unsupported
}

// Hook to get formatted wallet address
export function useFormattedAddress(): string | undefined {
  const { address } = useAccount()
  if (!address) return undefined

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
