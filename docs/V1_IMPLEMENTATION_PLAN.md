# Fair Launch - Implementation Plan

> Checkpoint-based implementation plan (February 2024)

**Related Documents:**
- [FAIR_LAUNCH_SYSTEM.md](./FAIR_LAUNCH_SYSTEM.md) - System overview
- [FAIR_LAUNCH_DECISIONS.md](./FAIR_LAUNCH_DECISIONS.md) - Decision matrix
- [FAIR_LAUNCH_COMPARISON.md](./FAIR_LAUNCH_COMPARISON.md) - Current vs Fair Launch
- [TECHNICAL_SPECIFICATIONS.md](./TECHNICAL_SPECIFICATIONS.md) - Complete technical details
- [ARCHITECTURE_AND_BEST_PRACTICES.md](./ARCHITECTURE_AND_BEST_PRACTICES.md) - **Architecture & coding standards**

---

## Version Checkpoints

| Version | Description | Dependencies | Est. Duration |
|---------|-------------|--------------|---------------|
| **v0.1** | Core ICO Contract | None | 3-4 days |
| **v0.2** | Treasury + Multisig + Timelock | v0.1 | 2-3 days |
| **v0.3** | Database + Indexer | v0.1, v0.2 | 2-3 days |
| **v0.4** | Frontend Integration | v0.1, v0.2, v0.3 | 4-5 days |
| **v0.5** | Testing + Testnet | v0.1-v0.4 | 3-4 days |
| **v1.0** | Production Release | v0.5 | 2-3 days |
| **v1.1** | Team Vesting (Time-Based) | v1.0 | 3-4 days |
| **v1.2** | Emergency Pause | v1.0 | 1-2 days |
| **v2.0** | Bid Wall System | v1.0 | 5-7 days |
| **v2.1** | Performance Unlocks | v2.0 | 3-4 days |
| **v3.0** | Token Voting Governance | v1.0 | 7-10 days |

## Feature Matrix

| Feature | v0.1 | v0.2 | v1.0 | v1.1 | v2.0 | v3.0 |
|---------|------|------|------|------|------|------|
| ICO Commitments | ✅ | | | | | |
| Pro-Rata Allocation | ✅ | | | | | |
| Token Claims | ✅ | | | | | |
| Refunds (Failed ICO) | ✅ | | | | | |
| Treasury | | ✅ | | | | |
| Multisig + Timelock | | ✅ | | | | |
| Liquidity Pool Setup | | ✅ | | | | |
| Platform Fee | ✅ | | | | | |
| Team Tokens (Locked) | ✅ | | | | | |
| Team Vesting | | | | ✅ | | |
| Emergency Pause | | | | | ✅ | |
| Bid Wall | | | | | ✅ | |
| Performance Unlocks | | | | | | ✅ |
| Token Voting | | | | | | ✅ |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FAIR LAUNCH SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CREATE TOKEN + ICO (v0.1)                                   │
│     └─> Creator fills form, configures parameters               │
│     └─> LaunchFactory deploys:                                  │
│         • LaunchToken (ERC20, minting disabled after deploy)    │
│         • ICOContract (accepts commitments)                     │
│                                                                 │
│  2. ICO PERIOD (1-14 days, configurable)                        │
│     └─> Users commit WBNB                                       │
│     └─> No withdrawals during period                            │
│     └─> Anyone can view total committed                         │
│                                                                 │
│  3. FINALIZATION                                                │
│     └─> Anyone can call finalize() after ICO ends               │
│     └─> If minimum NOT met → status = FAILED                    │
│     └─> If minimum MET:                                         │
│         • Calculate tokenPrice = totalRaised / tokenSupply      │
│         • Status = FINALIZED                                    │
│         • Platform takes 1% fee                                 │
│         • 20% to liquidity pool (v0.2)                          │
│         • 79% to treasury (v0.2)                                │
│                                                                 │
│  4. USER CLAIMS (Gas-Optimized)                                 │
│     └─> Each user calls claimTokens()                           │
│     └─> Allocation calculated at claim time (no loops!)         │
│     └─> allocation = (commitment * supply) / totalRaised        │
│                                                                 │
│  5. TREASURY (v0.2)                                             │
│     └─> Multisig (2/3 or 3/5) + 48h Timelock                    │
│     └─> Holds 79% of raise + LP tokens                          │
│     └─> Optional monthly spending limit                         │
│                                                                 │
│  6. TRADING (v0.2)                                              │
│     └─> WeightedPool enabled after finalization                 │
│     └─> Same AMM as existing system                             │
│                                                                 │
│  7. TEAM TOKENS (Optional, v0.1)                                │
│     └─> Max 20% of total supply                                 │
│     └─> Sent to treasury (locked until v1.1 vesting)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

---

## v0.1: Core ICO Contract

**Goal**: Minimal viable ICO - commit, finalize, claim, refund.

