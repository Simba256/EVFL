# Fair Launch System - Decision Matrix

> Track all decisions needed before implementation

**Related Documents:**
- [FAIR_LAUNCH_SYSTEM.md](./FAIR_LAUNCH_SYSTEM.md) - System overview
- [V1_IMPLEMENTATION_PLAN.md](./V1_IMPLEMENTATION_PLAN.md) - Implementation plan
- [TECHNICAL_SPECIFICATIONS.md](./TECHNICAL_SPECIFICATIONS.md) - Complete technical details
- [ARCHITECTURE_AND_BEST_PRACTICES.md](./ARCHITECTURE_AND_BEST_PRACTICES.md) - Architecture & coding standards

---

## Status Legend
- [ ] **OPEN** - Needs discussion
- [x] **DECIDED** - Decision made
- [~] **DEFERRED** - Decide later

## Version Checkpoints

| Version | Scope | Status |
|---------|-------|--------|
| **v0.1** | Core ICO Contract (commit, finalize, claim, refund) | Planning |
| **v0.2** | Treasury + Multisig + Timelock | Planning |
| **v0.3** | Database + Indexer Integration | Planning |
| **v0.4** | Frontend (Launch form, ICO pages, Claim UI) | Planning |
| **v0.5** | Testing + Testnet Deployment | Planning |
| **v1.0** | Production Release (Mainnet) | Planning |
| **v1.1** | Team Tokens with Time-Based Vesting | Future |
| **v1.2** | Emergency Pause Mechanism | Future |
| **v2.0** | Bid Wall System (Price Protection) | Future |
| **v2.1** | Performance-Based Unlock Multiples | Future |
| **v3.0** | Token Voting Governance | Future |

---

## 1. ICO Mechanism Decisions

### 1.1 Quote Token
**Question**: What token do users commit during ICO?

| Option | Pros | Cons |
|--------|------|------|
| **WBNB** | Native to BSC, high liquidity | Price volatility |
| **BUSD** | Stable, predictable raises | Regulatory concerns, less liquid |
| **USDC** | Stable, widely used | Bridge from Ethereum needed |
| **BNB (native)** | Easiest UX | Requires wrapping for contracts |

- [x] **Decision**: WBNB
- [ ] **Rationale**: Standard for BSC, high liquidity, native to ecosystem

---

### 1.2 ICO Duration
**Question**: How long is the commitment period?

| Option | Pros | Cons |
|--------|------|------|
| **1 day** | Fast, less waiting | May miss participants |
| **4 days** | MetaDAO standard, balanced | Moderate wait |
| **7 days** | Maximum participation | Long wait, capital locked |
| **Configurable** | Flexible, creator's choice | Variable, may need min/max limits |

- [x] **Decision**: Configurable by coin owners
- [ ] **Rationale**: Gives creators flexibility, can set min/max limits in contracts

---

### 1.3 Raise Structure
**Question**: Capped or uncapped raises?

| Option | Description | Trade-offs |
|--------|-------------|------------|
| **Hard Cap** | Fixed maximum, excess refunded | Gaming risk (over-commit) |
| **Uncapped** | Accept all commitments | Unpredictable dilution |
| **Discretionary** | Founder chooses after seeing demand | Requires trust |
| **Soft Cap + Overflow** | Minimum + excess to bid wall | Best of both |

- [x] **Decision**: Uncapped
- [ ] **Rationale**: Simpler implementation, true demand signal, no gaming risk

---

### 1.4 Minimum Raise
**Question**: What's the minimum to proceed?

| Option | Reasoning |
|--------|-----------|
| **$10,000** | Low barrier, more launches |
| **$50,000** | Moderate, filters low effort |
| **$100,000** | High bar, quality focus |
| **Configurable** | Per-launch decision |

- [x] **Decision**: $10,000
- [ ] **Rationale**: Low barrier to encourage launches, can be increased later if needed

---

### 1.5 Token Supply
**Question**: Fixed supply or configurable?

| Option | Description |
|--------|-------------|
| **Fixed 10M** | Simple, consistent (MetaDAO model) |
| **Configurable** | Founders choose supply |
| **Fixed with Team Option** | 10M base + up to 12.9M team |

- [x] **Decision**: Configurable (with reasonable limits)
- [x] **Rationale**: Flexibility for different project types. Enforce min 1M, max 1T tokens. Common defaults: 10M, 100M, 1B. UI can suggest standard options while allowing custom values.

---

## 2. Bid Wall Decisions

### 2.1 Bid Wall Duration
**Question**: How long does the bid wall operate?

