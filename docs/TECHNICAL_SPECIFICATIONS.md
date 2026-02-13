# Fair Launch - Technical Specifications

> Complete implementation details for v0.1 - v1.0

**Related Documents:**
- [FAIR_LAUNCH_SYSTEM.md](./FAIR_LAUNCH_SYSTEM.md) - System overview
- [FAIR_LAUNCH_DECISIONS.md](./FAIR_LAUNCH_DECISIONS.md) - Decision matrix
- [V1_IMPLEMENTATION_PLAN.md](./V1_IMPLEMENTATION_PLAN.md) - Implementation plan
- [ARCHITECTURE_AND_BEST_PRACTICES.md](./ARCHITECTURE_AND_BEST_PRACTICES.md) - Architecture & coding standards

---

## Table of Contents

1. [Dependencies & Versions](#1-dependencies--versions)
2. [v0.1: ICO Contract Specifications](#2-v01-ico-contract-specifications)
3. [v0.2: Treasury Specifications](#3-v02-treasury-specifications)
4. [v0.3: Database & API Specifications](#4-v03-database--api-specifications)
5. [v0.4: Frontend Specifications](#5-v04-frontend-specifications)
6. [v0.5: Testing Specifications](#6-v05-testing-specifications)
7. [v1.0: Production Deployment](#7-v10-production-deployment)

---

## 1. Dependencies & Versions

### 1.1 Smart Contract Dependencies

```json
{
  "dependencies": {
    "@openzeppelin/contracts": "5.0.1",
    "solidity": "0.8.20"
  },
  "devDependencies": {
    "hardhat": "^2.19.0",
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@nomicfoundation/hardhat-verify": "^2.0.0"
  }
}
```

### 1.2 Frontend Dependencies

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "viem": "2.x",
    "wagmi": "2.x",
    "@tanstack/react-query": "5.x",
    "zustand": "4.x"
  }
}
```

### 1.3 Network Configuration

| Network | Chain ID | RPC | Explorer |
|---------|----------|-----|----------|
| BSC Mainnet | 56 | https://bsc-dataseed.binance.org | https://bscscan.com |
| BSC Testnet | 97 | https://data-seed-prebsc-1-s1.binance.org:8545 | https://testnet.bscscan.com |

---

## 2. v0.1: ICO Contract Specifications

### 2.1 Contract Parameters

| Parameter | Type | Constraints | Default |
|-----------|------|-------------|---------|
| `tokenSupply` | uint256 | 1M - 1T tokens (1e24 - 1e30 wei) | 10M (1e25) |
| `minimumRaise` | uint256 | >= 10 BNB | 10 BNB |
| `icoDuration` | uint256 | 1-14 days (86400 - 1209600 seconds) | 4 days |
| `platformFeeBps` | uint256 | 0-500 (0-5%) | 100 (1%) |
| `teamTokensBps` | uint256 | 0-2000 (0-20%) | 0 |
| `startDelay` | uint256 | >= 1 hour | 1 hour |

### 2.2 Edge Cases & Handling

#### 2.2.1 Rounding Errors in Allocation

```solidity
// Problem: Integer division can leave dust tokens
// Example: 1000 tokens, 3 participants with equal commits
// Each gets 333 tokens, 1 token left as dust

// Solution: Last claimer gets remainder OR dust stays in contract
// We choose: Dust stays in contract (simpler, no ordering issues)

function claimTokens() external nonReentrant {
    // ...
    uint256 allocation = (commitments[msg.sender] * tokenSupply) / totalCommitted;
    // Note: Sum of all allocations may be slightly less than tokenSupply
    // Remaining dust (< participantCount tokens) stays in contract
    // ...
}

// Dust can be swept to treasury after all claims (governance action)
function sweepDust() external onlyAfterAllClaimed {
    uint256 dust = IERC20(token).balanceOf(address(this));
    if (dust > 0) {
        IERC20(token).transfer(treasury, dust);
    }
}
```

#### 2.2.2 Flash Loan Protection

```solidity
// Risk: Attacker flash loans BNB, commits large amount, manipulates allocation
// Mitigation: Commitment period (1-14 days) makes flash loans impractical
// Additional: No same-block finalization

function finalize() external nonReentrant {
    require(status == Status.ACTIVE, "Not active");
    require(block.timestamp > endTime, "Not ended");
    // Flash loan attack not viable because:
    // 1. Funds locked for entire ICO duration (1-14 days)
    // 2. Flash loans must be repaid in same transaction
    // 3. No benefit to manipulating allocation (pro-rata is fair)
    // ...
}
```

#### 2.2.3 Minimum Raise Edge Cases

```solidity
// Case 1: Exactly minimum raised
// Result: ICO succeeds, all funds distributed normally

// Case 2: Just under minimum (e.g., 9.999 BNB when min is 10 BNB)
// Result: ICO fails, full refunds

// Case 3: Zero commitments
// Result: ICO fails (0 < minimumRaise)

// Case 4: Single participant
// Result: If >= minimum, they get all tokens at their price
```

#### 2.2.4 Timestamp Manipulation

```solidity
// Risk: Miners can manipulate block.timestamp by ~15 seconds
// Impact: Minimal - ICO duration is days, not seconds
// Mitigation: Use >= and > for time checks (not ==)

function commit() external payable nonReentrant {
    require(block.timestamp >= startTime, "Not started");
    require(block.timestamp <= endTime, "Ended");
    // Even with 15s manipulation, no material impact on multi-day ICO
    // ...
}
```

#### 2.2.5 Reentrancy Scenarios

```solidity
// All external calls use ReentrancyGuard
// All state changes happen BEFORE external calls (CEI pattern)

function refund() external nonReentrant {
    require(status == Status.FAILED, "Not failed");
    require(commitments[msg.sender] > 0, "No commitment");

    // STATE CHANGE FIRST (Checks-Effects-Interactions)
    uint256 refundAmount = commitments[msg.sender];
    commitments[msg.sender] = 0;  // Clear before transfer

    // THEN EXTERNAL CALL
    (bool sent,) = payable(msg.sender).call{value: refundAmount}("");
    require(sent, "Refund failed");

    emit Refunded(msg.sender, refundAmount);
}
```

#### 2.2.6 Multiple Commits Same User

```solidity
// Allowed: Users can commit multiple times
// Handling: Accumulate in mapping, count participant only once

function commit() external payable nonReentrant {
    // ...
    if (commitments[msg.sender] == 0) {
        participantCount++;  // Only increment on first commit
    }
    commitments[msg.sender] += msg.value;  // Accumulate
    totalCommitted += msg.value;
    // ...
}
```

### 2.3 Gas Estimates

| Function | Estimated Gas | Notes |
|----------|---------------|-------|
| `commit()` (first time) | ~65,000 | New storage slot |
| `commit()` (subsequent) | ~45,000 | Update existing slot |
| `finalize()` | ~80,000 | No loops, fixed cost |
| `claimTokens()` | ~70,000 | Token transfer included |
| `refund()` | ~45,000 | BNB transfer |
| `markFailed()` | ~35,000 | State change only |

### 2.4 Constructor Parameters Example

```solidity
// Testnet deployment example
ICOContract ico = new ICOContract(
    0x1234...TokenAddress,           // token
    0x5678...TreasuryAddress,        // treasury
    0x9ABC...FactoryAddress,         // factory
    10_000_000 * 1e18,               // tokenSupply: 10M tokens
    10 ether,                         // minimumRaise: 10 BNB
    block.timestamp + 1 hours,        // startTime: 1 hour from now
    block.timestamp + 1 hours + 4 days, // endTime: 4 days after start
    100,                              // platformFeeBps: 1%
    0,                                // teamTokens: 0 (no team allocation)
    address(0)                        // teamWallet: not used
);
```

### 2.5 Events Specification

```solidity
// All events for indexer
event Committed(
    address indexed user,
    uint256 amount,
    uint256 totalUserCommitment  // Running total for this user
);

event Finalized(
    uint256 totalRaised,
    uint256 tokenPrice,          // Price in wei per token (18 decimals)
    uint256 participantCount
);

event TokensClaimed(
    address indexed user,
    uint256 allocation           // Actual tokens received
);

event Refunded(
    address indexed user,
    uint256 amount
);

event ICOFailed(
    uint256 totalCommitted,
    uint256 minimumRequired
);
```

### 2.6 Access Control Matrix

| Function | Who Can Call | When |
|----------|--------------|------|
| `commit()` | Anyone | startTime <= now <= endTime |
| `finalize()` | Anyone | now > endTime AND total >= minimum |
| `markFailed()` | Anyone | now > endTime AND total < minimum |
| `claimTokens()` | Committers | After finalization |
| `refund()` | Committers | After failure |
| `getAllocation()` | Anyone (view) | Anytime |
| `getICOInfo()` | Anyone (view) | Anytime |

---

## 3. v0.2: Treasury Specifications

### 3.1 Multisig Configuration

**Decision: 2-of-3 Multisig**

| Role | Signer | Rationale |
|------|--------|-----------|
| Signer 1 | Project Creator | Primary operator |
| Signer 2 | Platform Admin | Oversight |
| Signer 3 | Community Representative | Decentralization |

**For larger raises (>100 BNB): 3-of-5 Multisig**

| Role | Signer |
|------|--------|
| Signer 1-2 | Project Team (2) |
| Signer 3 | Platform Admin |
| Signer 4-5 | Community/Advisors (2) |

### 3.2 Fund Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FUND FLOW DIAGRAM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  USER COMMITS BNB                                                       │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐                                                        │
│  │ ICOContract │  Holds BNB during commitment period                    │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         │ finalize()                                                    │
│         ▼                                                               │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                    FUND DISTRIBUTION                      │          │
│  │                                                           │          │
│  │  Total Raised: 100 BNB                                    │          │
│  │  ├── Platform Fee (1%): 1 BNB ──────► LaunchFactory       │          │
│  │  │                                    (platform wallet)   │          │
│  │  │                                                        │          │
│  │  └── Remaining (99%): 99 BNB                              │          │
│  │      ├── Liquidity (20%): 19.8 BNB ──► WeightedPool       │          │
│  │      │                                 + tokens           │          │
│  │      │                                                    │          │
│  │      └── Treasury (79%): 79.2 BNB ───► Treasury           │          │
│  │                                        (multisig+timelock)│          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                         │
│  TOKEN DISTRIBUTION                                                     │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  Total Supply: 10,000,000 tokens                          │          │
│  │  ├── ICO Participants: 8,000,000 (80%) ──► claimTokens() │          │
│  │  ├── Liquidity Pool: 2,000,000 (20%) ────► WeightedPool  │          │
│  │  └── Team (if enabled): 0-2,000,000 ─────► Treasury      │          │
│  │                                            (locked)       │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Timelock Configuration

```solidity
// OpenZeppelin TimelockController constructor
TimelockController timelock = new TimelockController(
    2 days,                              // minDelay: 48 hours
    multisigSigners,                     // proposers: multisig addresses
    multisigSigners,                     // executors: same as proposers
    address(0)                           // admin: no admin (immutable)
);

// Roles after deployment:
// - PROPOSER_ROLE: multisig can propose transactions
// - EXECUTOR_ROLE: multisig can execute after delay
// - CANCELLER_ROLE: multisig can cancel pending transactions
// - No DEFAULT_ADMIN_ROLE: prevents role changes
```

### 3.4 Treasury Spending Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TREASURY SPENDING WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. PROPOSE (Multisig)                                                  │
│     └─> Multisig creates transaction via Gnosis Safe                    │
│     └─> Transaction targets Timelock.schedule()                         │
│     └─> Parameters: target, value, data, predecessor, salt, delay       │
│                                                                         │
│  2. WAIT (48 hours)                                                     │
│     └─> Transaction visible on-chain                                    │
│     └─> Community can review                                            │
│     └─> Multisig can cancel if needed                                   │
│                                                                         │
│  3. EXECUTE (Multisig)                                                  │
│     └─> After delay, multisig calls Timelock.execute()                  │
│     └─> Timelock calls Treasury.spendBNB() or Treasury.spendTokens()    │
│     └─> Funds transferred to recipient                                  │
│                                                                         │
│  EMERGENCY CANCEL                                                       │
│     └─> Multisig can call Timelock.cancel() anytime before execution    │
│     └─> Useful if proposal was malicious or circumstances changed       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Monthly Budget Implementation

```solidity
// Monthly budget allows spending WITHOUT full timelock delay
// Only for amounts within the pre-approved budget

contract Treasury {
    uint256 public monthlyLimit;        // e.g., 5 BNB per month
    uint256 public monthlySpent;        // Tracks current month spending
    uint256 public monthStartTimestamp; // When current month started

    // Called by timelock for regular spends
    function spendBNB(address payable recipient, uint256 amount, string calldata reason)
        external
        onlyOwner  // onlyOwner = timelock
        nonReentrant
    {
        _checkMonthlyLimit(amount);
        // ... transfer logic
    }

    // Budget spending (faster, no full timelock needed)
    // Still requires multisig signature but not 48h wait
    function spendFromBudget(address payable recipient, uint256 amount, string calldata reason)
        external
        onlyMultisig  // Direct multisig call, not through timelock
        nonReentrant
    {
        require(monthlyLimit > 0, "No budget configured");
        _checkMonthlyLimit(amount);
        _resetMonthIfNeeded();
        require(monthlySpent + amount <= monthlyLimit, "Exceeds monthly budget");

        monthlySpent += amount;
        // ... transfer logic
    }

    function _resetMonthIfNeeded() internal {
        if (block.timestamp >= monthStartTimestamp + 30 days) {
            monthlySpent = 0;
            monthStartTimestamp = block.timestamp;
        }
    }
}
```

### 3.6 Gnosis Safe Deployment

```bash
# Using Gnosis Safe Factory on BSC
# Factory address (BSC): 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2

# Option 1: Deploy via Safe UI
# 1. Go to https://app.safe.global
# 2. Connect wallet
# 3. Create new Safe on BSC
# 4. Add signers (2-of-3 or 3-of-5)
# 5. Set threshold
# 6. Deploy

# Option 2: Deploy programmatically
const safeFactory = await ethers.getContractAt(
    "GnosisSafeProxyFactory",
    "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2"
);

const safeSingleton = "0x3E5c63644E683549055b9Be8653de26E0B4CD36E"; // BSC
const initializer = safeInterface.encodeFunctionData("setup", [
    owners,           // Array of owner addresses
    threshold,        // Number of required signatures (2 or 3)
    address(0),       // to (no delegate call)
    "0x",             // data
    fallbackHandler,  // Fallback handler address
    address(0),       // paymentToken
    0,                // payment
    address(0)        // paymentReceiver
]);

const safe = await safeFactory.createProxy(safeSingleton, initializer);
```

---

## 4. v0.3: Database & API Specifications

### 4.1 Complete Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===================
// ICO Models
// ===================

model ICO {
  id              String      @id @default(cuid())

  // Contract addresses
  tokenAddress    String      @unique
  icoAddress      String      @unique
  treasuryAddress String?
  poolAddress     String?

  // Token info
  name            String
  symbol          String
  imageURI        String?
  description     String?

  // ICO configuration
  tokenSupply     Decimal     @db.Decimal(78, 0)  // uint256 max
  minimumRaise    Decimal     @db.Decimal(78, 0)
  icoDuration     Int                              // seconds
  startTime       DateTime
  endTime         DateTime
  platformFeeBps  Int         @default(100)       // 1%

  // Team allocation
  hasTeamTokens   Boolean     @default(false)
  teamTokensBps   Int         @default(0)
  teamWallet      String?

  // State
  status          ICOStatus   @default(PENDING)
  totalCommitted  Decimal     @db.Decimal(78, 0) @default(0)
  tokenPrice      Decimal?    @db.Decimal(78, 0)  // Set on finalization
  participantCount Int        @default(0)

  // Timestamps
  createdAt       DateTime    @default(now())
  finalizedAt     DateTime?

  // Creator
  creatorAddress  String

  // Relations
  commitments     Commitment[]
  token           Token?       @relation(fields: [tokenAddress], references: [address])
  treasury        Treasury?

  // Indexes
  @@index([status])
  @@index([creatorAddress])
  @@index([startTime(sort: Desc)])
  @@index([endTime])
  @@map("icos")
}

model Commitment {
  id              String      @id @default(cuid())
  icoId           String
  userAddress     String

  // Commitment details
  amount          Decimal     @db.Decimal(78, 0)
  transactionHash String
  blockNumber     Int

  // Post-finalization
  tokensAllocated Decimal?    @db.Decimal(78, 0)
  claimed         Boolean     @default(false)
  claimTxHash     String?

  // For failed ICOs
  refunded        Boolean     @default(false)
  refundTxHash    String?

  // Timestamps
  createdAt       DateTime    @default(now())
  claimedAt       DateTime?
  refundedAt      DateTime?

  // Relations
  ico             ICO         @relation(fields: [icoId], references: [id])

  // Constraints
  @@unique([icoId, userAddress])
  @@index([userAddress])
  @@index([icoId, claimed])
  @@map("commitments")
}

model Treasury {
  id              String      @id @default(cuid())
  icoId           String      @unique

  // Addresses
  treasuryAddress String      @unique
  timelockAddress String
  multisigAddress String

  // Balances (updated by indexer)
  bnbBalance      Decimal     @db.Decimal(78, 0) @default(0)
  tokenBalance    Decimal     @db.Decimal(78, 0) @default(0)

  // Budget
  monthlyLimit    Decimal?    @db.Decimal(78, 0)
  monthlySpent    Decimal     @db.Decimal(78, 0) @default(0)
  monthStartTime  DateTime    @default(now())

  // Stats
  totalReceived   Decimal     @db.Decimal(78, 0) @default(0)
  totalSpent      Decimal     @db.Decimal(78, 0) @default(0)

  // Timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // Relations
  ico             ICO         @relation(fields: [icoId], references: [id])
  spends          TreasurySpend[]
  pendingActions  PendingAction[]

  @@map("treasuries")
}

model TreasurySpend {
  id              String      @id @default(cuid())
  treasuryId      String

  // Spend details
  recipient       String
  amount          Decimal     @db.Decimal(78, 0)
  tokenAddress    String?     // null for BNB
  reason          String
  transactionHash String
  blockNumber     Int

  // Timestamps
  executedAt      DateTime
  createdAt       DateTime    @default(now())

  // Relations
  treasury        Treasury    @relation(fields: [treasuryId], references: [id])

  @@index([treasuryId])
  @@index([executedAt(sort: Desc)])
  @@map("treasury_spends")
}

model PendingAction {
  id              String      @id @default(cuid())
  treasuryId      String

  // Timelock details
  operationId     String      @unique  // Timelock operation ID
  target          String
  value           Decimal     @db.Decimal(78, 0)
  data            String                // Hex encoded calldata
  predecessor     String?
  salt            String

  // Timing
  scheduledAt     DateTime
  readyAt         DateTime              // When it can be executed

  // Status
  status          ActionStatus @default(PENDING)
  executedAt      DateTime?
  cancelledAt     DateTime?

  // Metadata
  description     String?

  // Relations
  treasury        Treasury    @relation(fields: [treasuryId], references: [id])

  @@index([treasuryId, status])
  @@index([readyAt])
  @@map("pending_actions")
}

// ===================
// Existing Token Model (extend)
// ===================

model Token {
  address         String      @id
  name            String
  symbol          String
  decimals        Int         @default(18)
  totalSupply     Decimal     @db.Decimal(78, 0)

  // Fair launch fields
  launchType      LaunchType  @default(INSTANT)
  ico             ICO?

  // ... existing fields ...

  @@map("tokens")
}

// ===================
// Indexer State
// ===================

model IndexerState {
  id              String      @id @default("singleton")
  lastBlockNumber Int         @default(0)
  lastBlockHash   String?
  updatedAt       DateTime    @updatedAt

  @@map("indexer_state")
}

// ===================
// Enums
// ===================

enum ICOStatus {
  PENDING       // Created, not started
  ACTIVE        // Accepting commitments
  FINALIZED     // Successfully completed
  FAILED        // Did not meet minimum
}

enum ActionStatus {
  PENDING       // Scheduled, waiting
  READY         // Can be executed
  EXECUTED      // Completed
  CANCELLED     // Cancelled before execution
}

enum LaunchType {
  INSTANT       // Legacy weighted pool launch
  FAIR_LAUNCH   // ICO-based fair launch
}
```

### 4.2 API Specifications (OpenAPI)

```yaml
openapi: 3.0.3
info:
  title: Fair Launch API
  version: 1.0.0
  description: API for Fair Launch ICO platform

servers:
  - url: /api
    description: API base path

paths:
  /icos:
    get:
      summary: List all ICOs
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [PENDING, ACTIVE, FINALIZED, FAILED]
        - name: creator
          in: query
          schema:
            type: string
          description: Filter by creator address
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
        - name: sort
          in: query
          schema:
            type: string
            enum: [startTime, totalCommitted, participantCount]
            default: startTime
        - name: order
          in: query
          schema:
            type: string
            enum: [asc, desc]
            default: desc
      responses:
        '200':
          description: List of ICOs
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/ICOSummary'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /icos/{address}:
    get:
      summary: Get ICO details
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
          description: ICO contract address
      responses:
        '200':
          description: ICO details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ICODetail'
        '404':
          description: ICO not found

  /icos/{address}/commitments:
    get:
      summary: List commitments for an ICO
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
        - name: user
          in: query
          schema:
            type: string
          description: Filter by user address
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of commitments
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Commitment'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /icos/{address}/user/{userAddress}:
    get:
      summary: Get user's position in an ICO
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
        - name: userAddress
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: User position
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserPosition'

  /fair-launch/create:
    post:
      summary: Create a new fair launch (returns unsigned transaction)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateFairLaunchRequest'
      responses:
        '200':
          description: Transaction data
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TransactionData'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'

  /treasuries/{address}:
    get:
      summary: Get treasury details
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Treasury details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TreasuryDetail'

  /treasuries/{address}/spends:
    get:
      summary: Get treasury spend history
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Spend history
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/TreasurySpend'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /treasuries/{address}/pending:
    get:
      summary: Get pending timelock actions
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Pending actions
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/PendingAction'

components:
  schemas:
    ICOSummary:
      type: object
      properties:
        id:
          type: string
        icoAddress:
          type: string
        tokenAddress:
          type: string
        name:
          type: string
        symbol:
          type: string
        imageURI:
          type: string
        status:
          type: string
          enum: [PENDING, ACTIVE, FINALIZED, FAILED]
        totalCommitted:
          type: string
        minimumRaise:
          type: string
        participantCount:
          type: integer
        startTime:
          type: string
          format: date-time
        endTime:
          type: string
          format: date-time
        progress:
          type: number
          description: Percentage of minimum raise achieved

    ICODetail:
      allOf:
        - $ref: '#/components/schemas/ICOSummary'
        - type: object
          properties:
            description:
              type: string
            tokenSupply:
              type: string
            tokenPrice:
              type: string
              nullable: true
            platformFeeBps:
              type: integer
            hasTeamTokens:
              type: boolean
            teamTokensBps:
              type: integer
            teamWallet:
              type: string
              nullable: true
            creatorAddress:
              type: string
            treasuryAddress:
              type: string
              nullable: true
            poolAddress:
              type: string
              nullable: true
            createdAt:
              type: string
              format: date-time
            finalizedAt:
              type: string
              format: date-time
              nullable: true

    Commitment:
      type: object
      properties:
        id:
          type: string
        userAddress:
          type: string
        amount:
          type: string
        tokensAllocated:
          type: string
          nullable: true
        claimed:
          type: boolean
        refunded:
          type: boolean
        transactionHash:
          type: string
        createdAt:
          type: string
          format: date-time

    UserPosition:
      type: object
      properties:
        userAddress:
          type: string
        totalCommitted:
          type: string
        estimatedAllocation:
          type: string
        allocationPercentage:
          type: number
        tokensAllocated:
          type: string
          nullable: true
        claimed:
          type: boolean
        refunded:
          type: boolean
        commitments:
          type: array
          items:
            $ref: '#/components/schemas/Commitment'

    CreateFairLaunchRequest:
      type: object
      required:
        - name
        - symbol
        - tokenSupply
        - minimumRaise
        - icoDuration
        - multisigSigners
        - multisigThreshold
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 64
        symbol:
          type: string
          minLength: 1
          maxLength: 10
        imageURI:
          type: string
          format: uri
        description:
          type: string
          maxLength: 1000
        tokenSupply:
          type: string
          description: Token supply in wei (1e18 = 1 token)
        minimumRaise:
          type: string
          description: Minimum raise in wei (1e18 = 1 BNB)
        icoDuration:
          type: integer
          minimum: 86400
          maximum: 1209600
          description: Duration in seconds (1-14 days)
        teamTokensBps:
          type: integer
          minimum: 0
          maximum: 2000
          default: 0
        teamWallet:
          type: string
        monthlyBudget:
          type: string
          default: "0"
        multisigSigners:
          type: array
          items:
            type: string
          minItems: 2
          maxItems: 5
        multisigThreshold:
          type: integer
          minimum: 2

    TransactionData:
      type: object
      properties:
        to:
          type: string
        data:
          type: string
        value:
          type: string
        gasEstimate:
          type: string

    TreasuryDetail:
      type: object
      properties:
        id:
          type: string
        treasuryAddress:
          type: string
        timelockAddress:
          type: string
        multisigAddress:
          type: string
        bnbBalance:
          type: string
        tokenBalance:
          type: string
        monthlyLimit:
          type: string
          nullable: true
        monthlySpent:
          type: string
        monthlyRemaining:
          type: string
        totalReceived:
          type: string
        totalSpent:
          type: string
        pendingActionsCount:
          type: integer

    TreasurySpend:
      type: object
      properties:
        id:
          type: string
        recipient:
          type: string
        amount:
          type: string
        tokenAddress:
          type: string
          nullable: true
        reason:
          type: string
        transactionHash:
          type: string
        executedAt:
          type: string
          format: date-time

    PendingAction:
      type: object
      properties:
        id:
          type: string
        operationId:
          type: string
        target:
          type: string
        value:
          type: string
        description:
          type: string
        status:
          type: string
          enum: [PENDING, READY, EXECUTED, CANCELLED]
        scheduledAt:
          type: string
          format: date-time
        readyAt:
          type: string
          format: date-time
        timeRemaining:
          type: integer
          description: Seconds until executable (0 if ready)

    Pagination:
      type: object
      properties:
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer
        hasMore:
          type: boolean

    ValidationError:
      type: object
      properties:
        error:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
```

### 4.3 Indexer Implementation

```typescript
// scripts/indexer/fair-launch-indexer.ts

import { createPublicClient, http, parseAbiItem, Log } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;
const POLL_INTERVAL = 5000; // 5 seconds

// Contract ABIs (events only)
const ICO_EVENTS = [
  parseAbiItem('event Committed(address indexed user, uint256 amount, uint256 totalUserCommitment)'),
  parseAbiItem('event Finalized(uint256 totalRaised, uint256 tokenPrice, uint256 participantCount)'),
  parseAbiItem('event TokensClaimed(address indexed user, uint256 allocation)'),
  parseAbiItem('event Refunded(address indexed user, uint256 amount)'),
  parseAbiItem('event ICOFailed(uint256 totalCommitted, uint256 minimumRequired)'),
];

const FACTORY_EVENTS = [
  parseAbiItem('event FairLaunchCreated(address indexed ico, address indexed token, address indexed treasury, address creator, uint256 tokenSupply, uint256 minimumRaise, uint256 startTime, uint256 endTime)'),
];

const TREASURY_EVENTS = [
  parseAbiItem('event FundsReceived(address indexed from, uint256 amount)'),
  parseAbiItem('event BNBSpent(address indexed recipient, uint256 amount, string reason)'),
  parseAbiItem('event TokensSpent(address indexed tokenAddress, address indexed recipient, uint256 amount, string reason)'),
];

// Main indexer class
class FairLaunchIndexer {
  private client: ReturnType<typeof createPublicClient>;
  private factoryAddress: `0x${string}`;
  private isRunning = false;

  constructor(
    rpcUrl: string,
    factoryAddress: string,
    private chainId: number = 97 // BSC Testnet default
  ) {
    this.client = createPublicClient({
      chain: chainId === 56 ? bsc : bscTestnet,
      transport: http(rpcUrl),
    });
    this.factoryAddress = factoryAddress as `0x${string}`;
  }

  async start() {
    this.isRunning = true;
    console.log('Starting Fair Launch Indexer...');

    while (this.isRunning) {
      try {
        await this.indexNewBlocks();
        await this.updateICOStatuses();
        await this.sleep(POLL_INTERVAL);
      } catch (error) {
        console.error('Indexer error:', error);
        await this.sleep(POLL_INTERVAL * 2); // Back off on error
      }
    }
  }

  stop() {
    this.isRunning = false;
  }

  private async indexNewBlocks() {
    const state = await prisma.indexerState.findUnique({
      where: { id: 'singleton' },
    });

    const lastBlock = state?.lastBlockNumber ?? 0;
    const currentBlock = Number(await this.client.getBlockNumber());

    if (currentBlock <= lastBlock) return;

    const toBlock = Math.min(lastBlock + BATCH_SIZE, currentBlock);
    console.log(`Indexing blocks ${lastBlock + 1} to ${toBlock}`);

    // Index factory events (new ICO creations)
    await this.indexFactoryEvents(BigInt(lastBlock + 1), BigInt(toBlock));

    // Index ICO events for all active ICOs
    const activeICOs = await prisma.iCO.findMany({
      where: { status: { in: ['PENDING', 'ACTIVE'] } },
      select: { icoAddress: true },
    });

    for (const ico of activeICOs) {
      await this.indexICOEvents(ico.icoAddress, BigInt(lastBlock + 1), BigInt(toBlock));
    }

    // Index treasury events
    const treasuries = await prisma.treasury.findMany({
      select: { treasuryAddress: true },
    });

    for (const treasury of treasuries) {
      await this.indexTreasuryEvents(treasury.treasuryAddress, BigInt(lastBlock + 1), BigInt(toBlock));
    }

    // Update indexer state
    await prisma.indexerState.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastBlockNumber: toBlock },
      update: { lastBlockNumber: toBlock },
    });
  }

  private async indexFactoryEvents(fromBlock: bigint, toBlock: bigint) {
    const logs = await this.client.getLogs({
      address: this.factoryAddress,
      events: FACTORY_EVENTS,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      if (log.eventName === 'FairLaunchCreated') {
        await this.handleFairLaunchCreated(log);
      }
    }
  }

  private async indexICOEvents(icoAddress: string, fromBlock: bigint, toBlock: bigint) {
    const logs = await this.client.getLogs({
      address: icoAddress as `0x${string}`,
      events: ICO_EVENTS,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      switch (log.eventName) {
        case 'Committed':
          await this.handleCommitted(icoAddress, log);
          break;
        case 'Finalized':
          await this.handleFinalized(icoAddress, log);
          break;
        case 'TokensClaimed':
          await this.handleTokensClaimed(icoAddress, log);
          break;
        case 'Refunded':
          await this.handleRefunded(icoAddress, log);
          break;
        case 'ICOFailed':
          await this.handleICOFailed(icoAddress, log);
          break;
      }
    }
  }

  private async indexTreasuryEvents(treasuryAddress: string, fromBlock: bigint, toBlock: bigint) {
    const logs = await this.client.getLogs({
      address: treasuryAddress as `0x${string}`,
      events: TREASURY_EVENTS,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      switch (log.eventName) {
        case 'FundsReceived':
          await this.handleFundsReceived(treasuryAddress, log);
          break;
        case 'BNBSpent':
        case 'TokensSpent':
          await this.handleSpend(treasuryAddress, log);
          break;
      }
    }
  }

  // Event Handlers
  private async handleFairLaunchCreated(log: Log) {
    const args = log.args as any;
    const block = await this.client.getBlock({ blockNumber: log.blockNumber! });

    await prisma.iCO.create({
      data: {
        icoAddress: args.ico,
        tokenAddress: args.token,
        treasuryAddress: args.treasury,
        creatorAddress: args.creator,
        tokenSupply: args.tokenSupply.toString(),
        minimumRaise: args.minimumRaise.toString(),
        startTime: new Date(Number(args.startTime) * 1000),
        endTime: new Date(Number(args.endTime) * 1000),
        status: 'PENDING',
        name: '', // Fetched separately
        symbol: '', // Fetched separately
      },
    });

    console.log(`New ICO created: ${args.ico}`);
  }

  private async handleCommitted(icoAddress: string, log: Log) {
    const args = log.args as any;

    const ico = await prisma.iCO.findUnique({
      where: { icoAddress },
    });

    if (!ico) return;

    await prisma.$transaction([
      prisma.commitment.upsert({
        where: {
          icoId_userAddress: {
            icoId: ico.id,
            userAddress: args.user,
          },
        },
        create: {
          icoId: ico.id,
          userAddress: args.user,
          amount: args.totalUserCommitment.toString(),
          transactionHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
        },
        update: {
          amount: args.totalUserCommitment.toString(),
        },
      }),
      prisma.iCO.update({
        where: { id: ico.id },
        data: {
          status: 'ACTIVE',
          totalCommitted: {
            increment: args.amount,
          },
          participantCount: {
            increment: 1, // Note: This overcounts for repeat committers
          },
        },
      }),
    ]);
  }

  private async handleFinalized(icoAddress: string, log: Log) {
    const args = log.args as any;
    const block = await this.client.getBlock({ blockNumber: log.blockNumber! });

    const ico = await prisma.iCO.findUnique({
      where: { icoAddress },
    });

    if (!ico) return;

    // Update ICO status
    await prisma.iCO.update({
      where: { id: ico.id },
      data: {
        status: 'FINALIZED',
        totalCommitted: args.totalRaised.toString(),
        tokenPrice: args.tokenPrice.toString(),
        participantCount: Number(args.participantCount),
        finalizedAt: new Date(Number(block.timestamp) * 1000),
      },
    });

    // Calculate all allocations
    const commitments = await prisma.commitment.findMany({
      where: { icoId: ico.id },
    });

    const totalRaised = BigInt(args.totalRaised);
    const tokenSupply = BigInt(ico.tokenSupply.toString());

    for (const commitment of commitments) {
      const userCommitment = BigInt(commitment.amount.toString());
      const allocation = (userCommitment * tokenSupply) / totalRaised;

      await prisma.commitment.update({
        where: { id: commitment.id },
        data: {
          tokensAllocated: allocation.toString(),
        },
      });
    }

    console.log(`ICO finalized: ${icoAddress}`);
  }

  private async handleTokensClaimed(icoAddress: string, log: Log) {
    const args = log.args as any;
    const block = await this.client.getBlock({ blockNumber: log.blockNumber! });

    const ico = await prisma.iCO.findUnique({
      where: { icoAddress },
    });

    if (!ico) return;

    await prisma.commitment.update({
      where: {
        icoId_userAddress: {
          icoId: ico.id,
          userAddress: args.user,
        },
      },
      data: {
        claimed: true,
        claimTxHash: log.transactionHash,
        claimedAt: new Date(Number(block.timestamp) * 1000),
      },
    });
  }

  private async handleRefunded(icoAddress: string, log: Log) {
    const args = log.args as any;
    const block = await this.client.getBlock({ blockNumber: log.blockNumber! });

    const ico = await prisma.iCO.findUnique({
      where: { icoAddress },
    });

    if (!ico) return;

    await prisma.commitment.update({
      where: {
        icoId_userAddress: {
          icoId: ico.id,
          userAddress: args.user,
        },
      },
      data: {
        refunded: true,
        refundTxHash: log.transactionHash,
        refundedAt: new Date(Number(block.timestamp) * 1000),
      },
    });
  }

  private async handleICOFailed(icoAddress: string, log: Log) {
    await prisma.iCO.update({
      where: { icoAddress },
      data: { status: 'FAILED' },
    });

    console.log(`ICO failed: ${icoAddress}`);
  }

  private async handleFundsReceived(treasuryAddress: string, log: Log) {
    const args = log.args as any;

    await prisma.treasury.update({
      where: { treasuryAddress },
      data: {
        bnbBalance: { increment: args.amount },
        totalReceived: { increment: args.amount },
      },
    });
  }

  private async handleSpend(treasuryAddress: string, log: Log) {
    const args = log.args as any;
    const block = await this.client.getBlock({ blockNumber: log.blockNumber! });

    const treasury = await prisma.treasury.findUnique({
      where: { treasuryAddress },
    });

    if (!treasury) return;

    await prisma.$transaction([
      prisma.treasurySpend.create({
        data: {
          treasuryId: treasury.id,
          recipient: args.recipient,
          amount: args.amount.toString(),
          tokenAddress: log.eventName === 'TokensSpent' ? args.tokenAddress : null,
          reason: args.reason,
          transactionHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          executedAt: new Date(Number(block.timestamp) * 1000),
        },
      }),
      prisma.treasury.update({
        where: { id: treasury.id },
        data: {
          bnbBalance: log.eventName === 'BNBSpent' ? { decrement: args.amount } : undefined,
          totalSpent: log.eventName === 'BNBSpent' ? { increment: args.amount } : undefined,
          monthlySpent: { increment: args.amount },
        },
      }),
    ]);
  }

  // Update ICO statuses based on time
  private async updateICOStatuses() {
    const now = new Date();

    // Update PENDING to ACTIVE when start time reached
    await prisma.iCO.updateMany({
      where: {
        status: 'PENDING',
        startTime: { lte: now },
      },
      data: { status: 'ACTIVE' },
    });

    // Note: ACTIVE to FINALIZED/FAILED is handled by on-chain events
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Reorg handling
async function handleReorg(reorgDepth: number) {
  const state = await prisma.indexerState.findUnique({
    where: { id: 'singleton' },
  });

  if (!state) return;

  const safeBlock = state.lastBlockNumber - reorgDepth;

  // Delete commitments from reorged blocks
  await prisma.commitment.deleteMany({
    where: { blockNumber: { gt: safeBlock } },
  });

  // Reset indexer state
  await prisma.indexerState.update({
    where: { id: 'singleton' },
    data: { lastBlockNumber: safeBlock },
  });

  console.log(`Handled reorg: rolled back to block ${safeBlock}`);
}

export { FairLaunchIndexer, handleReorg };
```

---

## 5. v0.4: Frontend Specifications

### 5.1 State Management (Zustand)

```typescript
// stores/fairLaunchStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ICOState {
  // Current ICO being viewed
  currentICO: ICODetail | null;
  isLoading: boolean;
  error: string | null;

  // User's position
  userPosition: UserPosition | null;

  // Actions
  fetchICO: (address: string) => Promise<void>;
  fetchUserPosition: (icoAddress: string, userAddress: string) => Promise<void>;
  clearError: () => void;
}

interface CreateLaunchState {
  // Form state
  formData: Partial<CreateFairLaunchRequest>;
  validationErrors: Record<string, string>;
  isSubmitting: boolean;

  // Actions
  updateFormData: (data: Partial<CreateFairLaunchRequest>) => void;
  validateForm: () => boolean;
  submitForm: () => Promise<TransactionData | null>;
  resetForm: () => void;
}

export const useICOStore = create<ICOState>()(
  devtools(
    (set, get) => ({
      currentICO: null,
      isLoading: false,
      error: null,
      userPosition: null,

      fetchICO: async (address: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/icos/${address}`);
          if (!response.ok) throw new Error('ICO not found');
          const ico = await response.json();
          set({ currentICO: ico, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      fetchUserPosition: async (icoAddress: string, userAddress: string) => {
        try {
          const response = await fetch(`/api/icos/${icoAddress}/user/${userAddress}`);
          if (!response.ok) return;
          const position = await response.json();
          set({ userPosition: position });
        } catch (error) {
          console.error('Failed to fetch user position:', error);
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'ico-store' }
  )
);

export const useCreateLaunchStore = create<CreateLaunchState>()(
  devtools(
    (set, get) => ({
      formData: {
        tokenSupply: '10000000000000000000000000', // 10M tokens
        minimumRaise: '10000000000000000000', // 10 BNB
        icoDuration: 345600, // 4 days
        teamTokensBps: 0,
        multisigThreshold: 2,
      },
      validationErrors: {},
      isSubmitting: false,

      updateFormData: (data) => {
        set((state) => ({
          formData: { ...state.formData, ...data },
          validationErrors: {}, // Clear errors on change
        }));
      },

      validateForm: () => {
        const { formData } = get();
        const errors: Record<string, string> = {};

        if (!formData.name || formData.name.length < 1) {
          errors.name = 'Name is required';
        }
        if (!formData.symbol || formData.symbol.length < 1) {
          errors.symbol = 'Symbol is required';
        }
        if (!formData.multisigSigners || formData.multisigSigners.length < 2) {
          errors.multisigSigners = 'At least 2 signers required';
        }
        // ... more validation

        set({ validationErrors: errors });
        return Object.keys(errors).length === 0;
      },

      submitForm: async () => {
        const { formData, validateForm } = get();
        if (!validateForm()) return null;

        set({ isSubmitting: true });
        try {
          const response = await fetch('/api/fair-launch/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

          if (!response.ok) {
            const error = await response.json();
            set({ validationErrors: error.details || {} });
            return null;
          }

          return await response.json();
        } finally {
          set({ isSubmitting: false });
        }
      },

      resetForm: () => {
        set({
          formData: {
            tokenSupply: '10000000000000000000000000',
            minimumRaise: '10000000000000000000',
            icoDuration: 345600,
            teamTokensBps: 0,
            multisigThreshold: 2,
          },
          validationErrors: {},
          isSubmitting: false,
        });
      },
    }),
    { name: 'create-launch-store' }
  )
);
```

### 5.2 Component Specifications

#### 5.2.1 FairLaunchForm

```typescript
// components/fair-launch/FairLaunchForm.tsx

interface FairLaunchFormProps {
  onSuccess: (icoAddress: string) => void;
}

interface FormStep {
  id: string;
  title: string;
  fields: string[];
}

const FORM_STEPS: FormStep[] = [
  {
    id: 'token',
    title: 'Token Details',
    fields: ['name', 'symbol', 'imageURI', 'description'],
  },
  {
    id: 'ico',
    title: 'ICO Parameters',
    fields: ['tokenSupply', 'minimumRaise', 'icoDuration'],
  },
  {
    id: 'team',
    title: 'Team Allocation',
    fields: ['teamTokensBps', 'teamWallet'],
  },
  {
    id: 'governance',
    title: 'Treasury Governance',
    fields: ['multisigSigners', 'multisigThreshold', 'monthlyBudget'],
  },
  {
    id: 'review',
    title: 'Review & Deploy',
    fields: [],
  },
];

// Validation rules
const VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 64,
    pattern: /^[a-zA-Z0-9\s]+$/,
    message: 'Name must be 1-64 alphanumeric characters',
  },
  symbol: {
    required: true,
    minLength: 1,
    maxLength: 10,
    pattern: /^[A-Z0-9]+$/,
    message: 'Symbol must be 1-10 uppercase alphanumeric characters',
  },
  tokenSupply: {
    required: true,
    min: BigInt('1000000000000000000000000'), // 1M tokens
    max: BigInt('1000000000000000000000000000000000'), // 1T tokens
    message: 'Supply must be between 1M and 1T tokens',
  },
  minimumRaise: {
    required: true,
    min: BigInt('10000000000000000000'), // 10 BNB
    message: 'Minimum raise must be at least 10 BNB',
  },
  icoDuration: {
    required: true,
    min: 86400, // 1 day
    max: 1209600, // 14 days
    message: 'Duration must be 1-14 days',
  },
  teamTokensBps: {
    required: false,
    min: 0,
    max: 2000, // 20%
    message: 'Team allocation cannot exceed 20%',
  },
  teamWallet: {
    required: (formData: any) => formData.teamTokensBps > 0,
    pattern: /^0x[a-fA-F0-9]{40}$/,
    message: 'Invalid wallet address',
  },
  multisigSigners: {
    required: true,
    minLength: 2,
    maxLength: 5,
    validate: (value: string[]) => value.every(addr => /^0x[a-fA-F0-9]{40}$/.test(addr)),
    message: 'Must have 2-5 valid signer addresses',
  },
  multisigThreshold: {
    required: true,
    validate: (value: number, formData: any) =>
      value >= 2 && value <= (formData.multisigSigners?.length || 0),
    message: 'Threshold must be 2 to number of signers',
  },
};
```

#### 5.2.2 CommitmentPanel

```typescript
// components/fair-launch/CommitmentPanel.tsx

interface CommitmentPanelProps {
  ico: ICODetail;
  userPosition: UserPosition | null;
  onCommitSuccess: () => void;
}

interface CommitmentPanelState {
  amount: string; // User input (BNB)
  estimatedAllocation: string;
  estimatedPercentage: number;
  isCommitting: boolean;
  error: string | null;
}

// Real-time allocation preview calculation
function calculateEstimatedAllocation(
  commitAmount: bigint,
  currentTotal: bigint,
  userExisting: bigint,
  tokenSupply: bigint
): { allocation: bigint; percentage: number } {
  const newTotal = currentTotal + commitAmount;
  const newUserTotal = userExisting + commitAmount;

  if (newTotal === 0n) {
    return { allocation: 0n, percentage: 0 };
  }

  const allocation = (newUserTotal * tokenSupply) / newTotal;
  const percentage = Number((newUserTotal * 10000n) / newTotal) / 100;

  return { allocation, percentage };
}

// UI States
const PANEL_STATES = {
  NOT_STARTED: {
    title: 'ICO Not Started',
    description: 'This ICO will start accepting commitments soon.',
    showInput: false,
    showCountdown: true,
  },
  ACTIVE: {
    title: 'Commit BNB',
    description: 'Your commitment will be converted to tokens at the ICO price.',
    showInput: true,
    showCountdown: true,
  },
  ENDED_PENDING: {
    title: 'ICO Ended',
    description: 'Waiting for finalization...',
    showInput: false,
    showFinalizeButton: true,
  },
  FINALIZED: {
    title: 'Claim Your Tokens',
    description: 'The ICO has been finalized. Claim your token allocation.',
    showInput: false,
    showClaimButton: true,
  },
  FAILED: {
    title: 'ICO Failed',
    description: 'The minimum raise was not met. Claim your refund.',
    showInput: false,
    showRefundButton: true,
  },
  CLAIMED: {
    title: 'Tokens Claimed',
    description: 'You have successfully claimed your tokens.',
    showInput: false,
  },
  REFUNDED: {
    title: 'Refund Claimed',
    description: 'Your BNB has been refunded.',
    showInput: false,
  },
};
```

#### 5.2.3 TreasuryDashboard

```typescript
// components/treasury/TreasuryDashboard.tsx

interface TreasuryDashboardProps {
  treasuryAddress: string;
}

interface TreasuryTab {
  id: string;
  label: string;
  component: React.ComponentType<any>;
}

const TREASURY_TABS: TreasuryTab[] = [
  { id: 'overview', label: 'Overview', component: TreasuryOverview },
  { id: 'pending', label: 'Pending Actions', component: PendingActions },
  { id: 'history', label: 'Spend History', component: SpendHistory },
  { id: 'settings', label: 'Settings', component: TreasurySettings },
];

// Pending action display format
interface PendingActionDisplay {
  operationId: string;
  title: string;           // Derived from calldata
  description: string;
  amount: string;          // Formatted BNB/token amount
  recipient: string;
  status: 'waiting' | 'ready' | 'executing';
  scheduledAt: Date;
  readyAt: Date;
  timeRemaining: string;   // "23h 45m" or "Ready"
  canExecute: boolean;
  canCancel: boolean;
}

// Spend history table columns
const SPEND_HISTORY_COLUMNS = [
  { key: 'executedAt', label: 'Date', sortable: true },
  { key: 'recipient', label: 'Recipient', sortable: false },
  { key: 'amount', label: 'Amount', sortable: true },
  { key: 'reason', label: 'Reason', sortable: false },
  { key: 'transactionHash', label: 'Tx', sortable: false },
];
```

### 5.3 Form Validation Rules

```typescript
// lib/validation/fairLaunchValidation.ts

import { z } from 'zod';

export const createFairLaunchSchema = z.object({
  // Token details
  name: z
    .string()
    .min(1, 'Name is required')
    .max(64, 'Name must be 64 characters or less')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Name can only contain letters, numbers, and spaces'),

  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol must be 10 characters or less')
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters and numbers only')
    .transform(val => val.toUpperCase()),

  imageURI: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),

  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),

  // ICO parameters
  tokenSupply: z
    .string()
    .refine(val => {
      try {
        const bn = BigInt(val);
        return bn >= BigInt('1000000000000000000000000') && // 1M
               bn <= BigInt('1000000000000000000000000000000000'); // 1T
      } catch {
        return false;
      }
    }, 'Token supply must be between 1M and 1T'),

  minimumRaise: z
    .string()
    .refine(val => {
      try {
        const bn = BigInt(val);
        return bn >= BigInt('10000000000000000000'); // 10 BNB
      } catch {
        return false;
      }
    }, 'Minimum raise must be at least 10 BNB'),

  icoDuration: z
    .number()
    .int()
    .min(86400, 'Duration must be at least 1 day')
    .max(1209600, 'Duration cannot exceed 14 days'),

  // Team allocation
  teamTokensBps: z
    .number()
    .int()
    .min(0, 'Cannot be negative')
    .max(2000, 'Cannot exceed 20%')
    .default(0),

  teamWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
    .optional()
    .or(z.literal('')),

  // Treasury
  monthlyBudget: z
    .string()
    .default('0'),

  // Governance
  multisigSigners: z
    .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'))
    .min(2, 'At least 2 signers required')
    .max(5, 'Maximum 5 signers allowed'),

  multisigThreshold: z
    .number()
    .int()
    .min(2, 'Threshold must be at least 2'),
}).refine(
  data => !data.teamTokensBps || data.teamWallet,
  { message: 'Team wallet required when team allocation > 0', path: ['teamWallet'] }
).refine(
  data => data.multisigThreshold <= data.multisigSigners.length,
  { message: 'Threshold cannot exceed number of signers', path: ['multisigThreshold'] }
);

export type CreateFairLaunchInput = z.infer<typeof createFairLaunchSchema>;
```

---

## 6. v0.5: Testing Specifications

### 6.1 Smart Contract Test Cases

```typescript
// test/ICOContract.test.ts

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('ICOContract', function () {
  // Test fixture
  async function deployICOFixture() {
    const [owner, user1, user2, user3, treasury, factory] = await ethers.getSigners();

    const LaunchToken = await ethers.getContractFactory('LaunchToken');
    const token = await LaunchToken.deploy('Test Token', 'TEST', ethers.parseEther('10000000'));

    const ICOContract = await ethers.getContractFactory('ICOContract');
    const startTime = (await time.latest()) + 3600; // 1 hour from now
    const endTime = startTime + 86400 * 4; // 4 days

    const ico = await ICOContract.deploy(
      token.target,
      treasury.address,
      factory.address,
      ethers.parseEther('10000000'), // 10M tokens
      ethers.parseEther('10'), // 10 BNB minimum
      startTime,
      endTime,
      100, // 1% fee
      0, // No team tokens
      ethers.ZeroAddress
    );

    // Transfer tokens to ICO
    await token.transfer(ico.target, ethers.parseEther('10000000'));

    return { ico, token, owner, user1, user2, user3, treasury, factory, startTime, endTime };
  }

  describe('Deployment', function () {
    it('Should set correct initial state', async function () {
      const { ico, token, treasury } = await loadFixture(deployICOFixture);

      expect(await ico.token()).to.equal(token.target);
      expect(await ico.treasury()).to.equal(treasury.address);
      expect(await ico.status()).to.equal(0); // PENDING
      expect(await ico.totalCommitted()).to.equal(0);
    });

    it('Should reject invalid parameters', async function () {
      const [owner, treasury, factory] = await ethers.getSigners();
      const LaunchToken = await ethers.getContractFactory('LaunchToken');
      const token = await LaunchToken.deploy('Test', 'TEST', ethers.parseEther('10000000'));

      const ICOContract = await ethers.getContractFactory('ICOContract');

      // End time before start time
      await expect(
        ICOContract.deploy(
          token.target,
          treasury.address,
          factory.address,
          ethers.parseEther('10000000'),
          ethers.parseEther('10'),
          1000,
          500, // end < start
          100,
          0,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith('Invalid times');

      // Team tokens > 20%
      await expect(
        ICOContract.deploy(
          token.target,
          treasury.address,
          factory.address,
          ethers.parseEther('10000000'),
          ethers.parseEther('10'),
          1000,
          2000,
          100,
          ethers.parseEther('3000000'), // 30%
          owner.address
        )
      ).to.be.revertedWith('Team max 20%');
    });
  });

  describe('Commitments', function () {
    it('Should reject commitments before start', async function () {
      const { ico, user1 } = await loadFixture(deployICOFixture);

      await expect(
        ico.connect(user1).commit({ value: ethers.parseEther('1') })
      ).to.be.revertedWith('Not started');
    });

    it('Should accept commitments during ICO period', async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      await expect(
        ico.connect(user1).commit({ value: ethers.parseEther('1') })
      ).to.emit(ico, 'Committed')
        .withArgs(user1.address, ethers.parseEther('1'), ethers.parseEther('1'));

      expect(await ico.commitments(user1.address)).to.equal(ethers.parseEther('1'));
      expect(await ico.totalCommitted()).to.equal(ethers.parseEther('1'));
      expect(await ico.participantCount()).to.equal(1);
      expect(await ico.status()).to.equal(1); // ACTIVE
    });

    it('Should accumulate multiple commitments from same user', async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      await ico.connect(user1).commit({ value: ethers.parseEther('1') });
      await ico.connect(user1).commit({ value: ethers.parseEther('2') });

      expect(await ico.commitments(user1.address)).to.equal(ethers.parseEther('3'));
      expect(await ico.participantCount()).to.equal(1); // Still 1 participant
    });

    it('Should reject commitments after end', async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('1') });

      await time.increaseTo(endTime + 1);

      await expect(
        ico.connect(user1).commit({ value: ethers.parseEther('1') })
      ).to.be.revertedWith('Ended');
    });

    it('Should reject zero commitment', async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      await expect(
        ico.connect(user1).commit({ value: 0 })
      ).to.be.revertedWith('Must send BNB');
    });
  });

  describe('Finalization', function () {
    it('Should finalize when minimum is met', async function () {
      const { ico, user1, user2, treasury, factory, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      // Commit 15 BNB total (above 10 BNB minimum)
      await ico.connect(user1).commit({ value: ethers.parseEther('10') });
      await ico.connect(user2).commit({ value: ethers.parseEther('5') });

      await time.increaseTo(endTime + 1);

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      const factoryBalanceBefore = await ethers.provider.getBalance(factory.address);

      await expect(ico.finalize())
        .to.emit(ico, 'Finalized');

      expect(await ico.status()).to.equal(2); // FINALIZED

      // Check fund distribution
      // 15 BNB total, 1% fee = 0.15 BNB to factory, 14.85 BNB to treasury
      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      const factoryBalanceAfter = await ethers.provider.getBalance(factory.address);

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(ethers.parseEther('14.85'));
      expect(factoryBalanceAfter - factoryBalanceBefore).to.equal(ethers.parseEther('0.15'));
    });

    it('Should calculate correct token price', async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('20') });
      await time.increaseTo(endTime + 1);

      await ico.finalize();

      // 20 BNB raised, 10M tokens
      // Price = 20 BNB / 10M tokens = 0.000002 BNB per token
      // In wei: 20e18 / 10e24 * 1e18 = 2e12
      const tokenPrice = await ico.tokenPrice();
      expect(tokenPrice).to.equal(ethers.parseEther('0.000002'));
    });

    it('Should reject finalization before end', async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('15') });

      await expect(ico.finalize()).to.be.revertedWith('Not ended');
    });

    it('Should reject finalization if minimum not met', async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('5') }); // Below 10 BNB min

      await time.increaseTo(endTime + 1);

      await expect(ico.finalize()).to.be.revertedWith('Minimum not met');
    });
  });

  describe('Token Claims', function () {
    it('Should allow claiming after finalization', async function () {
      const { ico, token, user1, user2, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('10') });
      await ico.connect(user2).commit({ value: ethers.parseEther('10') });
      await time.increaseTo(endTime + 1);
      await ico.finalize();

      // User1 should get 50% = 5M tokens
      await expect(ico.connect(user1).claimTokens())
        .to.emit(ico, 'TokensClaimed')
        .withArgs(user1.address, ethers.parseEther('5000000'));

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther('5000000'));
    });

    it('Should calculate correct pro-rata allocation', async function () {
      const { ico, token, user1, user2, user3, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('5') });  // 25%
      await ico.connect(user2).commit({ value: ethers.parseEther('10') }); // 50%
      await ico.connect(user3).commit({ value: ethers.parseEther('5') });  // 25%
      await time.increaseTo(endTime + 1);
      await ico.finalize();

      await ico.connect(user1).claimTokens();
      await ico.connect(user2).claimTokens();
      await ico.connect(user3).claimTokens();

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther('2500000')); // 2.5M
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther('5000000')); // 5M
      expect(await token.balanceOf(user3.address)).to.equal(ethers.parseEther('2500000')); // 2.5M
    });

    it('Should reject double claiming', async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('15') });
      await time.increaseTo(endTime + 1);
      await ico.finalize();

      await ico.connect(user1).claimTokens();
      await expect(ico.connect(user1).claimTokens()).to.be.revertedWith('Already claimed');
    });

    it('Should reject claims before finalization', async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('15') });

      await expect(ico.connect(user1).claimTokens()).to.be.revertedWith('Not finalized');
    });
  });

  describe('Refunds', function () {
    it('Should allow refunds after failure', async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('5') }); // Below minimum
      await time.increaseTo(endTime + 1);

      await ico.markFailed();
      expect(await ico.status()).to.equal(3); // FAILED

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await ico.connect(user1).refund();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(balanceAfter - balanceBefore + gasCost).to.equal(ethers.parseEther('5'));
    });

    it('Should reject refunds if ICO succeeded', async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('15') });
      await time.increaseTo(endTime + 1);
      await ico.finalize();

      await expect(ico.connect(user1).refund()).to.be.revertedWith('Not failed');
    });
  });

  describe('Edge Cases', function () {
    it('Should handle rounding correctly with many participants', async function () {
      const { ico, token, startTime, endTime } = await loadFixture(deployICOFixture);
      const signers = await ethers.getSigners();

      await time.increaseTo(startTime);

      // 7 participants commit 1 BNB each (indivisible allocation)
      for (let i = 1; i <= 7; i++) {
        await ico.connect(signers[i]).commit({ value: ethers.parseEther('1.42857') });
      }

      await time.increaseTo(endTime + 1);
      await ico.finalize();

      let totalClaimed = 0n;
      for (let i = 1; i <= 7; i++) {
        await ico.connect(signers[i]).claimTokens();
        totalClaimed += await token.balanceOf(signers[i].address);
      }

      // Total claimed should be <= token supply (some dust may remain)
      expect(totalClaimed).to.be.lte(ethers.parseEther('10000000'));
      // But should be very close (within 7 tokens of dust max)
      expect(totalClaimed).to.be.gte(ethers.parseEther('9999993'));
    });

    it('Should handle single participant getting all tokens', async function () {
      const { ico, token, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther('100') });
      await time.increaseTo(endTime + 1);
      await ico.finalize();

      await ico.connect(user1).claimTokens();
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther('10000000'));
    });

    it('Should prevent reentrancy on refund', async function () {
      // This test requires a malicious contract that attempts reentrancy
      // For now, we trust ReentrancyGuard from OpenZeppelin
      // Full test would deploy a ReentrancyAttacker contract
    });
  });
});
```

### 6.2 Test Coverage Targets

| Contract | Line Coverage | Branch Coverage | Function Coverage |
|----------|---------------|-----------------|-------------------|
| ICOContract | >= 95% | >= 90% | 100% |
| Treasury | >= 95% | >= 90% | 100% |
| LaunchFactory | >= 90% | >= 85% | 100% |
| LaunchToken | >= 90% | >= 85% | 100% |

### 6.3 Security Test Checklist

```markdown
## Security Test Checklist

