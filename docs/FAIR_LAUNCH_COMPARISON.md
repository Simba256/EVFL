# Current vs Fair Launch System Comparison

> Side-by-side comparison of the existing weighted pool system and the proposed fair launch system

**Related Documents:**
- [FAIR_LAUNCH_SYSTEM.md](./FAIR_LAUNCH_SYSTEM.md) - Full specification
- [FAIR_LAUNCH_DECISIONS.md](./FAIR_LAUNCH_DECISIONS.md) - Decision matrix
- [V1_IMPLEMENTATION_PLAN.md](./V1_IMPLEMENTATION_PLAN.md) - Implementation plan
- [TECHNICAL_SPECIFICATIONS.md](./TECHNICAL_SPECIFICATIONS.md) - Complete technical details
- [ARCHITECTURE_AND_BEST_PRACTICES.md](./ARCHITECTURE_AND_BEST_PRACTICES.md) - Architecture & coding standards

---

## Quick Comparison

| Aspect | Current System (Weighted Pool) | Fair Launch System (v1) |
|--------|------------------------------|------------------------|
| **Launch Type** | Instant AMM | ICO period (user-configurable) |
| **Pricing** | Bonding curve | Single fixed price |
| **Who Gets In** | First come, first served | Everyone pro-rata |
| **Price Discovery** | Market-driven from start | ICO price, then market |
| **Price Protection** | None | None (bid wall in v2+) |
| **Treasury** | None | Multisig + Timelock |
| **Team Tokens** | None | Optional (locked in treasury) |
| **Rug Risk** | High | Low (timelock + transparency) |

---

## 1. Token Launch Flow

### Current System (Weighted Pool)

```
User clicks "Launch Token"
         │
         ▼
┌─────────────────────┐
│  Fill Launch Form   │
│  • Name, Symbol     │
│  • Image, Desc      │
│  • Initial BNB      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pay Launch Fee     │
│  (0.01 BNB)         │
└──────────┬──────────┘
           │
           ▼ INSTANT
┌─────────────────────┐
│  Token Created      │
│  Pool Created       │
│  Trading LIVE       │
└─────────────────────┘

Time: ~30 seconds
```

### Fair Launch System (ICO - v1)

```
User clicks "Launch Token"
          │
          ▼
┌─────────────────────┐
│  Fill Launch Form   │
│  • Name, Symbol     │
│  • Image, Desc      │
│  • Token Supply     │
│  • Minimum Raise    │
│  • ICO Duration     │
│    (User chooses)   │
│  • Team Tokens?     │
│    (Optional)       │
└──────────┬──────────┘
            │
            ▼
┌─────────────────────┐
│  ICO Created        │
│  Status: PENDING    │
└──────────┬──────────┘
            │
            ▼ USER-CONFIGURED
┌─────────────────────┐
│  Commitment Period  │
│  Users deposit WBNB │
│  No trading yet     │
└──────────┬──────────┘
            │
            ▼
┌─────────────────────┐
│  ICO Finalized      │
│  • Tokens minted    │
│  • Allocations calc │
│  • Treasury funded  │
│  • LP created       │
│  • Platform fee     │
└──────────┬──────────┘
            │
            ▼
┌─────────────────────┐
│  Trading LIVE       │
│  (Weighted Pool)    │
└─────────────────────┘

Time: User-configured + finalization
```

---

## 2. Price Mechanics

### Current System

```
Price = f(reserves)

Initial: 80% TOKEN / 20% BNB weighted pool

Buy pressure  → Price goes UP
Sell pressure → Price goes DOWN

No floor, no ceiling
Early buyers get lower prices
```

**Example:**
- Launch: 1M tokens + 1 BNB → Price = ~0.00001 BNB
- After 10 BNB bought: Price = ~0.00015 BNB (15x)
- Early buyer: 15x gain
- Late buyer: Pays 15x more

### Fair Launch System

```
ICO Price = Total Raised / Token Supply

FIXED during ICO period

All participants pay SAME price

After launch:
  - Price can go up (market)
  - Price can go down (market)
  - BUT: Bid wall catches at ICO price
```