| Option | Pros | Cons |
|--------|------|------|
| **30 days** | Quick resolution | May not provide enough protection |
| **60 days** | Moderate protection | Middle ground |
| **90 days** | MetaDAO standard, extended protection | Long commitment |
| **Until exhausted** | Maximum protection | Unpredictable |

- [~] **Decision**: Deferred to v2.0
- [x] **Rationale**: Bid wall is complex and requires keeper infrastructure. Focus on core ICO mechanism first. Will revisit when v1.0 is stable.

---

### 2.2 Token Handling
**Question**: What happens to tokens bought by bid wall?

| Option | Effect | Trade-offs |
|--------|--------|------------|
| **Burn** | Deflationary, reduces supply | Permanent |
| **Treasury** | DAO holds tokens | Can be re-sold or used |
| **Lock** | Locked for period, then treasury | Delayed decision |

- [~] **Decision**: Deferred to v2.0
- [x] **Rationale**: Decision will be made during bid wall implementation. Leaning towards burn for deflationary effect.

---

### 2.3 Bid Price Strategy
**Question**: At what price does bid wall buy?

| Option | Description |
|--------|-------------|
| **Exact ICO Price** | Strong floor |
| **ICO Price - 5%** | Slight discount, extends duration |
| **Tiered** | More aggressive at lower prices |
| **Dynamic** | Adjust based on conditions |

- [~] **Decision**: Deferred to v2.0
- [x] **Rationale**: Likely exact ICO price for simplicity and strong messaging ("guaranteed floor"). Will finalize during v2.0 design.

---

### 2.4 Bid Wall Trigger
**Question**: Who/what triggers buybacks?

| Option | Pros | Cons |
|--------|------|------|
| **Anyone (permissionless)** | Decentralized | Gas costs for caller |
| **Keeper (Gelato/Chainlink)** | Automated, reliable | Ongoing cost |
| **Team multisig** | Controlled | Centralized |
| **Hybrid** | Anyone can, keeper as backup | Complex |

- [~] **Decision**: Deferred to v2.0
- [x] **Rationale**: Likely Gelato or Chainlink Automation for reliability. Will evaluate costs during v2.0 planning.

---

## 3. Treasury & Governance Decisions

### 3.1 Governance Model (v1)
**Question**: How is treasury controlled initially?

| Option | Complexity | Decentralization |
|--------|------------|------------------|
| **Team Multisig + Timelock** | Low | Low |
| **Token Voting (Governor)** | Medium | High |
| **Futarchy** | High | Very High |
| **Hybrid** | Medium | Medium |

- [x] **Decision**: Multisig + Timelock
- [ ] **Rationale**: Simpler to implement for v1, faster iteration, can upgrade to token voting later

---

### 3.2 Timelock Delay
**Question**: How long before treasury actions execute?

| Option | Security | Flexibility |
|--------|----------|-------------|
| **24 hours** | Moderate | High |
| **48 hours** | Good | Moderate |
| **7 days** | High | Low |
| **Configurable** | Variable | Variable |

- [x] **Decision**: 48 hours
- [x] **Rationale**: Balanced approach - enough time for community to react to malicious proposals, but not so long that legitimate operations are delayed. Industry standard for DeFi protocols.

---

### 3.2.1 Multisig Configuration
**Question**: How many signers and what threshold?

| Raise Size | Configuration | Rationale |
|------------|---------------|-----------|
| **< 100 BNB** | 2-of-3 | Small treasury, simpler ops |
| **>= 100 BNB** | 3-of-5 | Larger funds, more oversight |

**Signer Roles (2-of-3):**
| Role | Description |
|------|-------------|
| Signer 1 | Project Creator (primary operator) |
| Signer 2 | Platform Admin (oversight) |
| Signer 3 | Community Representative |

**Signer Roles (3-of-5):**
| Role | Description |
|------|-------------|
| Signers 1-2 | Project Team (2 members) |
| Signer 3 | Platform Admin |
| Signers 4-5 | Community/Advisors (2 members) |

- [x] **Decision**: 2-of-3 default, 3-of-5 for large raises (>100 BNB)
- [x] **Rationale**: Balances security with operational efficiency. Larger raises need more oversight.

---

### 3.3 Monthly Spending Limit
**Question**: Can teams spend without proposals?

| Option | Description |
|--------|-------------|
| **No limit** | Full governance for everything |
| **Fixed % of treasury** | E.g., 5% per month |
| **Fixed amount** | E.g., $10k per month |
| **Configurable at launch** | Founder sets limit |

