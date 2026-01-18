'use client';

import { useCallback } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { TokenFactoryABI, WBNBABI } from '../abis';
import { getContractAddresses, DEFAULT_CHAIN_ID } from '../config/contracts';

export interface CreateTokenParams {
  name: string;
  symbol: string;
  tokenURI: string;
  initialSupply: string; // In tokens (will be converted to wei)
  initialBnbLiquidity: string; // In BNB (will be converted to wei)
  tokenWeight?: number; // 50-99, defaults to 80
}

export interface TokenInfo {
  token: `0x${string}`;
  pool: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  initialSupply: bigint;
  createdAt: bigint;
}

export function useTokenFactory() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Use DEFAULT_CHAIN_ID (BSC Testnet) if not connected to a supported chain
  const effectiveChainId = chainId || DEFAULT_CHAIN_ID;
  const addresses = getContractAddresses(effectiveChainId);

  // Get launch fee
  const getLaunchFee = useCallback(async (): Promise<bigint> => {
    if (!publicClient || !addresses.tokenFactory) return 0n;

    try {
      const fee = await publicClient.readContract({
        address: addresses.tokenFactory,
        abi: TokenFactoryABI,
        functionName: 'launchFee',
      });
      return fee as bigint;
    } catch (error) {
      console.error('Error getting launch fee:', error);
      return parseEther('0.01'); // Default fallback
    }
  }, [publicClient, addresses.tokenFactory]);

  // Get all tokens
  const getAllTokens = useCallback(async (): Promise<`0x${string}`[]> => {
    if (!publicClient || !addresses.tokenFactory) return [];

    try {
      const tokens = await publicClient.readContract({
        address: addresses.tokenFactory,
        abi: TokenFactoryABI,
        functionName: 'getAllTokens',
      });
      return tokens as `0x${string}`[];
    } catch (error) {
      console.error('Error getting tokens:', error);
      return [];
    }
  }, [publicClient, addresses.tokenFactory]);

  // Get token info
  const getTokenInfo = useCallback(async (tokenAddress: `0x${string}`): Promise<TokenInfo | null> => {
    if (!publicClient || !addresses.tokenFactory) return null;

    try {
      const info = await publicClient.readContract({
        address: addresses.tokenFactory,
        abi: TokenFactoryABI,
        functionName: 'getTokenInfo',
        args: [tokenAddress],
      });
      return info as TokenInfo;
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }, [publicClient, addresses.tokenFactory]);

  // Get token count
  const getTokenCount = useCallback(async (): Promise<number> => {
    if (!publicClient || !addresses.tokenFactory) return 0;

    try {
      const count = await publicClient.readContract({
        address: addresses.tokenFactory,
        abi: TokenFactoryABI,
        functionName: 'getTokenCount',
      });
      return Number(count);
    } catch (error) {
      console.error('Error getting token count:', error);
      return 0;
    }
  }, [publicClient, addresses.tokenFactory]);

  // Create a new token
  const createToken = useCallback(async (params: CreateTokenParams): Promise<{
    tokenAddress: `0x${string}`;
    poolAddress: `0x${string}`;
    txHash: `0x${string}`;
  }> => {
    if (!walletClient || !publicClient || !address || !addresses.tokenFactory || !addresses.wbnb) {
      throw new Error('Wallet not connected or contracts not configured');
    }

    const { name, symbol, tokenURI, initialSupply, initialBnbLiquidity, tokenWeight = 80 } = params;

    // Convert values to wei
    const supplyWei = parseEther(initialSupply);
    const bnbLiquidityWei = parseEther(initialBnbLiquidity);
    const weightWei = parseEther((tokenWeight / 100).toString()); // e.g., 80 -> 0.8e18

    // Get launch fee
    const launchFee = await getLaunchFee();

    // First, wrap BNB to WBNB
    console.log('Wrapping BNB to WBNB...');
    const wrapHash = await walletClient.writeContract({
      address: addresses.wbnb,
      abi: WBNBABI,
      functionName: 'deposit',
      value: bnbLiquidityWei,
    });
    await publicClient.waitForTransactionReceipt({ hash: wrapHash });
    console.log('WBNB wrapped:', wrapHash);

    // Approve WBNB spending
    console.log('Approving WBNB...');
    const approveHash = await walletClient.writeContract({
      address: addresses.wbnb,
      abi: WBNBABI,
      functionName: 'approve',
      args: [addresses.tokenFactory, bnbLiquidityWei],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log('WBNB approved:', approveHash);

    // Create token
    console.log('Creating token...');
    const txHash = await walletClient.writeContract({
      address: addresses.tokenFactory,
      abi: TokenFactoryABI,
      functionName: 'createToken',
      args: [name, symbol, tokenURI, supplyWei, bnbLiquidityWei, weightWei],
      value: launchFee,
    });

    console.log('Waiting for transaction...', txHash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Parse the TokenCreated event to get addresses
    // Event: TokenCreated(address indexed token, address indexed pool, address indexed creator, string name, string symbol, uint256 initialSupply)
    // Topic[0] = event signature hash
    // Topic[1] = token address (indexed)
    // Topic[2] = pool address (indexed)
    // Topic[3] = creator address (indexed)

    let tokenAddress: `0x${string}` = '0x0';
    let poolAddress: `0x${string}` = '0x0';

    // Find the TokenCreated event from the factory
    for (const log of receipt.logs) {
      // Check if this log is from the factory and has the right structure
      if (log.address.toLowerCase() === addresses.tokenFactory.toLowerCase() && log.topics.length >= 4) {
        // Extract addresses from topics (remove padding - addresses are last 40 chars)
        tokenAddress = ('0x' + log.topics[1]?.slice(-40)) as `0x${string}`;
        poolAddress = ('0x' + log.topics[2]?.slice(-40)) as `0x${string}`;
        console.log('Found TokenCreated event:', { tokenAddress, poolAddress });
        break;
      }
    }

    // Fallback: try to get pool from factory
    if (poolAddress === '0x0' || poolAddress === '0x0000000000000000000000000000000000000000') {
      try {
        const pool = await publicClient.readContract({
          address: addresses.tokenFactory,
          abi: TokenFactoryABI,
          functionName: 'getPoolForToken',
          args: [tokenAddress],
        });
        poolAddress = pool as `0x${string}`;
        console.log('Got pool from factory:', poolAddress);
      } catch (e) {
        console.error('Could not get pool address:', e);
      }
    }

    return {
      tokenAddress,
      poolAddress,
      txHash,
    };
  }, [walletClient, publicClient, address, addresses, getLaunchFee]);

  return {
    createToken,
    getLaunchFee,
    getAllTokens,
    getTokenInfo,
    getTokenCount,
    factoryAddress: addresses.tokenFactory,
    wbnbAddress: addresses.wbnb,
    isConfigured: !!addresses.tokenFactory && addresses.tokenFactory !== '',
  };
}
