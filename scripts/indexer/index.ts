/**
 * Blockchain Event Indexer for RoboLaunch
 *
 * This script indexes blockchain events and stores them in the database:
 * - TokenCreated events from TokenFactory
 * - Swap events from WeightedPool contracts
 * - Transfer events for holder tracking
 *
 * Usage:
 *   npx ts-node scripts/indexer/index.ts
 *   or
 *   npx tsx scripts/indexer/index.ts
 */

import 'dotenv/config'
import { createPublicClient, http, fallback, parseAbiItem, formatEther, type Address, type Log } from 'viem'
import { bscTestnet, bsc } from 'viem/chains'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Import Prisma client
import { PrismaClient, TokenStatus } from '../../lib/generated/prisma'

// Import OHLCV candle update function
import { updateCandleWithTrade } from '../../lib/db/price-history'

// Import metrics refresh function
import { refreshAllTokenMetrics } from './refresh-metrics'

// Import health check server
import { startHealthServer, markHealthy, markUnhealthy, setPrismaClient } from './health'

// Import Fair Launch indexer
import {
  processFairLaunchCreatedEvents,
  processICOEvents,
  loadExistingFairLaunches,
  getLastFairLaunchCreatedBlock,
  getLastICOEventBlock,
  indexedICOs,
} from './fair-launch'

// Contract ABIs (event signatures only)
const TokenCreatedEvent = parseAbiItem(
  'event TokenCreated(address indexed token, address indexed pool, address indexed creator, string name, string symbol, uint256 initialSupply)'
)

const SwapEvent = parseAbiItem(
  'event Swap(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed trader)'
)

const TransferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)

// BSC Testnet RPC endpoints (fallback order)
const BSC_TESTNET_RPCS = [
  process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  'https://data-seed-prebsc-2-s1.bnbchain.org:8545',
  'https://data-seed-prebsc-1-s2.bnbchain.org:8545',
  'https://data-seed-prebsc-2-s2.bnbchain.org:8545',
  'https://bsc-testnet-rpc.publicnode.com',
].filter(Boolean) as string[]

// Configuration
const config = {
  chainId: parseInt(process.env.NEXT_PUBLIC_BSC_TESTNET_CHAIN_ID || '97'),
  rpcUrls: BSC_TESTNET_RPCS,
  tokenFactoryAddress: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET as Address,
  fairLaunchFactoryAddress: process.env.NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_ADDRESS_TESTNET as Address,
  wbnbAddress: process.env.NEXT_PUBLIC_WBNB_ADDRESS_TESTNET as Address,
  pollInterval: parseInt(process.env.INDEXER_POLL_INTERVAL || '10000'), // Default 10s instead of 5s
  startBlock: BigInt(process.env.INDEXER_START_BLOCK || '0'),
  // Fair Launch factory was deployed on 2026-02-12, use a recent start block
  fairLaunchStartBlock: BigInt(process.env.FAIR_LAUNCH_START_BLOCK || '90100000'),
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

// Initialize viem client with fallback RPCs
const publicClient = createPublicClient({
  chain: config.chainId === 97 ? bscTestnet : bsc,
  transport: fallback(
    config.rpcUrls.map(url => http(url, {
      timeout: 10000,
      retryCount: 2,
      retryDelay: 1000,
    })),
    { rank: true } // Auto-rank RPCs by latency
  ),
})

console.log(`Configured ${config.rpcUrls.length} RPC endpoints with fallback`)

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
        const tradeTimestamp = new Date(Number(block.timestamp) * 1000)
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
            blockTimestamp: tradeTimestamp,
            logIndex: log.logIndex,
          },
        })

        // Update OHLCV candles for all intervals
        await updateCandleWithTrade(
          token.id,
          price,
          formatEther(bnbAmount), // volume in BNB
          tradeTimestamp
        )

        console.log(`Indexed ${isBuy ? 'buy' : 'sell'} trade: ${formatEther(tokenAmount)} tokens @ ${price} BNB`)
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

// Zero address for mint/burn detection
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Process Transfer events for holder tracking
 */