- [x] **Decision**: Configurable at launch (optional)
- [x] **Rationale**: Gives creators flexibility. Some projects need operational spending, others want full governance. Default to no monthly limit (all spends require timelock). Creators can opt-in to a monthly budget if desired.

---

### 3.4 Minting Authority
**Question**: Who can mint new tokens?

| Option | Description |
|--------|-------------|
| **Governance only** | Requires proposal + vote |
| **Disabled** | No new minting ever |
| **Capped** | Max additional % per year |

- [x] **Decision**: Disabled (no new minting)
- [x] **Rationale**: Maximum trust guarantee. All tokens minted at ICO finalization. Prevents inflation and rug via minting. This is a core anti-rug feature.

---

## 4. Liquidity Decisions

### 4.1 AMM Type
**Question**: What AMM to use for trading?

| Option | Pros | Cons |
|--------|------|------|
| **Keep Weighted Pool** | Already built | Complex |
| **Uniswap V2 Clone** | Simple, proven | Less flexible |
| **PancakeSwap Integration** | Existing liquidity | External dependency |
| **Custom** | Full control | Development time |

- [x] **Decision**: Keep Weighted Pool
- [ ] **Rationale**: Already deployed and tested on BSC testnet, consistent with existing system

---

### 4.2 Liquidity Allocation
**Question**: What % of raise goes to liquidity?

| Option | Liquidity Depth | Treasury Size |
|--------|-----------------|---------------|
| **10%** | Lower | Larger |
| **20%** | Moderate (MetaDAO) | Moderate |
| **30%** | Higher | Smaller |

- [x] **Decision**: 20%
- [ ] **Rationale**: Balanced approach, MetaDAO standard, enough liquidity for trading

---

### 4.3 LP Token Ownership
**Question**: Who owns the LP tokens?

| Option | Control | Flexibility |
|--------|---------|-------------|
| **Burned** | None | None |
| **Treasury (Governance)** | DAO | High |
| **Time-locked** | None initially | Delayed |
| **Team** | Team | Risk |

- [x] **Decision**: Treasury (Governance via Timelock)
- [x] **Rationale**: LP tokens held by treasury, controlled via multisig + 48h timelock. Allows future flexibility (add liquidity, migrate pools) while maintaining security. Burning is too restrictive, team ownership is too risky.

---

## 5. Team Allocation Decisions

### 5.1 Team Allocation
**Question**: Is team allocation mandatory?

| Option | Description |
|--------|-------------|
| **Mandatory** | All launches have team tokens |
| **Optional** | Founders choose |
| **Prohibited** | No team allocation allowed |

- [x] **Decision**: Optional
- [ ] **Rationale**: Gives creators flexibility, can choose pure community tokens

---

### 5.2 Maximum Team Allocation
**Question**: What's the max team can receive?

| Option | % of Total Supply |
|--------|-------------------|
| **25%** | Conservative |
| **50%** | MetaDAO standard |
| **Configurable** | Founder decides |

- [x] **Decision**: Maximum 20% of total supply
- [x] **Rationale**: Conservative limit to maintain community trust. 20% is generous for team while ensuring 80%+ goes to community. Displayed prominently in UI so participants know allocation breakdown.

---

### 5.3 Unlock Multiples
**Question**: At what price multiples do tokens unlock?

| Option | Multiples |
|--------|-----------|
| **Conservative** | 2x, 5x, 10x, 20x |
| **MetaDAO Standard** | 2x, 4x, 8x, 16x, 32x |
| **Aggressive** | 3x, 10x, 50x, 100x |
| **Configurable** | Founder sets |

- [~] **Decision**: Deferred to v2.1
- [x] **Rationale**: Performance-based unlocks require price oracle infrastructure. v1.1 will implement simple time-based vesting first, v2.1 adds performance multiples.

---

### 5.4 Minimum Lock Period
**Question**: How long before ANY team tokens unlock?

| Option | Duration |
|--------|----------|
| **6 months** | Short |
| **12 months** | Moderate |
| **18 months** | MetaDAO standard |
| **24 months** | Conservative |

- [x] **Decision**: 6-month cliff, 18-month linear vesting (v1.1)
- [x] **Rationale**: 6-month cliff ensures team commitment, 18-month linear vesting aligns long-term incentives. Total 24-month unlock period. Implemented in v1.1 with simple time-based vesting.

---

### 5.5 Price Oracle
**Question**: How to verify price for unlocks?

