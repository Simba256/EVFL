# Robotics Memecoin Launchpad - Implementation Plan

## Current State Summary

The project is a **Next.js 16 + React 19** frontend with a polished cyberpunk UI. What's complete:
- Full frontend UI (Home, Launch, Leaderboard, Token Details pages)
- Wallet connection infrastructure (RainbowKit + Wagmi)
- Mock data system with 6 sample tokens
- Responsive design with 60+ UI components
- BSC network configuration (mainnet + testnet)

What's missing:
- Smart contracts (not deployed)
- Backend API (no server)
- Real trading functionality (disabled)
- Database (no persistence)

---

## Architecture Decisions

- **Primary Chain**: Binance Smart Chain (BSC) - start with testnet
- **Pool Mechanism**: Balancer-style weighted pools (custom deployment on BSC)
- **Multi-chain**: Expand to Ethereum, Polygon, Arbitrum later
- **Approach**: Start simple, iterate to complexity

---

## Phase 1: Smart Contracts (BSC Testnet)

**Goal**: Deploy basic smart contracts for token creation and weighted pool trading

### 1.1 LaunchToken (ERC20)
Basic ERC20 token contract that gets deployed for each new memecoin:
- Standard ERC20 functions (transfer, approve, balanceOf, etc.)
- Minting controlled by factory
- Burnable (optional)
- Events: `Transfer`, `Approval`

### 1.2 TokenFactory Contract
Creates new tokens and initializes their pools:
- `createToken(name, symbol, initialSupply, weights)` - Deploy new token + pool
- Configurable launch fee (in BNB)
- Tracks all created tokens
- Events: `TokenCreated`, `PoolCreated`

### 1.3 WeightedPool Contract (Balancer-style)
Custom weighted pool implementation for BSC:
- **Weighted math**: Support flexible ratios (e.g., 80/20, 70/30, 90/10)
- `swap(tokenIn, tokenOut, amountIn, minAmountOut)` - Trade tokens
- `joinPool(amounts)` - Add liquidity
- `exitPool(lpAmount)` - Remove liquidity
- Configurable swap fee (e.g., 0.3%)
- Price calculation based on weights and balances
- Events: `Swap`, `Join`, `Exit`

**Balancer Weighted Pool Math:**
```
spotPrice = (balanceIn / weightIn) / (balanceOut / weightOut)
amountOut = balanceOut * (1 - (balanceIn / (balanceIn + amountIn))^(weightIn/weightOut))
```

### 1.4 PoolRegistry Contract
Central registry for all pools:
- Register new pools
- Query pool by token address
- List all active pools
- Events: `PoolRegistered`

### Contract Interaction Flow
```
1. User calls TokenFactory.createToken()
2. Factory deploys new LaunchToken
3. Factory creates WeightedPool (e.g., 80% Token / 20% BNB)
4. Factory registers pool in PoolRegistry
5. Users can now swap via WeightedPool
```

### Deliverables
- [ ] `/contracts/src/LaunchToken.sol` - Basic ERC20
- [ ] `/contracts/src/TokenFactory.sol` - Token deployer
- [ ] `/contracts/src/WeightedPool.sol` - Balancer-style AMM
- [ ] `/contracts/src/WeightedMath.sol` - Math library
- [ ] `/contracts/src/PoolRegistry.sol` - Pool tracking
- [ ] Hardhat configuration for BSC testnet
- [ ] Basic unit tests
- [ ] Deploy script for BSC testnet
- [ ] Contract addresses in `.env`

---

## Phase 2: Backend API

**Goal**: Build REST API for data aggregation and off-chain storage

### 2.1 Core Infrastructure
- **Framework**: Node.js + Express or Fastify (or Nest.js for structure)
- **Database**: PostgreSQL for relational data
- **Cache**: Redis for price feeds and hot data
- **ORM**: Prisma or Drizzle

### 2.2 Database Schema

