/**
 * Check database for Fair Launch entries
 */
import 'dotenv/config'
import { prisma } from '../lib/db/prisma'

async function main() {
  console.log('=== DATABASE DIAGNOSTIC ===\n')

  // Check total fair launches
  const totalCount = await prisma.fairLaunch.count()
  console.log(`Total Fair Launches in DB: ${totalCount}`)

  // Check for specific NEW ICO
  const newICO = await prisma.fairLaunch.findUnique({
    where: { icoAddress: '0x835f183c68a65eb615adb8709c35a65fc734b924' }
  })
  console.log('\nNEW ICO (0x835f...924):', newICO ? 'FOUND ✅' : 'NOT FOUND ❌')
  if (newICO) {
    console.log('  Name:', newICO.name)
    console.log('  Symbol:', newICO.symbol)
    console.log('  Status:', newICO.status)
  }

  // Check for OLD ICO
  const oldICO = await prisma.fairLaunch.findUnique({
    where: { icoAddress: '0x59c8f15a399df5a14c3c8fa14c57275795024f9e' }
  })
  console.log('\nOLD ICO (0x59c8...f9e):', oldICO ? 'FOUND ✅' : 'NOT FOUND ❌')
  if (oldICO) {
    console.log('  Name:', oldICO.name)
    console.log('  Symbol:', oldICO.symbol)
    console.log('  Status:', oldICO.status)
  }

  // List all fair launches
  const allLaunches = await prisma.fairLaunch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      icoAddress: true,
      name: true,
      symbol: true,
      status: true,
      createdAt: true,
    }
  })
  console.log('\n=== ALL FAIR LAUNCHES ===')
  if (allLaunches.length === 0) {
    console.log('No fair launches found in database')
  } else {
    allLaunches.forEach((fl, i) => {
      console.log(`${i + 1}. ${fl.symbol} (${fl.name})`)
      console.log(`   Address: ${fl.icoAddress}`)
      console.log(`   Status: ${fl.status}`)
      console.log(`   Created: ${fl.createdAt}`)
    })
  }

  // Check indexer state for NEW factory
  const indexerState = await prisma.indexerState.findUnique({
    where: {
      contractAddress_eventType_chainId: {
        contractAddress: '0x821f4bbda70db4ecd61451907ad282cbebd007dd',
        eventType: 'FairLaunchCreated',
        chainId: 97,
      }
    }
  })
  console.log('\n=== INDEXER STATE (NEW Factory) ===')
  if (indexerState) {
    console.log('Last Indexed Block:', indexerState.lastIndexedBlock.toString())
    console.log('Last Indexed At:', indexerState.lastIndexedAt)
    console.log('Last TX Hash:', indexerState.lastIndexedTxHash)
    console.log('Error Count:', indexerState.errorCount)
    console.log('Last Error:', indexerState.lastError)
  } else {
    console.log('No indexer state found - indexer may not have run yet ❌')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
