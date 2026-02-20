/**
 * Fix Indexer State - Reset broken indexer state for NEW factory
 *
 * This script deletes the broken indexer state that's stuck at block 0
 * and causing "exceed maximum block range" errors.
 */
import 'dotenv/config'
import { prisma } from '../lib/db/prisma'

async function main() {
  console.log('=== FIXING INDEXER STATE ===\n')

  const NEW_FACTORY = '0x821f4bbda70db4ecd61451907ad282cbebd007dd'
  const CHAIN_ID = 97

  // Check current state
  const currentState = await prisma.indexerState.findUnique({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: NEW_FACTORY,
        eventType: 'FairLaunchCreated',
        chainId: CHAIN_ID,
      }
    }
  })

  if (currentState) {
    console.log('Current Indexer State:')
    console.log('  Contract:', currentState.contractAddress)
    console.log('  Last Block:', currentState.lastIndexedBlock.toString())
    console.log('  Error Count:', currentState.errorCount)
    console.log('  Last Error:', currentState.lastError)
    console.log()

    // Delete the broken state
    console.log('Deleting broken indexer state...')
    await prisma.indexerState.delete({
      where: {
        contractAddress_eventType_chainId: {
          contractAddress: NEW_FACTORY,
          eventType: 'FairLaunchCreated',
          chainId: CHAIN_ID,
        }
      }
    })
    console.log('✅ Indexer state deleted!')
    console.log()
    console.log('Next steps:')
    console.log('1. Ensure FAIR_LAUNCH_START_BLOCK=91000000 is set on Railway')
    console.log('2. Restart your Railway indexer service')
    console.log('3. The indexer will start fresh from block 91000000')
    console.log('4. Check Railway logs for "Found 1 FairLaunchCreated events"')
    console.log('5. Your ICO should appear on /fair-launch page within 20 seconds')
  } else {
    console.log('✅ No broken indexer state found - you\'re good to go!')
    console.log()
    console.log('Make sure these are set on Railway:')
    console.log('  NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_ADDRESS_TESTNET=0x821F4bbdA70Db4EcD61451907ad282CBEbD007dD')
    console.log('  FAIR_LAUNCH_START_BLOCK=91000000')
    console.log('  INDEXER_ENABLED=true')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
