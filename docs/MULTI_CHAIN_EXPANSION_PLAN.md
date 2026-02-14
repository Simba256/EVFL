# Multi-Chain Expansion Plan

## Overview

This document outlines the strategy for expanding the Fair Launch platform across multiple EVM-compatible chains, followed by Solana integration.

---

## Track 1: EVM Chain Expansion

### Target Chains (Priority Order)

| Priority | Chain | Chain ID | DEX Router | Wrapped Native | Block Explorer |
|----------|-------|----------|------------|----------------|----------------|
| 1 | Base | 8453 | Uniswap V2 | WETH | basescan.org |
| 2 | Arbitrum One | 42161 | Uniswap V2 | WETH | arbiscan.io |
| 3 | Polygon | 137 | QuickSwap | WMATIC | polygonscan.com |
| 4 | Avalanche | 43114 | TraderJoe | WAVAX | snowtrace.io |
| 5 | Optimism | 10 | Velodrome | WETH | optimistic.etherscan.io |
| 6 | Ethereum | 1 | Uniswap V2 | WETH | etherscan.io |

### Phase 1: Smart Contract Preparation

#### 1.1 Create Chain Configuration

```typescript
// contracts/config/chains.ts
export const CHAIN_CONFIG = {
  // Base Mainnet
  8453: {
    name: 'Base',
    weth: '0x4200000000000000000000000000000000000006',
    router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', // Uniswap V2
    factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
    explorer: 'https://basescan.org',
    rpc: 'https://mainnet.base.org',
  },
  // Base Sepolia (Testnet)
  84532: {
    name: 'Base Sepolia',
    weth: '0x4200000000000000000000000000000000000006',
    router: '0x1689E7B1F10000AE47eBfE339a4f69dECd19F602',
    factory: '0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e',
    explorer: 'https://sepolia.basescan.org',
    rpc: 'https://sepolia.base.org',
  },
  // Arbitrum One
  42161: {
    name: 'Arbitrum One',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', // Uniswap V2
    factory: '0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9',
    explorer: 'https://arbiscan.io',
    rpc: 'https://arb1.arbitrum.io/rpc',
  },
  // Arbitrum Sepolia (Testnet)
  421614: {
    name: 'Arbitrum Sepolia',
    weth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    router: '0x101F443B4d1b059569D643917553c771E1b9663E',
    factory: '0x...',
    explorer: 'https://sepolia.arbiscan.io',
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
  },
  // Polygon
  137: {
    name: 'Polygon',
    weth: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
    factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    explorer: 'https://polygonscan.com',
    rpc: 'https://polygon-rpc.com',
  },
  // Avalanche
  43114: {
    name: 'Avalanche',
    weth: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
    router: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4', // TraderJoe
    factory: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10',
    explorer: 'https://snowtrace.io',
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
  },
}
```

#### 1.2 Update Deployment Script

```typescript
// contracts/scripts/deploy-multichain.ts
import { CHAIN_CONFIG } from '../config/chains';

async function deployToChain(chainId: number) {
  const config = CHAIN_CONFIG[chainId];

  console.log(`Deploying to ${config.name}...`);

  const FairLaunchFactory = await ethers.getContractFactory("FairLaunchFactory");
  const factory = await FairLaunchFactory.deploy(
    config.weth,
    config.router
  );

  await factory.waitForDeployment();

  console.log(`FairLaunchFactory deployed to: ${await factory.getAddress()}`);

  // Verify on block explorer
  await hre.run("verify:verify", {
    address: await factory.getAddress(),
    constructorArguments: [config.weth, config.router],
  });

  return factory;
}
```

#### 1.3 Hardhat Multi-Chain Configuration