### ICOContract.sol

**Key Design Decisions**:
1. **Gas-optimized**: No loops in finalize() - allocations calculated at claim time
2. **No participant array**: Avoids unbounded gas costs
3. **Commitment tracking**: Simple mapping, allows multiple commits from same address
4. **Permissionless finalization**: Anyone can call finalize() after ICO ends

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ICOContract is ReentrancyGuard {
    enum Status { PENDING, ACTIVE, FINALIZED, FAILED }

    // Immutable Config (set at deployment)
    address public immutable token;
    address public immutable treasury;
    address public immutable factory;
    uint256 public immutable tokenSupply;      // Total tokens for ICO
    uint256 public immutable minimumRaise;     // Minimum BNB to succeed
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable platformFeeBps;   // Basis points (100 = 1%)

    // Optional team tokens
    uint256 public immutable teamTokens;       // 0 if no team allocation
    address public immutable teamWallet;

    // Mutable State
    Status public status;
    uint256 public totalCommitted;
    uint256 public tokenPrice;                 // Set on finalization (18 decimals)
    uint256 public participantCount;

    // User State
    mapping(address => uint256) public commitments;
    mapping(address => bool) public hasClaimed;

    // Events
    event Committed(address indexed user, uint256 amount, uint256 totalUserCommitment);
    event Finalized(uint256 totalRaised, uint256 tokenPrice, uint256 participantCount);
    event TokensClaimed(address indexed user, uint256 allocation);
    event Refunded(address indexed user, uint256 amount);
    event ICOFailed(uint256 totalCommitted, uint256 minimumRequired);

    constructor(
        address _token,
        address _treasury,
        address _factory,
        uint256 _tokenSupply,
        uint256 _minimumRaise,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _platformFeeBps,
        uint256 _teamTokens,
        address _teamWallet
    ) {
        require(_token != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        require(_endTime > _startTime, "Invalid times");
        require(_tokenSupply > 0, "Invalid supply");
        require(_platformFeeBps <= 500, "Fee too high"); // Max 5%
        require(_teamTokens <= (_tokenSupply * 20) / 100, "Team max 20%");

        token = _token;
        treasury = _treasury;
        factory = _factory;
        tokenSupply = _tokenSupply;
        minimumRaise = _minimumRaise;
        startTime = _startTime;
        endTime = _endTime;
        platformFeeBps = _platformFeeBps;
        teamTokens = _teamTokens;
        teamWallet = _teamWallet;

        status = Status.PENDING;
    }

    /// @notice Commit BNB to the ICO
    function commit() external payable nonReentrant {
        require(block.timestamp >= startTime, "Not started");
        require(block.timestamp <= endTime, "Ended");
        require(msg.value > 0, "Must send BNB");

        // Update status on first commit
        if (status == Status.PENDING) {
            status = Status.ACTIVE;
        }
        require(status == Status.ACTIVE, "ICO not active");

        // Track if new participant
        if (commitments[msg.sender] == 0) {
            participantCount++;
        }

        commitments[msg.sender] += msg.value;
        totalCommitted += msg.value;

        emit Committed(msg.sender, msg.value, commitments[msg.sender]);
    }

    /// @notice Finalize the ICO (anyone can call after end time)
    function finalize() external nonReentrant {
        require(status == Status.ACTIVE, "Not active");
        require(block.timestamp > endTime, "Not ended");
        require(totalCommitted >= minimumRaise, "Minimum not met");

        status = Status.FINALIZED;

        // Calculate token price: (totalRaised * 1e18) / tokenSupply
        // This gives price in wei per token (18 decimal precision)
        tokenPrice = (totalCommitted * 1e18) / tokenSupply;

        // Calculate fee and treasury amounts
        uint256 platformFee = (totalCommitted * platformFeeBps) / 10000;
        uint256 treasuryAmount = totalCommitted - platformFee;

        // Transfer to treasury
        (bool treasurySent,) = payable(treasury).call{value: treasuryAmount}("");
        require(treasurySent, "Treasury transfer failed");

        // Transfer platform fee
        if (platformFee > 0) {
            (bool feeSent,) = payable(factory).call{value: platformFee}("");
            require(feeSent, "Fee transfer failed");
        }

        emit Finalized(totalCommitted, tokenPrice, participantCount);
    }

    /// @notice Mark ICO as failed (anyone can call after end time if minimum not met)
    function markFailed() external {
        require(status == Status.ACTIVE || status == Status.PENDING, "Invalid status");
        require(block.timestamp > endTime, "Not ended");
        require(totalCommitted < minimumRaise, "Minimum was met");

        status = Status.FAILED;

        emit ICOFailed(totalCommitted, minimumRaise);
    }

    /// @notice Claim tokens after successful ICO
    /// @dev Allocation calculated at claim time (gas-optimized, no loops in finalize)
    function claimTokens() external nonReentrant {
        require(status == Status.FINALIZED, "Not finalized");
        require(commitments[msg.sender] > 0, "No commitment");
        require(!hasClaimed[msg.sender], "Already claimed");

        hasClaimed[msg.sender] = true;

        // Calculate allocation: (userCommitment * tokenSupply) / totalCommitted
        uint256 allocation = (commitments[msg.sender] * tokenSupply) / totalCommitted;

        require(IERC20(token).transfer(msg.sender, allocation), "Transfer failed");

        emit TokensClaimed(msg.sender, allocation);
    }

    /// @notice Refund after failed ICO
    function refund() external nonReentrant {
        require(status == Status.FAILED, "Not failed");
        require(commitments[msg.sender] > 0, "No commitment");

        uint256 refundAmount = commitments[msg.sender];
        commitments[msg.sender] = 0; // Prevent re-entrancy

        (bool sent,) = payable(msg.sender).call{value: refundAmount}("");
        require(sent, "Refund failed");

        emit Refunded(msg.sender, refundAmount);
    }

    /// @notice View function to calculate user's token allocation
    function getAllocation(address user) external view returns (uint256) {
        if (totalCommitted == 0) return 0;
        return (commitments[user] * tokenSupply) / totalCommitted;
    }

    /// @notice View function to get ICO info
    function getICOInfo() external view returns (
        Status _status,
        uint256 _totalCommitted,
        uint256 _tokenPrice,
        uint256 _participantCount,
        uint256 _minimumRaise,
        uint256 _tokenSupply,
        uint256 _startTime,
        uint256 _endTime
    ) {
        return (
            status,
            totalCommitted,
            tokenPrice,
            participantCount,
            minimumRaise,
            tokenSupply,
            startTime,
            endTime
        );
    }
}
```

### Key Improvements Over Original Design

| Issue | Original | Fixed |
|-------|----------|-------|
| **Gas in finalize()** | Loop over all participants | No loop - price calculated once |
| **Allocation calculation** | Stored in mapping during finalize | Calculated at claim time |
| **Participant tracking** | Array (unbounded gas) | Counter only |
| **Re-entrancy** | Basic checks | ReentrancyGuard + CEI pattern |
| **Multiple commits** | Pushed duplicate addresses | Simple increment |
| **Status transitions** | Manual | Automatic on first commit |

---

## v0.2: Treasury + Multisig + Timelock

**Goal**: Secure fund management with governance controls.

**Dependencies**: v0.1 (ICOContract)

### Treasury.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable, ReentrancyGuard {
    // Timelock is the owner (set via Ownable constructor)
    address public immutable token;

    // Optional monthly spending limit
    uint256 public monthlyLimit;
    uint256 public monthlySpent;
    uint256 public monthStartTimestamp;

    // Tracking
    uint256 public totalReceived;
    uint256 public totalSpent;

    // Events
    event FundsReceived(address indexed from, uint256 amount);
    event BNBSpent(address indexed recipient, uint256 amount, string reason);
    event TokensSpent(address indexed tokenAddress, address indexed recipient, uint256 amount, string reason);
    event MonthlyLimitUpdated(uint256 oldLimit, uint256 newLimit);

    constructor(
        address _token,
        address _timelock,
        uint256 _monthlyLimit
    ) Ownable(_timelock) {
        require(_token != address(0), "Invalid token");
        token = _token;
        monthlyLimit = _monthlyLimit;
        monthStartTimestamp = block.timestamp;
    }

    /// @notice Receive BNB
    receive() external payable {
        totalReceived += msg.value;
        emit FundsReceived(msg.sender, msg.value);
    }

    /// @notice Spend BNB (only via timelock)
    function spendBNB(
        address payable recipient,
        uint256 amount,
        string calldata reason
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");

        _checkMonthlyLimit(amount);

        totalSpent += amount;
        monthlySpent += amount;

        (bool sent,) = recipient.call{value: amount}("");
        require(sent, "Transfer failed");

        emit BNBSpent(recipient, amount, reason);
    }

    /// @notice Spend ERC20 tokens (only via timelock)
    function spendTokens(
        address tokenAddress,
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");

        require(IERC20(tokenAddress).transfer(recipient, amount), "Transfer failed");

        emit TokensSpent(tokenAddress, recipient, amount, reason);
    }

    /// @notice Update monthly spending limit (only via timelock)
    function setMonthlyLimit(uint256 newLimit) external onlyOwner {
        uint256 oldLimit = monthlyLimit;
        monthlyLimit = newLimit;
        emit MonthlyLimitUpdated(oldLimit, newLimit);
    }

    /// @notice Check and reset monthly limit
    function _checkMonthlyLimit(uint256 amount) internal {
        // Reset monthly counter if new month
        if (block.timestamp >= monthStartTimestamp + 30 days) {
            monthlySpent = 0;
            monthStartTimestamp = block.timestamp;
        }

        // Check limit (0 = no limit)
        if (monthlyLimit > 0) {
            require(monthlySpent + amount <= monthlyLimit, "Monthly limit exceeded");
        }
    }

    /// @notice View treasury balances
    function getBalances() external view returns (
        uint256 bnbBalance,
        uint256 tokenBalance,
        uint256 _totalReceived,
        uint256 _totalSpent,
        uint256 _monthlySpent,
        uint256 _monthlyLimit
    ) {
        return (
            address(this).balance,
            IERC20(token).balanceOf(address(this)),
            totalReceived,
            totalSpent,
            monthlySpent,
            monthlyLimit
        );
    }
}
```

### Timelock Setup

Using OpenZeppelin's `TimelockController`:

```solidity
// Deploy timelock with 48-hour delay
TimelockController timelock = new TimelockController(
    2 days,                    // minDelay: 48 hours
    proposers,                 // Array of proposer addresses (multisig)
    executors,                 // Array of executor addresses (multisig)
    address(0)                 // No admin (immutable)
);

// Treasury ownership transferred to timelock
Treasury treasury = new Treasury(token, address(timelock), monthlyLimit);
```

### Multisig Options

| Option | Setup | Recommendation |
|--------|-------|----------------|
| **Gnosis Safe** | Deploy via Safe factory | Recommended for production |
| **Custom 2/3** | Simple multisig contract | OK for testnet |
| **OpenZeppelin Governor** | Full governance | v3.0 upgrade path |

For v0.2, use Gnosis Safe (industry standard, battle-tested).

### LaunchFactory.sol

**Purpose**: Deploy new fair launches, set platform fees, collect fees.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./ICOContract.sol";
import "./Treasury.sol";
import "./LaunchToken.sol";

contract LaunchFactory is Ownable {
    // Platform settings
    uint256 public platformFeeBps = 100; // 1% (100 basis points)
    uint256 public constant MAX_FEE_BPS = 500; // Max 5%

    // Constraints
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 14 days;
    uint256 public constant MIN_RAISE = 10 ether; // ~$3k at $300/BNB
    uint256 public constant MIN_SUPPLY = 1_000_000 * 1e18;
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000 * 1e18;
    uint256 public constant MAX_TEAM_BPS = 2000; // 20%

    // Tracking
    address[] public allICOs;
    mapping(address => bool) public isValidICO;
    mapping(address => address) public icoToToken;
    mapping(address => address) public icoToTreasury;

    // Events
    event FairLaunchCreated(
        address indexed ico,
        address indexed token,
        address indexed treasury,
        address creator,
        uint256 tokenSupply,
        uint256 minimumRaise,
        uint256 startTime,
        uint256 endTime
    );
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeesWithdrawn(address indexed to, uint256 amount);

    struct LaunchParams {
        // Token details
        string name;
        string symbol;
        string imageURI;
        string description;

        // ICO parameters
        uint256 tokenSupply;
        uint256 minimumRaise;
        uint256 icoDuration;      // 1-14 days

        // Team allocation (optional)
        uint256 teamTokensBps;    // 0-2000 (0-20%)
        address teamWallet;

        // Treasury
        uint256 monthlyBudget;    // 0 = no limit

        // Multisig signers for treasury
        address[] multisigSigners;
        uint256 multisigThreshold;
    }

    constructor() Ownable(msg.sender) {}

    /// @notice Create a new fair launch ICO
    function createFairLaunch(LaunchParams calldata params)
        external
        returns (address ico, address token, address treasury)
    {
        // Validate parameters
        require(bytes(params.name).length > 0, "Name required");
        require(bytes(params.symbol).length > 0, "Symbol required");
        require(params.tokenSupply >= MIN_SUPPLY && params.tokenSupply <= MAX_SUPPLY, "Invalid supply");
        require(params.minimumRaise >= MIN_RAISE, "Below minimum raise");
        require(params.icoDuration >= MIN_DURATION && params.icoDuration <= MAX_DURATION, "Invalid duration");
        require(params.teamTokensBps <= MAX_TEAM_BPS, "Team allocation too high");
        if (params.teamTokensBps > 0) {
            require(params.teamWallet != address(0), "Team wallet required");
        }

        // Calculate team tokens
        uint256 teamTokens = (params.tokenSupply * params.teamTokensBps) / 10000;
        uint256 totalSupply = params.tokenSupply + teamTokens;

        // 1. Deploy Token (minting disabled after initial mint)
        LaunchToken newToken = new LaunchToken(
            params.name,
            params.symbol,
            totalSupply
        );
        token = address(newToken);

        // 2. Deploy Timelock (48h delay)
        address[] memory proposers = params.multisigSigners;
        address[] memory executors = params.multisigSigners;
        TimelockController timelock = new TimelockController(
            2 days,
            proposers,
            executors,
            address(0) // No admin
        );

        // 3. Deploy Treasury
        Treasury newTreasury = new Treasury(
            token,
            address(timelock),
            params.monthlyBudget
        );
        treasury = address(newTreasury);

        // 4. Deploy ICO Contract
        uint256 startTime = block.timestamp + 1 hours; // 1 hour delay for setup
        uint256 endTime = startTime + params.icoDuration;

        ICOContract newICO = new ICOContract(
            token,
            treasury,
            address(this),
            params.tokenSupply,  // ICO tokens (excludes team)
            params.minimumRaise,
            startTime,
            endTime,
            platformFeeBps,
            teamTokens,
            params.teamWallet
        );
        ico = address(newICO);

        // 5. Transfer tokens
        // ICO tokens to ICO contract
        newToken.transfer(ico, params.tokenSupply);
        // Team tokens to treasury (locked)
        if (teamTokens > 0) {
            newToken.transfer(treasury, teamTokens);
        }

        // 6. Register
        allICOs.push(ico);
        isValidICO[ico] = true;
        icoToToken[ico] = token;
        icoToTreasury[ico] = treasury;

        emit FairLaunchCreated(
            ico,
            token,
            treasury,
            msg.sender,
            params.tokenSupply,
            params.minimumRaise,
            startTime,
            endTime
        );

        return (ico, token, treasury);
    }

    /// @notice Update platform fee (owner only)
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Fee too high");
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Withdraw collected fees (owner only)
    function withdrawFees(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees");
        (bool sent,) = to.call{value: balance}("");
        require(sent, "Withdrawal failed");
        emit FeesWithdrawn(to, balance);
    }

    /// @notice Receive fees from ICO contracts
    receive() external payable {}

    /// @notice Get all ICOs count
    function getICOCount() external view returns (uint256) {
        return allICOs.length;
    }

    /// @notice Get ICOs paginated
    function getICOs(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = allICOs.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allICOs[i];
        }
        return result;
    }
}
```

### Reusing Existing Contracts

| Contract | Status | Changes Needed |
|----------|--------|----------------|
| **LaunchToken.sol** | Exists | Minor: disable minting after deploy |
| **WeightedPool.sol** | Deployed on testnet | None - reuse as-is |
| **PoolRegistry.sol** | Exists | Minor: add ICO tracking fields |
| **TokenFactory.sol** | Exists | Keep for legacy launches |

---

## v0.3: Database + Indexer

**Goal**: Track ICOs, commitments, and treasury state.

**Dependencies**: v0.1, v0.2

### Database Schema Updates

Add to `prisma/schema.prisma`:

```prisma
// ICO Model
model ICO {
  id              String   @id @default(cuid())
  tokenAddress    String   @unique
  icoAddress      String   @unique
  treasuryAddress  String   @unique
  poolAddress     String   @unique

  // Config
  tokenSupply     BigInt
  minimumRaise    BigInt
  icoDuration     Int      // User-configurable (in seconds)
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

  @@index([status])
  @@index([startTime(sort: Desc)])
  @@map("icos")
}

