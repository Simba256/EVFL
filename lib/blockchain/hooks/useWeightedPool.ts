'use client';

import { useCallback } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, formatEther, formatUnits } from 'viem';
import { WeightedPoolABI, ERC20ABI, WBNBABI } from '../abis';
import { getContractAddresses, DEFAULT_CHAIN_ID } from '../config/contracts';

export interface PoolInfo {
  token0: `0x${string}`;
  token1: `0x${string}`;
  balances: [bigint, bigint];
  weights: [bigint, bigint];
  swapFee: bigint;
  totalSupply: bigint;
}

export interface SwapParams {
  poolAddress: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: string; // Human readable amount
  slippagePercent?: number; // Default 1%
}

export function useWeightedPool() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Use DEFAULT_CHAIN_ID (BSC Testnet) if not connected to a supported chain
  const effectiveChainId = chainId || DEFAULT_CHAIN_ID;
  const addresses = getContractAddresses(effectiveChainId);

  // Get pool info
  const getPoolInfo = useCallback(async (poolAddress: `0x${string}`): Promise<PoolInfo> => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }

    const [tokens, balances, weights, swapFee, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: poolAddress,
        abi: WeightedPoolABI,
        functionName: 'getTokens',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: WeightedPoolABI,
        functionName: 'getBalances',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: WeightedPoolABI,
        functionName: 'getWeights',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: WeightedPoolABI,
        functionName: 'getSwapFee',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: WeightedPoolABI,
        functionName: 'totalSupply',
      }),
    ]);

    const tokensArray = tokens as `0x${string}`[];
    const balancesArray = balances as bigint[];
    const weightsArray = weights as bigint[];

    return {
      token0: tokensArray[0],
      token1: tokensArray[1],
      balances: [balancesArray[0], balancesArray[1]],
      weights: [weightsArray[0], weightsArray[1]],
      swapFee: swapFee as bigint,
      totalSupply: totalSupply as bigint,
    };
  }, [publicClient]);

  // Get spot price
  const getSpotPrice = useCallback(async (
    poolAddress: `0x${string}`,
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`
  ): Promise<bigint> => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }

    const price = await publicClient.readContract({
      address: poolAddress,
      abi: WeightedPoolABI,
      functionName: 'getSpotPrice',
      args: [tokenIn, tokenOut],
    });
    return price as bigint;
  }, [publicClient]);

  // Calculate output amount
  const calcOutGivenIn = useCallback(async (
    poolAddress: `0x${string}`,
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint
  ): Promise<bigint> => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }

    const amountOut = await publicClient.readContract({
      address: poolAddress,
      abi: WeightedPoolABI,
      functionName: 'calcOutGivenIn',
      args: [tokenIn, tokenOut, amountIn],
    });
    return amountOut as bigint;
  }, [publicClient]);

  // Execute swap
  const swap = useCallback(async (params: SwapParams): Promise<{
    amountOut: bigint;
    txHash: `0x${string}`;
  }> => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected');
    }

    const { poolAddress, tokenIn, tokenOut, amountIn, slippagePercent = 1 } = params;
    const amountInWei = parseEther(amountIn);

    // Check if tokenIn is WBNB and needs wrapping
    const isWbnbIn = tokenIn.toLowerCase() === addresses.wbnb?.toLowerCase();

    if (isWbnbIn) {
      // Wrap BNB first
      console.log('Wrapping BNB...');
      const wrapHash = await walletClient.writeContract({
        address: addresses.wbnb,
        abi: WBNBABI,
        functionName: 'deposit',
        value: amountInWei,
      });
      await publicClient.waitForTransactionReceipt({ hash: wrapHash });
    }

    // Check allowance and approve if needed
    const allowance = await publicClient.readContract({
      address: tokenIn,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [address, poolAddress],
    }) as bigint;

    if (allowance < amountInWei) {
      console.log('Approving token...');
      const approveHash = await walletClient.writeContract({
        address: tokenIn,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [poolAddress, amountInWei * 2n], // Approve extra for future swaps
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Calculate expected output
    const expectedOut = await calcOutGivenIn(poolAddress, tokenIn, tokenOut, amountInWei);
    // Convert slippage to basis points to handle decimal values (0.1% = 10 bps, 1% = 100 bps)
    const slippageBps = Math.floor(slippagePercent * 100);
    const minAmountOut = expectedOut * BigInt(10000 - slippageBps) / 10000n;

    // Execute swap
    console.log('Executing swap...');
    const txHash = await walletClient.writeContract({
      address: poolAddress,
      abi: WeightedPoolABI,
      functionName: 'swap',
      args: [tokenIn, tokenOut, amountInWei, minAmountOut, address],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // If output is WBNB, optionally unwrap
    // For now, we'll leave it as WBNB

    return {
      amountOut: expectedOut,
      txHash,
    };
  }, [walletClient, publicClient, address, addresses.wbnb, calcOutGivenIn]);

  // Get token balance
  const getTokenBalance = useCallback(async (
    tokenAddress: `0x${string}`,
    userAddress?: `0x${string}`
  ): Promise<bigint> => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }
    const targetAddress = userAddress || address;
    if (!targetAddress) {
      throw new Error('No address provided');
    }

    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'balanceOf',
      args: [targetAddress],
    });
    return balance as bigint;
  }, [publicClient, address]);

  return {
    getPoolInfo,
    getSpotPrice,
    calcOutGivenIn,
    swap,
    getTokenBalance,
    wbnbAddress: addresses.wbnb,
  };
}