```typescript
// contracts/hardhat.config.ts additions
networks: {
  // Existing BSC configs...

  base: {
    url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 8453,
  },
  baseSepolia: {
    url: 'https://sepolia.base.org',
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 84532,
  },
  arbitrum: {
    url: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 42161,
  },
  arbitrumSepolia: {
    url: 'https://sepolia-rollup.arbitrum.io/rpc',
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 421614,
  },
  polygon: {
    url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 137,
  },
  avalanche: {
    url: 'https://api.avax.network/ext/bc/C/rpc',
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 43114,
  },
},
etherscan: {
  apiKey: {
    base: process.env.BASESCAN_API_KEY,
    arbitrumOne: process.env.ARBISCAN_API_KEY,
    polygon: process.env.POLYGONSCAN_API_KEY,
    avalanche: process.env.SNOWTRACE_API_KEY,
  },
},
```

### Phase 2: Frontend Multi-Chain Support

#### 2.1 Chain Configuration

```typescript
// lib/config/chains.ts
import { base, arbitrum, polygon, avalanche, bsc } from 'wagmi/chains';

export const SUPPORTED_CHAINS = [bsc, base, arbitrum, polygon, avalanche] as const;

export const CHAIN_CONTRACTS: Record<number, {
  fairLaunchFactory: `0x${string}`;
  tokenFactory: `0x${string}`;
  weth: `0x${string}`;
  explorer: string;
  dexName: string;
}> = {
  56: { // BSC
    fairLaunchFactory: '0x821F4bbdA70Db4EcD61451907ad282CBEbD007dD',
    tokenFactory: '0x6F42EC722461Eb6fDe4B4cD8793b297eB34924F7',
    weth: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    explorer: 'https://bscscan.com',
    dexName: 'PancakeSwap',
  },
  8453: { // Base
    fairLaunchFactory: '0x...', // To be deployed
    tokenFactory: '0x...',
    weth: '0x4200000000000000000000000000000000000006',
    explorer: 'https://basescan.org',
    dexName: 'Uniswap',
  },
  42161: { // Arbitrum
    fairLaunchFactory: '0x...',
    tokenFactory: '0x...',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    explorer: 'https://arbiscan.io',
    dexName: 'Uniswap',
  },
  // ... more chains
};

export function getChainConfig(chainId: number) {
  return CHAIN_CONTRACTS[chainId];
}

export function getExplorerUrl(chainId: number, type: 'tx' | 'address' | 'token', hash: string) {
  const config = CHAIN_CONTRACTS[chainId];
  return `${config.explorer}/${type}/${hash}`;
}
```

#### 2.2 Update Wagmi Configuration

```typescript
// lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { base, arbitrum, polygon, avalanche, bsc, bscTestnet } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';

const chains = [bsc, base, arbitrum, polygon, avalanche, bscTestnet] as const;

const transports = {
  [bsc.id]: http('https://bsc-dataseed.binance.org'),
  [base.id]: http('https://mainnet.base.org'),
  [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  [polygon.id]: http('https://polygon-rpc.com'),
  [avalanche.id]: http('https://api.avax.network/ext/bc/C/rpc'),
  [bscTestnet.id]: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL),
};

export const config = createConfig({
  chains,
  transports,
  connectors: [...],
});
```

#### 2.3 Chain Selector Component

```tsx
// components/chain-selector.tsx
'use client';

import { useChainId, useSwitchChain } from 'wagmi';
import { SUPPORTED_CHAINS } from '@/lib/config/chains';

const CHAIN_ICONS: Record<number, string> = {
  56: '/chains/bsc.svg',
  8453: '/chains/base.svg',
  42161: '/chains/arbitrum.svg',
  137: '/chains/polygon.svg',
  43114: '/chains/avalanche.svg',
};

export function ChainSelector() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  return (
    <div className="relative">
      <select
        value={chainId}
        onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
        className="bg-card border border-border rounded-lg px-4 py-2"
      >
        {SUPPORTED_CHAINS.map((chain) => (
          <option key={chain.id} value={chain.id}>
            {chain.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

#### 2.4 Update Hooks for Multi-Chain

```typescript
// lib/blockchain/hooks/useFairLaunch.ts
import { useChainId } from 'wagmi';
import { getChainConfig } from '@/lib/config/chains';