| Option | Reliability | Complexity |
|--------|-------------|------------|
| **On-chain TWAP** | Moderate | Low |
| **Chainlink** | High | Medium |
| **Multi-source** | Highest | High |

- [~] **Decision**: Deferred to v2.1
- [x] **Rationale**: Only needed for performance-based unlocks. Will likely use on-chain TWAP from our own pools (7-day average) for simplicity and no external dependencies.

---

## 6. Platform Decisions

### 6.1 Platform Fee
**Question**: Does the platform take a fee?

| Option | Amount | When |
|--------|--------|------|
| **No fee** | 0% | - |
| **Raise fee** | 1-2.5% of ICO | At finalization |
| **Trade fee** | 0.1-0.5% of swaps | Ongoing |
| **Both** | Raise + Trade | Both |

- [x] **Decision**: Raise fee (percentage TBD)
- [ ] **Rationale**: Sustainable revenue model, aligned with successful launches

---

### 6.2 Launch Curation
**Question**: Who can launch tokens?

| Option | Access | Quality |
|--------|--------|---------|
| **Permissionless** | Anyone | Variable |
| **Curated** | Application required | Higher |
| **Staking** | Stake tokens to launch | Moderate |
| **Hybrid** | Permissionless + featured | Mixed |

- [x] **Decision**: Permissionless
- [ ] **Rationale**: True DeFi, no gatekeeping, MetaDAO standard

---

### 6.3 Contract Upgradability
**Question**: Can contracts be upgraded?

| Option | Flexibility | Trust |
|--------|-------------|-------|
| **Immutable** | None | Trustless |
| **Upgradable (Proxy)** | High | Requires trust |
| **Time-locked Upgrades** | Moderate | Moderate |

- [x] **Decision**: Immutable (no upgrades)
- [x] **Rationale**: Maximum trust guarantee. Each ICO deploys fresh immutable contracts. Factory can be upgraded to deploy new versions, but existing ICOs remain unchanged. Users know exactly what code they're interacting with.

---

### 6.4 Emergency Controls
**Question**: Should there be pause functionality?

| Option | Safety | Decentralization |
|--------|--------|------------------|
| **No pause** | Lower | Higher |
| **Admin pause** | Higher | Lower |
| **Governance pause** | Higher | Higher |
| **Time-limited pause** | Moderate | Moderate |

- [x] **Decision**: Time-limited pause (v1.2)
- [x] **Rationale**: Platform admin can pause new commitments for max 7 days in case of security incident. Cannot pause claims or refunds (users can always exit). Implemented in v1.2 after core functionality is stable.

---

## 7. Technical Decisions

### 7.1 Deployment Strategy
**Question**: How to handle existing system?

| Option | Description |
|--------|-------------|
| **Replace** | Remove weighted pools entirely |
| **Dual** | Support both systems |
| **Migrate** | Gradual transition |

- [x] **Decision**: Dual system initially, migrate over time
- [x] **Rationale**: Support both instant launch (existing) and fair launch (new) in v1.0. Mark instant launch as "Legacy" in UI. Evaluate deprecation after 3 months of fair launch operation.

---

### 7.2 Testnet First
**Question**: Which testnet to use?

| Option | Description |
|--------|-------------|
| **BSC Testnet** | Current setup |
| **Local Hardhat** | Fast iteration |
| **Both** | Local dev + testnet staging |

- [x] **Decision**: Both (Local Hardhat + BSC Testnet)
- [x] **Rationale**: Use local Hardhat for rapid development and unit tests. Deploy to BSC Testnet for integration testing and staging. Full flow testing on testnet before mainnet.

---

### 7.3 Audit Strategy
**Question**: Security audit approach?

| Option | Cost | Timeline |
|--------|------|----------|
| **Full audit** | High | 4-8 weeks |
| **Partial audit** | Medium | 2-4 weeks |
| **Bug bounty only** | Low | Ongoing |
| **Audit + bounty** | High | 6-10 weeks |

- [x] **Decision**: Partial audit + bug bounty
- [x] **Rationale**: Get partial audit focused on ICOContract and Treasury (critical contracts). Launch bug bounty program for ongoing security. Full audit for v2.0 when bid wall is added. Budget-conscious approach for v1.0.

---

## Summary: All Decisions

### Core ICO Decisions (v0.1-v1.0)

