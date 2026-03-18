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
- [ ] Mobile responsive improvements (hamburger menu, touch-friendly)
- [ ] Token stats formatting on detail page (raw numbers showing instead of formatted)
- [ ] Real trading data integration when DB is fully connected
- [ ] OG image generation for social sharing
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