// Commitment Model
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
  @@index([userAddress])
  @@index([amount(sort: Desc)])
  @@map("commitments")
}

// Treasury Model
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

  @@map("treasuries")
}

// Add to existing Token model
model Token {
  // ... existing fields ...

  // ICO relationship
  ico           ICO?
  treasury       Treasury?

  // ... existing fields ...
}

// Update TokenStatus enum if needed
enum ICOStatus {
  PENDING
  ACTIVE
  FINALIZED
  FAILED
}
```

### Indexer Updates

Create `scripts/indexer/fair-launch-events.ts`:

```typescript
import { publicClient, getContract } from 'viem'
import { ICO_ABI, TREASURY_ABI } from '@/lib/blockchain/abis'

export async function indexICOEvents() {
  const icos = await prisma.iCO.findMany({
    where: { status: { in: ['PENDING', 'ACTIVE'] } }
  })

  for (const ico of icos) {
    const contract = getContract({
      address: ico.icoAddress as `0x${string}`,
      abi: ICO_ABI
    })

    // Index Committed events
    const commitments = await publicClient.getLogs({
      address: ico.icoAddress as `0x${string}`,
      event: contract.events.Committed,
      fromBlock: lastIndexedBlock,
      toBlock: 'latest'
    })

    for (const log of commitments) {
      await prisma.commitment.upsert({
        where: {
          icoId_userAddress: {
            icoId: ico.id,
            userAddress: log.args.user
          }
        },
        create: {
          icoId: ico.id,
          userAddress: log.args.user,
          amount: log.args.amount.toString()
        },
        update: {
          amount: log.args.amount.toString()
        }
      })
    }

    // Index Finalized events
    const finalizations = await publicClient.getLogs({
      address: ico.icoAddress as `0x${string}`,
      event: contract.events.Finalized
    })

    for (const log of finalizations) {
      await prisma.iCO.update({
        where: { id: ico.id },
        data: {
          status: 'FINALIZED',
          tokenPrice: log.args.tokenPrice.toString(),
          finalizedAt: new Date()
        }
      })

      // Calculate token allocations
      await distributeTokens(ico)
    }

    // Index Failed events
    const failures = await publicClient.getLogs({
      address: ico.icoAddress as `0x${string}`,
      event: contract.events.Failed
    })

    for (const log of failures) {
      await prisma.iCO.update({
        where: { id: ico.id },
        data: { status: 'FAILED' }
      })

      // Set refund amounts
      await processRefunds(ico)
    }
  }
}

