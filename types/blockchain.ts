/**
 * Blockchain-specific TypeScript types
 */

import type { Address, Hash } from 'viem'

// Wallet connection state
export interface WalletState {
  address: Address | undefined
  isConnected: boolean
  isConnecting: boolean
  isDisconnected: boolean
  chain: {
    id: number
    name: string
    unsupported: boolean
  } | undefined
}

// Token launch parameters
export interface TokenLaunchParams {
  name: string
  symbol: string
  description: string
  imageUrl: string
  totalSupply: bigint
  initialPrice?: bigint
  creatorAllocation?: number // Percentage (0-100)
}

// Token metadata (from blockchain)
export interface OnChainToken {
  address: Address
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  creator: Address
  deployedAt: bigint // Timestamp
  bondingCurveAddress?: Address
}

// Trading transaction
export interface TradeParams {
  tokenAddress: Address
  amount: bigint
  slippage: number // Percentage (0-100)
  recipient?: Address
}

// Transaction status
export interface TransactionStatus {
  hash?: Hash
  status: 'idle' | 'pending' | 'success' | 'error'
  error?: Error
  confirmations?: number
}

// Bonding curve state
export interface BondingCurveState {
  tokenAddress: Address
  reserveBalance: bigint // BNB in curve
  tokenBalance: bigint // Tokens in curve
  currentPrice: bigint
  marketCap: bigint
  graduated: boolean
  graduationThreshold: bigint
}

// Token holder (on-chain)
export interface OnChainHolder {
  address: Address
  balance: bigint
  percentage: number
}

// Trade event (from blockchain logs)
export interface TradeEvent {
  hash: Hash
  blockNumber: bigint
  timestamp: bigint
  type: 'buy' | 'sell'
  trader: Address
  tokenAmount: bigint
  bnbAmount: bigint
  price: bigint
}

// Contract addresses per chain
export interface ContractAddresses {
  tokenFactory: Address
  tradingPool: Address
  registry: Address
}
