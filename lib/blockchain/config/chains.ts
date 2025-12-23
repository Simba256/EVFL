/**
 * Blockchain Chain Configurations
 * Supports BSC (primary) with multi-chain expansion ready
 */

import { bsc, bscTestnet, mainnet, polygon, arbitrum, base } from 'wagmi/chains'

// Primary chain: Binance Smart Chain
export const chains = [
  bsc, // BSC Mainnet - PRIMARY
  bscTestnet, // BSC Testnet for development

  // Future expansion (uncomment when ready):
  // mainnet,     // Ethereum
  // base,        // Base L2
  // polygon,     // Polygon
  // arbitrum,    // Arbitrum
] as const

export type SupportedChainId = typeof chains[number]['id']

// Chain-specific configuration
export const chainConfig = {
  [bsc.id]: {
    name: 'BNB Smart Chain',
    nativeCurrency: 'BNB',
    blockExplorer: 'https://bscscan.com',
    rpcUrl: process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    contracts: {
      // Your deployed contract addresses
      tokenFactory: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '',
      tradingPool: process.env.NEXT_PUBLIC_TRADING_POOL_ADDRESS || '',
      registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || '',
    },
  },
  [bscTestnet.id]: {
    name: 'BNB Testnet',
    nativeCurrency: 'tBNB',
    blockExplorer: 'https://testnet.bscscan.com',
    rpcUrl: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    contracts: {
      tokenFactory: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET || '',
      tradingPool: process.env.NEXT_PUBLIC_TRADING_POOL_ADDRESS_TESTNET || '',
      registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_TESTNET || '',
    },
  },
} as const

// Default chain (use testnet in development, mainnet in production)
export const defaultChain = process.env.NODE_ENV === 'production' ? bsc : bscTestnet

// Get contract addresses for current chain
export function getContractAddress(
  chainId: number,
  contract: 'tokenFactory' | 'tradingPool' | 'registry'
): string {
  const config = chainConfig[chainId as keyof typeof chainConfig]
  if (!config) {
    throw new Error(`Chain ${chainId} not supported`)
  }
  return config.contracts[contract]
}