async function distributeTokens(ico: ICO) {
  const commitments = await prisma.commitment.findMany({
    where: { icoId: ico.id }
  })

  const totalCommitted = BigInt(ico.totalCommitted)
  const tokenSupply = BigInt(ico.tokenSupply)

  for (const commitment of commitments) {
    const userCommitment = BigInt(commitment.amount)
    const allocation = (userCommitment * tokenSupply) / totalCommitted

    await prisma.commitment.update({
      where: { id: commitment.id },
      data: { tokensAllocated: allocation.toString() }
    })
  }
}

async function processRefunds(ico: ICO) {
  const commitments = await prisma.commitment.findMany({
    where: { icoId: ico.id }
  })

  for (const commitment of commitments) {
    await prisma.commitment.update({
      where: { id: commitment.id },
      data: {
        refundAmount: commitment.amount,
        status: 'REFUND_PENDING'
      }
    })
  }
}
```

### Treasury Spend Indexing

```typescript
export async function indexTreasurySpends() {
  const treasuries = await prisma.treasury.findMany()

  for (const treasury of treasuries) {
    const contract = getContract({
      address: treasury.treasuryAddress as `0x${string}`,
      abi: TREASURY_ABI
    })

    const spends = await publicClient.getLogs({
      address: treasury.treasuryAddress as `0x${string}`,
      event: contract.events.Spent,
      fromBlock: lastIndexedBlock,
      toBlock: 'latest'
    })

    for (const log of spends) {
      await prisma.treasury.update({
        where: { id: treasury.id },
        data: {
          currentSpent: {
            increment: log.args.amount
          }
        }
      })
    }
  }
}
```

---

## v0.4: Frontend Integration

**Goal**: User-facing pages for fair launch creation, commitment, and claiming.

**Dependencies**: v0.1, v0.2, v0.3

### New Pages

**`/app/fair-launch/new/page.tsx`**
- Create fair launch form
- ICO parameters configuration
- Team tokens toggle
- Preview before deployment

**`/app/fair-launch/[address]/page.tsx`**
- ICO detail page
- Commitment panel
- Progress bar (total committed vs minimum)
- Time remaining countdown
- Token allocation preview

**`/app/treasury/[address]/page.tsx`**
- Treasury dashboard
- Show multisig members
- Pending actions (timelocked)
- Spend history

### New Components

**`/components/fair-launch-form.tsx`**
```typescript
interface FairLaunchParams {
  // Token Details
  name: string
  symbol: string
  imageURI: string
  description: string