### Reentrancy
- [ ] ICOContract.commit() - No external calls
- [ ] ICOContract.claimTokens() - State updated before transfer
- [ ] ICOContract.refund() - State updated before transfer
- [ ] Treasury.spendBNB() - ReentrancyGuard applied
- [ ] Treasury.spendTokens() - ReentrancyGuard applied

### Access Control
- [ ] Only timelock can call Treasury spend functions
- [ ] Anyone can call finalize() (permissionless)
- [ ] Anyone can call markFailed() (permissionless)
- [ ] Only committers can claim/refund

### Integer Overflow/Underflow
- [ ] Solidity 0.8.x handles overflow by default
- [ ] Verify no unchecked blocks with arithmetic
- [ ] Test with extreme values (uint256 max)

### Timestamp Manipulation
- [ ] ±15 second manipulation has no material impact
- [ ] No == comparisons with block.timestamp

### Flash Loan Attacks
- [ ] Multi-day commitment period prevents flash loans
- [ ] No same-block finalization

### Front-running
- [ ] Commitment order doesn't affect allocation (pro-rata)
- [ ] No MEV extraction opportunity

### Denial of Service
- [ ] No unbounded loops in finalize()
- [ ] Individual claims (not batch)
- [ ] Failed transfers don't block others

### Price Oracle Manipulation
- [ ] No external price oracle in v0.1-v1.0
- [ ] Token price determined by ICO math only
```

---

## 7. v1.0: Production Deployment

### 7.1 Deployment Runbook

```markdown
# Fair Launch v1.0 - Deployment Runbook