export function useFairLaunch() {
  const chainId = useChainId();
  const config = getChainConfig(chainId);

  const factoryAddress = config?.fairLaunchFactory;

  // ... rest of hook uses factoryAddress
}
```

### Phase 3: Database Schema Updates

```prisma
// prisma/schema.prisma additions

model Token {
  id              String   @id @default(cuid())
  chainId         Int      // NEW: Chain identifier
  address         String
  // ... existing fields

  @@unique([chainId, address]) // Unique per chain
  @@index([chainId])
}

model FairLaunch {
  id              String   @id @default(cuid())
  chainId         Int      // NEW: Chain identifier
  icoAddress      String
  // ... existing fields

  @@unique([chainId, icoAddress])
  @@index([chainId])
}

model Trade {
  id              String   @id @default(cuid())
  chainId         Int      // NEW: Chain identifier
  // ... existing fields

  @@index([chainId])
}
```

### Phase 4: Multi-Chain Indexer

```typescript
// scripts/indexer/multi-chain-indexer.ts
import { CHAIN_CONFIG } from '@/lib/config/chains';

const CHAINS_TO_INDEX = [56, 8453, 42161, 137]; // BSC, Base, Arbitrum, Polygon

async function startMultiChainIndexer() {
  const indexers = CHAINS_TO_INDEX.map(chainId => {
    const config = CHAIN_CONFIG[chainId];
    return new ChainIndexer({
      chainId,
      rpcUrl: config.rpc,
      factoryAddress: config.fairLaunchFactory,
      startBlock: config.deploymentBlock,
    });
  });

  await Promise.all(indexers.map(i => i.start()));
}
```

### Deployment Checklist (Per Chain)

- [ ] Get native tokens for gas (ETH, MATIC, AVAX)
- [ ] Deploy FairLaunchFactory
- [ ] Verify contract on block explorer
- [ ] Update frontend chain config
- [ ] Update database with chainId
- [ ] Start indexer for new chain
- [ ] Test: Create fair launch
- [ ] Test: Commit funds
- [ ] Test: Finalize with LP
- [ ] Test: Claim tokens

### Estimated Timeline

| Task | Duration |
|------|----------|
| Chain config setup | 2 hours |
| Deploy to Base + Arbitrum | 2 hours |
| Frontend chain selector | 4 hours |
| Database schema update | 2 hours |
| Update all queries with chainId | 4 hours |
| Multi-chain indexer | 4 hours |
| Testing per chain | 2 hours each |
| **Total for 2 chains** | **~3 days** |
| **Each additional chain** | **+4 hours** |

---

## Track 2: Solana Expansion

### Overview

Solana requires a complete rewrite of smart contracts in Rust using the Anchor framework. This is a separate codebase that will run alongside the EVM contracts.

### Architecture Comparison

| Component | EVM | Solana |
|-----------|-----|--------|
| Language | Solidity | Rust |
| Framework | Hardhat | Anchor |
| Token Standard | ERC20 | SPL Token |
| DEX | Uniswap/PancakeSwap | Raydium/Orca |
| Wallet | MetaMask | Phantom/Solflare |
| RPC | Alchemy/Infura | Helius/QuickNode |
| Account Model | Contract Storage | Program Derived Addresses (PDAs) |

### Phase 1: Project Setup

#### 1.1 Initialize Anchor Project

```bash
# In project root
mkdir solana-contracts
cd solana-contracts