  // ICO Parameters
  tokenSupply: string
  minimumRaise: string
  icoDuration: number // In days
  liquidityPercent: number

  // Team Tokens (optional)
  enableTeamTokens: boolean
  teamTokenPercent: number
  teamWallet: string
}
```

**`/components/commitment-panel.tsx`**
- WBNB input
- Estimated tokens preview
- Commit button
- Loading states

**`/components/claim-tokens-panel.tsx`**
- Show allocated tokens
- Claim button
- Success/feedback

**`/components/ico-summary.tsx`**
- Status badge (PENDING, ACTIVE, FINALIZED, FAILED)
- Progress bar (committed / minimum)
- Time remaining
- Participant count

**`/components/treasury-overview.tsx`**
- Total funds
- Current spent
- Multisig members
- Pending transactions

### Modified Pages

**`/app/page.tsx`** (Home)
- Add "Active ICOs" section
- Show upcoming ICOs
- Show recent finalized ICOs

**`/app/launch/page.tsx`**
- Add toggle: "Fair Launch" vs "Instant Launch"
- Route to appropriate creation flow

### API Routes

**`/app/api/fair-launch/create/route.ts`**
- Validate parameters
- Call LaunchFactory.createFairLaunch()
- Return contract addresses

**`/app/api/icos/route.ts`**
- GET /api/icos - List all ICOs with filters
- GET /api/icos/[address] - ICO detail
- GET /api/icos/[address]/commitments - List commitments

**`/app/api/treasuries/[address]/route.ts`**
- GET - Treasury details
- GET /spends - Spend history

---

## v0.5: Testing + Testnet Deployment

**Goal**: Full test coverage and testnet validation.

**Dependencies**: v0.1-v0.4

### Smart Contract Tests

**`contracts/test/ICOContract.test.ts`**
```typescript
describe('ICOContract', () => {
  it('should accept commitments', async () => {
    // Test commit() function
  })

  it('should reject commitments after end time', async () => {
    // Test time-based restrictions
  })

  it('should calculate correct allocations', async () => {
    // Test pro-rata allocation math
  })

  it('should fail if minimum not raised', async () => {
    // Test fail() function
  })

  it('should distribute tokens on finalization', async () => {
    // Test finalize() and claimTokens()
  })

  it('should refund all commitments on failure', async () => {
    // Test refund() function
  })
})
```

**`contracts/test/Treasury.test.ts`**
```typescript
describe('Treasury', () => {
  it('should receive funds', async () => {
    // Test receive()
  })

  it('should only allow timelock to spend', async () => {
    // Test spend() with onlyOwner modifier
  })

  it('should track spent amounts', async () => {
    // Test totalFunds updates
  })
})
```

**`contracts/test/LaunchFactory.test.ts`**
```typescript
describe('LaunchFactory', () => {
  it('should create fair launch with correct parameters', async () => {
    // Test createFairLaunch()
  })

  it('should collect platform fees', async () => {
    // Test fee calculation and transfer
  })

  it('should reject invalid parameters', async () => {
    // Test validation (min duration, min raise, etc.)
  })
})
```

### Frontend Tests

**`components/__tests__/fair-launch-form.test.tsx`**
- Form validation
- Parameter preview
- Submit functionality

**`components/__tests__/commitment-panel.test.tsx`**
- WBNB input
- Estimated tokens calculation
- Commit transaction

### Integration Tests

**Full Flow Test**:
1. Creator creates fair launch
2. Users commit WBNB
3. ICO finalizes
4. Users claim tokens
5. Treasury receives funds
6. Trading begins on WeightedPool

---

## v1.0: Production Release

**Goal**: Mainnet deployment with full monitoring.

**Dependencies**: v0.5

### Pre-Release Checklist

- [ ] All tests passing (100% on critical paths)
- [ ] Gas optimization verified
- [ ] Partial security audit completed
- [ ] Contract verification setup
- [ ] Bug bounty program launched
- [ ] Documentation complete

### BSC Testnet Deployment

```bash
# Deploy LaunchFactory
npx hardhat run scripts/deploy-fair-launch.ts --network bscTestnet

