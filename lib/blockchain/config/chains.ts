/**
 * Blockchain Chain Configurations
 * Multi-chain support: BSC, Base, Arbitrum (testnets + mainnets)
 */

import {
  bsc,
  bscTestnet,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia
} from 'wagmi/chains'

// Supported chains - testnets for development, mainnets for production
export const chains = [
  // BSC
  bscTestnet, // BSC Testnet
  bsc, // BSC Mainnet

  // Base
  baseSepolia, // Base Sepolia Testnet
  base, // Base Mainnet

  // Arbitrum
  arbitrumSepolia, // Arbitrum Sepolia Testnet
  arbitrum, // Arbitrum One Mainnet
] as const

// Testnet chains only (for development)
export const testnetChains = [bscTestnet, baseSepolia, arbitrumSepolia] as const

// Mainnet chains only (for production)
export const mainnetChains = [bsc, base, arbitrum] as const

export type SupportedChainId = typeof chains[number]['id']

// Chain-specific configuration with contract addresses
export const chainConfig = {
  // BSC Mainnet
  [bsc.id]: {
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    nativeCurrency: 'BNB',
    blockExplorer: 'https://bscscan.com',
    rpcUrl: process.env.NEXT_PUBLIC_BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.bnbchain.org',
    dexName: 'PancakeSwap',
    isTestnet: false,
    contracts: {
      fairLaunchFactory: null as `0x${string}` | null, // Not deployed yet
      tokenFactory: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '',
      weth: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`, // WBNB
      dexRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as `0x${string}`,
    },
  },
  // BSC Testnet
  [bscTestnet.id]: {
    name: 'BNB Testnet',
    shortName: 'BSC Testnet',
    nativeCurrency: 'tBNB',
    blockExplorer: 'https://testnet.bscscan.com',
    rpcUrl: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    dexName: 'PancakeSwap',
    isTestnet: true,
    contracts: {
      fairLaunchFactory: '0x821F4bbdA70Db4EcD61451907ad282CBEbD007dD' as `0x${string}`,
      tokenFactory: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET || '',
      weth: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as `0x${string}`, // WBNB
      dexRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1' as `0x${string}`,
    },
  },
  // Base Mainnet
  [base.id]: {
    name: 'Base',
    shortName: 'Base',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://basescan.org',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
    dexName: 'Uniswap',
    isTestnet: false,
    contracts: {
      fairLaunchFactory: null as `0x${string}` | null,
      tokenFactory: null,
      weth: '0x4200000000000000000000000000000000000006' as `0x${string}`,
      dexRouter: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' as `0x${string}`,
    },
  },
  // Base Sepolia
  [baseSepolia.id]: {
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://sepolia.basescan.org',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    dexName: 'Uniswap',
    isTestnet: true,
    contracts: {
      fairLaunchFactory: null as `0x${string}` | null, // To be deployed
      tokenFactory: null,
      weth: '0x4200000000000000000000000000000000000006' as `0x${string}`,
      dexRouter: '0x1689E7B1F10000AE47eBfE339a4f69dECd19F602' as `0x${string}`,
    },
  },
  // Arbitrum One
  [arbitrum.id]: {
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://arbiscan.io',
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_MAINNET_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    dexName: 'Uniswap',
    isTestnet: false,
    contracts: {
      fairLaunchFactory: null as `0x${string}` | null,
      tokenFactory: null,
      weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as `0x${string}`,
      dexRouter: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' as `0x${string}`,
    },
  },
  // Arbitrum Sepolia
  [arbitrumSepolia.id]: {
    name: 'Arbitrum Sepolia',
    shortName: 'Arb Sepolia',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://sepolia.arbiscan.io',
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    dexName: 'Uniswap',
    isTestnet: true,
    contracts: {
      fairLaunchFactory: null as `0x${string}` | null, // To be deployed
      tokenFactory: null,
      weth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73' as `0x${string}`,
      dexRouter: '0x101F443B4d1b059569D643917553c771E1b9663E' as `0x${string}`,
    },
  },
} as const

// Default chain (use BSC testnet in development, BSC mainnet in production)
export const defaultChain = process.env.NODE_ENV === 'production' ? bsc : bscTestnet

// Get chain config for a given chainId
export function getChainConfig(chainId: number) {
  return chainConfig[chainId as keyof typeof chainConfig]
}

// Get FairLaunchFactory address for a chain
export function getFairLaunchFactoryAddress(chainId: number): `0x${string}` | null {
  const config = getChainConfig(chainId)
  return config?.contracts.fairLaunchFactory ?? null
}

// Get WETH/WBNB address for a chain
export function getWethAddress(chainId: number): `0x${string}` | null {
  const config = getChainConfig(chainId)
  return config?.contracts.weth ?? null
}

// Get DEX router address for a chain
export function getDexRouterAddress(chainId: number): `0x${string}` | null {
  const config = getChainConfig(chainId)
  return config?.contracts.dexRouter ?? null
}

// Get block explorer URL for transaction/address
export function getExplorerUrl(chainId: number, type: 'tx' | 'address' | 'token', hash: string): string {
  const config = getChainConfig(chainId)
  if (!config) return '#'
  return `${config.blockExplorer}/${type}/${hash}`
}

// Check if chain is supported
export function isChainSupported(chainId: number): boolean {
  return chainId in chainConfig
}

// Check if chain is a testnet
export function isTestnet(chainId: number): boolean {
  const config = getChainConfig(chainId)
  return config?.isTestnet ?? false
}

// Get native currency symbol for chain
export function getNativeCurrency(chainId: number): string {
  const config = getChainConfig(chainId)
  return config?.nativeCurrency ?? 'ETH'
}
