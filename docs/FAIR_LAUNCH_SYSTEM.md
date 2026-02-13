# Fair Launch System - Implementation Specification

> Based on MetaDAO's "Unruggable Capital Formation" model, adapted for BSC

## Table of Contents

1. [Overview](#1-overview)
2. [ICO Mechanism](#2-ico-mechanism)
3. [Treasury & Governance](#3-treasury--governance)
4. [Liquidity & AMM](#4-liquidity--amm)
5. [Team Tokens](#5-team-tokens)
6. [Technical Architecture](#6-technical-architecture)
7. [Migration Strategy](#7-migration-strategy)

---

## Version Roadmap

| Version | Scope | Status |
|---------|-------|--------|
| **v0.1** | Core ICO Contract | 📋 Planning |
| **v0.2** | Treasury + Multisig + Timelock | 📋 Planning |
| **v0.3** | Database + Indexer | 📋 Planning |
| **v0.4** | Frontend Integration | 📋 Planning |
| **v0.5** | Testing + Testnet | 📋 Planning |
| **v1.0** | Production Release | 📋 Planning |
| **v1.1** | Team Vesting (Time-Based) | 🔮 Future |
| **v1.2** | Emergency Pause | 🔮 Future |
| **v2.0** | Bid Wall (Price Protection) | 🔮 Future |
| **v2.1** | Performance-Based Unlocks | 🔮 Future |
| **v3.0** | Token Voting Governance | 🔮 Future |

See [V1_IMPLEMENTATION_PLAN.md](./V1_IMPLEMENTATION_PLAN.md) for detailed implementation plan.
See [FAIR_LAUNCH_DECISIONS.md](./FAIR_LAUNCH_DECISIONS.md) for all decisions.

---

---

## 1. Overview

### 1.1 Current System (Weighted Pool Model)

Our current implementation uses Balancer-style weighted pools:
- 80/20 token/WBNB ratio
- Instant trading via AMM
- Bonding curve-like price discovery
- No price floor protection
- Team retains control

### 1.2 Proposed System (Fair Launch Model)

The new system implements MetaDAO-style fair launches:
- **Equal Price for All**: Single ICO price, no private/seed rounds
- **Pro-Rata Allocation**: Tokens distributed proportionally to contributions
- **Bid Wall Protection**: Price floor at ICO price using excess funds
- **Governance-Controlled Treasury**: No single party controls funds
- **Performance Unlocks**: Team tokens tied to price milestones

### 1.3 Key Benefits (v1)

| Benefit | Description |
|---------|-------------|
| **Fair Distribution** | Everyone pays the same price (pro-rata allocation) |
| **Anti-Rug** | Treasury controlled by multisig + timelock, not founders |
| **Equal Opportunity** | No bot sniping, 4-day (configurable) commitment period |
| **Transparent Treasury** | All spends visible with 48h delay |
| **Optional Team Tokens** | Creators choose if they want team allocation |

### 1.4 Key Benefits (v2+ Future)

| Benefit | Description | Version |
|---------|-------------|----------|
| **Price Protection** | Bid wall creates floor at launch price | v2 |
| **Aligned Incentives** | Team earns only if token performs (price milestones) | v2 |
| **Reduced Volatility** | Treasury acts as market maker via buybacks | v2 |

---

## 2. ICO Mechanism

### 2.1 ICO Parameters (v1)

Each token launch requires the following parameters:

```solidity
struct ICOConfig {
    // Token Details
    string name;
    string symbol;
    string imageURI;
    string description;

    // ICO Parameters (v1)
    uint256 tokenSupply;          // Total tokens to mint (e.g., 10,000,000)
    uint256 icoAllocation;        // Tokens for ICO (e.g., 10,000,000 = 100%)
    uint256 minimumRaise;         // Minimum WBNB to proceed (e.g., $10,000)
    uint256 icoDuration;          // Duration in seconds (USER-CONFIGURABLE, e.g., 4 days)

    // Treasury Parameters (v1)
    uint256 liquidityPercent;     // % of raise for liquidity (e.g., 20%)
    uint256 liquidityTokens;      // Tokens for liquidity pool
    uint256 monthlyBudget;        // Optional spending limit for team

    // Team Allocation (Optional - v1)
    bool enableTeamTokens;        // Whether to mint team tokens
    uint256 teamAllocation;       // Additional tokens for team (locked in treasury)
    address teamWallet;          // Team wallet address

    // Platform Fee (v1)
    uint256 platformFeePercent;  // Fee taken by platform (e.g., 1% = 100 basis points)
}
```

### 2.2 ICO Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ICO LIFECYCLE (v1)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. CREATION          2. COMMITMENT        3. FINALIZATION          │
│  ────────────         ─────────────        ───────────────          │
│  • Set parameters     • Users deposit      • Check minimum met      │
│  • Deploy contracts   • Track commits      • Calculate allocations  │
│  • Start timer        • No withdrawals     • Distribute tokens      │
│                       • User-configured   • Setup treasury         │
│                       • Duration          • Create liquidity       │
│                                                                     │
│  [Failed ICO: Minimum not met → Full refunds to all participants]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Allocation Formula (v1)

All participants receive tokens at the same price:

```
User Allocation = (User Contribution / Total Contributions) × ICO Token Supply

ICO Price = Total Accepted Contributions / ICO Token Supply
```

**Example:**
- Total ICO Supply: 10,000,000 tokens
- Total Contributions: $5,000,000 USDC
- User A Contribution: $10,000 USDC
- User A Allocation: ($10,000 / $5,000,000) × 10,000,000 = 20,000 tokens
- ICO Price: $5,000,000 / 10,000,000 = $0.50 per token

### 2.4 v1: Uncapped Raises

**Decision**: v1 uses **uncapped** raises (no maximum limit).

**Rationale**:
- Simpler implementation
- True demand signal from participants
- No gaming risk (over-committing to get allocation)
- All tokens distributed to participants at same price

**Allocation Formula**:
```
Token Price = Total Raised / Token Supply
User Allocation = (User Contribution / Total Raised) × Token Supply
```

---

### 2.5 v2+: Discretionary Cap (Optional)

Founders can set a maximum they'll accept:

```
If Total Contributions > Maximum Raise:
    Accepted = Maximum Raise
    Refund per User = User Contribution × (1 - Maximum Raise / Total Contributions)
```

**Example:**
- Maximum Raise: $1,000,000
- Total Contributions: $2,000,000
- User Contribution: $10,000
- User Receives: 50% tokens + 50% refund ($5,000)

### 2.6 Decision: Capped vs Uncapped

| Approach | Pros | Cons |
|----------|------|------|
| **Capped** | Predictable raise, controlled dilution | Gaming (over-commit for allocation) |
| **Uncapped** | True demand signal | Unpredictable dilution |
| **Discretionary** | Founder flexibility | Requires trust |

**v1 Decision**: Uncapped with minimum ($10,000)

---

## 3. Treasury & Governance (v1)

> **Note**: Bid Wall system is **deferred to v2+**. See section [Bid Wall System (v2+)](#bid-wall-system-v2).

### 3.1 Treasury Structure (v1)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TREASURY STRUCTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    GOVERNANCE TREASURY                       │   │
│  │  • Holds: Remaining ICO funds + LP tokens + Token reserves  │   │
│  │  • Controlled by: Token holder governance                    │   │
│  │  • Minting: Only via governance proposal                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│     │   Monthly   │  │  Proposal   │  │   Return    │              │
│     │   Budget    │  │   Spending  │  │  to Holders │              │
│     │  (No vote)  │  │  (Requires  │  │  (Requires  │              │
│     │             │  │   vote)     │  │   vote)     │              │
│     └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Governance Options

**Option A: Simple Timelock + Multisig (v1 Decision)**
- Team multisig with timelock delay
- Community can see pending transactions
- Simpler but less decentralized

**Option B: Token Voting (Governor) (v2+)**
- OpenZeppelin Governor pattern
- Token holders vote on proposals
- Standard DAO governance

**Option C: Futarchy (Market-Based) (v2+)**
- Prediction markets decide proposals
- Most complex, most aligned with MetaDAO
- Requires conditional token infrastructure

### 3.3 Spending Limits (Optional)

```solidity
struct SpendingConfig {
    uint256 monthlyLimit;         // BNB/USDC team can spend without vote
    uint256 currentMonthSpent;    // Tracking
    uint256 monthStartTime;       // Reset timer
    address[] authorizedSpenders; // Who can spend within limit
}
```

### 3.4 Anti-Rug Mechanisms

| Mechanism | Implementation |
|-----------|----------------|
| **No Team Mint** | Minting authority transferred to governance |
| **Timelock** | All treasury actions have delay (e.g., 48h) |
| **Spending Caps** | Monthly limits on team spending |
| **Return Mechanism** | Governance can vote to return funds to holders |
| **Transparent** | All actions on-chain, indexed for UI |

### 3.5 Decision: Governance Model (v1)

**Decisions Made:**
1. **Model**: Multisig + Timelock (v1)
2. **Timelock Delay**: TBD (24h, 48h, 7 days?)
3. **Monthly Budget Limits**: Optional (configurable per launch)
4. **Futarchy**: Deferred to v2+

**Questions Remaining:**
1. What timelock delay? (24h, 48h, 7 days?)
2. Multisig config: How many signers? How many required? (3/5, 2/3?)

---

## 4. Liquidity & AMM (v1)

---

## 5. Liquidity & AMM

### 4.1 Initial Liquidity Setup (v1)

After successful ICO:

```
Liquidity Pool Funding:
├── From ICO Raise: 20% of accepted funds
├── From Token Supply: ~29% of total (2.9M of 10M in MetaDAO model)
└── Result: Deep initial liquidity at ICO price
```

### 4.2 AMM Options

| AMM Type | Pros | Cons |
|----------|------|------|
| **Uniswap V2 Style** | Simple, proven, easy integration | Capital inefficient |
| **Uniswap V3 Style** | Concentrated liquidity, efficient | Complex, requires management |
| **Balancer Weighted** | Flexible weights, our current system | More complex math |
| **Custom TWAP AMM** | MetaDAO style, governance integration (v2+) | Custom development |

**v1 Decision**: Keep Weighted Pool (already deployed and tested)

### 4.3 Treasury as Market Maker (v2+)

The treasury acts as a stabilizing force via bid wall:

```
IF price < ICO_PRICE:
    Treasury BUYS tokens (price support)
    Reduces circulating supply

IF price > ICO_PRICE:
    Treasury SELLS tokens (provide liquidity)
    Increases circulating supply
    Generates revenue for treasury
```

**v1 Note**: Bid wall not implemented in v1, so treasury does not actively participate in trading.

### 4.4 LP Token Handling

**Options:**
1. **Lock Forever**: LP tokens locked in treasury permanently
2. **Governance Controlled**: Token holders can vote on LP actions
3. **Time-Locked**: LP locked for fixed period, then governance controlled

### 4.5 Decision: Liquidity Model (v1)

**Decisions Made:**
1. **AMM Type**: Keep Weighted Pool (already deployed on BSC testnet)
2. **Liquidity Allocation**: 20% of raise
3. **Liquidity Tokens**: ~29% of total token supply
4. **LP Token Ownership**: Treasury-controlled (via multisig + timelock)

---

## 5. Team Tokens (Optional - v1)

### 5.1 Team Token Structure (v1)

**Decision**: Team tokens are **optional** in v1. If creator opts in:

```
Total Supply: Token Supply + Team Tokens (optional)
├── ICO Allocation: Token Supply (100% of ICO allocation)
├── Liquidity: 20% of raise (funds) + ~29% of tokens
├── Treasury: 80% of raise (funds)
└── Team (Optional): Sent to treasury, LOCKED

Team Token Status (v1):
- If enabled: Minted and locked in treasury
- No unlock milestones (v1)
- Can only be spent via treasury governance
```

**v2+ Enhancement**: Team tokens would have performance-based unlock multiples (see section [Performance-Based Unlocks (v2+)](#performance-based-unlocks-v2)).

---

## 6. Bid Wall System (v2+)

> **Status**: DEFERRED to v2+ implementation

### 6.1 Concept (v2+)

The bid wall creates a price floor by using excess ICO funds to buy back tokens:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FUND ALLOCATION (v2+)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Total Raise: $5,000,000                                            │
│  ├── Minimum Goal: $3,000,000 (Team runway)                         │
│  │   ├── Liquidity Pool: $600,000 (20%)                             │
│  │   └── Treasury: $2,400,000 (80%)                                 │
│  │                                                                  │
│  └── Excess: $2,000,000 → BID WALL (v2+)                          │
│      • Places buy orders at ICO price                               │
│      • Active for 90 days                                          │
│      • Tokens bought are BURNED or HELD                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Bid Wall Mechanics (v2+)

**Option A: Automated Buyback Contract**
- Smart contract that buys when price < ICO price
- Works with any AMM
- Simpler implementation

**Option B: Limit Order Book**
- Place actual limit orders on DEX
- Requires compatible order book (not standard AMM)
- More complex implementation

### 6.3 Bid Wall Strategies (v2+)

| Strategy | Description | Trade-offs |
|----------|-------------|------------|
| **Fixed Price** | Buy at exact ICO price | Strong floor, may exhaust quickly |
| **Tiered** | Buy more aggressively at lower prices | Extends duration, weaker floor |
| **Time-Decay** | Reduce buy price over time | Natural wind-down |

---

## 7. Performance-Based Unlocks (v2+)

> **Status**: DEFERRED to v2+ implementation

### 7.1 Team Token Structure (v2+)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEAM TOKEN ALLOCATION (v2+)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Total Supply: 25,800,000 tokens (if team opts in)                  │
│  ├── ICO Allocation: 10,000,000 (38.8%)                             │
│  ├── Liquidity: 2,900,000 (11.2%)                                   │
│  └── Team (Locked): 12,900,000 (50%) - PERFORMANCE BASED            │
│                                                                     │
│  Team Unlock Schedule:                                              │
│  ┌────────────┬──────────────┬─────────────────────┐               │
│  │  Multiple  │  % Unlocked  │  Cumulative         │               │
│  ├────────────┼──────────────┼─────────────────────┤               │
│  │  2x        │  10%         │  1,290,000 tokens   │               │
│  │  4x        │  15%         │  3,225,000 tokens   │               │
│  │  8x        │  25%         │  6,450,000 tokens   │               │
│  │  16x       │  25%         │  9,675,000 tokens   │               │
│  │  32x       │  25%         │  12,900,000 tokens  │               │
│  └────────────┴──────────────┴─────────────────────┘               │
│                                                                     │
│  Minimum Lock: 18 months (even if multiples hit earlier)            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Price Oracle (v2+)

To determine if unlock thresholds are met:

**Option A: TWAP (Time-Weighted Average Price)**
- Average price over period (e.g., 7 days)
- Resistant to manipulation
- Industry standard

**Option B: Chainlink Oracle**
- External price feed
- Most reliable for established tokens
- Requires Chainlink support

**Option C: On-Chain TWAP from AMM**
- Read directly from liquidity pool
- No external dependency
- Can be manipulated with enough capital

### 7.3 Unlock Mechanism (v2+)

```solidity
function claimUnlock(uint256 trancheIndex) external onlyTeam {
    require(block.timestamp >= minLockEnd, "Still locked");
    require(!trancheClaimed[trancheIndex], "Already claimed");

    uint256 requiredPrice = icoPrice * priceMultiples[trancheIndex];
    uint256 currentPrice = getTWAP();

    require(currentPrice >= requiredPrice, "Price threshold not met");

    uint256 unlockAmount = totalAllocation * unlockPercents[trancheIndex] / 100;
    trancheClaimed[trancheIndex] = true;
    claimed += unlockAmount;

    token.transfer(teamWallet, unlockAmount);
}
```

---

## 6. Technical Architecture

### 6.1 Smart Contract Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTRACT ARCHITECTURE (v1)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │  LaunchFactory  │ ← Creates new fair launches                       │
│  └────────┬────────┘                                                │
│           │                                                         │
│           │ creates                                                 │
│           ▼                                                         │
│  ┌─────────────────┐     ┌─────────────────┐                       │
│  │   ICOContract   │────▶│   LaunchToken   │                       │
│  │                 │     │   (ERC20)       │                       │
│  │  • Commitments  │     └─────────────────┘                       │
│  │  • Allocation   │              │                                 │
│  │  • Refunds      │              │ minting authority               │
│  │  • Distribution │              ▼                                 │
│  └────────┬────────┘              ┌─────────────────┐               │
│           │ finalizes           │    Treasury     │                       │
│           │ (optional)           │  (Multisig +  │                       │
│           │                     │   Timelock)    │                       │
│           ▼                     │                 │                       │
│  ┌─────────────────┐           │  • Holds funds  │                       │
│  │  LiquidityPool  │◀──────────│  • Spending     │                       │
│  │   (Weighted)    │           │  (48h delay)   │                       │
│  │                 │           └─────────────────┘                       │
│  │  • Trading      │                                                    │
│  │  • Swaps        │                                                    │
│  │  • Spot price   │                                                    │
│  └─────────────────┘                                                    │
│                                                                     │
│  v2+ Additions (Not in v1):                                         │
│  • BidWall - Price protection, buybacks                               │
│  • TeamVesting - Performance-based unlocks                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Contract Responsibilities

| Contract | Responsibilities | Version |
|----------|------------------|----------|
| **LaunchFactory** | Deploy new launches, track all launches, platform fees | v1 |
| **ICOContract** | Accept commitments, calculate allocations, distribute tokens, handle refunds | v1 |
| **LaunchToken** | Standard ERC20, mintable only by Treasury | v1 |
| **Treasury** | Hold funds, multisig + timelock governance, spending limits | v1 |
| **WeightedPool** | AMM functionality, spot price, swaps | v1 (reused) |
| **BidWall** | Monitor price, execute buybacks, burn tokens | v2+ |
| **TeamVesting** | Lock team tokens, verify milestones, release | v2+ |

### 6.3 Events for Indexer

```solidity
// ICO Events (v1)
event ICOCreated(address indexed icoAddress, address indexed creator, ICOConfig config);
event Committed(address indexed ico, address indexed user, uint256 amount);
event ICOFinalized(address indexed ico, uint256 totalRaised, uint256 tokenPrice);
event TokensClaimed(address indexed ico, address indexed user, uint256 tokens);
event ICOFailed(address indexed ico, uint256 totalCommitted);

// Treasury Events (v1)
event FundsReceived(uint256 amount);
event Spent(address indexed recipient, uint256 amount, string reason);

// v2+ Events (Not in v1)
// event BidWallFunded(address indexed token, uint256 amount, uint256 icoPrice);
// event BuybackExecuted(address indexed token, uint256 spent, uint256 tokensBought, uint256 price);
// event TeamUnlockClaimed(address indexed token, uint256 tranche, uint256 amount);
```

### 6.4 Frontend Updates Required

| Page/Component | Changes Needed | Version |
|----------------|----------------|----------|
| **Launch Page** | New form for ICO parameters, team allocation toggle | v1 |
| **Fair Launch Page** | ICO status, commitment UI, claim UI | v1 |
| **Treasury Page** | New page for treasury status, pending actions | v1 |
| **Indexer** | New events to index, new database tables | v1 |
| **Charts** | Show ICO price line (v2+: bid wall level) | v1 |
| **Vesting Page** | Team vesting status, unlock progress | v2+ |

### 6.5 Database Schema

```prisma
// v1 Database Schema
model ICO {
  id              String   @id @default(cuid())
  tokenAddress    String   @unique
  icoAddress      String   @unique
  treasuryAddress  String   @unique
  poolAddress     String   @unique

  // Config
  tokenSupply     BigInt
  minimumRaise    BigInt
  icoDuration     Int      // User-configurable
  startTime       DateTime
  endTime         DateTime

  // Status
  status          ICOStatus // PENDING, ACTIVE, FINALIZED, FAILED
  totalCommitted  BigInt
  tokenPrice      BigInt?

  // Team tokens (optional)
  hasTeamTokens   Boolean  @default(false)
  teamTokensAmount BigInt   @default(0)
  teamWallet      String?

  // Relations
  commitments     Commitment[]
  token           Token        @relation(fields: [tokenAddress], references: [address])

  createdAt       DateTime @default(now())
  finalizedAt     DateTime?
}

model Commitment {
  id          String   @id @default(cuid())
  icoId       String
  userAddress String
  amount      BigInt

  // After finalization
  tokensAllocated BigInt?
  refundAmount    BigInt?
  claimed         Boolean @default(false)
  refunded        Boolean @default(false)

  ico         ICO      @relation(fields: [icoId], references: [id])

  createdAt   DateTime @default(now())
  claimedAt   DateTime?
  refundedAt  DateTime?

  @@unique([icoId, userAddress])
}

model Treasury {
  id              String   @id @default(cuid())
  tokenAddress    String   @unique

  totalFunds      BigInt
  monthlyBudget   BigInt?
  currentSpent   BigInt

  multisigAddress String
  timelockAddress String

  token           Token    @relation(fields: [tokenAddress], references: [address])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// v2+ Additions (Not in v1)
// model BidWall { ... }
// model TeamVesting { ... }

enum ICOStatus {
  PENDING
  ACTIVE
  FINALIZED
  FAILED
}
```

---

## 7. Migration from Current System

### 7.1 What Changes

| Component | Current (Weighted Pool) | New (Fair Launch v1) |
|-----------|----------------------|------------------------|
| **Token Creation** | Instant via factory | ICO commitment period |
| **Pricing** | Bonding curve (AMM) | Fixed ICO price |
| **Trading** | Immediate | After ICO finalizes |
| **Price Protection** | None | None (bid wall in v2+) |
| **Treasury** | None | Multisig + Timelock |
| **Team Tokens** | None | Optional, locked in treasury |

### 7.2 Backward Compatibility

**Options:**
1. **Full Migration**: Remove weighted pool system entirely
2. **Dual System**: Support both launch types
3. **Gradual**: New launches use ICO, existing tokens unchanged

**Recommendation**: Dual system initially, phase out weighted pools

### 7.3 Deployment Strategy

```
Phase 1: Deploy new contracts alongside existing
├── LaunchFactory (new)
├── ICOContract template
├── Treasury template
└── Keep: TokenFactory, WeightedPool (for existing tokens)

Phase 2: Update frontend
├── New launch flow for ICO
├── Keep existing token pages working
└── Add ICO-specific pages

Phase 3: Deprecate old system (v2+)
├── Disable new weighted pool launches
├── Existing pools continue working
└── All new launches use ICO system
```

---

## 8. Finalized Decisions

All core decisions have been made. See [FAIR_LAUNCH_DECISIONS.md](./FAIR_LAUNCH_DECISIONS.md) for the complete decision matrix.

### Key Parameters (v1.0)

| Parameter | Decision |
|-----------|----------|
| Quote Token | WBNB |
| Platform Fee | 1% (100 bps) |
| Timelock Delay | 48 hours |
| ICO Duration | 1-14 days (configurable) |
| Minimum Raise | 10 BNB (~$3k) |
| Max Team Allocation | 20% |
| Liquidity Allocation | 20% of raise |
| Raise Structure | Uncapped |
| Minting | Disabled (no new minting) |
| Upgradability | Immutable contracts |
| Governance (v1.0) | Multisig + Timelock |
| Launch Curation | Permissionless |

### Future Versions

| Version | Features |
|---------|----------|
| v1.1 | Team vesting (6-month cliff, 18-month linear) |
| v1.2 | Emergency pause (max 7 days) |
| v2.0 | Bid wall (price protection) |
| v2.1 | Performance-based unlock multiples |
| v3.0 | Token voting governance |

---

## 9. Implementation

See [V1_IMPLEMENTATION_PLAN.md](./V1_IMPLEMENTATION_PLAN.md) for:
- Smart contract outlines
- Database schema overview
- Frontend components list
- Version checkpoint roadmap

See [TECHNICAL_SPECIFICATIONS.md](./TECHNICAL_SPECIFICATIONS.md) for:
- Complete contract code with edge cases
- API specifications (OpenAPI)
- Component prop interfaces
- Test case matrix
- Deployment runbooks
- Monitoring & alerting
- Incident response procedures

See [ARCHITECTURE_AND_BEST_PRACTICES.md](./ARCHITECTURE_AND_BEST_PRACTICES.md) for:
- System architecture diagrams
- Smart contract design patterns
- Solidity coding conventions
- Security best practices
- Gas optimization techniques
- Frontend architecture patterns
- Testing best practices
- Deployment procedures

---

## Appendix A: MetaDAO Reference

### Key Differences from MetaDAO

| Aspect | MetaDAO (Solana) | Our System (BSC) |
|--------|------------------|------------------|
| Chain | Solana | BSC |
| Quote Token | USDC | WBNB/BUSD |
| Governance | Futarchy | Token voting (simpler) |
| AMM | Custom TWAP | Standard AMM |
| Programs | Anchor | Solidity/Hardhat |

### MetaDAO Contract References

- Launchpad: v0.7.0
- Bid Wall: v0.7.0 (`WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx`)
- AMM: v0.5.0
- Futarchy: v0.6.0 (`FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq`)

---

## Appendix B: References

- [MetaDAO Documentation](https://docs.metadao.fi)
- [MetaDAO GitHub](https://github.com/metaDAOproject/programs)
- [MetaDAO ICO Mechanics](https://docs.metadao.fi/how-launches-work/sale)
- [Solana Compass - MetaDAO Analysis](https://solanacompass.com/learn/Lightspeed/how-metadao-became-solanas-breakout-token-launchpad-kollan-house)