## Pre-Deployment Checklist

### Code Verification
- [ ] All tests passing: `npx hardhat test`
- [ ] Coverage meets targets: `npx hardhat coverage`
- [ ] No critical/high findings from audit
- [ ] Bug bounty running for 2+ weeks

### Environment Setup
- [ ] Deployer wallet funded (>= 1 BNB for gas)
- [ ] Deployer private key secured (hardware wallet recommended)
- [ ] RPC endpoints configured (primary + fallback)
- [ ] BSCScan API key for verification

### Configuration
- [ ] Platform fee wallet address confirmed
- [ ] Initial multisig signers identified
- [ ] Default parameters reviewed

## Deployment Steps

### Step 1: Deploy LaunchFactory

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY="..."
export BSC_RPC_URL="https://bsc-dataseed.binance.org"
export BSCSCAN_API_KEY="..."

# Deploy
npx hardhat run scripts/deploy-factory.ts --network bscMainnet

# Expected output:
# LaunchFactory deployed to: 0x...
# Transaction hash: 0x...
```

### Step 2: Verify on BSCScan

```bash
npx hardhat verify --network bscMainnet <FACTORY_ADDRESS>

# Expected: "Successfully verified contract LaunchFactory on BSCScan"
```

### Step 3: Configure Factory

```bash
# Set platform fee (if different from default)
npx hardhat run scripts/configure-factory.ts --network bscMainnet

