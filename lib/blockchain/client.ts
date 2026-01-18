import { createPublicClient, http } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

// Public client for BSC Testnet (read-only, no wallet needed)
export const bscTestnetClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
});

// Public client for BSC Mainnet (read-only, no wallet needed)
export const bscMainnetClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.bnbchain.org'),
});

// Get client for chain ID
export function getPublicClient(chainId: number = 97) {
  return chainId === 56 ? bscMainnetClient : bscTestnetClient;
}