# Initialize Anchor project
anchor init fair_launch --javascript
cd fair_launch
```

#### 1.2 Project Structure

```
solana-contracts/
├── programs/
│   └── fair_launch/
│       └── src/
│           ├── lib.rs              # Main program entry
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── create_launch.rs
│           │   ├── commit.rs
│           │   ├── finalize.rs
│           │   ├── claim.rs
│           │   └── refund.rs
│           ├── state/
│           │   ├── mod.rs
│           │   ├── launch.rs
│           │   └── commitment.rs
│           └── errors.rs
├── tests/
│   └── fair_launch.ts
├── migrations/
├── Anchor.toml
└── Cargo.toml
```

### Phase 2: Solana Smart Contracts

#### 2.1 Core Data Structures

```rust
// programs/fair_launch/src/state/launch.rs
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct FairLaunch {
    // Authority
    pub authority: Pubkey,          // Creator
    pub bump: u8,                   // PDA bump

    // Token info
    pub token_mint: Pubkey,         // SPL Token mint
    pub token_supply: u64,          // Total tokens for distribution

    // ICO parameters
    pub minimum_raise: u64,         // Minimum SOL in lamports
    pub start_time: i64,
    pub end_time: i64,

    // State
    pub status: LaunchStatus,
    pub total_committed: u64,       // Total SOL committed
    pub participant_count: u32,

    // Treasury
    pub treasury: Pubkey,           // Treasury account

    // LP Config
    pub lp_sol_bps: u16,            // % of SOL for LP
    pub lp_tokens: u64,             // Tokens reserved for LP
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum LaunchStatus {
    #[default]
    Pending,
    Active,
    Finalized,
    Failed,
}

// Size calculation for account allocation
impl FairLaunch {
    pub const SIZE: usize = 8 +     // discriminator
        32 +                         // authority
        1 +                          // bump
        32 +                         // token_mint
        8 +                          // token_supply
        8 +                          // minimum_raise
        8 +                          // start_time
        8 +                          // end_time
        1 +                          // status
        8 +                          // total_committed
        4 +                          // participant_count
        32 +                         // treasury
        2 +                          // lp_sol_bps
        8 +                          // lp_tokens
        64;                          // padding
}
```

#### 2.2 Commitment Account

```rust
// programs/fair_launch/src/state/commitment.rs
use anchor_lang::prelude::*;

#[account]
pub struct Commitment {
    pub fair_launch: Pubkey,        // Parent launch
    pub user: Pubkey,               // Committer
    pub amount: u64,                // SOL committed in lamports
    pub has_claimed: bool,
    pub has_refunded: bool,
    pub bump: u8,
}

impl Commitment {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1 + 32;
}
```

#### 2.3 Create Launch Instruction

```rust
// programs/fair_launch/src/instructions/create_launch.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::*;

#[derive(Accounts)]
#[instruction(
    token_supply: u64,
    minimum_raise: u64,
    duration_seconds: i64,
    lp_sol_bps: u16,
    lp_token_bps: u16,
)]
pub struct CreateLaunch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = FairLaunch::SIZE,
        seeds = [b"fair_launch", token_mint.key().as_ref()],
        bump
    )]
    pub fair_launch: Account<'info, FairLaunch>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = fair_launch,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_token_account.owner == authority.key(),
        constraint = creator_token_account.mint == token_mint.key(),
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateLaunch>,
    token_supply: u64,
    minimum_raise: u64,
    duration_seconds: i64,
    lp_sol_bps: u16,
    lp_token_bps: u16,
) -> Result<()> {
    let fair_launch = &mut ctx.accounts.fair_launch;
    let clock = Clock::get()?;

    // Validation
    require!(token_supply > 0, ErrorCode::InvalidSupply);
    require!(minimum_raise > 0, ErrorCode::InvalidMinimum);
    require!(duration_seconds >= 86400, ErrorCode::DurationTooShort); // 1 day min
    require!(lp_sol_bps <= 5000, ErrorCode::InvalidLpConfig); // Max 50%

    // Calculate LP tokens
    let lp_tokens = (token_supply as u128 * lp_token_bps as u128 / 10000) as u64;
    let total_tokens = token_supply + lp_tokens;

    // Set state
    fair_launch.authority = ctx.accounts.authority.key();
    fair_launch.bump = ctx.bumps.fair_launch;
    fair_launch.token_mint = ctx.accounts.token_mint.key();
    fair_launch.token_supply = token_supply;
    fair_launch.minimum_raise = minimum_raise;
    fair_launch.start_time = clock.unix_timestamp + 3600; // 1 hour delay
    fair_launch.end_time = fair_launch.start_time + duration_seconds;
    fair_launch.status = LaunchStatus::Pending;
    fair_launch.total_committed = 0;
    fair_launch.participant_count = 0;
    fair_launch.lp_sol_bps = lp_sol_bps;
    fair_launch.lp_tokens = lp_tokens;

    // Transfer tokens to vault
    anchor_spl::token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.creator_token_account.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        total_tokens,
    )?;

    emit!(LaunchCreated {
        launch: fair_launch.key(),
        authority: fair_launch.authority,
        token_mint: fair_launch.token_mint,
        token_supply,
        minimum_raise,
        start_time: fair_launch.start_time,
        end_time: fair_launch.end_time,
    });

    Ok(())
}

