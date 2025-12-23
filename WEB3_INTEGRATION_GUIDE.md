# 🚀 Web3 Integration Guide - RoboLaunch on BSC

Complete guide to integrate wallet connection, smart contracts, and trading features.

---

## 📦 Step 1: Install Dependencies

```bash
npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query --legacy-peer-deps
```

**Why these packages:**
- `wagmi` - React hooks for blockchain (best-in-class for EVM chains)
- `viem` - Modern TypeScript Ethereum library (replaces ethers.js)
- `@rainbow-me/rainbowkit` - Beautiful wallet connection UI
- `@tanstack/react-query` - Data fetching/caching (required by wagmi)

---

## 🔧 Step 2: Configure Environment Variables

Create `.env.local`:

```bash
# Copy from example
cp .env.example .env.local
```

**Required variables:**

```env
# BSC Testnet (for development)
NEXT_PUBLIC_BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# Your deployed contract addresses (testnet)
NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET=0x...
NEXT_PUBLIC_TRADING_POOL_ADDRESS_TESTNET=0x...
NEXT_PUBLIC_REGISTRY_ADDRESS_TESTNET=0x...

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

**Get WalletConnect Project ID:**
1. Go to https://cloud.walletconnect.com
2. Sign up / login
3. Create new project
4. Copy Project ID

---

## 🏗️ Step 3: Wrap App with Web3 Provider

Update `app/layout.tsx`:

```tsx
import { Web3Provider } from './providers/web3-provider'
import '@rainbow-me/rainbowkit/styles.css' // Add this import
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.variable} ${inter.variable} font-sans antialiased`}>
        {/* Wrap children with Web3Provider */}
        <Web3Provider>
          {children}
        </Web3Provider>
        <Analytics />
      </body>
    </html>
  )
}
```

---

## 🔌 Step 4: Add Wallet Button to Header

Update `components/header.tsx`:

```tsx
import { WalletButton } from "./wallet-button"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/20 glass-morph scanlines">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" fill="currentColor" />
          <span className="text-2xl font-bold">
            ROBO<span className="text-primary">LAUNCH</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/">Tokens</Link>
          <Link href="/launch">Launch</Link>
          <Link href="/leaderboard">Leaderboard</Link>
        </nav>

        {/* Wallet Button - Replace placeholder */}
        <WalletButton />
      </div>
    </header>
  )
}
```

---

## 📝 Step 5: Add Your Contract ABIs

Create `lib/blockchain/contracts/abis/` folder and add your ABIs:

```typescript
// lib/blockchain/contracts/abis/TokenFactory.ts
export const TokenFactoryABI = [
  // Your TokenFactory ABI here
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "totalSupply", type: "uint256" },
    ],
    name: "createToken",
    outputs: [{ name: "tokenAddress", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ... rest of your ABI
] as const

// lib/blockchain/contracts/abis/TradingPool.ts
export const TradingPoolABI = [
  // Your TradingPool ABI here
  {
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "buyTokens",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  // ... rest of your ABI
] as const
```

---

## 🎣 Step 6: Create Contract Interaction Hooks

Example: Token Launch Hook

```typescript
// lib/blockchain/hooks/useTokenLaunch.ts
'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { TokenFactoryABI } from '../contracts/abis/TokenFactory'
import { getContractAddress } from '../config/chains'
import type { TokenLaunchParams } from '@/types/blockchain'

export function useTokenLaunch() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const launchToken = async (params: TokenLaunchParams) => {
    const chainId = 97 // BSC Testnet

    writeContract({
      address: getContractAddress(chainId, 'tokenFactory'),
      abi: TokenFactoryABI,
      functionName: 'createToken',
      args: [
        params.name,
        params.symbol,
        params.totalSupply,
      ],
    })
  }

  return {
    launchToken,
    isPending,
    isConfirming,
    isSuccess,
    error,
    txHash: hash,
  }
}
```

Example: Token Trading Hook

```typescript
// lib/blockchain/hooks/useTokenTrade.ts
'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { TradingPoolABI } from '../contracts/abis/TradingPool'
import { getContractAddress } from '../config/chains'

export function useTokenTrade() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const buyTokens = async (tokenAddress: string, bnbAmount: string) => {
    const chainId = 97 // BSC Testnet

    writeContract({
      address: getContractAddress(chainId, 'tradingPool'),
      abi: TradingPoolABI,
      functionName: 'buyTokens',
      args: [tokenAddress],
      value: parseEther(bnbAmount), // Send BNB
    })
  }

  const sellTokens = async (tokenAddress: string, tokenAmount: bigint) => {
    const chainId = 97

    writeContract({
      address: getContractAddress(chainId, 'tradingPool'),
      abi: TradingPoolABI,
      functionName: 'sellTokens',
      args: [tokenAddress, tokenAmount],
    })
  }

  return {
    buyTokens,
    sellTokens,
    isPending,
    isConfirming,
    isSuccess,
    error,
    txHash: hash,
  }
}
```

---

## 🎨 Step 7: Update Launch Form

Update `components/launch-form.tsx` to use the hook:

```tsx
'use client'

import { useTokenLaunch } from '@/lib/blockchain/hooks/useTokenLaunch'
import { useWalletConnection } from '@/lib/blockchain/hooks/useWalletConnection'
import { parseUnits } from 'viem'

export function LaunchForm() {
  const { isConnected, connect } = useWalletConnection()
  const { launchToken, isPending, isSuccess, txHash } = useTokenLaunch()

  const handleSubmit = async (data: FormData) => {
    if (!isConnected) {
      connect()
      return
    }

    await launchToken({
      name: data.get('name') as string,
      symbol: data.get('symbol') as string,
      description: data.get('description') as string,
      imageUrl: data.get('image') as string,
      totalSupply: parseUnits(data.get('supply') as string, 18),
    })
  }

  if (isSuccess) {
    return (
      <div className="text-center">
        <h2>Token Launched! 🚀</h2>
        <p>Transaction: {txHash}</p>
        <a href={`https://testnet.bscscan.com/tx/${txHash}`}>View on BSCScan</a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Launching...' : 'Launch Token'}
      </button>
    </form>
  )
}
```

---

## 🔍 Step 8: Read Blockchain Data

Example: Get token price from bonding curve

```typescript
// lib/blockchain/hooks/useTokenPrice.ts
'use client'

import { useReadContract } from 'wagmi'
import { TradingPoolABI } from '../contracts/abis/TradingPool'
import { getContractAddress } from '../config/chains'
import type { Address } from 'viem'

export function useTokenPrice(tokenAddress: Address) {
  const { data, isLoading, error } = useReadContract({
    address: getContractAddress(97, 'tradingPool'),
    abi: TradingPoolABI,
    functionName: 'getCurrentPrice',
    args: [tokenAddress],
  })

  return {
    price: data,
    isLoading,
    error,
  }
}
```

---

## 📊 Step 9: Replace Mock Data with Blockchain Data

Update `lib/data/tokens.ts`:

```typescript
import { useReadContract } from 'wagmi'
import { getContractAddress } from '@/lib/blockchain/config/chains'
import { RegistryABI } from '@/lib/blockchain/contracts/abis/Registry'

// NEW: Fetch real tokens from blockchain
export async function getTokensFromBlockchain(): Promise<Token[]> {
  const chainId = 97 // BSC Testnet

  // This would call your Registry contract
  const { data } = useReadContract({
    address: getContractAddress(chainId, 'registry'),
    abi: RegistryABI,
    functionName: 'getAllTokens',
  })

  // Transform blockchain data to your Token type
  return data?.map((token: any) => ({
    id: token.address,
    name: token.name,
    symbol: token.symbol,
    // ... map other fields
  })) || []
}

// Keep mock data for development
export async function getTokens(): Promise<Token[]> {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
    return MOCK_TOKENS
  }
  return getTokensFromBlockchain()
}
```

---

## 🧪 Step 10: Testing

1. **Get Testnet BNB:**
   - Visit https://testnet.bnbchain.org/faucet-smart
   - Connect wallet
   - Request testnet BNB

2. **Test Wallet Connection:**
   ```bash
   npm run dev
   ```
   - Click "Connect Wallet"
   - Select MetaMask (or your wallet)
   - Switch to BSC Testnet if prompted

3. **Deploy Test Contracts:**
   - Deploy your contracts to BSC Testnet
   - Add addresses to `.env.local`

4. **Test Token Launch:**
   - Fill out launch form
   - Approve transaction in wallet
   - Verify on BSCScan

---

## 🚀 Going to Production

1. **Update env for mainnet:**
   ```env
   NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed.binance.org
   NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=0x... # Mainnet address
   ```

2. **Deploy contracts to BSC Mainnet**

3. **Test thoroughly on testnet first!**

---

## 🎯 Next Steps

### Immediate (Phase 1):
- ✅ Wallet connection (DONE - just install deps)
- ⏳ Token launch functionality
- ⏳ Add your contract ABIs
- ⏳ Create trading interface

### Future (Phase 2):
- Add Bonding Curve implementation
- Real-time price updates (WebSockets)
- Transaction history
- Token analytics dashboard

### Multi-Chain Expansion (Phase 3):
- Add Ethereum support
- Add Solana support (@solana/web3.js)
- Unified wallet interface

---

## 📚 Resources

- **Wagmi Docs:** https://wagmi.sh
- **Viem Docs:** https://viem.sh
- **RainbowKit Docs:** https://rainbowkit.com
- **BSC Docs:** https://docs.bnbchain.org
- **BSC Testnet Faucet:** https://testnet.bnbchain.org/faucet-smart
- **BSCScan (Testnet):** https://testnet.bscscan.com

---

## ⚠️ Important Notes

1. **Never commit private keys** to git
2. **Test on testnet first** before mainnet
3. **Audit smart contracts** before production
4. **Set gas limits** appropriately
5. **Handle errors gracefully** - show user-friendly messages

---

## 🆘 Troubleshooting

**"Chain not supported":**
- Make sure BSC is in your `chains` array in `lib/blockchain/config/chains.ts`
- Verify NEXT_PUBLIC_BSC_RPC_URL is set

**"Contract function not found":**
- Check ABI matches deployed contract
- Verify contract address is correct

**"Insufficient funds":**
- Get testnet BNB from faucet
- Check gas estimates

---

Your architecture is **production-ready**! Just install the dependencies and start integrating your contracts. 🚀