**Example:**
- ICO: 10M tokens offered
- $500,000 raised from 100 participants
- ICO Price: $0.05 per token
- ALL participants pay $0.05 per token
- Bid wall: Buys back at $0.05 if price drops

---

## 3. Participation Experience

### Current System

```
User A (Fast):
  • Sees launch announcement
  • Buys in first minute
  • Gets 100,000 tokens for 0.1 BNB
  • Price: 0.000001 BNB/token

User B (Slow):
  • Sees same announcement
  • Buys 30 minutes later
  • Gets 10,000 tokens for 0.1 BNB
  • Price: 0.00001 BNB/token

Result: User A has 10x more tokens for same investment
Winner: Fastest/bots
```

### Fair Launch System

```
User A (Early commit):
  • Commits 1 BNB on day 1
  • Waits for ICO to end

User B (Late commit):
  • Commits 1 BNB on day 4
  • Waits for ICO to end

ICO Ends:
  • Total raised: 100 BNB
  • Token supply: 10M
  • Price: 0.00001 BNB/token

User A receives: 100,000 tokens
User B receives: 100,000 tokens

Result: SAME tokens for same investment
Winner: Everyone equal
```

---

## 4. Smart Contract Architecture

### Current System

```
┌─────────────────────────────────────────────┐
│              TokenFactory                    │
│  • createToken()                            │
│  • Deploys: LaunchToken + WeightedPool      │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌───────────────────┐
│  LaunchToken  │    │   WeightedPool    │
│   (ERC20)     │    │                   │
│               │◄───│  • swap()         │
│  • transfer   │    │  • getSpotPrice() │
│  • approve    │    │  • join/exit      │
│  • balanceOf  │    │                   │
└───────────────┘    └───────────────────┘

Contracts: 2 per token
Complexity: Medium
```

### Fair Launch System

```
┌─────────────────────────────────────────────────────────────────┐
│                    LaunchFactory (New)                           │
│  • createFairLaunch()                                           │
│  • Deploys: ICOContract + LaunchToken + Treasury               │
└──────────────────────────────┬──────────────────────────────────┘
                                │
      ┌────────────┬────────────┼────────────┐
      ▼            ▼            ▼            ▼
┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐
│  ICO    │ │  Launch  │ │ Treasury │ │  v2+ Addons │
│Contract │ │  Token   │ │          │ │             │
│         │ │ (ERC20)  │ │ • Funds  │ │ • BidWall   │
│• commit │ │          │ │ • Govern │ │ • TeamVest  │
│• claim  │ │ • mint   │ │ • Spend  │ │             │
│• refund │ │ (owner:  │ │ • Timel. │ │             │
│         │ │ ICO)     │ │          │ │             │
└─────────┘ └──────────┘ └──────────┘ └─────────────┘
                                │
                                ▼
                       ┌───────────────┐
                       │ WeightedPool  │
                       │  (AMM)        │
                       └───────────────┘

Contracts: 4 per token (v1)
Complexity: Medium
```

---

## 5. User Journeys

### Buyer Journey

| Step | Current System | Fair Launch System |
|------|---------------|-------------------|
| 1 | Find token | Find ICO |
| 2 | Connect wallet | Connect wallet |
| 3 | Enter BNB amount | Enter commitment amount |
| 4 | Click "Buy" | Click "Commit" |
| 5 | **Receive tokens instantly** | **Wait for ICO to end (4 days)** |
| 6 | - | Click "Claim" |
| 7 | - | Receive tokens |
| 8 | Can sell immediately | Can sell immediately |
| 9 | No price protection | Bid wall protects price |

### Creator Journey

| Step | Current System | Fair Launch System |
|------|---------------|-------------------|
| 1 | Fill form (basic) | Fill form (detailed) |
| 2 | Pay fee (0.01 BNB) | Configure ICO parameters |
| 3 | Token + pool created | ICO created, wait 4 days |
| 4 | **Done** | ICO finalizes automatically |
| 5 | - | Treasury created with funds |
| 6 | - | Receive monthly budget access |
| 7 | Full control | Governance controls treasury |
| 8 | Can rug | Cannot rug (no mint, no treasury) |

