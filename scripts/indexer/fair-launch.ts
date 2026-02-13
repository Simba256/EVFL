/**
 * Fair Launch Indexer Module
 *
 * Indexes events from FairLaunchFactory and ICOContract:
 * - FairLaunchCreated from FairLaunchFactory
 * - Committed, Finalized, ICOFailed, TokensClaimed, Refunded from ICOContract
 */

import { parseAbiItem, formatEther, type Address, type PublicClient } from 'viem'
import type { PrismaClient, ICOStatus } from '../../lib/generated/prisma'

// Event ABIs
export const FairLaunchCreatedEvent = parseAbiItem(
  'event FairLaunchCreated(address indexed ico, address indexed token, address indexed treasury, address timelock, address creator, uint256 tokenSupply, uint256 minimumRaise, uint256 startTime, uint256 endTime)'
)

export const CommittedEvent = parseAbiItem(
  'event Committed(address indexed user, uint256 amount, uint256 totalUserCommitment)'
)

export const FinalizedEvent = parseAbiItem(
  'event Finalized(uint256 totalRaised, uint256 tokenPrice, uint256 participantCount)'
)

export const ICOFailedEvent = parseAbiItem(
  'event ICOFailed(uint256 totalCommitted, uint256 minimumRequired)'
)

export const TokensClaimedEvent = parseAbiItem(
  'event TokensClaimed(address indexed user, uint256 allocation)'
)

export const RefundedEvent = parseAbiItem(
  'event Refunded(address indexed user, uint256 amount)'
)

// Contract ABI for reading token metadata
const LaunchTokenABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'tokenURI', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
]

// Track indexed ICOs for event monitoring
export const indexedICOs: Set<string> = new Set()

/**
 * Get indexer state helpers
 */
async function getLastIndexedBlock(
  prisma: PrismaClient,
  contractAddress: string,
  eventType: string,
  chainId: number,
  startBlock: bigint
): Promise<bigint> {
  const state = await prisma.indexerState.findUnique({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: contractAddress.toLowerCase(),
        eventType,
        chainId,
      },
    },
  })
  return state?.lastIndexedBlock ?? startBlock
}

async function updateIndexerState(
  prisma: PrismaClient,
  contractAddress: string,
  contractType: string,
  eventType: string,
  chainId: number,
  blockNumber: bigint,
  txHash?: string
): Promise<void> {
  await prisma.indexerState.upsert({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: contractAddress.toLowerCase(),
        eventType,
        chainId,
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
      chainId,
      lastIndexedBlock: blockNumber,
      lastIndexedTxHash: txHash?.toLowerCase(),
    },
  })
}

async function recordError(
  prisma: PrismaClient,
  contractAddress: string,
  contractType: string,
  eventType: string,
  chainId: number,
  error: string
): Promise<void> {
  await prisma.indexerState.upsert({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: contractAddress.toLowerCase(),
        eventType,
        chainId,
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
      chainId,
      lastIndexedBlock: BigInt(0),
      lastError: error,
      errorCount: 1,
    },
  })
}

/**
 * Process FairLaunchCreated events from FairLaunchFactory
 */
