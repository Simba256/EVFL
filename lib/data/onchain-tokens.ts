import { bscTestnetClient } from '@/lib/blockchain/client';
import { TokenFactoryABI, WeightedPoolABI } from '@/lib/blockchain/abis';
import { getContractAddresses } from '@/lib/blockchain/config/contracts';
import { formatEther } from 'viem';
import type { Token } from '@/types';

interface OnChainTokenInfo {
  token: `0x${string}`;
  pool: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  initialSupply: bigint;
  createdAt: bigint;
}

export async function getOnChainTokens(): Promise<Token[]> {
  try {
    const addresses = getContractAddresses(97); // BSC Testnet

    // Get all token addresses
    const tokenAddresses = await bscTestnetClient.readContract({
      address: addresses.tokenFactory,
      abi: TokenFactoryABI,
      functionName: 'getAllTokens',
    }) as `0x${string}`[];

    if (!tokenAddresses || tokenAddresses.length === 0) {
      return [];
    }

    // Fetch info for each token
    const tokens: Token[] = await Promise.all(
      tokenAddresses.map(async (tokenAddr) => {
        try {
          const info = await bscTestnetClient.readContract({
            address: addresses.tokenFactory,
            abi: TokenFactoryABI,
            functionName: 'getTokenInfo',
            args: [tokenAddr],
          }) as OnChainTokenInfo;

          // Try to get pool data for price
          let price = '0';
          let marketCap = '$0';
          let liquidity = '0 BNB';

          if (info.pool && info.pool !== '0x0000000000000000000000000000000000000000') {
            try {
              const [balances, weights] = await Promise.all([
                bscTestnetClient.readContract({
                  address: info.pool,
                  abi: WeightedPoolABI,
                  functionName: 'getBalances',
                }),
                bscTestnetClient.readContract({
                  address: info.pool,
                  abi: WeightedPoolABI,
                  functionName: 'getWeights',
                }),
              ]);

              const tokenBalance = (balances as bigint[])[0];
              const bnbBalance = (balances as bigint[])[1];
              const tokenWeight = (weights as bigint[])[0];
              const bnbWeight = (weights as bigint[])[1];

              if (tokenBalance > 0n && bnbBalance > 0n) {
                // Calculate spot price
                const priceNum = (Number(bnbBalance) / Number(bnbWeight)) / (Number(tokenBalance) / Number(tokenWeight));
                price = `${priceNum.toFixed(10)} BNB`;

                // Calculate market cap (price * total supply)
                const mcapBnb = priceNum * Number(formatEther(info.initialSupply));
                marketCap = `${mcapBnb.toFixed(4)} BNB`;

                liquidity = `${parseFloat(formatEther(bnbBalance)).toFixed(4)} BNB`;
              }
            } catch (e) {
              console.error('Error fetching pool data:', e);
            }
          }

          // Calculate time ago
          const createdTime = Number(info.createdAt) * 1000;
          const now = Date.now();
          const diffMs = now - createdTime;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);

          let timeAgo = 'just now';
          if (diffDays > 0) timeAgo = `${diffDays}d ago`;
          else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
          else if (diffMins > 0) timeAgo = `${diffMins}m ago`;

          return {
            id: tokenAddr,
            name: info.name,
            symbol: `$${info.symbol}`,
            description: `Launched on RoboLaunch with Balancer-style weighted pool.`,
            image: '/robot-placeholder.png', // Default image
            marketCap,
            volume24h: liquidity, // Using liquidity as proxy for now
            holders: 1, // Would need to index Transfer events to track
            price,
            change24h: 0, // Would need price history to calculate
            createdAt: timeAgo,
            creator: `${info.creator.slice(0, 6)}...${info.creator.slice(-4)}`,
            status: 'new' as const,
            // Extra fields for on-chain tokens
            tokenAddress: info.token,
            poolAddress: info.pool,
            isOnChain: true,
          };
        } catch (e) {
          console.error('Error fetching token info:', e);
          return null;
        }
      })
    );

    // Filter out any null results
    return tokens.filter((t): t is Token => t !== null);
  } catch (e) {
    console.error('Error fetching on-chain tokens:', e);
    return [];
  }
}