---

## 6. Risk Comparison

### Current System Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Rug pull** | HIGH | None - creator has full control |
| **Bot sniping** | HIGH | None - first come first served |
| **Price manipulation** | MEDIUM | Pool math limits extreme moves |
| **Impermanent loss** | LOW | 80/20 weight reduces IL |
| **Smart contract bug** | MEDIUM | Audited contracts |

### Fair Launch System (v1) Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Rug pull** | LOW | Treasury controlled by multisig + timelock |
| **Bot sniping** | NONE | Pro-rata allocation |
| **Price manipulation** | MEDIUM | No bid wall in v1, but treasury transparency |
| **ICO fails** | MEDIUM | Full refund if minimum not met |
| **Governance attack** | LOW | Timelock delay (48h) + multisig |
| **Smart contract bug** | MEDIUM | More contracts = more risk (v1 has 4) |

### Fair Launch System (v2+) Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Rug pull** | LOW | Treasury governance, no mint |
| **Bot sniping** | NONE | Pro-rata allocation |
| **Price manipulation** | LOW | Bid wall creates floor |
| **ICO fails** | MEDIUM | Full refund if minimum not met |
| **Governance attack** | LOW | Timelock + thresholds |
| **Bid wall exhaustion** | MEDIUM | Time limit, burns reduce supply |
| **Smart contract bug** | MEDIUM | More contracts = more risk |

---

## 7. Fee Structure

### Current System

| Fee | Amount | When | To |
|-----|--------|------|-----|
| Launch fee | 0.01 BNB | Token creation | Platform |
| Swap fee | 0.3% | Each trade | LP holders |

### Fair Launch System (v1)

| Fee | Amount | When | To |
|-----|--------|------|-----|
| ICO fee | TBD (1-2%) | Finalization | Platform |
| Swap fee | 0.3% | Each trade | LP (treasury) |
| Governance fee | 0% | Proposals | None |

---

## 8. Database Changes

### Current Schema (Simplified)

```prisma
model Token {
  address     String
  name        String
  symbol      String
  poolAddress String
  // ... trading metrics
}

model Trade {
  tokenId     String
  type        String  // buy/sell
  amount      BigInt
  price       BigInt
}
```

### New Schema (Additions - v1)

```prisma
model Token {
  // ... existing fields ...

  // NEW: ICO relationship (v1)
  ico           ICO?
  treasury      Treasury?

  // v2+ additions (not in v1):
  // bidWall       BidWall?
  // teamVesting   TeamVesting?
}

model ICO {
  id              String
  tokenAddress    String
  icoAddress      String
  treasuryAddress String
  poolAddress     String

  status          ICOStatus
  minimumRaise    BigInt
  icoDuration     Int      // User-configurable
  totalCommitted  BigInt
  tokenPrice      BigInt?
  startTime       DateTime
  endTime         DateTime

  hasTeamTokens   Boolean  @default(false)
  teamTokensAmount BigInt   @default(0)
  teamWallet      String?

  commitments     Commitment[]
}

model Commitment {
  icoId           String
  userAddress     String
  amount          BigInt
  tokensAllocated BigInt?
  refundAmount    BigInt?
  claimed         Boolean
  refunded        Boolean
}

model Treasury {
  tokenAddress    String
  totalFunds      BigInt
  monthlyBudget   BigInt?
  currentSpent   BigInt
  multisigAddress String
  timelockAddress String
}

// v2+ additions (not in v1):
// model BidWall { ... }
// model TeamVesting { ... }
```

---

## 9. Frontend Changes

### Pages to Modify

| Page | Changes |
|------|---------|
| `/launch` | Add option: Fair Launch vs Instant Launch |
| `/token/[symbol]` | Show ICO status (if token has ICO) |
| `/` (home) | Show "Active ICOs" section |

### New Pages (v1)

| Page | Purpose |
|------|---------|
| `/fair-launch/new` | Create fair launch form |
| `/fair-launch/[address]` | ICO detail page with commitment UI |
| `/treasury/[address]` | Treasury dashboard, pending actions |

### New Pages (v2+)