```
tokens
├── id (uuid)
├── contract_address (string, unique)
├── name, symbol, description
├── image_url
├── creator_address
├── initial_supply
├── created_at
├── status (new | rising | graduated)
├── market_cap, volume_24h, price_usd
└── holders_count

trades
├── id (uuid)
├── token_id (fk)
├── trader_address
├── type (buy | sell)
├── amount, price, usd_value
├── tx_hash
└── created_at

holders
├── id (uuid)
├── token_id (fk)
├── wallet_address
├── balance
└── percentage

price_history
├── id (uuid)
├── token_id (fk)
├── price, timestamp
└── volume
```

### 2.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tokens` | List all tokens (pagination, filters) |
| GET | `/api/tokens/:symbol` | Token detail |
| GET | `/api/tokens/:symbol/trades` | Recent trades |
| GET | `/api/tokens/:symbol/holders` | Top holders |
| GET | `/api/tokens/:symbol/chart` | Price history |
| GET | `/api/leaderboard` | Ranked tokens |
| GET | `/api/trending` | Trending tokens |
| POST | `/api/tokens` | Register new token (webhook from contract) |

### 2.4 Blockchain Indexer
- Listen to contract events (TokenCreated, Trade, etc.)
- Sync on-chain data to database
- Options: Custom indexer, The Graph, or Moralis

### Deliverables
- [ ] Backend server in `/server/` or separate repo
- [ ] Database migrations
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Event listener/indexer service
- [ ] Environment configuration

---

## Phase 3: Frontend Integration

**Goal**: Connect UI to smart contracts and backend API

### 3.1 Replace Mock Data
- Update `/lib/data/tokens.ts` to fetch from API
- Add React Query hooks for all endpoints
- Implement loading states and error handling

### 3.2 Smart Contract Integration
- Add contract ABIs to `/lib/blockchain/contracts/`
- Create hooks:
  - `useTokenFactory()` - launch new tokens
  - `useTradingPool()` - buy/sell tokens
  - `useTokenBalance()` - user holdings
  - `useAllowance()` - token approvals

### 3.3 Launch Form Integration
- Connect `/components/launch-form.tsx` to TokenFactory contract
- Add transaction status UI (pending, success, error)
- Image upload to IPFS/Arweave for metadata

### 3.4 Trading UI
- Add buy/sell panel to token detail page
- Price impact calculator
- Slippage settings
- Transaction history for connected wallet

### 3.5 Real-time Updates
- WebSocket connection for live prices
- Trade notifications
- New token alerts

### Deliverables
- [ ] Contract ABIs and hooks
- [ ] API integration layer
- [ ] Trading interface
- [ ] Transaction status modals
- [ ] Real-time updates

---

## Phase 4: Token Activity & Analytics

**Goal**: Comprehensive activity tracking and data visualization

### 4.1 Activity Feed
- Real-time trade feed (global and per-token)
- Wallet activity tracking
- "Whales" alerts (large trades)

### 4.2 Charts & Analytics
- Replace TradingView embed with custom charts
- Price charts (1H, 24H, 7D, 30D, ALL)
- Volume charts
- Holder distribution pie chart
- Market cap history

### 4.3 Token Metrics
- Bonding curve progress (% to graduation)
- Liquidity depth
- Buy/sell pressure indicator
- Social sentiment (Twitter mentions)

### 4.4 User Portfolio
- Connected wallet's holdings
- P&L tracking
- Trade history
- Favorite/watchlist tokens

### Deliverables
- [ ] Activity feed component
- [ ] Enhanced chart system
- [ ] Analytics dashboard
- [ ] Portfolio page

---

## Phase 5: Exchange Features

**Goal**: Full DEX-like trading experience

### 5.1 Swap Interface
- Token-to-token swaps
- Best route calculation
- Multi-hop trades

### 5.2 Liquidity Provision
- Add/remove liquidity
- LP token management
- Yield display

### 5.3 Order Types (Optional)
- Limit orders
- Stop-loss orders
- DCA (Dollar Cost Averaging)

### 5.4 Advanced Trading
- Price alerts
- Auto-buy on launch
- Sniper protection

### Deliverables
- [ ] Swap interface
- [ ] Liquidity management UI
- [ ] Advanced order types
- [ ] Price alert system