export async function processFairLaunchCreatedEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  factoryAddress: Address,
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint,
  startBlock: bigint
): Promise<void> {
  console.log(`Fetching FairLaunchCreated events from block ${fromBlock} to ${toBlock}`)

  try {
    const logs = await publicClient.getLogs({
      address: factoryAddress,
      event: FairLaunchCreatedEvent,
      fromBlock,
      toBlock,
    })

    console.log(`Found ${logs.length} FairLaunchCreated events`)

    for (const log of logs) {
      const { ico, token, treasury, timelock, creator, tokenSupply, minimumRaise, startTime, endTime } = log.args as {
        ico: Address
        token: Address
        treasury: Address
        timelock: Address
        creator: Address
        tokenSupply: bigint
        minimumRaise: bigint
        startTime: bigint
        endTime: bigint
      }

      // Check if ICO already exists
      const exists = await prisma.fairLaunch.findUnique({
        where: { icoAddress: ico.toLowerCase() },
      })

      if (!exists) {
        // Fetch token metadata from contract
        let name = 'Unknown Token'
        let symbol = 'UNKNOWN'
        let imageURI = ''

        try {
          // Use type assertion to avoid viem's strict typing issues
          const client = publicClient as any
          const [nameResult, symbolResult, uriResult] = await Promise.all([
            client.readContract({
              address: token,
              abi: LaunchTokenABI,
              functionName: 'name',
            }),
            client.readContract({
              address: token,
              abi: LaunchTokenABI,
              functionName: 'symbol',
            }),
            client.readContract({
              address: token,
              abi: LaunchTokenABI,
              functionName: 'tokenURI',
            }),
          ])
          name = nameResult as string
          symbol = symbolResult as string
          imageURI = (uriResult as string) || ''
        } catch (e) {
          console.warn(`Could not fetch token metadata for ${token}:`, e)
        }

        // Create Fair Launch in database
        await prisma.fairLaunch.create({
          data: {
            icoAddress: ico.toLowerCase(),
            tokenAddress: token.toLowerCase(),
            treasuryAddress: treasury.toLowerCase(),
            timelockAddress: timelock.toLowerCase(),
            creatorAddress: creator.toLowerCase(),
            name,
            symbol: symbol.toUpperCase(),
            imageURI,
            tokenSupply: tokenSupply.toString(),
            minimumRaise: minimumRaise.toString(),
            startTime: new Date(Number(startTime) * 1000),
            endTime: new Date(Number(endTime) * 1000),
            status: 'PENDING',
            deployTxHash: log.transactionHash,
          },
        })

        console.log(`Indexed new Fair Launch: ${symbol} (${ico})`)

        // Add ICO to monitored set
        indexedICOs.add(ico.toLowerCase())
      }
    }

    // Update indexer state
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1]
      await updateIndexerState(
        prisma,
        factoryAddress,
        'FairLaunchFactory',
        'FairLaunchCreated',
        chainId,
        lastLog.blockNumber,
        lastLog.transactionHash
      )
    } else {
      await updateIndexerState(prisma, factoryAddress, 'FairLaunchFactory', 'FairLaunchCreated', chainId, toBlock)
    }
  } catch (error) {
    console.error('Error processing FairLaunchCreated events:', error)
    await recordError(prisma, factoryAddress, 'FairLaunchFactory', 'FairLaunchCreated', chainId, (error as Error).message)
  }
}

/**
 * Process ICO events (Committed, Finalized, ICOFailed, TokensClaimed, Refunded)
 */
export async function processICOEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  icoAddress: Address,
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  // Get the Fair Launch from database
  const fairLaunch = await prisma.fairLaunch.findUnique({
    where: { icoAddress: icoAddress.toLowerCase() },
  })

  if (!fairLaunch) {
    console.log(`Fair Launch not found for ICO ${icoAddress}, skipping`)
    return
  }

  // Process each event type
  await processCommittedEvents(prisma, publicClient, icoAddress, fairLaunch.id, chainId, fromBlock, toBlock)
  await processFinalizedEvents(prisma, publicClient, icoAddress, fairLaunch.id, chainId, fromBlock, toBlock)
  await processICOFailedEvents(prisma, publicClient, icoAddress, fairLaunch.id, chainId, fromBlock, toBlock)
  await processTokensClaimedEvents(prisma, publicClient, icoAddress, fairLaunch.id, chainId, fromBlock, toBlock)
  await processRefundedEvents(prisma, publicClient, icoAddress, fairLaunch.id, chainId, fromBlock, toBlock)
}

/**
 * Process Committed events
 */
async function processCommittedEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  icoAddress: Address,
  fairLaunchId: string,
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  try {
    const logs = await publicClient.getLogs({
      address: icoAddress,
      event: CommittedEvent,
      fromBlock,
      toBlock,
    })

    if (logs.length === 0) {
      await updateIndexerState(prisma, icoAddress, 'ICOContract', 'Committed', chainId, toBlock)
      return
    }

    console.log(`Found ${logs.length} Committed events for ICO ${icoAddress}`)

    for (const log of logs) {
      const { user, amount, totalUserCommitment } = log.args as {
        user: Address
        amount: bigint
        totalUserCommitment: bigint
      }

      const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

      // Upsert commitment (accumulates across multiple commits)
      await prisma.commitment.upsert({
        where: {
          fairLaunchId_userAddress: {
            fairLaunchId,
            userAddress: user.toLowerCase(),
          },
        },
        update: {
          amount: totalUserCommitment.toString(),
          lastTxHash: log.transactionHash,
          lastBlockNumber: log.blockNumber,
          lastBlockTime: new Date(Number(block.timestamp) * 1000),
        },
        create: {
          fairLaunchId,
          icoAddress: icoAddress.toLowerCase(),
          userAddress: user.toLowerCase(),
          amount: totalUserCommitment.toString(),
          lastTxHash: log.transactionHash,
          lastBlockNumber: log.blockNumber,
          lastBlockTime: new Date(Number(block.timestamp) * 1000),
        },
      })

      console.log(`Commitment: ${user} committed ${formatEther(amount)} BNB (total: ${formatEther(totalUserCommitment)})`)
    }

    // Update Fair Launch totals
    const commitments = await prisma.commitment.findMany({
      where: { fairLaunchId },
    })

    const totalCommitted = commitments.reduce(
      (sum, c) => sum + BigInt(c.amount),
      BigInt(0)
    )

    await prisma.fairLaunch.update({
      where: { id: fairLaunchId },
      data: {
        status: 'ACTIVE' as ICOStatus,
        totalCommitted: totalCommitted.toString(),
        participantCount: commitments.length,
      },
    })

    // Update indexer state
    const lastLog = logs[logs.length - 1]
    await updateIndexerState(
      prisma,
      icoAddress,
      'ICOContract',
      'Committed',
      chainId,
      lastLog.blockNumber,
      lastLog.transactionHash
    )
  } catch (error) {
    console.error(`Error processing Committed events for ${icoAddress}:`, error)
    await recordError(prisma, icoAddress, 'ICOContract', 'Committed', chainId, (error as Error).message)
  }
}

