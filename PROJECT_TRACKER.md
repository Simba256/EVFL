# Project Tracker

> Last updated: 2026-03-18

## Project Summary
RoboLaunch - A robotics-themed memecoin launchpad on BSC (testnet) with fair launch ICOs, weighted pool trading, and token creation. Built with Next.js 16, Tailwind CSS 4, wagmi/viem, and Prisma.

## Current Status
**Status**: Active - MVP polish for client showcase

## In Progress
- [ ] Further UI/UX polish as needed for client demo

## Recently Completed
- [x] Add robotics placeholder images to fair launch pages (2026-03-18)
- [x] Replace v0 default favicons with RoboLaunch branded lightning bolt icons (2026-03-18)
- [x] Add realistic mock trade data for all token pages with proper formatting (2026-03-18)
- [x] Add realistic mock OHLCV candle data for all tokens, replace DEX Screener iframe (2026-03-18)
- [x] Use robotics placeholder images for tokens without custom images (2026-03-18)
- [x] Fix on-chain token detail page to show uploaded images from DB (2026-03-18)
- [x] Replace Inter with Space Grotesk font, fix font-sans fallback (was Times New Roman) (2026-03-18)
- [x] Fix dark mode primary color from gray to proper neon cyan (2026-03-18)
- [x] Add themed scrollbars, selection highlight, heading typography (2026-03-18)
- [x] Upgrade nav links with uppercase HUD-style tracking (2026-03-18)

## Upcoming / Planned

### Phase 1 — MVP Polish (Current)
- [ ] Mobile responsive improvements (hamburger menu, touch-friendly)
- [ ] Token stats formatting on detail page (raw numbers showing instead of formatted)
- [ ] Fix hardcoded `testnet.bscscan.com` URLs — make dynamic via chain config (3 files)
- [ ] OG image generation for social sharing

### Phase 2 — Mainnet Launch
- [ ] Deploy contracts to BSC Mainnet (56) — TokenFactory, FairLaunchFactory, PoolRegistry
- [ ] Update contract addresses in config (or via env vars)
- [ ] Replace `bscTestnetClient` with dynamic `getPublicClient(chainId)` (5 call sites)
- [ ] Set up production database and indexer with mainnet start block
- [ ] Configure WalletConnect project ID for production
- [ ] Security audit of smart contracts before mainnet

### Phase 3 — Multichain Expansion
- [ ] Deploy contracts to Base (8453) — framework already scaffolded in chains.ts
- [ ] Deploy contracts to Arbitrum (42161) — framework already scaffolded
- [ ] Chain selector UI in header / wallet connection
- [ ] Per-chain indexer instances and DB partitioning
- [ ] Cross-chain token discovery and unified leaderboard
- [ ] Chain-specific DEX router integration (PancakeSwap, Uniswap, SushiSwap)

### Phase 4 — Growth & Features
- [ ] Real-time WebSocket updates for trades and price charts
- [ ] Token creator dashboard with analytics
- [ ] Social features (comments, likes, watchlists)
- [ ] Referral / affiliate system
- [ ] Advanced trading (limit orders, slippage settings)
- [ ] Governance voting for graduated tokens
- [ ] API rate limiting and production hardening
- [ ] Performance optimization (image lazy loading, bundle splitting)

## Blockers
- None

## Key Decisions
- (2026-03-18) Use Space Grotesk over Inter for body font — fits robotics/tech aesthetic better, Inter is overused
- (2026-03-18) Deterministic placeholder images via hash — each token consistently gets the same robot image across all pages
- (2026-03-18) Mock data fallback strategy — price charts and trades generate realistic data when DB is unavailable, enabling client demos without full infrastructure
- (2026-03-18) Replaced embedded DEX Screener iframe with native PriceChart component — was showing random Solana chart, now uses proper mock data

## Notes
- Deployed at https://evfl.vercel.app/
- GitHub: https://github.com/Simba256/EVFL
- On-chain tokens on BSC Testnet (chain ID 97)
- 6 robotics placeholder images in /public/ for tokens without uploads
- Mock candle generator uses seeded PRNG for deterministic output per token+interval
- Multi-chain config already scaffolded in `lib/blockchain/config/chains.ts` for BSC, Base, Arbitrum
- Contracts deployed on testnet: TokenFactory (`0x6F42...`), FairLaunchFactory (`0x821F...`), PoolRegistry (`0x785F...`)
- Multi-chain expansion plan doc exists at `docs/MULTI_CHAIN_EXPANSION_PLAN.md`