# Verify contracts
npx hardhat verify --network bscTestnet <factory-address>

# Run full flow test
npx hardhat test --network bscTestnet
```

### BSC Mainnet Deployment

```bash
# Deploy to mainnet (after successful testnet)
npx hardhat run scripts/deploy-fair-launch.ts --network bscMainnet

# Verify on BSCScan
npx hardhat verify --network bscMainnet <factory-address>

# Update environment variables
```

### Post-Release Checklist

- [ ] Update frontend with mainnet contract addresses
- [ ] Deploy indexer to production
- [ ] Run database migrations
- [ ] Enable feature flag for fair launch
- [ ] Monitor first 3 ICOs closely
- [ ] Collect user feedback

---

## v1.1: Team Vesting (Time-Based)

**Goal**: Allow team tokens to vest over time.

**Dependencies**: v1.0

### TeamVesting.sol (Simplified)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TeamVesting {
    address public immutable token;
    address public immutable beneficiary;
    uint256 public immutable totalAmount;
    uint256 public immutable cliffEnd;      // 6 months from start
    uint256 public immutable vestingEnd;    // 24 months from start
    uint256 public released;

    constructor(
        address _token,
        address _beneficiary,
        uint256 _amount,
        uint256 _startTime
    ) {
        token = _token;
        beneficiary = _beneficiary;
        totalAmount = _amount;
        cliffEnd = _startTime + 180 days;    // 6 month cliff
        vestingEnd = _startTime + 730 days;  // 24 month total
    }

    function release() external {
        require(block.timestamp >= cliffEnd, "Cliff not reached");

        uint256 vested = vestedAmount();
        uint256 releasable = vested - released;
        require(releasable > 0, "Nothing to release");

        released = vested;
        IERC20(token).transfer(beneficiary, releasable);
    }

    function vestedAmount() public view returns (uint256) {
        if (block.timestamp < cliffEnd) return 0;
        if (block.timestamp >= vestingEnd) return totalAmount;

        // Linear vesting after cliff
        uint256 vestingDuration = vestingEnd - cliffEnd;
        uint256 elapsed = block.timestamp - cliffEnd;
        return (totalAmount * elapsed) / vestingDuration;
    }
}
```

