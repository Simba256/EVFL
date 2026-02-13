# Fair Launch - Architecture & Best Practices

> Comprehensive guide for implementing the Fair Launch system

**Related Documents:**
- [FAIR_LAUNCH_SYSTEM.md](./FAIR_LAUNCH_SYSTEM.md) - System overview
- [TECHNICAL_SPECIFICATIONS.md](./TECHNICAL_SPECIFICATIONS.md) - Technical details
- [V1_IMPLEMENTATION_PLAN.md](./V1_IMPLEMENTATION_PLAN.md) - Implementation plan

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Smart Contract Architecture](#2-smart-contract-architecture)
3. [Solidity Best Practices](#3-solidity-best-practices)
4. [Security Best Practices](#4-security-best-practices)
5. [Gas Optimization](#5-gas-optimization)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Backend & Indexer Architecture](#7-backend--indexer-architecture)
8. [Testing Best Practices](#8-testing-best-practices)
9. [Deployment Best Practices](#9-deployment-best-practices)
10. [Code Organization](#10-code-organization)

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FAIR LAUNCH SYSTEM ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           FRONTEND (Next.js)                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │  Pages   │  │Components│  │  Hooks   │  │  Stores  │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  │       │             │             │             │                   │   │
│  │       └─────────────┴─────────────┴─────────────┘                   │   │
│  │                           │                                          │   │
│  └───────────────────────────┼──────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         API LAYER (Next.js API Routes)                │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │ │
│  │  │  /api/icos  │  │/api/treasury│  │/api/fair-   │                   │ │
│  │  │             │  │             │  │  launch     │                   │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                   │ │
│  └─────────┼────────────────┼────────────────┼───────────────────────────┘ │
│            │                │                │                              │
│            ▼                ▼                ▼                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DATABASE (PostgreSQL)                         │   │
│  │  ┌────────┐  ┌────────────┐  ┌──────────┐  ┌────────────┐          │   │
│  │  │  ICOs  │  │Commitments │  │Treasuries│  │   Tokens   │          │   │
│  │  └────────┘  └────────────┘  └──────────┘  └────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│            ▲                                                                │
│            │ (Indexed Events)                                               │
│  ┌─────────┴───────────────────────────────────────────────────────────┐   │
│  │                         INDEXER (Node.js)                            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │   │
│  │  │Event Poller│  │Event Parser│  │DB Updater  │                     │   │
│  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘                     │   │
│  └─────────┼───────────────┼───────────────┼────────────────────────────┘   │
│            │               │               │                                │
│            ▼               ▼               ▼                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      BLOCKCHAIN (BSC)                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │LaunchFactory│  │ ICOContract │  │  Treasury   │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ LaunchToken │  │WeightedPool │  │  Timelock   │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER ACTION                BLOCKCHAIN              DATABASE                │
│  ───────────                ──────────              ────────                │
│                                                                             │
│  1. Create ICO                                                              │
│     User ──────► Frontend ──────► LaunchFactory.createFairLaunch()          │
│                                          │                                  │
│                                          ▼                                  │
│                                   FairLaunchCreated event                   │
│                                          │                                  │
│                                          ▼                                  │
│                                   Indexer ──────► INSERT ICO                │
│                                                                             │
│  2. Commit BNB                                                              │
│     User ──────► Frontend ──────► ICOContract.commit()                      │
│                                          │                                  │
│                                          ▼                                  │
│                                   Committed event                           │
│                                          │                                  │
│                                          ▼                                  │
│                                   Indexer ──────► UPSERT Commitment         │
│                                                                             │
│  3. Claim Tokens                                                            │
│     User ──────► Frontend ──────► ICOContract.claimTokens()                 │
│                                          │                                  │
│                                          ▼                                  │
│                                   TokensClaimed event                       │
│                                          │                                  │
│                                          ▼                                  │
│                                   Indexer ──────► UPDATE Commitment         │
│                                                                             │
│  4. Read Data                                                               │
│     User ──────► Frontend ──────► API ──────► Database                      │
│                      │                                                      │
│                      └──────► On-chain (for real-time balance)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Component Responsibilities

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| **Frontend** | User interface, wallet connection, tx signing | Next.js, React, wagmi |
| **API** | Data aggregation, validation, caching | Next.js API routes |
| **Database** | Indexed on-chain data, fast queries | PostgreSQL, Prisma |
| **Indexer** | Event monitoring, data synchronization | Node.js, viem |
| **Smart Contracts** | Business logic, fund custody, state | Solidity, OpenZeppelin |

### 1.4 Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SEPARATION OF CONCERNS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT GOES ON-CHAIN (Smart Contracts)                                       │
│  ─────────────────────────────────────                                      │
│  ✓ Fund custody (BNB, tokens)                                               │
│  ✓ Commitment tracking (who committed what)                                 │
│  ✓ Allocation calculation (pro-rata math)                                   │
│  ✓ Access control (who can do what)                                         │
│  ✓ Time-based rules (ICO start/end)                                         │
│  ✓ Treasury governance (timelock + multisig)                                │
│                                                                             │
│  WHAT GOES OFF-CHAIN (Database/Backend)                                     │
│  ──────────────────────────────────────                                     │
│  ✓ Historical data (all past events)                                        │
│  ✓ Aggregated metrics (total participants, etc.)                            │
│  ✓ Search and filtering                                                     │
│  ✓ User preferences                                                         │
│  ✓ Metadata (images, descriptions)                                          │
│  ✓ Analytics and reporting                                                  │
│                                                                             │
│  WHAT GOES IN FRONTEND                                                      │
│  ─────────────────────                                                      │
│  ✓ User interface rendering                                                 │
│  ✓ Wallet connection                                                        │
│  ✓ Transaction preparation                                                  │
│  ✓ Real-time updates                                                        │
│  ✓ Input validation (client-side)                                           │
│  ✓ Error handling and feedback                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Smart Contract Architecture

### 2.1 Contract Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SMART CONTRACT HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FACTORY PATTERN                                   │   │
│  │                                                                      │   │
│  │  LaunchFactory (Singleton)                                           │   │
│  │  ├── Creates ICOContract instances                                   │   │
│  │  ├── Creates Treasury instances                                      │   │
│  │  ├── Creates LaunchToken instances                                   │   │
│  │  ├── Collects platform fees                                          │   │
│  │  └── Maintains registry of all ICOs                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ creates                                      │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PER-ICO CONTRACTS                                 │   │
│  │                                                                      │   │
│  │  ICOContract (1 per ICO)                                             │   │
│  │  ├── Accepts commitments                                             │   │
│  │  ├── Handles finalization                                            │   │
│  │  ├── Distributes tokens                                              │   │
│  │  └── Processes refunds                                               │   │
│  │                                                                      │   │
│  │  Treasury (1 per ICO)                                                │   │
│  │  ├── Holds funds                                                     │   │
│  │  ├── Enforces timelock                                               │   │
│  │  └── Tracks spending                                                 │   │
│  │                                                                      │   │
│  │  LaunchToken (1 per ICO)                                             │   │
│  │  ├── Standard ERC20                                                  │   │
│  │  └── Fixed supply (no minting)                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ uses                                         │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED CONTRACTS                                  │   │
│  │                                                                      │   │
│  │  TimelockController (OpenZeppelin)                                   │   │
│  │  ├── 48-hour delay                                                   │   │
│  │  └── Proposal/execution pattern                                      │   │
│  │                                                                      │   │
│  │  WeightedPool (Existing)                                             │   │
│  │  ├── AMM functionality                                               │   │
│  │  └── Price discovery                                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Design Patterns Used

| Pattern | Where Used | Purpose |
|---------|------------|---------|
| **Factory** | LaunchFactory | Deploy new ICO instances |
| **State Machine** | ICOContract | Manage ICO lifecycle (PENDING→ACTIVE→FINALIZED/FAILED) |
| **Checks-Effects-Interactions** | All contracts | Prevent reentrancy |
| **Pull over Push** | Token claims | Users claim their tokens (not pushed) |
| **Access Control** | Treasury | Role-based permissions |
| **Timelock** | Treasury | Delay sensitive operations |
| **Immutable** | All parameters | No upgrades, maximum trust |

### 2.3 State Machine (ICO Lifecycle)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ICO STATE MACHINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌──────────┐                                       │
│                          │ PENDING  │                                       │
│                          └────┬─────┘                                       │
│                               │                                             │
│                               │ First commit() AND                          │
│                               │ block.timestamp >= startTime                │
│                               ▼                                             │
│                          ┌──────────┐                                       │
│                          │  ACTIVE  │◄────────────────┐                     │
│                          └────┬─────┘                 │                     │
│                               │                       │                     │
│                               │ block.timestamp       │ More commits       │
│                               │ > endTime             │ allowed            │
│                               │                       │                     │
│                     ┌─────────┴─────────┐             │                     │
│                     │                   │             │                     │
│                     ▼                   ▼             │                     │
│  totalCommitted >= minimum    totalCommitted < minimum                      │
│                     │                   │                                   │
│                     ▼                   ▼                                   │
│               ┌──────────┐        ┌──────────┐                              │
│               │FINALIZED │        │  FAILED  │                              │
│               └────┬─────┘        └────┬─────┘                              │
│                    │                   │                                    │
│                    │                   │                                    │
│              claimTokens()        refund()                                  │
│              available            available                                 │
│                                                                             │
│  TRANSITIONS:                                                               │
│  ─────────────                                                              │
│  PENDING → ACTIVE:    Automatic on first commit after startTime             │
│  ACTIVE → FINALIZED:  Anyone calls finalize() after endTime if min met      │
│  ACTIVE → FAILED:     Anyone calls markFailed() after endTime if min NOT met│
│                                                                             │
│  TERMINAL STATES: FINALIZED, FAILED (no further transitions)                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Contract Inheritance

```solidity
// ICOContract inheritance
ICOContract
├── ReentrancyGuard (OpenZeppelin)
└── (No other inheritance - keeps it simple)

// Treasury inheritance
Treasury
├── Ownable (OpenZeppelin) - Owner is Timelock
└── ReentrancyGuard (OpenZeppelin)

// LaunchToken inheritance
LaunchToken
└── ERC20 (OpenZeppelin)

// LaunchFactory inheritance
LaunchFactory
└── Ownable (OpenZeppelin) - For platform admin functions
```

---

## 3. Solidity Best Practices

### 3.1 Code Style & Conventions

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20; // EXACT version, not ^0.8.20

// ============================================
// IMPORTS: OpenZeppelin first, then local
// ============================================
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IICOContract.sol";

// ============================================
// CONTRACT LAYOUT ORDER:
// 1. Type declarations (enums, structs)
// 2. State variables
// 3. Events
// 4. Errors (custom errors preferred)
// 5. Modifiers
// 6. Constructor
// 7. External functions
// 8. Public functions
// 9. Internal functions
// 10. Private functions
// 11. View/Pure functions
// ============================================

contract ICOContract is ReentrancyGuard {
    // ========== TYPE DECLARATIONS ==========
    enum Status { PENDING, ACTIVE, FINALIZED, FAILED }

    // ========== STATE VARIABLES ==========
    // Group by: immutable, then storage

    // Immutable (set once in constructor)
    address public immutable token;
    address public immutable treasury;
    uint256 public immutable minimumRaise;

    // Storage (can change)
    Status public status;
    uint256 public totalCommitted;

    // Mappings last
    mapping(address => uint256) public commitments;

    // ========== EVENTS ==========
    event Committed(address indexed user, uint256 amount);
    event Finalized(uint256 totalRaised, uint256 tokenPrice);

    // ========== CUSTOM ERRORS ==========
    // Gas-efficient alternative to require strings
    error NotActive();
    error NotEnded();
    error MinimumNotMet();
    error AlreadyClaimed();

    // ========== MODIFIERS ==========
    modifier onlyActive() {
        if (status != Status.ACTIVE) revert NotActive();
        _;
    }

    // ========== CONSTRUCTOR ==========
    constructor(
        address _token,
        address _treasury,
        uint256 _minimumRaise
    ) {
        // Validate inputs
        require(_token != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");

        // Set immutables
        token = _token;
        treasury = _treasury;
        minimumRaise = _minimumRaise;

        // Initialize state
        status = Status.PENDING;
    }

    // ========== EXTERNAL FUNCTIONS ==========
    function commit() external payable nonReentrant onlyActive {
        // Implementation
    }

    // ========== VIEW FUNCTIONS ==========
    function getAllocation(address user) external view returns (uint256) {
        // Implementation
    }
}
```

### 3.2 Naming Conventions

```solidity
// CONTRACTS: PascalCase
contract ICOContract {}
contract LaunchFactory {}

// INTERFACES: I prefix + PascalCase
interface IICOContract {}
interface ITreasury {}

// EVENTS: PascalCase (verb in past tense)
event Committed(address indexed user, uint256 amount);
event TokensClaimed(address indexed user, uint256 allocation);
event ICOFinalized(uint256 totalRaised);

// ERRORS: PascalCase (descriptive)
error NotActive();
error InsufficientBalance();
error UnauthorizedCaller();

// FUNCTIONS: camelCase
function commitFunds() external {}
function claimTokens() external {}

// INTERNAL/PRIVATE FUNCTIONS: _camelCase
function _calculateAllocation() internal {}
function _transferTokens() private {}

// STATE VARIABLES: camelCase
uint256 public totalCommitted;
mapping(address => uint256) public commitments;

// CONSTANTS: SCREAMING_SNAKE_CASE
uint256 public constant MAX_FEE_BPS = 500;
uint256 public constant BASIS_POINTS = 10000;

// IMMUTABLES: camelCase (like regular variables)
address public immutable token;
uint256 public immutable minimumRaise;

// FUNCTION PARAMETERS: _camelCase (underscore prefix)
function setFee(uint256 _newFee) external {
    fee = _newFee;
}

// LOCAL VARIABLES: camelCase (no prefix)
function calculate() internal {
    uint256 userShare = commitments[msg.sender];
    uint256 totalShares = totalCommitted;
}
```

### 3.3 Documentation (NatSpec)

```solidity
/// @title ICO Contract for Fair Launch System
/// @author YourProject Team
/// @notice Handles ICO commitments, token distribution, and refunds
/// @dev Implements pro-rata allocation with gas-optimized claiming
contract ICOContract is ReentrancyGuard {

    /// @notice Commit BNB to the ICO
    /// @dev Commitments accumulate for the same user
    /// @dev Emits Committed event on success
    /// @custom:security nonReentrant
    function commit() external payable nonReentrant {
        // Implementation
    }

    /// @notice Calculate user's token allocation
    /// @param user The address to check allocation for
    /// @return allocation The number of tokens the user will receive
    /// @dev Returns 0 if ICO not finalized or user has no commitment
    function getAllocation(address user) external view returns (uint256 allocation) {
        if (status != Status.FINALIZED) return 0;
        if (totalCommitted == 0) return 0;
        allocation = (commitments[user] * tokenSupply) / totalCommitted;
    }
}
```

### 3.4 Error Handling

```solidity
// ============================================
// PREFER CUSTOM ERRORS (Gas efficient)
// ============================================

// Good: Custom error (~24 gas per character saved)
error InsufficientBalance(uint256 requested, uint256 available);
error NotAuthorized(address caller, address required);

function withdraw(uint256 amount) external {
    if (amount > balance) {
        revert InsufficientBalance(amount, balance);
    }
}

// Acceptable: Short require strings (for critical checks)
require(msg.sender == owner, "Not owner");
require(amount > 0, "Zero amount");

// Avoid: Long require strings (waste gas)
// BAD: require(amount > 0, "The amount must be greater than zero");

// ============================================
// ERROR HANDLING PATTERNS
// ============================================

// Pattern 1: Guard clauses at top of function
function finalize() external {
    // All checks first
    if (status != Status.ACTIVE) revert NotActive();
    if (block.timestamp <= endTime) revert NotEnded();
    if (totalCommitted < minimumRaise) revert MinimumNotMet();

    // Then effects
    status = Status.FINALIZED;

    // Then interactions
    _distributeFunds();
}

// Pattern 2: Validate inputs in internal function
function _validateCommitment(uint256 amount) internal view {
    if (amount == 0) revert ZeroAmount();
    if (block.timestamp < startTime) revert NotStarted();
    if (block.timestamp > endTime) revert Ended();
}
```

---

## 4. Security Best Practices

### 4.1 Checks-Effects-Interactions Pattern

```solidity
// ============================================
// ALWAYS: Checks → Effects → Interactions
// ============================================

function claimTokens() external nonReentrant {
    // ========== CHECKS ==========
    // Validate all conditions first
    if (status != Status.FINALIZED) revert NotFinalized();
    if (commitments[msg.sender] == 0) revert NoCommitment();
    if (hasClaimed[msg.sender]) revert AlreadyClaimed();

    // ========== EFFECTS ==========
    // Update state BEFORE any external calls
    hasClaimed[msg.sender] = true; // Mark claimed FIRST

    // Calculate allocation
    uint256 allocation = (commitments[msg.sender] * tokenSupply) / totalCommitted;

    // ========== INTERACTIONS ==========
    // External calls LAST
    bool success = IERC20(token).transfer(msg.sender, allocation);
    require(success, "Transfer failed");

    emit TokensClaimed(msg.sender, allocation);
}

// ============================================
// BAD EXAMPLE (Vulnerable to reentrancy)
// ============================================

function badRefund() external {
    uint256 amount = commitments[msg.sender];
    require(amount > 0, "No commitment");

    // BAD: External call BEFORE state update
    (bool sent,) = payable(msg.sender).call{value: amount}("");
    require(sent, "Refund failed");

    // Attacker's receive() can call badRefund() again
    // before this line executes
    commitments[msg.sender] = 0;
}
```

### 4.2 Access Control

```solidity
// ============================================
// EXPLICIT ACCESS CONTROL
// ============================================

contract Treasury is Ownable, ReentrancyGuard {
    // Owner is set to Timelock address
    // Only Timelock can call onlyOwner functions

    // For spending within budget (direct multisig)
    address public multisig;

    modifier onlyMultisig() {
        require(msg.sender == multisig, "Not multisig");
        _;
    }

    modifier onlyTimelockOrMultisig() {
        require(
            msg.sender == owner() || msg.sender == multisig,
            "Not authorized"
        );
        _;
    }

    // Large spends: through timelock
    function spendBNB(address payable recipient, uint256 amount)
        external
        onlyOwner // Timelock only
        nonReentrant
    {
        // Implementation
    }

    // Budget spends: direct multisig
    function spendFromBudget(address payable recipient, uint256 amount)
        external
        onlyMultisig
        nonReentrant
    {
        require(amount <= monthlyBudgetRemaining(), "Exceeds budget");
        // Implementation
    }
}

// ============================================
// PERMISSIONLESS FUNCTIONS
// ============================================

// These functions can be called by anyone
// They rely on time/state conditions, not caller identity

function finalize() external { // Anyone can call
    require(status == Status.ACTIVE, "Not active");
    require(block.timestamp > endTime, "Not ended"); // Time-based
    require(totalCommitted >= minimumRaise, "Min not met"); // State-based
    // Safe: conditions ensure correctness, not caller identity
}

function markFailed() external { // Anyone can call
    require(status == Status.ACTIVE, "Not active");
    require(block.timestamp > endTime, "Not ended");
    require(totalCommitted < minimumRaise, "Min was met");
    // Safe: conditions are mutually exclusive with finalize()
}
```

### 4.3 Integer Safety

```solidity
// ============================================
// SOLIDITY 0.8+ HANDLES OVERFLOW BY DEFAULT
// ============================================

// Safe: Will revert on overflow
uint256 total = a + b;
uint256 product = a * b;

// ============================================
// BE CAREFUL WITH DIVISION
// ============================================

// Integer division truncates (rounds down)
// 7 / 3 = 2 (not 2.33...)

// Problem: Rounding in allocation
uint256 allocation = (userCommitment * tokenSupply) / totalCommitted;
// If userCommitment = 1, tokenSupply = 100, totalCommitted = 3
// allocation = 100 / 3 = 33 (not 33.33)
// Some tokens become "dust"

// Solution: Accept dust, allow sweep after all claims
function sweepDust() external onlyAfterAllClaimed {
    uint256 dust = IERC20(token).balanceOf(address(this));
    if (dust > 0) {
        IERC20(token).transfer(treasury, dust);
    }
}

// ============================================
// AVOID PRECISION LOSS
// ============================================

// Bad: Divide then multiply (loses precision)
uint256 bad = (a / b) * c;

// Good: Multiply then divide (maintains precision)
uint256 good = (a * c) / b;

// For prices: Use high precision (18 decimals)
uint256 tokenPrice = (totalCommitted * 1e18) / tokenSupply;
// This gives price with 18 decimal precision
```

### 4.4 External Call Safety

```solidity
// ============================================
// SAFE TOKEN TRANSFERS
// ============================================

// Option 1: Use OpenZeppelin SafeERC20
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

function safeTransfer() internal {
    IERC20(token).safeTransfer(recipient, amount);
    // Handles:
    // - Tokens that don't return bool
    // - Tokens that return false on failure
}

// Option 2: Check return value
function manualTransfer() internal {
    bool success = IERC20(token).transfer(recipient, amount);
    require(success, "Transfer failed");
}

// ============================================
// SAFE BNB TRANSFERS
// ============================================

// Preferred: Low-level call with gas limit
function sendBNB(address payable recipient, uint256 amount) internal {
    (bool sent,) = recipient.call{value: amount}("");
    require(sent, "BNB transfer failed");
}

// Avoid: transfer() and send()
// - transfer() has 2300 gas limit (can fail with complex receivers)
// - send() returns false instead of reverting

// ============================================
// HANDLE CALLBACK ATTACKS
// ============================================

// Risk: Malicious contract in receive/fallback
// Mitigation: ReentrancyGuard + CEI pattern

// Additional: Consider gas limits for non-critical callbacks
(bool sent,) = recipient.call{value: amount, gas: 10000}("");
// Limits gas available to receiver's receive() function
```

### 4.5 Security Checklist

```markdown
## Pre-Deployment Security Checklist

### Reentrancy
- [ ] All external calls use ReentrancyGuard
- [ ] State changes happen BEFORE external calls
- [ ] Mappings are updated before transfers

### Access Control
- [ ] All sensitive functions have access modifiers
- [ ] Owner/admin cannot be zero address
- [ ] Role transitions are controlled

### Integer Handling
- [ ] Using Solidity 0.8+ (built-in overflow checks)
- [ ] Division operations checked for precision loss
- [ ] Multiplication before division where possible

### External Calls
- [ ] Using SafeERC20 or checking return values
- [ ] BNB transfers use call() not transfer()
- [ ] External call failures handled gracefully

### Input Validation
- [ ] All function parameters validated
- [ ] Zero address checks for addresses
- [ ] Bounds checking for numeric inputs
- [ ] Array length limits to prevent DoS

### State Machine
- [ ] All state transitions are valid
- [ ] No way to reach invalid states
- [ ] Terminal states are truly terminal

### Time Handling
- [ ] No reliance on exact timestamps
- [ ] Tolerance for block.timestamp manipulation
- [ ] Using >= and <= not ==

### Economic Security
- [ ] No flash loan attack vectors
- [ ] Front-running doesn't provide advantage
- [ ] Fee calculations are correct
```

---

## 5. Gas Optimization

### 5.1 Storage Optimization

```solidity
// ============================================
// STORAGE COSTS (Most expensive operation)
// ============================================

// SSTORE (new value): ~20,000 gas
// SSTORE (update): ~5,000 gas
// SLOAD: ~2,100 gas (cold), ~100 gas (warm)

// ============================================
// PACK VARIABLES
// ============================================

// Bad: Each variable uses full 32-byte slot
contract Unoptimized {
    uint256 a;      // Slot 0
    uint8 b;        // Slot 1 (wastes 31 bytes)
    uint256 c;      // Slot 2
    uint8 d;        // Slot 3 (wastes 31 bytes)
    address e;      // Slot 4
}

// Good: Pack variables into same slot
contract Optimized {
    uint256 a;      // Slot 0 (32 bytes)
    uint256 c;      // Slot 1 (32 bytes)
    address e;      // Slot 2 (20 bytes)
    uint8 b;        // Slot 2 (1 byte) - packed with address
    uint8 d;        // Slot 2 (1 byte) - packed with address
}

// ============================================
// USE IMMUTABLE FOR CONSTRUCTOR-SET VALUES
// ============================================

// Good: Immutable (stored in bytecode, not storage)
address public immutable token;      // ~3 gas to read
uint256 public immutable minimumRaise;

// Bad: Regular storage (when value never changes)
address public token;                // ~2100 gas to read (cold)

// ============================================
// USE CONSTANTS FOR KNOWN VALUES
// ============================================

uint256 public constant MAX_FEE = 500;        // ~3 gas
uint256 public constant BASIS_POINTS = 10000; // ~3 gas
```

### 5.2 Loop Optimization

```solidity
// ============================================
// AVOID UNBOUNDED LOOPS
// ============================================

// Bad: Loop over all participants (can hit gas limit)
function badFinalize() external {
    for (uint i = 0; i < participants.length; i++) {
        // If 1000+ participants, this WILL fail
        allocations[participants[i]] = calculateAllocation(participants[i]);
    }
}

// Good: No loops - calculate at claim time
function goodFinalize() external {
    // Just set the price, O(1) operation
    tokenPrice = (totalCommitted * 1e18) / tokenSupply;
    status = Status.FINALIZED;
}

function claimTokens() external {
    // Each user calculates their own allocation
    uint256 allocation = (commitments[msg.sender] * tokenSupply) / totalCommitted;
    // O(1) per user
}

// ============================================
// IF LOOPS NEEDED: Cache array length
// ============================================

// Bad: Reads length every iteration
for (uint i = 0; i < array.length; i++) {
    // array.length is SLOAD each time
}

// Good: Cache length
uint256 length = array.length;
for (uint i = 0; i < length; i++) {
    // Only one SLOAD for length
}

// Better: Use unchecked for index (saves ~60 gas per iteration)
uint256 length = array.length;
for (uint i = 0; i < length;) {
    // Do work
    unchecked { ++i; } // Safe: i < length, won't overflow
}
```

### 5.3 Function Optimization

```solidity
// ============================================
// EXTERNAL VS PUBLIC
// ============================================

// external: Cheaper when called from outside
// public: More expensive (copies calldata to memory)

// Good: Use external for functions only called externally
function commit() external payable { }

// Use public only if also called internally
function getInfo() public view returns (uint256) {
    return _calculateInfo(); // Called internally too
}

// ============================================
// CALLDATA VS MEMORY FOR PARAMETERS
// ============================================

// Good: Use calldata for external function array params
function processSigners(address[] calldata signers) external {
    // calldata is read-only, no copy
}

// Bad: Memory copies the entire array
function processSigners(address[] memory signers) external {
    // Copies all data to memory first
}

// ============================================
// SHORT-CIRCUIT CONDITIONS
// ============================================

// Good: Check cheap conditions first
function validate() internal view {
    // Cheap checks first
    require(status == Status.ACTIVE, "Not active"); // Storage read
    require(msg.value > 0, "Zero value"); // Very cheap
    require(block.timestamp >= startTime, "Not started"); // Cheap

    // Expensive checks last (only if needed)
    require(isWhitelisted(msg.sender), "Not whitelisted"); // Mapping read
}
```

### 5.4 Event Optimization

```solidity
// ============================================
// INDEXED PARAMETERS
// ============================================

// Indexed: Allows filtering, stored in log topics
// Non-indexed: Stored in log data (cheaper)

// Good: Index fields you'll filter by
event Committed(
    address indexed user,     // Filter by user
    uint256 amount,           // Don't need to filter
    uint256 totalUserCommitment
);

// Maximum 3 indexed parameters per event
// Indexed parameters cost more gas to emit

// ============================================
// EMIT ONLY NECESSARY DATA
// ============================================

// Good: Emit what's needed for indexing
event TokensClaimed(address indexed user, uint256 allocation);

// Bad: Emit redundant data
event TokensClaimed(
    address indexed user,
    uint256 allocation,
    uint256 totalSupply,      // Already known
    address tokenAddress,      // Already known
    uint256 timestamp         // block.timestamp available
);
```

---

## 6. Frontend Architecture

### 6.1 Component Structure

```
src/
├── app/                          # Next.js App Router
│   ├── fair-launch/
│   │   ├── new/
│   │   │   └── page.tsx         # Create ICO form
│   │   └── [address]/
│   │       └── page.tsx         # ICO detail page
│   ├── treasury/
│   │   └── [address]/
│   │       └── page.tsx         # Treasury dashboard
│   └── api/                     # API routes
│       ├── icos/
│       │   └── route.ts
│       └── fair-launch/
│           └── create/
│               └── route.ts
│
├── components/
│   ├── fair-launch/             # Feature components
│   │   ├── FairLaunchForm.tsx
│   │   ├── CommitmentPanel.tsx
│   │   ├── ClaimTokensPanel.tsx
│   │   ├── ICOSummary.tsx
│   │   ├── ICOCountdown.tsx
│   │   └── ProRataCalculator.tsx
│   ├── treasury/
│   │   ├── TreasuryDashboard.tsx
│   │   ├── PendingActions.tsx
│   │   └── SpendHistory.tsx
│   └── ui/                      # Generic UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       └── Modal.tsx
│
├── hooks/                       # Custom hooks
│   ├── useICO.ts               # ICO data fetching
│   ├── useCommitment.ts        # Commitment transactions
│   ├── useTreasury.ts          # Treasury data
│   └── useCountdown.ts         # Time remaining
│
├── stores/                      # Zustand stores
│   ├── icoStore.ts
│   ├── createLaunchStore.ts
│   └── treasuryStore.ts
│
├── lib/
│   ├── contracts/              # Contract interactions
│   │   ├── addresses.ts        # Contract addresses
│   │   ├── abis/               # Contract ABIs
│   │   └── hooks.ts            # Wagmi hooks
│   ├── api/                    # API client
│   │   └── client.ts
│   └── utils/                  # Utilities
│       ├── format.ts           # Number formatting
│       └── validation.ts       # Form validation
│
└── types/                       # TypeScript types
    ├── ico.ts
    ├── treasury.ts
    └── api.ts
```

### 6.2 State Management Pattern

```typescript
// ============================================
// ZUSTAND STORE PATTERN
// ============================================

// stores/icoStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface ICOState {
  // Data
  currentICO: ICODetail | null;
  userPosition: UserPosition | null;

  // Loading states
  isLoading: boolean;
  isCommitting: boolean;
  isClaiming: boolean;

  // Errors
  error: string | null;

  // Actions
  fetchICO: (address: string) => Promise<void>;
  fetchUserPosition: (icoAddress: string, userAddress: string) => Promise<void>;
  commit: (amount: bigint) => Promise<boolean>;
  claim: () => Promise<boolean>;
  clearError: () => void;
}

export const useICOStore = create<ICOState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      currentICO: null,
      userPosition: null,
      isLoading: false,
      isCommitting: false,
      isClaiming: false,
      error: null,

      // Actions
      fetchICO: async (address) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/icos/${address}`);
          if (!response.ok) throw new Error('Failed to fetch ICO');
          const data = await response.json();
          set({ currentICO: data });
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          set({ isLoading: false });
        }
      },

      commit: async (amount) => {
        set({ isCommitting: true, error: null });
        try {
          // Transaction logic here
          return true;
        } catch (error) {
          set({ error: (error as Error).message });
          return false;
        } finally {
          set({ isCommitting: false });
        }
      },

      clearError: () => set({ error: null }),
    })),
    { name: 'ico-store' }
  )
);

// ============================================
// USE IN COMPONENTS
// ============================================

function ICOPage({ address }: { address: string }) {
  const { currentICO, isLoading, error, fetchICO } = useICOStore();

  useEffect(() => {
    fetchICO(address);
  }, [address, fetchICO]);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!currentICO) return <NotFound />;

  return <ICODetail ico={currentICO} />;
}
```

### 6.3 Contract Interaction Pattern

```typescript
// ============================================
// WAGMI HOOKS FOR CONTRACT INTERACTION
// ============================================

// hooks/useCommitment.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { ICO_ABI } from '@/lib/contracts/abis';

export function useCommitment(icoAddress: `0x${string}`) {
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash });

  const commit = async (amountBNB: string) => {
    const value = parseEther(amountBNB);

    writeContract({
      address: icoAddress,
      abi: ICO_ABI,
      functionName: 'commit',
      value,
    });
  };

  return {
    commit,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError || confirmError,
    transactionHash: hash,
  };
}

// ============================================
// USE IN COMPONENT
// ============================================

function CommitmentPanel({ icoAddress }: { icoAddress: `0x${string}` }) {
  const [amount, setAmount] = useState('');
  const { commit, isPending, isConfirming, isSuccess, error } = useCommitment(icoAddress);

  const handleSubmit = () => {
    if (amount) {
      commit(amount);
    }
  };

  return (
    <div>
      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in BNB"
        disabled={isPending || isConfirming}
      />
      <Button
        onClick={handleSubmit}
        loading={isPending || isConfirming}
      >
        {isPending ? 'Confirm in Wallet...' :
         isConfirming ? 'Confirming...' :
         'Commit BNB'}
      </Button>
      {error && <ErrorMessage message={error.message} />}
      {isSuccess && <SuccessMessage message="Commitment successful!" />}
    </div>
  );
}
```

### 6.4 Error Handling Pattern

```typescript
// ============================================
// CENTRALIZED ERROR HANDLING
// ============================================

// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  ICO_NOT_ACTIVE: 'ICO_NOT_ACTIVE',
} as const;

// Parse blockchain errors
export function parseContractError(error: unknown): AppError {
  const message = (error as Error).message || 'Unknown error';

  // Match common revert reasons
  if (message.includes('Not active')) {
    return new AppError('ICO is not currently active', ErrorCodes.ICO_NOT_ACTIVE);
  }
  if (message.includes('insufficient funds')) {
    return new AppError('Insufficient BNB balance', ErrorCodes.INSUFFICIENT_BALANCE);
  }
  if (message.includes('user rejected')) {
    return new AppError('Transaction cancelled', ErrorCodes.TRANSACTION_FAILED);
  }

  return new AppError(message, ErrorCodes.TRANSACTION_FAILED);
}

// ============================================
// ERROR BOUNDARY
// ============================================

// components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error caught by boundary:', error, info);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 7. Backend & Indexer Architecture

### 7.1 Indexer Design

```typescript
// ============================================
// INDEXER ARCHITECTURE
// ============================================

/*
┌─────────────────────────────────────────────────────────────────┐
│                        INDEXER FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Poller     │────▶│   Parser     │────▶│   Handler    │    │
│  │              │     │              │     │              │    │
│  │ Get new logs │     │ Decode logs  │     │ Update DB    │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                                         │             │
│         │                                         │             │
│         ▼                                         ▼             │
│  ┌──────────────┐                         ┌──────────────┐     │
│  │  Blockchain  │                         │   Database   │     │
│  │    (BSC)     │                         │ (PostgreSQL) │     │
│  └──────────────┘                         └──────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
*/

// ============================================
// POLLING STRATEGY
// ============================================

class Indexer {
  private lastBlock: number = 0;
  private isRunning: boolean = false;
  private readonly BATCH_SIZE = 1000;      // Blocks per batch
  private readonly POLL_INTERVAL = 5000;   // 5 seconds
  private readonly MAX_RETRIES = 3;

  async start() {
    this.isRunning = true;

    // Load last indexed block from DB
    this.lastBlock = await this.getLastIndexedBlock();

    while (this.isRunning) {
      try {
        await this.indexNewBlocks();
      } catch (error) {
        console.error('Indexing error:', error);
        await this.handleError(error);
      }

      await this.sleep(this.POLL_INTERVAL);
    }
  }

  private async indexNewBlocks() {
    const currentBlock = await this.getCurrentBlock();

    if (currentBlock <= this.lastBlock) {
      return; // No new blocks
    }

    // Process in batches to avoid memory issues
    for (let from = this.lastBlock + 1; from <= currentBlock; from += this.BATCH_SIZE) {
      const to = Math.min(from + this.BATCH_SIZE - 1, currentBlock);

      await this.processBlockRange(from, to);

      // Update checkpoint after each batch
      await this.saveCheckpoint(to);
      this.lastBlock = to;
    }
  }
}

// ============================================
// REORG HANDLING
// ============================================

class ReorgHandler {
  private readonly CONFIRMATION_BLOCKS = 12; // Wait for 12 confirmations

  async detectReorg(): Promise<number | null> {
    const savedBlock = await this.getLatestIndexedBlock();
    const chainBlock = await this.getBlockFromChain(savedBlock.number);

    // If hashes don't match, there was a reorg
    if (savedBlock.hash !== chainBlock.hash) {
      return savedBlock.number;
    }

    return null;
  }

  async handleReorg(reorgBlock: number) {
    console.log(`Reorg detected at block ${reorgBlock}`);

    // Find common ancestor
    let block = reorgBlock;
    while (block > 0) {
      const saved = await this.getIndexedBlock(block);
      const chain = await this.getBlockFromChain(block);

      if (saved.hash === chain.hash) {
        break; // Found common ancestor
      }
      block--;
    }

    // Delete all data after common ancestor
    await this.deleteDataAfterBlock(block);

    // Reset indexer checkpoint
    await this.setCheckpoint(block);

    console.log(`Rolled back to block ${block}`);
  }
}
```

### 7.2 API Design Principles

```typescript
// ============================================
// REST API CONVENTIONS
// ============================================

// Resource naming: Plural nouns
// GET /api/icos              - List ICOs
// GET /api/icos/:address     - Get single ICO
// GET /api/icos/:address/commitments - Nested resource

// Use query params for filtering/pagination
// GET /api/icos?status=ACTIVE&limit=20&offset=0

// ============================================
// RESPONSE FORMAT
// ============================================

// Success response
interface SuccessResponse<T> {
  data: T;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Error response
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

// ============================================
// API ROUTE PATTERN
// ============================================

// app/api/icos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    const where = status ? { status: status as ICOStatus } : {};

    // Execute with pagination
    const [icos, total] = await Promise.all([
      prisma.iCO.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { startTime: 'desc' },
        include: { token: true },
      }),
      prisma.iCO.count({ where }),
    ]);

    return NextResponse.json({
      data: icos,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + icos.length < total,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

import { z } from 'zod';

const createICOSchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(10),
  // ... other fields
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate
    const parsed = createICOSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    // Process valid request
    const result = await createICO(parsed.data);
    return NextResponse.json({ data: result });
  } catch (error) {
    // Handle error
  }
}
```

---

## 8. Testing Best Practices

### 8.1 Test Structure

```typescript
// ============================================
// TEST FILE ORGANIZATION
// ============================================

/*
test/
├── unit/                      # Unit tests (isolated)
│   ├── ICOContract.test.ts
│   ├── Treasury.test.ts
│   └── LaunchFactory.test.ts
│
├── integration/               # Integration tests (multiple contracts)
│   ├── ICOLifecycle.test.ts
│   └── TreasuryGovernance.test.ts
│
├── e2e/                       # End-to-end tests
│   └── FullFlow.test.ts
│
├── fixtures/                  # Test data
│   └── deployments.ts
│
└── helpers/                   # Test utilities
    ├── time.ts
    ├── assertions.ts
    └── constants.ts
*/

// ============================================
// TEST STRUCTURE PATTERN
// ============================================

describe('ICOContract', function () {
  // Shared fixture
  async function deployFixture() {
    // Setup code
  }

  // Group by feature
  describe('Deployment', function () {
    it('should set correct initial state', async function () {
      // Test
    });

    it('should reject invalid parameters', async function () {
      // Test
    });
  });

  describe('Commitments', function () {
    describe('when ICO is active', function () {
      it('should accept valid commitment', async function () {});
      it('should accumulate multiple commitments', async function () {});
      it('should emit Committed event', async function () {});
    });

    describe('when ICO is not active', function () {
      it('should reject commitment before start', async function () {});
      it('should reject commitment after end', async function () {});
    });
  });

  describe('Edge Cases', function () {
    it('should handle rounding correctly', async function () {});
    it('should handle single participant', async function () {});
    it('should handle maximum values', async function () {});
  });
});
```

### 8.2 Test Patterns

```typescript
// ============================================
// FIXTURE PATTERN (Hardhat)
// ============================================

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// Define once, reuse everywhere
async function deployICOFixture() {
  const [owner, user1, user2] = await ethers.getSigners();

  const Token = await ethers.getContractFactory('LaunchToken');
  const token = await Token.deploy('Test', 'TEST', parseEther('10000000'));

  const ICO = await ethers.getContractFactory('ICOContract');
  const ico = await ICO.deploy(/* params */);

  return { ico, token, owner, user1, user2 };
}

describe('ICOContract', function () {
  it('test 1', async function () {
    const { ico, user1 } = await loadFixture(deployICOFixture);
    // Fresh deployment for each test
  });

  it('test 2', async function () {
    const { ico, user1 } = await loadFixture(deployICOFixture);
    // Another fresh deployment
  });
});

// ============================================
// TIME MANIPULATION
// ============================================

import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

it('should finalize after end time', async function () {
  const { ico, user1, endTime } = await loadFixture(deployICOFixture);

  // Fast forward to after end time
  await time.increaseTo(endTime + 1);

  // Now finalization should work
  await expect(ico.finalize()).to.not.be.reverted;
});

// ============================================
// EVENT ASSERTIONS
// ============================================

it('should emit correct event', async function () {
  const { ico, user1 } = await loadFixture(deployICOFixture);

  await expect(ico.connect(user1).commit({ value: parseEther('1') }))
    .to.emit(ico, 'Committed')
    .withArgs(user1.address, parseEther('1'), parseEther('1'));
});

// ============================================
// REVERT ASSERTIONS
// ============================================

it('should revert with custom error', async function () {
  const { ico, user1 } = await loadFixture(deployICOFixture);

  await expect(ico.connect(user1).commit({ value: 0 }))
    .to.be.revertedWith('Must send BNB');

  // Or with custom error
  await expect(ico.connect(user1).claimTokens())
    .to.be.revertedWithCustomError(ico, 'NotFinalized');
});

// ============================================
// BALANCE ASSERTIONS
// ============================================

it('should transfer correct amount', async function () {
  const { ico, user1, treasury } = await loadFixture(deployFixture);

  // Check balance change
  await expect(ico.connect(user1).commit({ value: parseEther('10') }))
    .to.changeEtherBalance(user1, parseEther('-10'));

  // Check multiple balances
  await expect(ico.finalize())
    .to.changeEtherBalances(
      [ico, treasury],
      [parseEther('-10'), parseEther('9.9')] // After 1% fee
    );
});
```

### 8.3 Coverage Requirements

```markdown
## Coverage Targets

| Contract | Line | Branch | Function | Critical Paths |
|----------|------|--------|----------|----------------|
| ICOContract | 95% | 90% | 100% | 100% |
| Treasury | 95% | 90% | 100% | 100% |
| LaunchFactory | 90% | 85% | 100% | 100% |
| LaunchToken | 90% | 85% | 100% | 100% |

## Critical Paths (Must be 100%)
- commit() → finalize() → claimTokens()
- commit() → markFailed() → refund()
- Treasury.spendBNB() through timelock
- All access control checks
- All revert conditions
```

---

## 9. Deployment Best Practices

### 9.1 Deployment Checklist

```markdown
## Pre-Deployment

### Code Quality
- [ ] All tests passing
- [ ] Coverage meets targets
- [ ] No compiler warnings
- [ ] Static analysis clean (Slither)
- [ ] Code review completed

### Security
- [ ] Audit findings addressed
- [ ] Bug bounty running
- [ ] No hardcoded addresses (except verified contracts)
- [ ] Admin keys secured (hardware wallet)

### Configuration
- [ ] Correct network settings
- [ ] Gas price strategy defined
- [ ] Deployment wallet funded
- [ ] All constructor parameters verified

## Deployment Steps

### 1. Deploy Factory
```bash
npx hardhat run scripts/deploy.ts --network bscMainnet
```

### 2. Verify
```bash
npx hardhat verify --network bscMainnet <ADDRESS> <CONSTRUCTOR_ARGS>
```

### 3. Configure
- Set platform fee (if different from default)
- Transfer ownership (if needed)

### 4. Test on Mainnet
- Create small test ICO
- Verify all functions work
- Check event emissions

## Post-Deployment

### Immediate
- [ ] Update frontend with new addresses
- [ ] Start indexer
- [ ] Verify all systems connected

### First 24 Hours
- [ ] Monitor for unusual activity
- [ ] Check gas usage
- [ ] Verify event indexing

### First Week
- [ ] Review first real ICOs
- [ ] Gather user feedback
- [ ] Monitor support channels
```

### 9.2 Deployment Scripts

```typescript
// scripts/deploy.ts
import { ethers, network } from 'hardhat';
import { verify } from './utils/verify';

async function main() {
  console.log(`Deploying to ${network.name}...`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} BNB`);

  // Deploy
  const LaunchFactory = await ethers.getContractFactory('LaunchFactory');
  const factory = await LaunchFactory.deploy();
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log(`LaunchFactory deployed to: ${address}`);

  // Wait for confirmations
  console.log('Waiting for confirmations...');
  const deployTx = factory.deploymentTransaction();
  await deployTx?.wait(5); // Wait for 5 confirmations

  // Verify on BSCScan
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    console.log('Verifying on BSCScan...');
    await verify(address, []);
  }

  // Save deployment info
  const deployment = {
    network: network.name,
    address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    txHash: deployTx?.hash,
  };

  console.log('Deployment complete:', deployment);

  // Write to file
  const fs = require('fs');
  fs.writeFileSync(
    `deployments/${network.name}.json`,
    JSON.stringify(deployment, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## 10. Code Organization

### 10.1 Project Structure

```
contracts/
├── src/
│   ├── core/                    # Core contracts
│   │   ├── ICOContract.sol
│   │   ├── Treasury.sol
│   │   └── LaunchFactory.sol
│   │
│   ├── tokens/                  # Token contracts
│   │   └── LaunchToken.sol
│   │
│   ├── governance/              # Governance (v3.0)
│   │   └── (future)
│   │
│   └── interfaces/              # Contract interfaces
│       ├── IICOContract.sol
│       ├── ITreasury.sol
│       └── ILaunchFactory.sol
│
├── test/                        # Test files
│   └── (see testing section)
│
├── scripts/                     # Deployment scripts
│   ├── deploy.ts
│   ├── verify.ts
│   └── configure.ts
│
└── hardhat.config.ts           # Hardhat configuration
```

### 10.2 File Naming Conventions

```
// Contracts: PascalCase
ICOContract.sol
LaunchFactory.sol
LaunchToken.sol

// Interfaces: I prefix
IICOContract.sol
ITreasury.sol

// Libraries: PascalCase with Lib suffix
MathLib.sol
AllocationLib.sol

// Test files: .test.ts suffix
ICOContract.test.ts
Treasury.test.ts

// Script files: kebab-case
deploy-factory.ts
verify-contracts.ts

// TypeScript types: PascalCase
ico.ts (contains ICODetail, ICOSummary, etc.)
```

### 10.3 Import Organization

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// ============================================
// IMPORTS ORDER
// ============================================

// 1. OpenZeppelin contracts (alphabetical)
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// 2. Other external contracts (alphabetical)
// import "@chainlink/contracts/...";

// 3. Local interfaces (alphabetical)
import "./interfaces/IICOContract.sol";
import "./interfaces/ITreasury.sol";

// 4. Local contracts (alphabetical)
// import "./libraries/MathLib.sol";
```

---

## Quick Reference

### Commands

```bash
# Compile
npx hardhat compile

# Test
npx hardhat test

# Coverage
npx hardhat coverage

# Deploy (testnet)
npx hardhat run scripts/deploy.ts --network bscTestnet

# Deploy (mainnet)
npx hardhat run scripts/deploy.ts --network bscMainnet

# Verify
npx hardhat verify --network bscMainnet <ADDRESS>

# Static analysis
slither .

# Gas report
REPORT_GAS=true npx hardhat test
```

### Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Solidity version | 0.8.20 exact | Stability, known behavior |
| Upgradability | Immutable | Maximum trust |
| Storage pattern | Minimal storage | Gas efficiency |
| Loop pattern | No on-chain loops | Gas safety |
| Error pattern | Custom errors | Gas efficiency |
| Access pattern | Role-based | Flexible, secure |
| Time pattern | Timelock | Governance safety |

---

*This document should be read alongside [TECHNICAL_SPECIFICATIONS.md](./TECHNICAL_SPECIFICATIONS.md) for implementation details.*