# Verify configuration
npx hardhat run scripts/verify-config.ts --network bscMainnet
```

### Step 4: Update Frontend

1. Update `lib/contracts/addresses.ts`:
```typescript
export const CONTRACTS = {
  launchFactory: {
    56: '0x...', // BSC Mainnet
    97: '0x...', // BSC Testnet
  },
};
```

2. Deploy frontend changes
3. Clear CDN cache if applicable

### Step 5: Update Indexer

1. Update indexer configuration with new factory address
2. Deploy indexer
3. Verify indexer is tracking factory events

### Step 6: Smoke Test

1. Create test fair launch (small amount)
2. Verify ICO appears in frontend
3. Test commitment flow
4. Test finalization
5. Test claiming

## Post-Deployment Monitoring

### Metrics to Watch (First 24 Hours)
- [ ] Factory event emissions
- [ ] Gas costs within expected range
- [ ] No failed transactions
- [ ] Frontend loads correctly
- [ ] Indexer processing events

### Alerts to Configure
- Factory balance drops (fee collection)
- High gas usage on any function
- Unusual event patterns
- Frontend error rate spike

## Rollback Procedure

### If Critical Bug Found:
1. **DO NOT** attempt to upgrade (contracts are immutable)
2. Disable "Create Fair Launch" button in frontend
3. Communicate to users via announcement
4. Deploy new factory with fix
5. Update frontend to new address
6. Existing ICOs continue to function with old contracts

### If Frontend Issue:
1. Rollback frontend deployment
2. Clear CDN cache
3. Verify functionality restored
```

