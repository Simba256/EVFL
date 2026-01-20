import { prisma } from './lib/db/prisma';

async function main() {
  const tokens = await prisma.token.findMany({
    select: {
      name: true,
      symbol: true,
      image: true,
      tokenAddress: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('Recent tokens and their images:');
  tokens.forEach(t => {
    console.log('---');
    console.log('Name:', t.name);
    console.log('Symbol:', t.symbol);
    console.log('Image:', t.image || '(empty)');
    console.log('Address:', t.tokenAddress);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
