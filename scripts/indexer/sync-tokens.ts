/**
 * Sync Tokens Script
 *
 * This script syncs all on-chain tokens to the database.
 * It fetches tokens from the TokenFactory and ensures they exist in the database.
 *
 * Usage:
 *   pnpm run sync:tokens
 */

import 'dotenv/config'
import { createPublicClient, http, parseAbiItem, formatEther, type Address } from 'viem'
import { bscTestnet } from 'viem/chains'
import { prisma } from '@/lib/db/prisma'
import { TokenFactoryABI, WeightedPoolABI } from '@/lib/blockchain/abis'
import { getContractAddresses } from '@/lib/blockchain/config/contracts'

// Create a public client for BSC Testnet
const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
})

interface OnChainTokenInfo {
  token: `0x${string}`
  pool: `0x${string}`
  creator: `0x${string}`
  name: string
  symbol: string
  initialSupply: bigint
  createdAt: bigint
}

// Transfer event signature
const TransferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const BLOCK_BATCH_SIZE = 2000n

interface HolderBalance {
  balance: bigint
  lastUpdatedBlock: bigint
}

async function backfillHoldersForToken(
  tokenAddress: Address,
  tokenId: string,
  totalSupply: string,
  fromBlock: bigint
): Promise<number> {
  console.log(`  Backfilling holders from block ${fromBlock}...`)

  const currentBlock = await publicClient.getBlockNumber()
  const balances = new Map<string, HolderBalance>()
  const totalSupplyBigInt = BigInt(totalSupply)

  let processedEvents = 0
  let startBlock = fromBlock

  while (startBlock <= currentBlock) {
    const endBlock = startBlock + BLOCK_BATCH_SIZE > currentBlock
      ? currentBlock
      : startBlock + BLOCK_BATCH_SIZE

    try {
      const logs = await publicClient.getLogs({
        address: tokenAddress,
        event: TransferEvent,
        fromBlock: startBlock,
        toBlock: endBlock,
      })

      for (const log of logs) {
        const from = (log.args.from as string).toLowerCase()
        const to = (log.args.to as string).toLowerCase()
        const value = log.args.value as bigint
        const blockNumber = log.blockNumber

        if (from !== ZERO_ADDRESS) {
          const existing = balances.get(from)
          if (existing) {
            existing.balance -= value
            existing.lastUpdatedBlock = blockNumber
            if (existing.balance <= 0n) {
              balances.delete(from)
            }
          }
        }

        if (to !== ZERO_ADDRESS) {
          const existing = balances.get(to)
          if (existing) {
            existing.balance += value
            existing.lastUpdatedBlock = blockNumber
          } else {
            balances.set(to, {
              balance: value,
              lastUpdatedBlock: blockNumber,
            })
          }
        }

        processedEvents++
      }
    } catch (error) {
      console.error(`  Error fetching logs:`, error)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    startBlock = endBlock + 1n
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log(`  Found ${processedEvents} transfer events, ${balances.size} holders`)

  // Save holders to database
  for (const [holderAddress, data] of balances) {
    if (data.balance <= 0n) continue

    const percentage = totalSupplyBigInt > 0n
      ? Number((data.balance * 10000n) / totalSupplyBigInt) / 100
      : 0

    await prisma.tokenHolder.upsert({
      where: {
        tokenId_holderAddress: { tokenId, holderAddress },
      },
      update: {
        balance: data.balance.toString(),
        percentage,
        lastUpdatedBlock: data.lastUpdatedBlock,
        lastUpdatedAt: new Date(),
      },
      create: {
        tokenId,
        tokenAddress: tokenAddress.toLowerCase(),
        holderAddress,
        balance: data.balance.toString(),
        percentage,
        lastUpdatedBlock: data.lastUpdatedBlock,
      },
    })
  }

  // Update holder count
  const holdersCount = await prisma.tokenHolder.count({ where: { tokenId } })
  await prisma.token.update({
    where: { id: tokenId },
    data: { holdersCount },
  })

  // Update indexer state
  const chainId = 97
  await prisma.indexerState.upsert({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: tokenAddress.toLowerCase(),
        eventType: 'Transfer',
        chainId,
      },
    },
    update: {
      lastIndexedBlock: currentBlock,
      lastIndexedAt: new Date(),
    },
    create: {
      contractAddress: tokenAddress.toLowerCase(),
      contractType: 'Token',
      eventType: 'Transfer',
      chainId,
      lastIndexedBlock: currentBlock,
      lastIndexedAt: new Date(),
    },
  })

  return holdersCount
}

async function main() {
  console.log('='.repeat(60))
  console.log('TOKEN SYNC SCRIPT')
  console.log('='.repeat(60))

  const addresses = getContractAddresses(97)
  console.log(`\nTokenFactory: ${addresses.tokenFactory}`)

  // Get all on-chain tokens
  const onChainTokens = await publicClient.readContract({
    address: addresses.tokenFactory,
    abi: TokenFactoryABI,
    functionName: 'getAllTokens',
  }) as `0x${string}`[]

  console.log(`Found ${onChainTokens.length} on-chain tokens\n`)

  for (const tokenAddr of onChainTokens) {
    console.log(`\nProcessing ${tokenAddr}...`)

    // Check if already in database
    const existingToken = await prisma.token.findFirst({
      where: { tokenAddress: { equals: tokenAddr, mode: 'insensitive' } },
    })

    if (existingToken) {
      console.log(`  Already in database: ${existingToken.symbol} (holdersCount=${existingToken.holdersCount})`)

      // Check if we need to backfill
      if (existingToken.holdersCount === 0 || existingToken.holdersCount === 1) {
        // Use early block to catch all events
        const fromBlock = 85000000n

        const count = await backfillHoldersForToken(
          tokenAddr,
          existingToken.id,
          existingToken.totalSupply,
          fromBlock
        )
        console.log(`  Updated holder count: ${count}`)
      }
      continue
    }

    // Fetch token info from blockchain
    console.log(`  Fetching token info...`)
    const info = await publicClient.readContract({
      address: addresses.tokenFactory,
      abi: TokenFactoryABI,
      functionName: 'getTokenInfo',
      args: [tokenAddr],
    }) as OnChainTokenInfo

    console.log(`  Name: ${info.name}, Symbol: ${info.symbol}`)

    // Create token in database
    const token = await prisma.token.create({
      data: {
        name: info.name,
        symbol: info.symbol,
        description: `Launched on RoboLaunch with Balancer-style weighted pool.`,
        tokenAddress: tokenAddr.toLowerCase(),
        poolAddress: info.pool.toLowerCase(),
        creatorAddress: info.creator.toLowerCase(),
        totalSupply: info.initialSupply.toString(),
        isOnChain: true,
        holdersCount: 1, // Will be updated by backfill
        change24h: 0,
        volume24h: '0',
      },
    })

    console.log(`  Created in database with id: ${token.id}`)

    // Use a safe early block to catch all events (block estimation was unreliable)
    const fromBlock = 85000000n

    // Backfill holders
    const count = await backfillHoldersForToken(
      tokenAddr,
      token.id,
      info.initialSupply.toString(),
      fromBlock
    )
    console.log(`  Holder count: ${count}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('SYNC COMPLETE')
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('Fatal error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