async function processTransferEvents(
  tokenAddress: Address,
  tokenId: string,
  totalSupply: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  console.log(`Fetching Transfer events for token ${tokenAddress} from block ${fromBlock} to ${toBlock}`)

  try {
    const logs = await publicClient.getLogs({
      address: tokenAddress,
      event: TransferEvent,
      fromBlock,
      toBlock,
    })

    console.log(`Found ${logs.length} Transfer events for token ${tokenAddress}`)

    if (logs.length === 0) {
      // Update indexer state even if no events
      await updateIndexerState(tokenAddress, 'Token', 'Transfer', toBlock)
      return
    }

    const totalSupplyBigInt = BigInt(totalSupply)

    for (const log of logs) {
      const { from, to, value } = log.args as {
        from: Address
        to: Address
        value: bigint
      }

      const fromLower = from.toLowerCase()
      const toLower = to.toLowerCase()
      const valueStr = value.toString()

      // Update sender balance (if not mint from zero address)
      if (fromLower !== ZERO_ADDRESS) {
        const existingFrom = await prisma.tokenHolder.findUnique({
          where: {
            tokenId_holderAddress: {
              tokenId,
              holderAddress: fromLower,
            },
          },
        })

        if (existingFrom) {
          const newBalance = BigInt(existingFrom.balance) - value
          if (newBalance <= 0n) {
            // Remove holder if balance is zero or negative
            await prisma.tokenHolder.delete({
              where: { id: existingFrom.id },
            })
            console.log(`Removed holder ${fromLower} (balance: 0)`)
          } else {
            // Update balance
            const percentage = totalSupplyBigInt > 0n
              ? Number((newBalance * 10000n) / totalSupplyBigInt) / 100
              : 0
            await prisma.tokenHolder.update({
              where: { id: existingFrom.id },
              data: {
                balance: newBalance.toString(),
                percentage,
                lastUpdatedBlock: log.blockNumber,
                lastUpdatedAt: new Date(),
              },
            })
          }
        }
      }

      // Update receiver balance (if not burn to zero address)
      if (toLower !== ZERO_ADDRESS) {
        const existingTo = await prisma.tokenHolder.findUnique({
          where: {
            tokenId_holderAddress: {
              tokenId,
              holderAddress: toLower,
            },
          },
        })

        if (existingTo) {
          // Update existing holder
          const newBalance = BigInt(existingTo.balance) + value
          const percentage = totalSupplyBigInt > 0n
            ? Number((newBalance * 10000n) / totalSupplyBigInt) / 100
            : 0
          await prisma.tokenHolder.update({
            where: { id: existingTo.id },
            data: {
              balance: newBalance.toString(),
              percentage,
              lastUpdatedBlock: log.blockNumber,
              lastUpdatedAt: new Date(),
            },
          })
        } else {
          // Create new holder
          const percentage = totalSupplyBigInt > 0n
            ? Number((value * 10000n) / totalSupplyBigInt) / 100
            : 0
          await prisma.tokenHolder.create({
            data: {
              tokenId,
              tokenAddress: tokenAddress.toLowerCase(),
              holderAddress: toLower,
              balance: valueStr,
              percentage,
              lastUpdatedBlock: log.blockNumber,
            },
          })
          console.log(`Added new holder ${toLower}`)
        }
      }
    }

    // Update holders count on the token
    const holdersCount = await prisma.tokenHolder.count({
      where: { tokenId },
    })
    await prisma.token.update({
      where: { id: tokenId },
      data: { holdersCount },
    })
    console.log(`Updated holders count for token: ${holdersCount}`)

    // Update indexer state
    const lastLog = logs[logs.length - 1]
    await updateIndexerState(
      tokenAddress,
      'Token',
      'Transfer',
      lastLog.blockNumber,
      lastLog.transactionHash
    )
  } catch (error) {
    console.error(`Error processing Transfer events for token ${tokenAddress}:`, error)
    await recordError(tokenAddress, 'Token', 'Transfer', (error as Error).message)
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
  console.log(`FairLaunchFactory: ${config.fairLaunchFactoryAddress}`)
  console.log(`Poll Interval: ${config.pollInterval}ms`)

  // Start health check server
  // Railway sets PORT automatically, fall back to HEALTH_PORT or 8080
  const healthPort = parseInt(process.env.PORT || process.env.HEALTH_PORT || '8080')
  setPrismaClient(prisma)
  startHealthServer(healthPort)

  // Load existing pools
  await loadExistingPools()

  // Load existing Fair Launches
  await loadExistingFairLaunches(prisma)

  // Cycle counter for periodic tasks
  let cycleCount = 0
  const metricsRefreshInterval = 12 // Refresh every 12 cycles (60s at 5s poll interval)

  while (true) {
    cycleCount++
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

      // Index Transfer events for all on-chain tokens (holder tracking)
      const onChainTokens = await prisma.token.findMany({
        where: { isOnChain: true },
        select: { id: true, tokenAddress: true, totalSupply: true },
      })

      for (const token of onChainTokens) {
        const lastTransferBlock = await getLastIndexedBlock(token.tokenAddress, 'Transfer')
        if (currentBlock > lastTransferBlock) {
          await processTransferEvents(
            token.tokenAddress as Address,
            token.id,
            token.totalSupply,
            lastTransferBlock + 1n,
            currentBlock
          )
        }
      }

      // ============ Fair Launch Indexing ============

      // Index FairLaunchCreated events
      if (config.fairLaunchFactoryAddress) {
        const lastFairLaunchBlock = await getLastFairLaunchCreatedBlock(
          prisma,
          config.fairLaunchFactoryAddress,
          config.chainId,
          config.fairLaunchStartBlock
        )
        if (currentBlock > lastFairLaunchBlock) {
          await processFairLaunchCreatedEvents(
            prisma,
            publicClient,
            config.fairLaunchFactoryAddress,
            config.chainId,
            lastFairLaunchBlock + 1n,
            currentBlock,
            config.fairLaunchStartBlock
          )
        }
      }

      // Index ICO events for all monitored Fair Launches
      for (const icoAddress of indexedICOs) {
        // Use the minimum block from all event types as starting point
        const lastCommittedBlock = await getLastICOEventBlock(
          prisma,
          icoAddress,
          'Committed',
          config.chainId,
          config.fairLaunchStartBlock
        )

        if (currentBlock > lastCommittedBlock) {
          await processICOEvents(
            prisma,
            publicClient,
            icoAddress as Address,
            config.chainId,
            lastCommittedBlock + 1n,
            currentBlock
          )
        }
      }

      // Refresh token metrics periodically (every 60s by default)
      if (cycleCount % metricsRefreshInterval === 0) {
        console.log('\nRunning periodic metrics refresh...')
        try {
          await refreshAllTokenMetrics(prisma)
        } catch (error) {
          console.error('Error refreshing metrics:', error)
        }
      }

      // Mark indexer as healthy
      markHealthy(currentBlock, cycleCount)

      console.log(`Indexer cycle ${cycleCount} complete. Waiting ${config.pollInterval}ms...`)
    } catch (error) {
      console.error('Error in indexer loop:', error)
      markUnhealthy((error as Error).message)
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