/**
 * Process Finalized events
 */
async function processFinalizedEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  icoAddress: Address,
  fairLaunchId: string,
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  try {
    const logs = await publicClient.getLogs({
      address: icoAddress,
      event: FinalizedEvent,
      fromBlock,
      toBlock,
    })

    if (logs.length === 0) {
      await updateIndexerState(prisma, icoAddress, 'ICOContract', 'Finalized', chainId, toBlock)
      return
    }

    console.log(`Found ${logs.length} Finalized events for ICO ${icoAddress}`)

    for (const log of logs) {
      const { totalRaised, tokenPrice, participantCount } = log.args as {
        totalRaised: bigint
        tokenPrice: bigint
        participantCount: bigint
      }

      const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

      // Update Fair Launch status
      await prisma.fairLaunch.update({
        where: { id: fairLaunchId },
        data: {
          status: 'FINALIZED' as ICOStatus,
          totalCommitted: totalRaised.toString(),
          tokenPrice: tokenPrice.toString(),
          participantCount: Number(participantCount),
          finalizedAt: new Date(Number(block.timestamp) * 1000),
          finalizeTxHash: log.transactionHash,
        },
      })

      // Calculate allocations for all commitments
      const fairLaunch = await prisma.fairLaunch.findUnique({
        where: { id: fairLaunchId },
      })

      if (fairLaunch) {
        const tokenSupply = BigInt(fairLaunch.tokenSupply)
        const commitments = await prisma.commitment.findMany({
          where: { fairLaunchId },
        })

        for (const commitment of commitments) {
          const userCommitment = BigInt(commitment.amount)
          const allocation = (userCommitment * tokenSupply) / totalRaised
          await prisma.commitment.update({
            where: { id: commitment.id },
            data: { allocation: allocation.toString() },
          })
        }
      }

      console.log(`ICO Finalized: ${formatEther(totalRaised)} BNB raised, ${participantCount} participants`)
    }

    // Update indexer state
    const lastLog = logs[logs.length - 1]
    await updateIndexerState(
      prisma,
      icoAddress,
      'ICOContract',
      'Finalized',
      chainId,
      lastLog.blockNumber,
      lastLog.transactionHash
    )
  } catch (error) {
    console.error(`Error processing Finalized events for ${icoAddress}:`, error)
    await recordError(prisma, icoAddress, 'ICOContract', 'Finalized', chainId, (error as Error).message)
  }
}

/**
 * Process ICOFailed events
 */
async function processICOFailedEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  icoAddress: Address,
  fairLaunchId: string,
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  try {
    const logs = await publicClient.getLogs({
      address: icoAddress,
      event: ICOFailedEvent,
      fromBlock,
      toBlock,
    })

    if (logs.length === 0) {
      await updateIndexerState(prisma, icoAddress, 'ICOContract', 'ICOFailed', chainId, toBlock)
      return
    }

    console.log(`Found ${logs.length} ICOFailed events for ICO ${icoAddress}`)

    for (const log of logs) {
      const { totalCommitted, minimumRequired } = log.args as {
        totalCommitted: bigint
        minimumRequired: bigint
      }

      const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

      // Update Fair Launch status
      await prisma.fairLaunch.update({
        where: { id: fairLaunchId },
        data: {
          status: 'FAILED' as ICOStatus,
          totalCommitted: totalCommitted.toString(),
          failedAt: new Date(Number(block.timestamp) * 1000),
        },
      })

      console.log(`ICO Failed: ${formatEther(totalCommitted)} BNB committed, minimum was ${formatEther(minimumRequired)}`)
    }

    // Update indexer state
    const lastLog = logs[logs.length - 1]
    await updateIndexerState(
      prisma,
      icoAddress,
      'ICOContract',
      'ICOFailed',
      chainId,
      lastLog.blockNumber,
      lastLog.transactionHash
    )
  } catch (error) {
    console.error(`Error processing ICOFailed events for ${icoAddress}:`, error)
    await recordError(prisma, icoAddress, 'ICOContract', 'ICOFailed', chainId, (error as Error).message)
  }
}

