import { prisma } from './prisma'
import { IndexerState as PrismaIndexerState } from '../generated/prisma'

// Contract types for indexer
export type ContractType = 'TokenFactory' | 'WeightedPool' | 'Token'

// Event types to index
export type EventType = 'TokenCreated' | 'Swap' | 'Transfer'

// Indexer state type for internal use
export interface IndexerStateInfo {
  contractAddress: string
  contractType: ContractType
  eventType: EventType
  chainId: number
  lastIndexedBlock: bigint
  lastIndexedTxHash: string | null
  lastIndexedAt: Date
  lastError: string | null
  errorCount: number
}

// Convert Prisma indexer state to internal type
function toIndexerStateInfo(state: PrismaIndexerState): IndexerStateInfo {
  return {
    contractAddress: state.contractAddress,
    contractType: state.contractType as ContractType,
    eventType: state.eventType as EventType,
    chainId: state.chainId,
    lastIndexedBlock: state.lastIndexedBlock,
    lastIndexedTxHash: state.lastIndexedTxHash,
    lastIndexedAt: state.lastIndexedAt,
    lastError: state.lastError,
    errorCount: state.errorCount,
  }
}

// Get indexer state for a contract/event
export async function getIndexerState(
  contractAddress: string,
  eventType: EventType,
  chainId: number
): Promise<IndexerStateInfo | null> {
  const state = await prisma.indexerState.findUnique({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: contractAddress.toLowerCase(),
        eventType,
        chainId,
      },
    },
  })

  return state ? toIndexerStateInfo(state) : null
}

// Get last indexed block for a contract/event
export async function getLastIndexedBlock(
  contractAddress: string,
  eventType: EventType,
  chainId: number
): Promise<bigint> {
  const state = await getIndexerState(contractAddress, eventType, chainId)
  return state?.lastIndexedBlock ?? BigInt(0)
}

// Update indexer state after successful indexing
export async function updateIndexerState(
  contractAddress: string,
  contractType: ContractType,
  eventType: EventType,
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

// Record indexer error
export async function recordIndexerError(
  contractAddress: string,
  contractType: ContractType,
  eventType: EventType,
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

// Get all indexer states
export async function getAllIndexerStates(): Promise<IndexerStateInfo[]> {
  const states = await prisma.indexerState.findMany({
    orderBy: { lastIndexedAt: 'desc' },
  })

  return states.map(toIndexerStateInfo)
}

// Get indexer states by contract type
export async function getIndexerStatesByType(
  contractType: ContractType
): Promise<IndexerStateInfo[]> {
  const states = await prisma.indexerState.findMany({
    where: { contractType },
    orderBy: { lastIndexedAt: 'desc' },
  })

  return states.map(toIndexerStateInfo)
}

// Get indexer states with errors
export async function getIndexerStatesWithErrors(): Promise<IndexerStateInfo[]> {
  const states = await prisma.indexerState.findMany({
    where: { lastError: { not: null } },
    orderBy: { errorCount: 'desc' },
  })

  return states.map(toIndexerStateInfo)
}

// Reset indexer state (for re-indexing)
export async function resetIndexerState(
  contractAddress: string,
  eventType: EventType,
  chainId: number,
  startBlock: bigint = BigInt(0)
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
      lastIndexedBlock: startBlock,
      lastIndexedTxHash: null,
      lastError: null,
      errorCount: 0,
    },
    create: {
      contractAddress: contractAddress.toLowerCase(),
      contractType: 'TokenFactory', // Will be overwritten on first index
      eventType,
      chainId,
      lastIndexedBlock: startBlock,
    },
  })
}

// Delete indexer state
export async function deleteIndexerState(
  contractAddress: string,
  eventType: EventType,
  chainId: number
): Promise<boolean> {
  try {
    await prisma.indexerState.delete({
      where: {
        contractAddress_eventType_chainId: {
          contractAddress: contractAddress.toLowerCase(),
          eventType,
          chainId,
        },
      },
    })
    return true
  } catch {
    return false
  }
}