#[event]
pub struct LaunchCreated {
    pub launch: Pubkey,
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_supply: u64,
    pub minimum_raise: u64,
    pub start_time: i64,
    pub end_time: i64,
}
```

#### 2.4 Commit SOL Instruction

```rust
// programs/fair_launch/src/instructions/commit.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Commit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"fair_launch", fair_launch.token_mint.as_ref()],
        bump = fair_launch.bump,
    )]
    pub fair_launch: Account<'info, FairLaunch>,

    #[account(
        init_if_needed,
        payer = user,
        space = Commitment::SIZE,
        seeds = [b"commitment", fair_launch.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub commitment: Account<'info, Commitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Commit>, amount: u64) -> Result<()> {
    let fair_launch = &mut ctx.accounts.fair_launch;
    let commitment = &mut ctx.accounts.commitment;
    let clock = Clock::get()?;

    // Validation
    require!(amount > 0, ErrorCode::ZeroAmount);
    require!(clock.unix_timestamp >= fair_launch.start_time, ErrorCode::NotStarted);
    require!(clock.unix_timestamp <= fair_launch.end_time, ErrorCode::AlreadyEnded);

    // Update status on first commit
    if fair_launch.status == LaunchStatus::Pending {
        fair_launch.status = LaunchStatus::Active;
    }
    require!(fair_launch.status == LaunchStatus::Active, ErrorCode::NotActive);

    // Track new participant
    if commitment.amount == 0 {
        fair_launch.participant_count += 1;
        commitment.fair_launch = fair_launch.key();
        commitment.user = ctx.accounts.user.key();
        commitment.bump = ctx.bumps.commitment;
    }

    // Transfer SOL to fair launch PDA
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: fair_launch.to_account_info(),
            },
        ),
        amount,
    )?;

    commitment.amount += amount;
    fair_launch.total_committed += amount;

    emit!(Committed {
        launch: fair_launch.key(),
        user: ctx.accounts.user.key(),
        amount,
        total_committed: fair_launch.total_committed,
    });

    Ok(())
}