---

## v1.2: Emergency Pause

**Goal**: Safety mechanism for security incidents.

**Dependencies**: v1.0

### Pausable ICO (Upgrade)

```solidity
// Add to ICOContract
import "@openzeppelin/contracts/security/Pausable.sol";

contract ICOContract is ReentrancyGuard, Pausable {
    address public immutable pauser; // Platform admin

    modifier whenCommitmentsAllowed() {
        require(!paused(), "Commitments paused");
        _;
    }

    function commit() external payable nonReentrant whenCommitmentsAllowed {
        // ... existing logic
    }

    // Claims and refunds CANNOT be paused (users can always exit)
    function claimTokens() external nonReentrant {
        // ... existing logic (no pause check)
    }

    function pause() external {
        require(msg.sender == pauser, "Not pauser");
        _pause();
    }

    function unpause() external {
        require(msg.sender == pauser, "Not pauser");
        require(block.timestamp <= pausedAt + 7 days, "Pause expired");
        _unpause();
    }
}
```

---

## v2.0: Bid Wall System

**Goal**: Price protection via automated buybacks.

**Dependencies**: v1.0

### Key Components

1. **BidWall.sol**: Monitors price, executes buybacks
2. **Keeper Integration**: Gelato or Chainlink Automation
3. **Price Oracle**: On-chain TWAP from weighted pool

