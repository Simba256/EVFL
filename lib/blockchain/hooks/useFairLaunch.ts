"use client"

import { useCallback, useMemo } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { parseEther, formatEther, type Address } from 'viem'

// FairLaunchFactory ABI (subset we need)
const FairLaunchFactoryABI = [
  {
    name: 'createFairLaunch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'imageURI', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'tokenSupply', type: 'uint256' },
          { name: 'minimumRaise', type: 'uint256' },
          { name: 'icoDuration', type: 'uint256' },
          { name: 'teamTokensBps', type: 'uint256' },
          { name: 'teamWallet', type: 'address' },
          { name: 'monthlyBudget', type: 'uint256' },
          { name: 'treasuryOwner', type: 'address' },
          { name: 'lpBnbBps', type: 'uint256' },
          { name: 'lpTokensBps', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'ico', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'treasury', type: 'address' },
    ],
  },
  {
    name: 'platformFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'MIN_SUPPLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'MAX_SUPPLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'MIN_RAISE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'MIN_DURATION',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'MAX_DURATION',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

// ICOContract ABI
const ICOContractABI = [
  {
    name: 'commit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'claimTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'refund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'finalize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'markFailed',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getICOInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'status', type: 'uint8' },
          { name: 'totalCommitted', type: 'uint256' },
          { name: 'tokenPrice', type: 'uint256' },
          { name: 'participantCount', type: 'uint256' },
          { name: 'minimumRaise', type: 'uint256' },
          { name: 'tokenSupply', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'commitments',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'hasClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getAllocation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'canFinalize',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'canMarkFailed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const

export interface CreateFairLaunchParams {
  name: string
  symbol: string
  imageURI: string
  description: string
  tokenSupply: string // in tokens (e.g., "10000000" for 10M)
  minimumRaise: string // in BNB
  icoDurationDays: number // 1-14 days
  teamTokensPercent: number // 0-20%
  teamWallet?: string // required if teamTokensPercent > 0
  monthlyBudget?: string // in BNB, 0 = no limit
  treasuryOwner?: string // defaults to creator
  lpBnbPercent?: number // 0-50%, % of raised BNB for LP
  lpTokensPercent?: number // 0-50%, % of tokens reserved for LP
}

export interface ICOInfo {
  status: number // 0=PENDING, 1=ACTIVE, 2=FINALIZED, 3=FAILED
  totalCommitted: bigint
  tokenPrice: bigint
  participantCount: bigint
  minimumRaise: bigint
  tokenSupply: bigint
  startTime: bigint
  endTime: bigint
}

export function useFairLaunch() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const factoryAddress = process.env.NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_ADDRESS_TESTNET as Address | undefined

  const isConfigured = useMemo(() => {
    return !!factoryAddress && factoryAddress !== '0x'
  }, [factoryAddress])

  // Get platform fee
  const getPlatformFee = useCallback(async (): Promise<number> => {
    if (!publicClient || !factoryAddress) return 100 // default 1%

    const fee = await publicClient.readContract({
      address: factoryAddress,
      abi: FairLaunchFactoryABI,
      functionName: 'platformFeeBps',
    })
    return Number(fee)
  }, [publicClient, factoryAddress])

  // Create a new Fair Launch
  const createFairLaunch = useCallback(async (params: CreateFairLaunchParams) => {
    if (!walletClient || !publicClient || !address || !factoryAddress) {
      throw new Error('Wallet not connected or contracts not configured')
    }

    const durationSeconds = params.icoDurationDays * 24 * 60 * 60
    const teamBps = params.teamTokensPercent * 100 // Convert percent to basis points
    const lpBnbBps = (params.lpBnbPercent || 0) * 100 // Convert percent to basis points
    const lpTokensBps = (params.lpTokensPercent || 0) * 100 // Convert percent to basis points

    const launchParams = {
      name: params.name,
      symbol: params.symbol,
      imageURI: params.imageURI,
      description: params.description,
      tokenSupply: parseEther(params.tokenSupply),
      minimumRaise: parseEther(params.minimumRaise),
      icoDuration: BigInt(durationSeconds),
      teamTokensBps: BigInt(teamBps),
      teamWallet: (params.teamWallet || '0x0000000000000000000000000000000000000000') as Address,
      monthlyBudget: params.monthlyBudget ? parseEther(params.monthlyBudget) : BigInt(0),
      treasuryOwner: (params.treasuryOwner || address) as Address,
      lpBnbBps: BigInt(lpBnbBps),
      lpTokensBps: BigInt(lpTokensBps),
    }

    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      address: factoryAddress,
      abi: FairLaunchFactoryABI,
      functionName: 'createFairLaunch',
      args: [launchParams],
      account: address,
    })

    // Execute the transaction
    const txHash = await walletClient.writeContract(request)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    // Parse the FairLaunchCreated event to get addresses
    // For now, return the tx hash and let the indexer pick up the event
    return {
      txHash,
      receipt,
    }
  }, [walletClient, publicClient, address, factoryAddress])

  // Commit BNB to an ICO
  const commit = useCallback(async (icoAddress: Address, amountBnb: string) => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const value = parseEther(amountBnb)

    const { request } = await publicClient.simulateContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'commit',
      account: address,
      value,
    })

    const txHash = await walletClient.writeContract(request)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    return { txHash, receipt }
  }, [walletClient, publicClient, address])

  // Claim tokens after successful ICO
  const claimTokens = useCallback(async (icoAddress: Address) => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const { request } = await publicClient.simulateContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'claimTokens',
      account: address,
    })

    const txHash = await walletClient.writeContract(request)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    return { txHash, receipt }
  }, [walletClient, publicClient, address])

  // Refund after failed ICO
  const refund = useCallback(async (icoAddress: Address) => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const { request } = await publicClient.simulateContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'refund',
      account: address,
    })

    const txHash = await walletClient.writeContract(request)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    return { txHash, receipt }
  }, [walletClient, publicClient, address])

  // Finalize ICO (anyone can call after end time if minimum met)
  const finalize = useCallback(async (icoAddress: Address) => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const { request } = await publicClient.simulateContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'finalize',
      account: address,
    })

    const txHash = await walletClient.writeContract(request)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    return { txHash, receipt }
  }, [walletClient, publicClient, address])

  // Mark ICO as failed (anyone can call after end time if minimum not met)
  const markFailed = useCallback(async (icoAddress: Address) => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const { request } = await publicClient.simulateContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'markFailed',
      account: address,
    })

    const txHash = await walletClient.writeContract(request)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    return { txHash, receipt }
  }, [walletClient, publicClient, address])

  // Get ICO info
  const getICOInfo = useCallback(async (icoAddress: Address): Promise<ICOInfo> => {
    if (!publicClient) {
      throw new Error('Public client not available')
    }

    const info = await publicClient.readContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'getICOInfo',
    })

    return {
      status: info.status,
      totalCommitted: info.totalCommitted,
      tokenPrice: info.tokenPrice,
      participantCount: info.participantCount,
      minimumRaise: info.minimumRaise,
      tokenSupply: info.tokenSupply,
      startTime: info.startTime,
      endTime: info.endTime,
    }
  }, [publicClient])

  // Get user's commitment
  const getUserCommitment = useCallback(async (icoAddress: Address, userAddress?: Address): Promise<bigint> => {
    if (!publicClient) {
      throw new Error('Public client not available')
    }

    const user = userAddress || address
    if (!user) return BigInt(0)

    return publicClient.readContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'commitments',
      args: [user],
    })
  }, [publicClient, address])

  // Check if user has claimed
  const hasUserClaimed = useCallback(async (icoAddress: Address, userAddress?: Address): Promise<boolean> => {
    if (!publicClient) {
      throw new Error('Public client not available')
    }

    const user = userAddress || address
    if (!user) return false

    return publicClient.readContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'hasClaimed',
      args: [user],
    })
  }, [publicClient, address])

  // Get user's allocation
  const getUserAllocation = useCallback(async (icoAddress: Address, userAddress?: Address): Promise<bigint> => {
    if (!publicClient) {
      throw new Error('Public client not available')
    }

    const user = userAddress || address
    if (!user) return BigInt(0)

    return publicClient.readContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'getAllocation',
      args: [user],
    })
  }, [publicClient, address])

  // Check if ICO can be finalized
  const canFinalize = useCallback(async (icoAddress: Address): Promise<boolean> => {
    if (!publicClient) return false

    return publicClient.readContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'canFinalize',
    })
  }, [publicClient])

  // Check if ICO can be marked as failed
  const canMarkFailed = useCallback(async (icoAddress: Address): Promise<boolean> => {
    if (!publicClient) return false

    return publicClient.readContract({
      address: icoAddress,
      abi: ICOContractABI,
      functionName: 'canMarkFailed',
    })
  }, [publicClient])

  return {
    isConnected,
    isConfigured,
    address,
    factoryAddress,
    // Factory functions
    createFairLaunch,
    getPlatformFee,
    // ICO functions
    commit,
    claimTokens,
    refund,
    finalize,
    markFailed,
    // View functions
    getICOInfo,
    getUserCommitment,
    hasUserClaimed,
    getUserAllocation,
    canFinalize,
    canMarkFailed,
  }
}
