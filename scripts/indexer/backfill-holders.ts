/**
 * Backfill Holders Script
 *
 * This script fetches ALL historical Transfer events for tokens
 * and rebuilds the holder data from scratch.
 *
 * Usage:
 *   pnpm run backfill:holders
 *
 * Options:
 *   --token=0x... - Backfill only a specific token
 *   --reset       - Clear existing holder data before backfilling
 */

import 'dotenv/config'
import { createPublicClient, http, parseAbiItem, formatEther, type Address } from 'viem'
import { bscTestnet } from 'viem/chains'
import { prisma } from '@/lib/db/prisma'

// Transfer event signature
const TransferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)

// Zero address for mint/burn detection
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// Create a public client for BSC Testnet
const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
})

// Batch size for fetching logs (to avoid RPC limits)
const BLOCK_BATCH_SIZE = 5000n

interface HolderBalance {
  balance: bigint
  firstPurchasedAt: Date
}

async function backfillTokenHolders(
  tokenAddress: Address,
  tokenId: string,
  totalSupply: string,
  fromBlock: bigint,
  reset: boolean
): Promise<number> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Backfilling holders for token: ${tokenAddress}`)
  console.log(`From block: ${fromBlock}`)

  // Clear existing holder data if reset flag is set
  if (reset) {
    const deleted = await prisma.tokenHolder.deleteMany({
      where: { tokenId }
    })
    console.log(`Cleared ${deleted.count} existing holder records`)
  }

  // Get current block
  const currentBlock = await publicClient.getBlockNumber()
  console.log(`Current block: ${currentBlock}`)

  // Track balances in memory for efficiency
  const balances = new Map<string, HolderBalance>()
  const totalSupplyBigInt = BigInt(totalSupply)

  // Fetch logs in batches
  let processedEvents = 0
  let startBlock = fromBlock

  while (startBlock <= currentBlock) {
    const endBlock = startBlock + BLOCK_BATCH_SIZE > currentBlock
      ? currentBlock
      : startBlock + BLOCK_BATCH_SIZE

    console.log(`Fetching blocks ${startBlock} to ${endBlock}...`)

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

        // Get block timestamp for firstPurchasedAt
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
        const timestamp = new Date(Number(block.timestamp) * 1000)

        // Update sender balance (if not mint)
        if (from !== ZERO_ADDRESS) {
          const existing = balances.get(from)
          if (existing) {
            existing.balance -= value
            if (existing.balance <= 0n) {
              balances.delete(from)
            }
          }
        }

        // Update receiver balance (if not burn)
        if (to !== ZERO_ADDRESS) {
          const existing = balances.get(to)
          if (existing) {
            existing.balance += value
          } else {
            balances.set(to, {
              balance: value,
              firstPurchasedAt: timestamp,
            })
          }
        }

        processedEvents++
      }

      console.log(`  Processed ${logs.length} events (total: ${processedEvents})`)
    } catch (error) {
      console.error(`Error fetching logs for blocks ${startBlock}-${endBlock}:`, error)
      // Wait and retry with smaller batch on error
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    startBlock = endBlock + 1n

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Save all holders to database
  console.log(`\nSaving ${balances.size} holders to database...`)

  let savedCount = 0
  for (const [holderAddress, data] of balances) {
    if (data.balance <= 0n) continue

    const percentage = totalSupplyBigInt > 0n
      ? Number((data.balance * 10000n) / totalSupplyBigInt) / 100
      : 0

    try {
      await prisma.tokenHolder.upsert({
        where: {
          tokenId_holderAddress: {
            tokenId,
            holderAddress,
          },
        },
        update: {
          balance: data.balance.toString(),
          percentage,
        },
        create: {
          tokenId,
          tokenAddress: tokenAddress.toLowerCase(),
          holderAddress,
          balance: data.balance.toString(),
          percentage,
          firstPurchasedAt: data.firstPurchasedAt,
        },
      })
      savedCount++
    } catch (error) {
      console.error(`Error saving holder ${holderAddress}:`, error)
    }
  }

  // Update token holder count
  const holdersCount = await prisma.tokenHolder.count({
    where: { tokenId },
  })

  await prisma.token.update({
    where: { id: tokenId },
    data: { holdersCount },
  })

  console.log(`Saved ${savedCount} holders. Total holder count: ${holdersCount}`)

  // Update indexer state so regular indexer continues from here
  await prisma.indexerState.upsert({
    where: {
      contractAddress_eventType: {
        contractAddress: tokenAddress.toLowerCase(),
        eventType: 'Transfer',
      },
    },
    update: {
      lastBlockNumber: currentBlock,
      lastUpdatedAt: new Date(),
    },
    create: {
      contractAddress: tokenAddress.toLowerCase(),
      contractType: 'Token',
      eventType: 'Transfer',
      lastBlockNumber: currentBlock,
      lastUpdatedAt: new Date(),
    },
  })

  return holdersCount
}

async function main() {
  console.log('='.repeat(60))
  console.log('HOLDER BACKFILL SCRIPT')
  console.log('='.repeat(60))

  // Parse command line arguments
  const args = process.argv.slice(2)
  const tokenArg = args.find(a => a.startsWith('--token='))
  const specificToken = tokenArg ? tokenArg.split('=')[1] : null
  const reset = args.includes('--reset')

  console.log(`Options:`)
  console.log(`  Specific token: ${specificToken || 'All tokens'}`)
  console.log(`  Reset existing data: ${reset}`)

  // Get tokens to backfill
  let tokens
  if (specificToken) {
    tokens = await prisma.token.findMany({
      where: {
        tokenAddress: { equals: specificToken.toLowerCase(), mode: 'insensitive' }
      },
    })
    if (tokens.length === 0) {
      console.error(`Token not found: ${specificToken}`)
      process.exit(1)
    }
  } else {
    tokens = await prisma.token.findMany({
      where: { isOnChain: true },
    })
  }

  console.log(`\nFound ${tokens.length} tokens to backfill`)

  // Backfill each token
  let totalHolders = 0
  for (const token of tokens) {
    try {
      // Try to get deploy block from transaction
      let fromBlock = 0n
      if (token.deployTxHash) {
        try {
          const tx = await publicClient.getTransaction({
            hash: token.deployTxHash as `0x${string}`
          })
          fromBlock = tx.blockNumber
          console.log(`Found deploy block from tx: ${fromBlock}`)
        } catch {
          console.log(`Could not get deploy block from tx, starting from block 0`)
        }
      }

      const holders = await backfillTokenHolders(
        token.tokenAddress as Address,
        token.id,
        token.totalSupply,
        fromBlock,
        reset
      )
      totalHolders += holders
    } catch (error) {
      console.error(`Error backfilling token ${token.tokenAddress}:`, error)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('BACKFILL COMPLETE')
  console.log('='.repeat(60))
  console.log(`Total tokens processed: ${tokens.length}`)
  console.log(`Total holders found: ${totalHolders}`)

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('Fatal error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