### High-Level Design

```
┌─────────────────────────────────────────────────────┐
│                  BID WALL FLOW                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. ICO Finalizes with excess funds                 │
│     └─> Excess = Raised - Minimum                   │
│     └─> Excess sent to BidWall contract             │
│                                                     │
│  2. BidWall monitors price (via keeper)             │
│     └─> TWAP < ICO_PRICE triggers buyback           │
│                                                     │
│  3. Buyback executes                                │
│     └─> Swap BNB for tokens on WeightedPool         │
│     └─> Tokens burned (deflationary)                │
│                                                     │
│  4. Duration: 90 days or until funds exhausted      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## v2.1: Performance-Based Unlocks

**Goal**: Team tokens unlock based on price milestones.

**Dependencies**: v2.0 (needs price oracle)

### Unlock Schedule

| Multiple | % Unlocked | Cumulative |
|----------|------------|------------|
| 2x ICO Price | 10% | 10% |
| 4x ICO Price | 15% | 25% |
| 8x ICO Price | 25% | 50% |
| 16x ICO Price | 25% | 75% |
| 32x ICO Price | 25% | 100% |

**Minimum hold**: 18 months (even if multiples hit earlier)

---

## v3.0: Token Voting Governance

**Goal**: Replace multisig with on-chain governance.

**Dependencies**: v1.0

### Components

1. **GovernorContract**: OpenZeppelin Governor pattern
2. **Voting Token**: Existing launch token (1 token = 1 vote)
3. **Proposal System**: Create, vote, execute proposals
4. **Timelock Integration**: Proposals execute through existing timelock

---

## Estimated Timeline

| Version | Duration | Cumulative |
|---------|----------|------------|
| v0.1 (ICO Contract) | 3-4 days | 3-4 days |
| v0.2 (Treasury) | 2-3 days | 5-7 days |
| v0.3 (DB + Indexer) | 2-3 days | 7-10 days |
| v0.4 (Frontend) | 4-5 days | 11-15 days |
| v0.5 (Testing) | 3-4 days | 14-19 days |
| v1.0 (Production) | 2-3 days | 16-22 days |

**Total to v1.0**: ~3-4 weeks

### Post-v1.0 (Optional)

| Version | Duration | Notes |
|---------|----------|-------|
| v1.1 (Team Vesting) | 3-4 days | Can run parallel |
| v1.2 (Emergency Pause) | 1-2 days | Quick addition |
| v2.0 (Bid Wall) | 5-7 days | Requires keeper setup |
| v2.1 (Performance Unlocks) | 3-4 days | Builds on v2.0 |
| v3.0 (Governance) | 7-10 days | Major feature |

---

## Decisions Summary

All major decisions have been finalized. See [FAIR_LAUNCH_DECISIONS.md](./FAIR_LAUNCH_DECISIONS.md) for the complete decision matrix.

### Key Parameters (v1.0)

| Parameter | Value |
|-----------|-------|
| Platform Fee | 1% (100 bps) |
| Timelock Delay | 48 hours |
| ICO Duration | 1-14 days (configurable) |
| Minimum Raise | 10 BNB (~$3k) |
| Max Team Allocation | 20% |
| Liquidity Allocation | 20% of raise |
| Minting | Disabled |
| Upgradability | Immutable |

---

## References

- MetaDAO Documentation: https://docs.metadao.fi
- OpenZeppelin Contracts: https://docs.openzeppelin.com
- Gnosis Safe: https://safe.global
- BSC Testnet: https://testnet.bscscan.com
- Gelato Network: https://gelato.network
- Chainlink Automation: https://automation.chain.link