---

## Phase 6: Security & Production

**Goal**: Audit, optimize, and launch

### 6.1 Smart Contract Security
- Internal audit
- External audit (recommended firms: Trail of Bits, OpenZeppelin)
- Bug bounty program

### 6.2 Frontend Security
- Input sanitization
- Rate limiting
- Anti-bot measures (CAPTCHA for launches)

### 6.3 Performance
- API caching strategy
- Database indexing
- CDN for static assets
- Edge functions for API

### 6.4 Monitoring
- Error tracking (Sentry)
- Analytics (Vercel Analytics already integrated)
- Uptime monitoring
- Blockchain monitoring (contract health)

### Deliverables
- [ ] Security audit report
- [ ] Performance benchmarks
- [ ] Monitoring dashboards
- [ ] Incident response plan

---

## Phase 7: Growth Features

**Goal**: Community and engagement features

### 7.1 Social Features
- Token comments/chat
- Creator profiles
- Follow tokens/creators
- Share to Twitter/Telegram

### 7.2 Gamification
- Achievement badges
- Trading competitions
- Referral program
- Loyalty rewards

### 7.3 Creator Tools
- Token management dashboard
- Holder airdrops
- Announcements
- Token burns

### Deliverables
- [ ] Comment system
- [ ] User profiles
- [ ] Achievement system
- [ ] Creator dashboard

---

## Recommended Priority Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Phase 1: Smart Contracts | High | Critical |
| 2 | Phase 2: Backend API | High | Critical |
| 3 | Phase 3: Frontend Integration | Medium | Critical |
| 4 | Phase 4: Activity & Analytics | Medium | High |
| 5 | Phase 6: Security & Production | Medium | Critical |
| 6 | Phase 5: Exchange Features | High | Medium |
| 7 | Phase 7: Growth Features | Medium | Medium |

---

## Quick Wins (Can Start Now)

1. **Set up Hardhat/Foundry** in `/contracts/`
2. **Create backend scaffold** with database schema
3. **Add IPFS integration** for token images
4. **Fix TypeScript errors** (currently ignored in build)
5. **Get WalletConnect Project ID** and add to `.env`
6. **Set up BSC testnet** for development testing

---

## Tech Stack Recommendations

| Layer | Recommended | Alternatives |
|-------|-------------|--------------|
| Smart Contracts | Solidity 0.8.x + Hardhat | Foundry |
| Math Library | OpenZeppelin + Custom WeightedMath | PRBMath |
| Backend | Node.js + Fastify | Nest.js, Go |
| Database | PostgreSQL | Supabase |
| Cache | Redis | Upstash |
| Indexer | Custom + Viem/Ethers.js | The Graph, Moralis |
| Image Storage | IPFS (Pinata) | Arweave, S3 |
| Real-time | WebSockets | Server-Sent Events |

## Multi-Chain Expansion Strategy

**Phase 1 (Now)**: BSC Testnet → BSC Mainnet
**Phase 2 (Later)**:
- Ethereum (Balancer V2 native - can use official contracts)
- Polygon (Balancer V2 native)
- Arbitrum (Balancer V2 native)
- Base

For chains with native Balancer deployment, integrate directly with their contracts instead of custom deployment.

---

## Files to Create/Modify

```
New Directories:
├── /contracts/           # Solidity smart contracts
│   ├── src/
│   ├── test/
│   └── scripts/
├── /server/              # Backend API (or separate repo)
│   ├── src/
│   ├── prisma/
│   └── docker-compose.yml

Modified Files:
├── /lib/data/tokens.ts   # Replace mock with API calls
├── /lib/blockchain/      # Add contract ABIs and hooks
├── /components/          # Add trading UI components
├── /app/token/[symbol]/  # Enhance with trading panel
└── /.env                 # Add contract addresses
```

---

## Estimated Scope

- **Phase 1-3** (MVP): Core launchpad functionality
- **Phase 4-5** (V1): Full-featured trading platform
- **Phase 6-7** (V2): Production-ready with community features

The frontend foundation is solid. The main work is blockchain integration and backend infrastructure.