| # | Decision | Choice | Version |
|---|----------|--------|---------|
| 1 | Quote token | WBNB | v0.1 |
| 2 | Raise structure | Uncapped | v0.1 |
| 3 | Minimum raise | $10,000 (in BNB equivalent) | v0.1 |
| 4 | ICO duration | Configurable (1-14 days) | v0.1 |
| 5 | Token supply | Configurable (1M-1T) | v0.1 |
| 6 | AMM type | Keep Weighted Pool | v0.1 |
| 7 | Governance model | Multisig + Timelock | v0.2 |
| 8 | Timelock duration | 48 hours | v0.2 |
| 9 | Liquidity allocation | 20% of raise | v0.1 |
| 10 | LP token ownership | Treasury (via timelock) | v0.2 |
| 11 | Team allocation | Optional (max 20%) | v0.1 |
| 12 | Platform fee | 1% of raise | v0.1 |
| 13 | Launch curation | Permissionless | v0.1 |
| 14 | Minting authority | Disabled (no new minting) | v0.1 |
| 15 | Contract upgradability | Immutable | v0.1 |
| 16 | Monthly spending limit | Configurable (optional) | v0.2 |
| 17 | Deployment strategy | Dual system (legacy + fair launch) | v1.0 |
| 18 | Testnet strategy | Local Hardhat + BSC Testnet | v0.5 |
| 19 | Audit strategy | Partial audit + bug bounty | v0.5 |

### Future Decisions (v1.1+)

| # | Decision | Preliminary Choice | Version |
|---|----------|-------------------|---------|
| 20 | Team vesting | 6-month cliff, 18-month linear | v1.1 |
| 21 | Emergency pause | Time-limited (max 7 days) | v1.2 |
| 22 | Bid wall duration | 90 days (tentative) | v2.0 |
| 23 | Token handling (bid wall) | Burn (tentative) | v2.0 |
| 24 | Bid price strategy | Exact ICO price (tentative) | v2.0 |
| 25 | Bid wall trigger | Keeper (Gelato/Chainlink) | v2.0 |
| 26 | Unlock multiples | MetaDAO standard (2x-32x) | v2.1 |
| 27 | Price oracle | On-chain TWAP (7-day) | v2.1 |

---

## Decision Log

| Date | Decision | Choice | Rationale |
|------|----------|--------|-----------|
| 2024-02-12 | Quote Token | WBNB | Standard for BSC, high liquidity |
| 2024-02-12 | ICO Duration | Configurable (1-14 days) | Creator flexibility |
| 2024-02-12 | Raise Structure | Uncapped | Simpler, true demand signal |
| 2024-02-12 | Minimum Raise | $10,000 | Low barrier to encourage launches |
| 2024-02-12 | Governance Model | Multisig + Timelock | Simpler for initial version |
| 2024-02-12 | Liquidity Allocation | 20% | MetaDAO standard, balanced |
| 2024-02-12 | AMM Type | Keep Weighted Pool | Already deployed and tested |
| 2024-02-12 | Team Allocation | Optional (max 20%) | Flexibility, community trust |
| 2024-02-12 | Platform Fee | 1% of raise | Sustainable revenue |
| 2024-02-12 | Launch Curation | Permissionless | True DeFi, no gatekeeping |
| 2024-02-12 | Timelock Duration | 48 hours | Balance security/flexibility |
| 2024-02-12 | Minting | Disabled | Anti-rug guarantee |
| 2024-02-12 | Upgradability | Immutable | Maximum trust |
| 2024-02-12 | Token Supply | Configurable (1M-1T) | Project flexibility |
| 2024-02-12 | LP Ownership | Treasury | Governance control |
| 2024-02-12 | Emergency Pause | Time-limited (v1.2) | Safety with limits |
| 2024-02-12 | Audit Strategy | Partial + bounty | Budget-conscious |

---

## Version Roadmap

```
v0.1 ─── Core ICO Contract (commit, finalize, claim, refund)
  │
v0.2 ─── Treasury + Multisig + Timelock
  │
v0.3 ─── Database + Indexer Integration
  │
v0.4 ─── Frontend (Launch form, ICO pages, Claim UI)
  │
v0.5 ─── Testing + Testnet Deployment
  │
v1.0 ─── Production Release (Mainnet)
  │
v1.1 ─── Team Tokens with Time-Based Vesting
  │
v1.2 ─── Emergency Pause Mechanism
  │
v2.0 ─── Bid Wall System (Price Protection)
  │
v2.1 ─── Performance-Based Unlock Multiples
  │
v3.0 ─── Token Voting Governance
```

---

## Next Steps

1. ✅ All core decisions finalized
2. Begin v0.1 implementation (ICOContract)
3. Write tests alongside development
4. Deploy to local Hardhat for rapid iteration