/**
 * Process TokensClaimed events
 */
async function processTokensClaimedEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  icoAddress: Address,
  fairLaunchId: string,
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  try {
    const logs = await publicClient.getLogs({
      address: icoAddress,
      event: TokensClaimedEvent,
      fromBlock,
      toBlock,
    })

    if (logs.length === 0) {
      await updateIndexerState(prisma, icoAddress, 'ICOContract', 'TokensClaimed', chainId, toBlock)
      return
    }

    console.log(`Found ${logs.length} TokensClaimed events for ICO ${icoAddress}`)

    for (const log of logs) {
      const { user, allocation } = log.args as {
        user: Address
        allocation: bigint
      }

      const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

      // Update commitment
      await prisma.commitment.updateMany({
        where: {
          fairLaunchId,
          userAddress: user.toLowerCase(),
        },
        data: {
          hasClaimed: true,
          claimedAt: new Date(Number(block.timestamp) * 1000),
          allocation: allocation.toString(),
        },
      })

      console.log(`Tokens Claimed: ${user} claimed ${formatEther(allocation)} tokens`)
    }

    // Update indexer state
    const lastLog = logs[logs.length - 1]
    await updateIndexerState(
      prisma,
      icoAddress,
      'ICOContract',
      'TokensClaimed',
      chainId,
      lastLog.blockNumber,
      lastLog.transactionHash
    )
  } catch (error) {
    console.error(`Error processing TokensClaimed events for ${icoAddress}:`, error)
    await recordError(prisma, icoAddress, 'ICOContract', 'TokensClaimed', chainId, (error as Error).message)
  }
}

/**
 * Process Refunded events
 */
async function processRefundedEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  icoAddress: Address,
  fairLaunchId: string,
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  try {
    const logs = await publicClient.getLogs({
      address: icoAddress,
      event: RefundedEvent,
      fromBlock,
      toBlock,
    })

    if (logs.length === 0) {
      await updateIndexerState(prisma, icoAddress, 'ICOContract', 'Refunded', chainId, toBlock)
      return
    }

    console.log(`Found ${logs.length} Refunded events for ICO ${icoAddress}`)

    for (const log of logs) {
      const { user, amount } = log.args as {
        user: Address
        amount: bigint
      }

      const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

      // Update commitment
      await prisma.commitment.updateMany({
        where: {
          fairLaunchId,
          userAddress: user.toLowerCase(),
        },
        data: {
          hasRefunded: true,
          refundedAt: new Date(Number(block.timestamp) * 1000),
        },
      })

      console.log(`Refunded: ${user} received ${formatEther(amount)} BNB`)
    }

    // Update indexer state
    const lastLog = logs[logs.length - 1]
    await updateIndexerState(
      prisma,
      icoAddress,
      'ICOContract',
      'Refunded',
      chainId,
      lastLog.blockNumber,
      lastLog.transactionHash
    )
  } catch (error) {
    console.error(`Error processing Refunded events for ${icoAddress}:`, error)
    await recordError(prisma, icoAddress, 'ICOContract', 'Refunded', chainId, (error as Error).message)
  }
}

/**
 * Load existing Fair Launches from database
 */
export async function loadExistingFairLaunches(prisma: PrismaClient): Promise<void> {
  const fairLaunches = await prisma.fairLaunch.findMany({
    where: {
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    select: { icoAddress: true },
  })

  for (const fl of fairLaunches) {
    indexedICOs.add(fl.icoAddress.toLowerCase())
  }

  console.log(`Loaded ${indexedICOs.size} active Fair Launches to monitor`)
}

/**
 * Get last indexed block for Fair Launch factory
 */
export async function getLastFairLaunchCreatedBlock(
  prisma: PrismaClient,
  factoryAddress: string,
  chainId: number,
  startBlock: bigint
): Promise<bigint> {
  return getLastIndexedBlock(prisma, factoryAddress, 'FairLaunchCreated', chainId, startBlock)
}

/**
 * Get last indexed block for ICO events
 */
export async function getLastICOEventBlock(
  prisma: PrismaClient,
  icoAddress: string,
  eventType: string,
  chainId: number,
  startBlock: bigint
): Promise<bigint> {
  return getLastIndexedBlock(prisma, icoAddress, eventType, chainId, startBlock)
}