#[event]
pub struct Committed {
    pub launch: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub total_committed: u64,
}
```

#### 2.5 Finalize with Raydium LP

```rust
// programs/fair_launch/src/instructions/finalize.rs
use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"fair_launch", fair_launch.token_mint.as_ref()],
        bump = fair_launch.bump,
    )]
    pub fair_launch: Account<'info, FairLaunch>,

    #[account(mut)]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: Treasury receives funds
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    // Raydium accounts for LP creation
    // ... (complex - requires Raydium CPI)

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Finalize>) -> Result<()> {
    let fair_launch = &mut ctx.accounts.fair_launch;
    let clock = Clock::get()?;

    require!(fair_launch.status == LaunchStatus::Active, ErrorCode::NotActive);
    require!(clock.unix_timestamp > fair_launch.end_time, ErrorCode::NotEnded);
    require!(fair_launch.total_committed >= fair_launch.minimum_raise, ErrorCode::MinimumNotMet);

    fair_launch.status = LaunchStatus::Finalized;

    // Calculate amounts
    let platform_fee = fair_launch.total_committed * 100 / 10000; // 1%
    let lp_amount = fair_launch.total_committed * fair_launch.lp_sol_bps as u64 / 10000;
    let treasury_amount = fair_launch.total_committed - platform_fee - lp_amount;

    // TODO: Create Raydium LP pool with lp_amount SOL and lp_tokens
    // This requires CPI to Raydium's AMM program

    // Transfer to treasury
    **fair_launch.to_account_info().try_borrow_mut_lamports()? -= treasury_amount;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? += treasury_amount;

    emit!(Finalized {
        launch: fair_launch.key(),
        total_committed: fair_launch.total_committed,
        participant_count: fair_launch.participant_count,
    });

    Ok(())
}
```

#### 2.6 Error Definitions

```rust
// programs/fair_launch/src/errors.rs
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid token supply")]
    InvalidSupply,

    #[msg("Invalid minimum raise amount")]
    InvalidMinimum,

    #[msg("Duration too short (minimum 1 day)")]
    DurationTooShort,

    #[msg("Invalid LP configuration")]
    InvalidLpConfig,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("ICO has not started yet")]
    NotStarted,

    #[msg("ICO has already ended")]
    AlreadyEnded,

    #[msg("ICO is not active")]
    NotActive,

    #[msg("ICO has not ended yet")]
    NotEnded,

    #[msg("Minimum raise not met")]
    MinimumNotMet,

    #[msg("ICO is not finalized")]
    NotFinalized,

    #[msg("ICO has not failed")]
    NotFailed,

    #[msg("No commitment found")]
    NoCommitment,

    #[msg("Already claimed")]
    AlreadyClaimed,

    #[msg("Already refunded")]
    AlreadyRefunded,
}
```

### Phase 3: Frontend Solana Integration

#### 3.1 Install Dependencies

```bash
pnpm add @solana/web3.js @solana/wallet-adapter-base @solana/wallet-adapter-react \
  @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets @coral-xyz/anchor
```

#### 3.2 Wallet Provider Setup

```tsx
// providers/solana-provider.tsx
'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo } from 'react';

import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

#### 3.3 Solana Fair Launch Hook

```typescript
// lib/solana/hooks/useSolanaFairLaunch.ts
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useMemo } from 'react';
import { IDL, FairLaunch } from '../idl/fair_launch';

const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID');

export function useSolanaFairLaunch() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;

    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );

    return new Program<FairLaunch>(IDL, PROGRAM_ID, provider);
  }, [connection, wallet]);

  const createFairLaunch = async (params: {
    tokenMint: PublicKey;
    tokenSupply: number;
    minimumRaise: number;
    durationSeconds: number;
    lpSolBps: number;
    lpTokenBps: number;
  }) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const [fairLaunchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fair_launch'), params.tokenMint.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .createLaunch(
        new BN(params.tokenSupply),
        new BN(params.minimumRaise * LAMPORTS_PER_SOL),
        new BN(params.durationSeconds),
        params.lpSolBps,
        params.lpTokenBps
      )
      .accounts({
        authority: wallet.publicKey,
        fairLaunch: fairLaunchPda,
        tokenMint: params.tokenMint,
        // ... other accounts
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { txHash: tx, fairLaunch: fairLaunchPda.toString() };
  };

  const commit = async (fairLaunch: PublicKey, amountSol: number) => {
    if (!program || !wallet.publicKey) throw new Error('Wallet not connected');

    const [commitmentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('commitment'), fairLaunch.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .commit(new BN(amountSol * LAMPORTS_PER_SOL))
      .accounts({
        user: wallet.publicKey,
        fairLaunch,
        commitment: commitmentPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  };

  return {
    program,
    createFairLaunch,
    commit,
    // ... other methods
  };
}
```

#### 3.4 Chain Type Detection

```typescript
// lib/hooks/useChainType.ts
import { useChainId } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';

export type ChainType = 'evm' | 'solana';

export function useChainType(): ChainType {
  const evmChainId = useChainId();
  const solanaWallet = useWallet();

  // If Solana wallet is connected and no EVM chain, use Solana
  if (solanaWallet.connected && !evmChainId) {
    return 'solana';
  }

  return 'evm';
}

export function useIsEVM() {
  return useChainType() === 'evm';
}

export function useIsSolana() {
  return useChainType() === 'solana';
}
```

### Phase 4: Unified UI Components