### 7.2 Monitoring & Alerting

```typescript
// monitoring/alerts.ts

interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  channels: ('slack' | 'email' | 'pagerduty')[];
}

export const ALERTS: AlertConfig[] = [
  // Contract Alerts
  {
    name: 'ICO Creation Failed',
    condition: 'transaction_reverted AND method == "createFairLaunch"',
    threshold: 1,
    severity: 'warning',
    channels: ['slack'],
  },
  {
    name: 'High Gas Usage',
    condition: 'gas_used > expected_gas * 1.5',
    threshold: 3, // 3 occurrences in 1 hour
    severity: 'warning',
    channels: ['slack'],
  },
  {
    name: 'Platform Fee Withdrawal',
    condition: 'method == "withdrawFees"',
    threshold: 1,
    severity: 'info',
    channels: ['slack', 'email'],
  },

  // Indexer Alerts
  {
    name: 'Indexer Lag',
    condition: 'current_block - indexed_block > 100',
    threshold: 1,
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
  },
  {
    name: 'Indexer Error',
    condition: 'indexer_error_count > 0',
    threshold: 5, // 5 errors in 5 minutes
    severity: 'warning',
    channels: ['slack'],
  },

  // Frontend Alerts
  {
    name: 'API Error Rate',
    condition: 'api_error_rate > 1%',
    threshold: 1,
    severity: 'warning',
    channels: ['slack'],
  },
  {
    name: 'Frontend Load Time',
    condition: 'p95_load_time > 3000ms',
    threshold: 1,
    severity: 'warning',
    channels: ['slack'],
  },

  // Business Alerts
  {
    name: 'Large ICO Created',
    condition: 'minimumRaise > 100 BNB',
    threshold: 1,
    severity: 'info',
    channels: ['slack', 'email'],
  },
  {
    name: 'ICO Finalized',
    condition: 'event == "Finalized"',
    threshold: 1,
    severity: 'info',
    channels: ['slack'],
  },
  {
    name: 'ICO Failed',
    condition: 'event == "ICOFailed"',
    threshold: 1,
    severity: 'warning',
    channels: ['slack'],
  },
];
```

