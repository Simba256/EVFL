/**
 * Blockchain Event Indexer for RoboLaunch
 *
 * This script indexes blockchain events and stores them in the database:
 * - TokenCreated events from TokenFactory
 * - Swap events from WeightedPool contracts
 * - Transfer events for holder tracking (future)
 *
 * Usage:
 *   npx ts-node scripts/indexer/index.ts
 *   or
 *   npx tsx scripts/indexer/index.ts
 */

import 'dotenv/config'
import { createPublicClient, http, parseAbiItem, formatEther, type Address, type Log } from 'viem'
import { bscTestnet, bsc } from 'viem/chains'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Import Prisma client
import { PrismaClient, TokenStatus } from '../../lib/generated/prisma'

// Contract ABIs (event signatures only)
const TokenCreatedEvent = parseAbiItem(
  'event TokenCreated(address indexed token, address indexed pool, address indexed creator, string name, string symbol, uint256 initialSupply)'
)

const SwapEvent = parseAbiItem(
  'event Swap(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed trader)'
)

// Configuration
const config = {
  chainId: parseInt(process.env.NEXT_PUBLIC_BSC_TESTNET_CHAIN_ID || '97'),
  rpcUrl: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  tokenFactoryAddress: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET as Address,
  wbnbAddress: process.env.NEXT_PUBLIC_WBNB_ADDRESS_TESTNET as Address,
  pollInterval: parseInt(process.env.INDEXER_POLL_INTERVAL || '5000'),
  startBlock: BigInt(process.env.INDEXER_START_BLOCK || '0'),
  enabled: process.env.INDEXER_ENABLED === 'true',
}

// Initialize Prisma client with adapter
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Initialize viem client
const publicClient = createPublicClient({
  chain: config.chainId === 97 ? bscTestnet : bsc,
  transport: http(config.rpcUrl),
})

// Track indexed pools for Swap event monitoring
const indexedPools: Set<string> = new Set()

/**
 * Get the last indexed block for a contract/event
 */
async function getLastIndexedBlock(
  contractAddress: string,
  eventType: string
): Promise<bigint> {
  const state = await prisma.indexerState.findUnique({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: contractAddress.toLowerCase(),
        eventType,
        chainId: config.chainId,
      },
    },
  })
  return state?.lastIndexedBlock ?? config.startBlock
}

/**
 * Update the indexer state after processing
 */
async function updateIndexerState(
  contractAddress: string,
  contractType: string,
  eventType: string,
  blockNumber: bigint,
  txHash?: string
): Promise<void> {
  await prisma.indexerState.upsert({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: contractAddress.toLowerCase(),
        eventType,
        chainId: config.chainId,
      },
    },
    update: {
      lastIndexedBlock: blockNumber,
      lastIndexedTxHash: txHash?.toLowerCase(),
      lastIndexedAt: new Date(),
      lastError: null,
      errorCount: 0,
    },
    create: {
      contractAddress: contractAddress.toLowerCase(),
      contractType,
      eventType,
      chainId: config.chainId,
      lastIndexedBlock: blockNumber,
      lastIndexedTxHash: txHash?.toLowerCase(),
    },
  })
}

/**
 * Record an indexer error
 */
async function recordError(
  contractAddress: string,
  contractType: string,
  eventType: string,
  error: string
): Promise<void> {
  await prisma.indexerState.upsert({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: contractAddress.toLowerCase(),
        eventType,
        chainId: config.chainId,
      },
    },
    update: {
      lastError: error,
      errorCount: { increment: 1 },
    },
    create: {
      contractAddress: contractAddress.toLowerCase(),
      contractType,
      eventType,
      chainId: config.chainId,
      lastIndexedBlock: BigInt(0),
      lastError: error,
      errorCount: 1,
    },
  })
}

/**
 * Process TokenCreated events
 */
async function processTokenCreatedEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
  if (!config.tokenFactoryAddress) {
    console.log('TokenFactory address not configured, skipping TokenCreated indexing')
    return
  }

  console.log(`Fetching TokenCreated events from block ${fromBlock} to ${toBlock}`)

  try {
    const logs = await publicClient.getLogs({
      address: config.tokenFactoryAddress,
      event: TokenCreatedEvent,
      fromBlock,
      toBlock,
    })

    console.log(`Found ${logs.length} TokenCreated events`)

    for (const log of logs) {
      const { token, pool, creator, name, symbol, initialSupply } = log.args as {
        token: Address
        pool: Address
        creator: Address
        name: string
        symbol: string
        initialSupply: bigint
      }

      // Check if token already exists
      const exists = await prisma.token.findUnique({
        where: { tokenAddress: token.toLowerCase() },
      })

      if (!exists) {
        // Get block timestamp
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

        // Create token in database
        await prisma.token.create({
          data: {
            name,
            symbol: symbol.toUpperCase(),
            tokenAddress: token.toLowerCase(),
            poolAddress: pool.toLowerCase(),
            creatorAddress: creator.toLowerCase(),
            totalSupply: initialSupply.toString(),
            decimals: 18,
            status: 'new' as TokenStatus,
            isOnChain: true,
            deployTxHash: log.transactionHash,
            deployedAt: new Date(Number(block.timestamp) * 1000),
          },
        })

        console.log(`Indexed new token: ${symbol} (${token})`)

        // Add pool to monitored pools
        indexedPools.add(pool.toLowerCase())
      }
    }

    // Update indexer state
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1]
      await updateIndexerState(
        config.tokenFactoryAddress,
        'TokenFactory',
        'TokenCreated',
        lastLog.blockNumber,
        lastLog.transactionHash
      )
    } else {
      await updateIndexerState(
        config.tokenFactoryAddress,
        'TokenFactory',
        'TokenCreated',
        toBlock
      )
    }
  } catch (error) {
    console.error('Error processing TokenCreated events:', error)
    await recordError(
      config.tokenFactoryAddress,
      'TokenFactory',
      'TokenCreated',
      (error as Error).message
    )
  }
}