| Page | Purpose |
|------|---------|
| `/bid-wall/[address]` | Bid wall status, buyback history |
| `/vesting/[address]` | Team vesting status, unlock progress |

### New Components

| Component | Purpose | Version |
|-----------|---------|----------|
| `FairLaunchForm` | Configure ICO parameters | v1 |
| `CommitmentPanel` | Deposit WBNB during ICO | v1 |
| `ClaimTokensPanel` | Claim tokens after ICO | v1 |
| `ICOSummary` | Show ICO status, progress bar | v1 |
| `TreasuryDashboard` | Treasury balance, spending, pending actions | v1 |
| `BidWallStatus` | Show remaining bid wall funds | v2+ |
| `VestingProgress` | Team unlock milestones | v2+ |
| `ICOCountdown` | Time remaining in ICO | v1 |
| `ProRataCalculator` | Estimate allocation | v1 |

---

## 10. Indexer Changes

### New Events to Index (v1)

```typescript
// ICO Events
'ICOCreated'
'Committed'
'ICOFinalized'
'TokensClaimed'
'ICOFailed'

// Treasury Events
'FundsReceived'
'Spent'

// v2+ Events (not in v1)
// 'BidWallFunded'
// 'BuybackExecuted'
// 'TeamUnlockClaimed'
```

### New Indexer Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `indexICOEvents` | 5s | Track commitments, claims |
| `indexBidWallEvents` | 5s | Track buybacks, burns |
| `indexTreasuryEvents` | 5s | Track spending, proposals |
| `checkICOFinalization` | 1m | Auto-finalize ended ICOs |
| `refreshBidWallMetrics` | 1m | Calculate remaining funds |

---

## 11. Migration Strategy

### Phase 1: Parallel Systems

```
Week 1-2:
┌─────────────────────────────────────────────────┐
│  Current System (Weighted Pools)                │
│  ✓ Continue operating                           │
│  ✓ Existing tokens work normally                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  New System (Fair Launch) - TESTNET             │
│  • Deploy contracts                             │
│  • Test ICO flow                                │
│  • Test bid wall                                │
└─────────────────────────────────────────────────┘
```

### Phase 2: Soft Launch

```
Week 3-4:
┌─────────────────────────────────────────────────┐
│  Current System                                 │
│  ✓ Still available                              │
│  ⚠ Marked as "Legacy"                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  New System - MAINNET                           │
│  • Launch with 1-2 test ICOs                    │
│  • Monitor closely                              │
│  • Collect feedback                             │
└─────────────────────────────────────────────────┘
```

### Phase 3: Full Transition

```
Week 5+:
┌─────────────────────────────────────────────────┐
│  Current System                                 │
│  ✗ New launches disabled                        │
│  ✓ Existing pools still tradeable               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  New System                                     │
│  ✓ All new launches use ICO                     │
│  ✓ Full feature set                             │
└─────────────────────────────────────────────────┘
```

---

## Summary: Key Differences

| Aspect | Current (Weighted Pool) | Fair Launch (v1.0) | Winner |
|--------|----------------------|-------------------|--------|
| **Fairness** | Bots/fast win | Everyone equal | Fair Launch |
| **Price stability** | Volatile | Volatile (bid wall in v2.0) | Tie |
| **Rug protection** | None | Multisig + Timelock | Fair Launch |
| **Launch speed** | Instant | 1-14 days configurable | Current |
| **Complexity** | Simple | Medium | Current |
| **UX** | Easy | More steps (commit → wait → claim) | Current |
| **Trust required** | High (in creator) | Medium (in code + multisig) | Fair Launch |

### Version Roadmap

| Version | Key Features |
|---------|--------------|
| **v0.1-v1.0** | Core ICO, Treasury, Frontend, Production |
| **v1.1** | Team vesting (time-based) |
| **v1.2** | Emergency pause |
| **v2.0** | Bid wall (price protection) |
| **v2.1** | Performance-based unlock multiples |
| **v3.0** | Token voting governance |

**Conclusion**: Fair Launch v1.0 improves fairness and rug protection at the cost of launch speed and complexity. v2.0+ adds price protection via bid wall.
