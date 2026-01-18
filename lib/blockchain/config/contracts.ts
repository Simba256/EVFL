/**
 * Contract addresses configuration
 * Supports both BSC Mainnet and Testnet
 */

// Hardcode testnet addresses as fallback (deployed contracts)
const BSC_TESTNET_CONTRACTS = {
  wbnb: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as `0x${string}`,
  tokenFactory: '0x6F42EC722461Eb6fDe4B4cD8793b297eB34924F7' as `0x${string}`,
  poolRegistry: '0x785FAE9B7C7801173bc1Dc1e38A9ae827137abBc' as `0x${string}`,
};

export const CONTRACT_ADDRESSES = {
  // BSC Mainnet (Chain ID: 56)
  56: {
    wbnb: (process.env.NEXT_PUBLIC_WBNB_ADDRESS || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c') as `0x${string}`,
    tokenFactory: (process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '') as `0x${string}`,
    poolRegistry: (process.env.NEXT_PUBLIC_POOL_REGISTRY_ADDRESS || '') as `0x${string}`,
  },
  // BSC Testnet (Chain ID: 97)
  97: {
    wbnb: (process.env.NEXT_PUBLIC_WBNB_ADDRESS_TESTNET || BSC_TESTNET_CONTRACTS.wbnb) as `0x${string}`,
    tokenFactory: (process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET || BSC_TESTNET_CONTRACTS.tokenFactory) as `0x${string}`,
    poolRegistry: (process.env.NEXT_PUBLIC_POOL_REGISTRY_ADDRESS_TESTNET || BSC_TESTNET_CONTRACTS.poolRegistry) as `0x${string}`,
  },
} as const;

// Default chain for the app (BSC Testnet for development)
export const DEFAULT_CHAIN_ID = 97;

export type SupportedChainId = keyof typeof CONTRACT_ADDRESSES;

export function getContractAddresses(chainId?: number) {
  // Use default chain if not specified or not supported
  const effectiveChainId = chainId && chainId in CONTRACT_ADDRESSES ? chainId : DEFAULT_CHAIN_ID;
  return CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId];
}

export function isChainSupported(chainId: number): chainId is SupportedChainId {
  return chainId in CONTRACT_ADDRESSES;
}
