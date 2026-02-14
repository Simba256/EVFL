/**
 * Application-wide constants
 * Centralized configuration values for consistency and maintainability
 */

// Network configuration
export const NETWORK = {
  CHAIN_ID: 97, // BSC Testnet
  BLOCK_EXPLORER: 'https://testnet.bscscan.com',
  RPC_URL: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL,
} as const

// Fair Launch ICO configuration
export const FAIR_LAUNCH = {
  MIN_RAISE_BNB: 0.1,
  MIN_DURATION_DAYS: 1,
  MAX_DURATION_DAYS: 14,
  MAX_TEAM_PERCENT: 20,
  MIN_LP_PERCENT: 10,
  MAX_LP_PERCENT: 50,
  DEFAULT_LP_PERCENT: 30,
  DEFAULT_DURATION_DAYS: 7,
  DEFAULT_TOKEN_SUPPLY: 10_000_000,
  DEFAULT_MIN_RAISE: 1,
} as const

// Trading panel configuration
export const TRADING = {
  MIN_BNB: 0.01,
  SLIPPAGE_OPTIONS: [0.5, 1, 2, 5] as const,
  DEFAULT_SLIPPAGE: 1,
  SWAP_FEE_PERCENT: 0.3,
  DEBOUNCE_MS: 300,
} as const

// Polling/refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  COMMITMENTS: 15_000,
  POOL_RESERVES: 10_000,
  PRICE_HISTORY: 30_000,
  BALANCES: 10_000,
} as const

// Token configuration
export const TOKEN = {
  MIN_SUPPLY: 1_000_000,
  MAX_SUPPLY: 1_000_000_000_000,
  DEFAULT_SUPPLY: 10_000_000,
} as const

// Image upload configuration
export const IMAGE_UPLOAD = {
  MAX_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  VALID_TYPES: ['image/png', 'image/jpeg', 'image/gif'] as const,
} as const

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const