### 7.3 Incident Response

```markdown
# Incident Response Playbook

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| SEV-1 | Critical - Funds at risk | Immediate | Smart contract vulnerability |
| SEV-2 | High - Service degraded | 1 hour | Indexer down, API errors |
| SEV-3 | Medium - Partial impact | 4 hours | Slow performance, UI bugs |
| SEV-4 | Low - Minimal impact | 24 hours | Cosmetic issues |

## SEV-1: Smart Contract Vulnerability

### Immediate Actions (0-15 minutes)
1. **Assess scope**: Which contracts affected? Which functions?
2. **Pause if possible**: Disable frontend creation of new ICOs
3. **Communicate**: Post to Discord/Twitter: "Investigating potential issue"
4. **Assemble team**: Page on-call engineer + security lead

### Containment (15-60 minutes)
1. **Analyze**: Determine exact vulnerability
2. **Assess impact**: Any funds lost? Any at risk?
3. **Plan mitigation**: Can we deploy new factory? Need to contact users?

### Resolution (1-24 hours)
1. **Fix**: Deploy new contracts if needed
2. **Verify**: Security team validates fix
3. **Communicate**: Detailed post-mortem to community
4. **Monitor**: Watch for any exploitation attempts

## SEV-2: Indexer/API Down

### Immediate Actions (0-15 minutes)
1. Check indexer logs for errors
2. Check database connectivity
3. Check RPC endpoint status

### Resolution
1. Restart indexer if stuck
2. Reindex from safe block if data corrupted
3. Scale horizontally if load issue

## Contact List

| Role | Name | Contact |
|------|------|---------|
| Engineering Lead | TBD | phone/slack |
| Security Lead | TBD | phone/slack |
| Communications | TBD | phone/slack |
```

---

## Appendix: Quick Reference

### Contract Addresses (To Be Filled After Deployment)

| Contract | BSC Testnet | BSC Mainnet |
|----------|-------------|-------------|
| LaunchFactory | TBD | TBD |
| LaunchToken (impl) | TBD | TBD |

### Key Parameters

| Parameter | Value |
|-----------|-------|
| Platform Fee | 1% (100 bps) |
| Min ICO Duration | 1 day |
| Max ICO Duration | 14 days |
| Min Raise | 10 BNB |
| Min Token Supply | 1M |
| Max Token Supply | 1T |
| Max Team Allocation | 20% |
| Timelock Delay | 48 hours |

### Gas Estimates

| Operation | Estimated Gas | Cost @ 5 gwei |
|-----------|---------------|---------------|
| Create Fair Launch | ~3,000,000 | ~0.015 BNB |
| Commit | ~65,000 | ~0.000325 BNB |
| Finalize | ~80,000 | ~0.0004 BNB |
| Claim Tokens | ~70,000 | ~0.00035 BNB |
| Refund | ~45,000 | ~0.000225 BNB |