/**
 * Process Swap events for a pool
 */
async function processSwapEvents(
  poolAddress: Address,
  tokenAddress: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  console.log(`Fetching Swap events for pool ${poolAddress} from block ${fromBlock} to ${toBlock}`)

  try {
    const logs = await publicClient.getLogs({
      address: poolAddress,
      event: SwapEvent,
      fromBlock,
      toBlock,
    })

    console.log(`Found ${logs.length} Swap events for pool ${poolAddress}`)

    // Get token from database
    const token = await prisma.token.findUnique({
      where: { tokenAddress: tokenAddress.toLowerCase() },
    })

    if (!token) {
      console.log(`Token not found for address ${tokenAddress}, skipping swaps`)
      return
    }

    for (const log of logs) {
      const { tokenIn, tokenOut, amountIn, amountOut, trader } = log.args as {
        tokenIn: Address
        tokenOut: Address
        amountIn: bigint
        amountOut: bigint
        trader: Address
      }

      // Check if trade already exists
      const exists = await prisma.trade.findUnique({
        where: { txHash: log.transactionHash.toLowerCase() },
      })

      if (!exists) {
        // Determine if this is a buy or sell
        const isBuy = tokenOut.toLowerCase() === tokenAddress.toLowerCase()

        // Get block timestamp
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

        // Calculate price (BNB per token)
        const tokenAmount = isBuy ? amountOut : amountIn
        const bnbAmount = isBuy ? amountIn : amountOut
        const price = tokenAmount > 0n
          ? (Number(formatEther(bnbAmount)) / Number(formatEther(tokenAmount))).toString()
          : '0'

        // Create trade in database
        await prisma.trade.create({
          data: {
            tokenId: token.id,
            tokenAddress: tokenAddress.toLowerCase(),
            type: isBuy ? 'buy' : 'sell',
            traderAddress: trader.toLowerCase(),
            tokenAmount: tokenAmount.toString(),
            bnbAmount: bnbAmount.toString(),
            price,
            txHash: log.transactionHash.toLowerCase(),
            blockNumber: log.blockNumber,
            blockTimestamp: new Date(Number(block.timestamp) * 1000),
            logIndex: log.logIndex,
          },
        })

        console.log(`Indexed ${isBuy ? 'buy' : 'sell'} trade: ${formatEther(tokenAmount)} tokens`)
      }
    }

    // Update indexer state
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1]
      await updateIndexerState(
        poolAddress,
        'WeightedPool',
        'Swap',
        lastLog.blockNumber,
        lastLog.transactionHash
      )
    } else {
      await updateIndexerState(poolAddress, 'WeightedPool', 'Swap', toBlock)
    }
  } catch (error) {
    console.error(`Error processing Swap events for pool ${poolAddress}:`, error)
    await recordError(poolAddress, 'WeightedPool', 'Swap', (error as Error).message)
  }
}

/**
 * Load existing pools from database
 */
async function loadExistingPools(): Promise<void> {
  const tokens = await prisma.token.findMany({
    where: { poolAddress: { not: null } },
    select: { poolAddress: true },
  })

  for (const token of tokens) {
    if (token.poolAddress) {
      indexedPools.add(token.poolAddress.toLowerCase())
    }
  }

  console.log(`Loaded ${indexedPools.size} existing pools to monitor`)
}

/**
 * Main indexer loop
 */
async function runIndexer(): Promise<void> {
  console.log('Starting RoboLaunch Indexer...')
  console.log(`Chain ID: ${config.chainId}`)
  console.log(`TokenFactory: ${config.tokenFactoryAddress}`)
  console.log(`Poll Interval: ${config.pollInterval}ms`)

  // Load existing pools
  await loadExistingPools()

  while (true) {
    try {
      // Get current block
      const currentBlock = await publicClient.getBlockNumber()
      console.log(`\nCurrent block: ${currentBlock}`)

      // Index TokenCreated events
      const lastTokenCreatedBlock = await getLastIndexedBlock(
        config.tokenFactoryAddress,
        'TokenCreated'
      )
      if (currentBlock > lastTokenCreatedBlock) {
        await processTokenCreatedEvents(lastTokenCreatedBlock + 1n, currentBlock)
      }

      // Index Swap events for all pools
      for (const poolAddress of indexedPools) {
        // Get token address for this pool
        const token = await prisma.token.findFirst({
          where: { poolAddress: poolAddress.toLowerCase() },
          select: { tokenAddress: true },
        })

        if (token) {
          const lastSwapBlock = await getLastIndexedBlock(poolAddress, 'Swap')
          if (currentBlock > lastSwapBlock) {
            await processSwapEvents(
              poolAddress as Address,
              token.tokenAddress as Address,
              lastSwapBlock + 1n,
              currentBlock
            )
          }
        }
      }

      console.log(`Indexer cycle complete. Waiting ${config.pollInterval}ms...`)
    } catch (error) {
      console.error('Error in indexer loop:', error)
    }

    // Wait for next poll
    await new Promise((resolve) => setTimeout(resolve, config.pollInterval))
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\nShutting down indexer...')
  await prisma.$disconnect()
  await pool.end()
  process.exit(0)
}

// Handle shutdown signals
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Run the indexer
if (config.enabled) {
  runIndexer().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
} else {
  console.log('Indexer is disabled. Set INDEXER_ENABLED=true to enable.')
  process.exit(0)
}
