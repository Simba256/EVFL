/**
 * Cleanup ALL Broken Indexer States
 *
 * This removes all indexer states with errors so they can start fresh
 */
import 'dotenv/config'
import { prisma } from '../lib/db/prisma'

async function main() {
  console.log('=== CLEANING UP BROKEN INDEXER STATES ===\n')

  // Find all broken states
  const brokenStates = await prisma.indexerState.findMany({
    where: {
      OR: [
        { errorCount: { gt: 0 } },
        { lastError: { not: null } },
      ],
    },
  })

  console.log(`Found ${brokenStates.length} broken indexer states:\n`)

  brokenStates.forEach((state, i) => {
    console.log(`${i + 1}. ${state.contractType} - ${state.eventType}`)
    console.log(`   Contract: ${state.contractAddress}`)
    console.log(`   Error Count: ${state.errorCount}`)
    console.log(`   Last Block: ${state.lastIndexedBlock.toString()}`)
    console.log()
  })

  if (brokenStates.length === 0) {
    console.log('✅ No broken indexer states found!')
    await prisma.$disconnect()
    return
  }

  // Delete all broken states
  console.log('Deleting all broken indexer states...')
  const result = await prisma.indexerState.deleteMany({
    where: {
      OR: [
        { errorCount: { gt: 0 } },
        { lastError: { not: null } },
      ],
    },
  })

  console.log(`✅ Deleted ${result.count} broken indexer states!`)
  console.log()
  console.log('Next steps:')
  console.log('1. Ensure these environment variables are set on Railway:')
  console.log('   - NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_ADDRESS_TESTNET=0x821F4bbdA70Db4EcD61451907ad282CBEbD007dD')
  console.log('   - FAIR_LAUNCH_START_BLOCK=91000000')
  console.log('   - INDEXER_ENABLED=true')
  console.log('2. Restart your Railway indexer service')
  console.log('3. Indexer will start fresh with correct start blocks')
  console.log('4. Check /health endpoint - errorCount should be 0')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
