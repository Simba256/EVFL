/**
 * Health Check Server for the Indexer
 *
 * Provides a simple HTTP endpoint for container health checks.
 * Reports indexer status including last processed block and error state.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'

// Health status interface
interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting'
  uptime: number
  lastBlock?: bigint
  lastError?: string
  lastErrorAt?: Date
  cycleCount: number
  errorCount?: number
  indexerErrors?: IndexerError[]
}

interface IndexerError {
  contract: string
  contractType: string
  eventType: string
  errorCount: number
  lastError: string | null
  lastIndexedBlock: string
  lastIndexedAt: Date | null
}

// Shared state (updated by the indexer)
let healthStatus: HealthStatus = {
  status: 'starting',
  uptime: 0,
  cycleCount: 0,
}

const startTime = Date.now()

// Store reference to prisma client (set by indexer)
let prismaClient: any = null

export function setPrismaClient(prisma: any): void {
  prismaClient = prisma
}

/**
 * Update the health status (called by the indexer)
 */
export function updateHealthStatus(update: Partial<HealthStatus>): void {
  healthStatus = {
    ...healthStatus,
    ...update,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  }
}

/**
 * Mark the indexer as healthy after a successful cycle
 */
export function markHealthy(lastBlock: bigint, cycleCount: number): void {
  updateHealthStatus({
    status: 'healthy',
    lastBlock,
    cycleCount,
    lastError: undefined,
    lastErrorAt: undefined,
  })
}

/**
 * Mark the indexer as unhealthy after an error
 */
export function markUnhealthy(error: string): void {
  updateHealthStatus({
    status: 'unhealthy',
    lastError: error,
    lastErrorAt: new Date(),
  })
}

/**
 * Get indexer errors from database
 */
async function getIndexerErrors(): Promise<IndexerError[]> {
  if (!prismaClient) return []

  try {
    const errors = await prismaClient.indexerState.findMany({
      where: {
        OR: [
          { errorCount: { gt: 0 } },
          { lastError: { not: null } },
        ],
      },
      select: {
        contractAddress: true,
        contractType: true,
        eventType: true,
        errorCount: true,
        lastError: true,
        lastIndexedBlock: true,
        lastIndexedAt: true,
      },
      orderBy: {
        errorCount: 'desc',
      },
      take: 10, // Show top 10 problematic indexers
    })

    return errors.map((e) => ({
      contract: e.contractAddress,
      contractType: e.contractType,
      eventType: e.eventType,
      errorCount: e.errorCount,
      lastError: e.lastError,
      lastIndexedBlock: e.lastIndexedBlock.toString(),
      lastIndexedAt: e.lastIndexedAt,
    }))
  } catch (error) {
    console.error('Error fetching indexer errors:', error)
    return []
  }
}

/**
 * Start the health check HTTP server
 */
export function startHealthServer(port: number = 8080): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Update uptime
    healthStatus.uptime = Math.floor((Date.now() - startTime) / 1000)

    if (req.url === '/health' || req.url === '/') {
      // Fetch indexer errors from database
      const indexerErrors = await getIndexerErrors()
      const totalErrorCount = indexerErrors.reduce((sum, e) => sum + e.errorCount, 0)

      const statusCode = healthStatus.status === 'unhealthy' ? 503 : 200

      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify(
          {
            ...healthStatus,
            lastBlock: healthStatus.lastBlock?.toString(),
            errorCount: totalErrorCount,
            indexerErrors: indexerErrors.length > 0 ? indexerErrors : undefined,
          },
          null,
          2
        )
      )
    } else if (req.url === '/ready') {
      // Readiness probe - only ready when healthy
      const isReady = healthStatus.status === 'healthy'
      res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ready: isReady }))
    } else if (req.url === '/live') {
      // Liveness probe - alive unless critically unhealthy
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ alive: true }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  server.listen(port, () => {
    console.log(`Health check server listening on port ${port}`)
  })

  // Handle server errors
  server.on('error', (error) => {
    console.error('Health server error:', error)
  })
}

// If run directly, start a test health server
if (require.main === module) {
  console.log('Starting standalone health check server...')
  startHealthServer()

  // Simulate status changes for testing
  setTimeout(() => {
    markHealthy(BigInt(12345678), 1)
    console.log('Marked as healthy')
  }, 2000)
}
