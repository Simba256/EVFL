/**
 * Test Health Endpoint - Shows what the enhanced health endpoint will display
 */
import 'dotenv/config'
import { prisma } from '../lib/db/prisma'

async function main() {
  console.log('=== HEALTH ENDPOINT TEST ===\n')

  // Simulate what the health endpoint will show
  const errors = await prisma.indexerState.findMany({
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
    take: 10,
  })

  const totalErrorCount = errors.reduce((sum, e) => sum + e.errorCount, 0)

  console.log('Enhanced /health endpoint will show:')
  console.log('=====================================\n')

  const healthResponse = {
    status: 'healthy',
    uptime: 133083,
    lastBlock: '91394988',
    cycleCount: 2355,
    errorCount: totalErrorCount,
    indexerErrors: errors.length > 0 ? errors.map((e) => ({
      contract: e.contractAddress,
      contractType: e.contractType,
      eventType: e.eventType,
      errorCount: e.errorCount,
      lastError: e.lastError,
      lastIndexedBlock: e.lastIndexedBlock.toString(),
      lastIndexedAt: e.lastIndexedAt,
    })) : undefined,
  }

  console.log(JSON.stringify(healthResponse, null, 2))

  console.log('\n=== SUMMARY ===')
  console.log(`Total Errors Found: ${totalErrorCount}`)
  console.log(`Indexers with Errors: ${errors.length}`)

  if (errors.length > 0) {
    console.log('\nTop Issues:')
    errors.slice(0, 3).forEach((e, i) => {
      console.log(`${i + 1}. ${e.contractType} - ${e.eventType}`)
      console.log(`   Contract: ${e.contractAddress}`)
      console.log(`   Errors: ${e.errorCount}`)
      console.log(`   Last Error: ${e.lastError?.substring(0, 100)}...`)
    })
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
