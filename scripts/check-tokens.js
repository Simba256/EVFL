// Quick script to check tokens from the factory
const { createPublicClient, http } = require('viem');
const { bscTestnet } = require('viem/chains');

const FACTORY_ADDRESS = '0x6F42EC722461Eb6fDe4B4cD8793b297eB34924F7';

const TokenFactoryABI = [
  {
    inputs: [],
    name: 'getAllTokens',
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ type: 'address' }],
    name: 'getTokenInfo',
    outputs: [{
      components: [
        { name: 'token', type: 'address' },
        { name: 'pool', type: 'address' },
        { name: 'creator', type: 'address' },
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'initialSupply', type: 'uint256' },
        { name: 'createdAt', type: 'uint256' },
      ],
      type: 'tuple',
    }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main() {
  const client = createPublicClient({
    chain: bscTestnet,
    transport: http('https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
  });

  console.log('Fetching tokens from factory...\n');

  const tokens = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: TokenFactoryABI,
    functionName: 'getAllTokens',
  });

  console.log(`Found ${tokens.length} token(s):\n`);

  for (const tokenAddr of tokens) {
    const info = await client.readContract({
      address: FACTORY_ADDRESS,
      abi: TokenFactoryABI,
      functionName: 'getTokenInfo',
      args: [tokenAddr],
    });

    console.log('-----------------------------------');
    console.log(`Name: ${info.name}`);
    console.log(`Symbol: ${info.symbol}`);
    console.log(`Token: ${info.token}`);
    console.log(`Pool: ${info.pool}`);
    console.log(`Creator: ${info.creator}`);
    console.log(`Supply: ${(BigInt(info.initialSupply) / BigInt(10**18)).toString()} tokens`);
    console.log(`Created: ${new Date(Number(info.createdAt) * 1000).toLocaleString()}`);
    console.log('-----------------------------------\n');
  }
}

main().catch(console.error);