```tsx
// components/fair-launch-form-unified.tsx
'use client';

import { useChainType } from '@/lib/hooks/useChainType';
import { useFairLaunch } from '@/lib/blockchain/hooks/useFairLaunch';
import { useSolanaFairLaunch } from '@/lib/solana/hooks/useSolanaFairLaunch';

export function UnifiedFairLaunchForm() {
  const chainType = useChainType();

  // Use appropriate hook based on chain type
  const evmHook = useFairLaunch();
  const solanaHook = useSolanaFairLaunch();

  const createLaunch = async (params: LaunchParams) => {
    if (chainType === 'solana') {
      return solanaHook.createFairLaunch({
        tokenMint: new PublicKey(params.tokenAddress),
        tokenSupply: params.tokenSupply,
        minimumRaise: params.minimumRaise,
        durationSeconds: params.durationDays * 86400,
        lpSolBps: params.lpPercent * 100,
        lpTokenBps: params.lpPercent * 100,
      });
    } else {
      return evmHook.createFairLaunch(params);
    }
  };

  // ... rest of form
}
```

### Phase 5: Database Schema for Solana

```prisma
// prisma/schema.prisma additions

enum ChainType {
  EVM
  SOLANA
}

model Token {
  id              String    @id @default(cuid())
  chainType       ChainType @default(EVM)
  chainId         Int?      // For EVM chains
  solanaCluster   String?   // 'mainnet-beta', 'devnet' for Solana
  address         String    // Contract address or mint address
  // ... existing fields

  @@unique([chainType, chainId, address])
  @@unique([chainType, solanaCluster, address])
}

model FairLaunch {
  id              String    @id @default(cuid())
  chainType       ChainType @default(EVM)
  chainId         Int?
  solanaCluster   String?
  // ... existing fields
}
```

### Solana Deployment Checklist

- [ ] Set up Anchor development environment
- [ ] Write and test all program instructions
- [ ] Deploy to Solana Devnet
- [ ] Verify program on Solana Explorer
- [ ] Integrate Raydium SDK for LP creation
- [ ] Add Phantom/Solflare wallet support to frontend
- [ ] Create Solana-specific hooks
- [ ] Update database schema
- [ ] Build Solana indexer (using Helius webhooks or similar)
- [ ] Test full flow on Devnet
- [ ] Deploy to Mainnet-beta

### Estimated Timeline for Solana

| Task | Duration |
|------|----------|
| Anchor project setup | 1 day |
| Core instructions (create, commit, finalize, claim, refund) | 5 days |
| Raydium LP integration | 3 days |
| Testing on localnet | 2 days |
| Frontend Solana wallet integration | 2 days |
| Solana hooks and API | 3 days |
| Database schema updates | 1 day |
| Solana indexer | 3 days |
| Devnet testing | 2 days |
| Bug fixes and polish | 3 days |
| **Total** | **~5-6 weeks** |

---

## Combined Roadmap

```
Week 1-2:   EVM Expansion (Base + Arbitrum)
Week 3:     EVM Expansion (Polygon + Avalanche)
Week 4-5:   Solana Anchor contracts
Week 6-7:   Solana Raydium integration
Week 8-9:   Solana frontend integration
Week 10:    Testing and polish
Week 11:    Mainnet deployments
```

---

## Risk Considerations

### EVM Chains
- **Low risk**: Same contracts, just deploy and configure
- **Bridge considerations**: Users may want to bridge tokens between chains
- **Gas costs**: Ethereum mainnet may be expensive for small launches

### Solana
- **Medium-high risk**: New codebase, different security model
- **Audit recommended**: Solana programs have different attack vectors
- **Raydium integration**: Complex, may require their SDK team's help
- **Account rent**: Solana requires rent for accounts (can be recovered)

---

## Resources

### EVM
- [Uniswap V2 Docs](https://docs.uniswap.org/contracts/v2/overview)
- [Base Docs](https://docs.base.org/)
- [Arbitrum Docs](https://docs.arbitrum.io/)

### Solana
- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Raydium SDK](https://github.com/raydium-io/raydium-sdk)
- [Helius RPC & Webhooks](https://docs.helius.dev/)
