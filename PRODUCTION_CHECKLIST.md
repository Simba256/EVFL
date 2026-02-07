# Production Checklist

Items to address before going to production.

## Security

- [ ] **SSL Certificate Verification** (`lib/db/prisma.ts:27`)
  - Currently using `rejectUnauthorized: false` which disables SSL cert verification
  - Fix: Get Supabase CA certificate and set `rejectUnauthorized: true` with `ca: process.env.DATABASE_CA_CERT`
  - Or: Add runtime warning if this ships to production

## Environment

- [ ] Ensure all secrets are in environment variables (not hardcoded)
- [ ] Set `NODE_ENV=production`
- [ ] Review and remove any debug endpoints or logging

## Database

- [ ] Run any pending migrations
- [ ] Verify database backups are configured
- [ ] Check connection pool settings for production load

## Monitoring

- [ ] Error tracking configured (e.g., Sentry)
- [ ] Basic health check endpoint available
- [ ] Logging configured for production (no sensitive data logged)

---

# Pre-Mainnet Checklist

Items to complete before deploying contracts to mainnet. Not needed for testnet MVP.

## Smart Contract Testing

- [ ] **Contract integration tests**
  - Full flow: create token → initialize pool → swap → verify balances
  - Multi-step transaction tests
  - Currently only unit tests exist for WeightedMath and WeightedPool

- [ ] **Liquidity provider tests**
  - joinPool/exitPool edge cases
  - LP token accuracy verification
  - Proportional withdrawal correctness

- [ ] **Slippage and price impact tests**
  - Verify slippage protection works correctly
  - Test price impact over multiple consecutive swaps
  - Large swap behavior near pool limits

- [ ] **Error recovery tests**
  - Insufficient liquidity scenarios
  - Token transfer failures
  - Balance edge cases

## Smart Contract Security

- [ ] **Security audit**
  - Professional audit of WeightedMath.sol and WeightedPool.sol
  - Focus on: powApprox accuracy, AMM invariant preservation, rounding errors

- [ ] **Reentrancy review**
  - Contracts use ReentrancyGuard but explicit attack tests recommended

- [ ] **Access control review**
  - Verify factory-only minting on LaunchToken
  - Verify pool registration authorization

## Frontend Testing

- [ ] **Trading panel tests** (`components/trading-panel.tsx`)
  - Swap calculation accuracy
  - Slippage handling
  - Error states and user feedback
  - Only add once UI is finalized

- [ ] **Hook tests** (`lib/blockchain/hooks/useWeightedPool.ts`)
  - Contract call parameters
  - BNB wrapping logic
  - Approval flow

## Infrastructure

- [ ] **Database indexer** (if needed)
  - Decide: is on-chain reading sufficient or do we need cached data?
  - If needed: implement event listener, add indexer tests
  - Currently schema exists but indexer not implemented

- [ ] **Rate limiting**
  - Add rate limiting on API endpoints if public

- [ ] **Gas optimization**
  - Benchmark gas costs for key operations
  - Optimize if costs are prohibitive on mainnet

## Nice-to-Have (Lower Priority)

- [ ] Fuzz testing for math functions (random inputs)
- [ ] Invariant testing (pool invariant never decreases except fees)
- [ ] Multi-user/MEV simulation tests
- [ ] Frontend E2E tests (Cypress/Playwright)
