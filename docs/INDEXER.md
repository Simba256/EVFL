# RoboLaunch Blockchain Event Indexer

## Quick Start

```bash
# Local development (uses .env file)
npm run indexer:dev

# Railway deployment (from GitHub)
# 1. Connect repo at railway.app
# 2. Set environment variables (see below)
# 3. Deploy
```

## Current Production Configuration

These are the actual values for BSC Testnet deployment:

| Setting | Value |
|---------|-------|
| **Database** | `postgresql://postgres.mdcmexgjqjyyaallrimg:reborn-r8-gg@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| **TokenFactory** | `0x6F42EC722461Eb6fDe4B4cD8793b297eB34924F7` |
| **PoolRegistry** | `0x785FAE9B7C7801173bc1Dc1e38A9ae827137abBc` |
| **WBNB** | `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd` |
| **RPC URL** | `https://data-seed-prebsc-1-s1.binance.org:8545` |
| **Chain ID** | `97` (BSC Testnet) |
| **Poll Interval** | `5000ms` (5 seconds) |

---

## Overview

The indexer is a background service that monitors the BSC blockchain for events related to token creation, swaps, and transfers. It processes these events and stores them in the database, enabling real-time price charts, trading history, holder tracking, and aggregated metrics.

### What It Does

| Event Type | Source | Database Tables Updated |
|------------|--------|------------------------|
| `TokenCreated` | TokenFactory | `tokens` |
| `Swap` | WeightedPool contracts | `trades`, `price_history` |
| `Transfer` | Token contracts | `token_holders`, `tokens.holdersCount` |
| Metrics refresh | Aggregation job | `tokens.volume24h`, `tokens.change24h`, `tokens.change7d`, `tokens.price` |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Indexer Process                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Event Loop  │  │   Metrics   │  │   Health Server     │  │
│  │  (5s poll)  │  │  (60s poll) │  │   (HTTP :8080)      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Prisma Client                        ││
│  └─────────────────────────┬───────────────────────────────┘│
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │   PostgreSQL   │
                    │   (Supabase)   │
                    └────────────────┘
```

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL database (local or Supabase)
- BSC testnet RPC access

### Environment Variables

The indexer shares environment variables with the main application. These are already configured in `.env`:

```bash
# ============================================
# Database (Supabase PostgreSQL) - REQUIRED
# ============================================
DATABASE_URL="postgresql://postgres.mdcmexgjqjyyaallrimg:reborn-r8-gg@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# ============================================
# Contract Addresses (BSC Testnet) - REQUIRED
# ============================================
NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET="0x6F42EC722461Eb6fDe4B4cD8793b297eB34924F7"
NEXT_PUBLIC_POOL_REGISTRY_ADDRESS_TESTNET="0x785FAE9B7C7801173bc1Dc1e38A9ae827137abBc"
NEXT_PUBLIC_WBNB_ADDRESS_TESTNET="0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"

# ============================================
# RPC Configuration - REQUIRED
# ============================================
NEXT_PUBLIC_BSC_TESTNET_RPC_URL="https://data-seed-prebsc-1-s1.binance.org:8545"
NEXT_PUBLIC_BSC_TESTNET_CHAIN_ID="97"

# ============================================
# Indexer Configuration - REQUIRED
# ============================================
INDEXER_ENABLED="true"                    # Must be "true" to run
INDEXER_POLL_INTERVAL="5000"              # Poll interval in ms (default: 5000)
INDEXER_START_BLOCK="0"                   # Block to start indexing from (default: 0)
HEALTH_PORT="8080"                        # Health check server port
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET` | **Yes** | - | TokenFactory contract |
| `NEXT_PUBLIC_WBNB_ADDRESS_TESTNET` | **Yes** | - | WBNB token address |
| `NEXT_PUBLIC_BSC_TESTNET_RPC_URL` | **Yes** | - | BSC RPC endpoint |
| `NEXT_PUBLIC_BSC_TESTNET_CHAIN_ID` | No | `97` | Chain ID |
| `INDEXER_ENABLED` | **Yes** | `false` | Must be `true` |
| `INDEXER_POLL_INTERVAL` | No | `5000` | Poll interval (ms) |
| `INDEXER_START_BLOCK` | No | `0` | Starting block |
| `HEALTH_PORT` | No | `8080` | Health server port |

### Running Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run the indexer (requires INDEXER_ENABLED=true)
npm run indexer:dev

# Or run with explicit env vars
INDEXER_ENABLED=true DATABASE_URL="..." npm run indexer
```

### Running Metrics Refresh Standalone

```bash
# One-time metrics refresh (useful for testing)
npm run refresh-metrics
```

---

## Deployment

### Option 1: Railway from GitHub (Recommended)

Railway provides simple deployment with automatic restarts, logging, and GitHub integration for continuous deployment.

#### Method A: Deploy from GitHub (Recommended)

This method auto-deploys when you push to your repository.

**Step 1: Create Railway Account**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended for easy repo access)

**Step 2: Create New Project from GitHub**
1. Click **"New Project"** in Railway dashboard
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub repositories
4. Select the `robotics-memecoin-launchpad` repository
5. Railway will detect the `Dockerfile.indexer` and `railway.toml`

**Step 3: Configure the Service**
1. After deployment starts, click on the service
2. Go to **Settings** tab
3. Under **Build**, ensure:
   - Builder: `Dockerfile`
   - Dockerfile Path: `Dockerfile.indexer`
4. Under **Deploy**, set:
   - Healthcheck Path: `/health`
   - Restart Policy: `Always`

**Step 4: Configure Environment Variables**
1. Go to **Variables** tab
2. Click **"RAW Editor"** to paste all variables at once, or add individually:

```env
# Required - Database
DATABASE_URL=postgresql://postgres.mdcmexgjqjyyaallrimg:reborn-r8-gg@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Required - Contracts
NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET=0x6F42EC722461Eb6fDe4B4cD8793b297eB34924F7
NEXT_PUBLIC_POOL_REGISTRY_ADDRESS_TESTNET=0x785FAE9B7C7801173bc1Dc1e38A9ae827137abBc
NEXT_PUBLIC_WBNB_ADDRESS_TESTNET=0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd

# Required - RPC
NEXT_PUBLIC_BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
NEXT_PUBLIC_BSC_TESTNET_CHAIN_ID=97

# Required - Indexer
INDEXER_ENABLED=true

# Optional - Indexer Tuning
INDEXER_POLL_INTERVAL=5000
INDEXER_START_BLOCK=0
HEALTH_PORT=8080
NODE_ENV=production
```

**Step 5: Redeploy**
1. After adding variables, click **"Deploy"** to trigger a new deployment
2. Wait for the build to complete (~2-3 minutes)

**Step 6: Verify Deployment**
1. Once deployed, Railway provides a URL like `indexer-production-xxxx.up.railway.app`
2. Test health endpoint:
   ```bash
   curl https://indexer-production-xxxx.up.railway.app/health
   ```

#### Method B: Deploy from CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login (opens browser)
railway login

# Link to existing project OR create new one
railway link   # If you already created a project in dashboard
# OR
railway init   # To create a new project

# Deploy
railway up

# Set variables
railway variables set DATABASE_URL="postgresql://postgres.mdcmexgjqjyyaallrimg:reborn-r8-gg@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
railway variables set NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET="0x6F42EC722461Eb6fDe4B4cD8793b297eB34924F7"
railway variables set NEXT_PUBLIC_BSC_TESTNET_RPC_URL="https://data-seed-prebsc-1-s1.bnbchain.org:8545"
railway variables set INDEXER_ENABLED="true"

# Trigger redeploy after setting variables
railway up
```

#### Railway Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (Supabase) |
| `NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET` | Yes | - | TokenFactory contract address |
| `NEXT_PUBLIC_WBNB_ADDRESS_TESTNET` | Yes | - | WBNB token address |
| `NEXT_PUBLIC_BSC_TESTNET_RPC_URL` | Yes | `https://data-seed-prebsc-1-s1.bnbchain.org:8545` | BSC RPC endpoint |
| `NEXT_PUBLIC_BSC_TESTNET_CHAIN_ID` | No | `97` | Chain ID (97=testnet, 56=mainnet) |
| `INDEXER_ENABLED` | Yes | `false` | Must be `true` to run |
| `INDEXER_POLL_INTERVAL` | No | `5000` | Polling interval in ms |
| `INDEXER_START_BLOCK` | No | `0` | Block to start indexing from |
| `HEALTH_PORT` | No | `8080` | Health check server port |
| `NODE_ENV` | No | `production` | Node environment |

#### Railway Monitoring

**View Logs:**
- Dashboard: Click on service → **Deployments** → Select deployment → **View Logs**
- CLI: `railway logs`

**Check Metrics:**
- Dashboard shows CPU, Memory, Network usage
- Health endpoint: `https://your-app.up.railway.app/health`

**Redeploy:**
- Push to GitHub (auto-deploys if connected)
- Dashboard: Click **"Deploy"** button
- CLI: `railway up`

#### Railway Costs

| Plan | Hours/Month | Cost | Best For |
|------|-------------|------|----------|
| Free | 500 | $0 | Testing |
| Hobby | Unlimited | $5/month | Production |
| Pro | Unlimited | $20/month | Teams |

The indexer typically uses <$5/month on the Hobby plan.

#### Railway Troubleshooting

**Build Fails:**
- Check build logs for errors
- Ensure `Dockerfile.indexer` exists in repo root
- Verify `railway.toml` is committed

**Service Crashes:**
- Check logs for error messages
- Verify all required environment variables are set
- Check DATABASE_URL connectivity

**Health Check Fails:**
- Ensure `HEALTH_PORT=8080` matches Dockerfile EXPOSE
- Check that the indexer starts successfully
- Verify health endpoint returns 200

### Option 2: Docker

#### Build and Run

```bash
# Build image
docker build -f Dockerfile.indexer -t robolaunch-indexer .

# Run container
docker run -d \
  --name indexer \
  -e DATABASE_URL="postgresql://..." \
  -e INDEXER_ENABLED=true \
  -e NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET="0x..." \
  -p 8080:8080 \
  --restart unless-stopped \
  robolaunch-indexer
```

#### Using Docker Compose

```bash
# Create .env file with your variables, then:
docker-compose -f docker-compose.indexer.yml up -d

# View logs
docker-compose -f docker-compose.indexer.yml logs -f

# Stop
docker-compose -f docker-compose.indexer.yml down
```

### Option 3: VPS with PM2

```bash
# Install PM2
npm install -g pm2

# Start indexer
pm2 start npm --name "indexer" -- run indexer

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### Option 4: Kubernetes

Create a deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: robolaunch-indexer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: indexer
  template:
    metadata:
      labels:
        app: indexer
    spec:
      containers:
      - name: indexer
        image: robolaunch-indexer:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: indexer-secrets
              key: database-url
        - name: INDEXER_ENABLED
          value: "true"
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /live
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
```

---

## Health Monitoring

### Endpoints

| Endpoint | Purpose | Success Code | Failure Code |
|----------|---------|--------------|--------------|
| `/health` | Full status JSON | 200 | 503 |
| `/ready` | Readiness probe | 200 | 503 |
| `/live` | Liveness probe | 200 | - |

### Health Response Example

```json
{
  "status": "healthy",
  "uptime": 3600,
  "lastBlock": "12345678",
  "cycleCount": 720
}
```

### Unhealthy Response Example

```json
{
  "status": "unhealthy",
  "uptime": 3650,
  "lastBlock": "12345678",
  "lastError": "RPC request failed: rate limited",
  "lastErrorAt": "2024-01-15T10:30:00.000Z",
  "cycleCount": 730
}
```

### Monitoring with curl

```bash
# Check health
curl http://localhost:8080/health

# Check readiness
curl http://localhost:8080/ready

# Check liveness
curl http://localhost:8080/live
```

---

## Database Tables

### IndexerState

Tracks the last processed block for each contract/event combination:

```sql
SELECT * FROM "IndexerState" ORDER BY "lastIndexedAt" DESC;
```

### Checking Indexer Progress

```sql
-- Last indexed blocks per contract
SELECT
  "contractAddress",
  "eventType",
  "lastIndexedBlock",
  "lastIndexedAt",
  "errorCount",
  "lastError"
FROM "IndexerState"
ORDER BY "lastIndexedAt" DESC;

-- Recent trades
SELECT * FROM "Trade" ORDER BY "blockTimestamp" DESC LIMIT 10;

-- Price candles for a token
SELECT * FROM "PriceHistory"
WHERE "tokenId" = 'your-token-id'
  AND "interval" = 3600
ORDER BY "timestamp" DESC
LIMIT 24;
```

---

## Troubleshooting

### Indexer Won't Start

1. **Check INDEXER_ENABLED**
   ```bash
   echo $INDEXER_ENABLED  # Should be "true"
   ```

2. **Check DATABASE_URL**
   ```bash
   # Test database connection
   npx prisma db pull
   ```

3. **Check RPC connectivity**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     https://data-seed-prebsc-1-s1.bnbchain.org:8545
   ```

### Indexer Stops Processing

1. **Check health endpoint**
   ```bash
   curl http://localhost:8080/health
   ```

2. **Check IndexerState for errors**
   ```sql
   SELECT * FROM "IndexerState" WHERE "errorCount" > 0;
   ```

3. **Check logs for RPC errors**
   - Rate limiting: Consider using a private RPC endpoint
   - Connection timeouts: Check network connectivity

### Missing Data

1. **Check if token exists in database**
   ```sql
   SELECT * FROM "Token" WHERE "tokenAddress" = '0x...';
   ```

2. **Check indexer start block**
   - If `INDEXER_START_BLOCK` is set too high, events may be missed
   - Run backfill to recover missing events (see Future Enhancements)

3. **Check IndexerState for the specific contract**
   ```sql
   SELECT * FROM "IndexerState"
   WHERE "contractAddress" = '0x...' AND "eventType" = 'Swap';
   ```

### High Memory Usage

1. **Check for connection pool leaks**
   - The indexer uses a single Prisma client
   - If memory grows unbounded, restart the indexer

2. **Reduce batch sizes** (if processing many tokens)
   - Edit `refresh-metrics.ts` and reduce `batchSize` from 10 to 5

---

## Future Enhancements (Phases 4-5)

### Phase 4: Real-Time WebSocket Layer

Add instant price updates without polling:

```typescript
// scripts/indexer/realtime.ts
import { watchContractEvent } from 'viem'

publicClient.watchContractEvent({
  address: poolAddress,
  abi: WeightedPoolABI,
  eventName: 'Swap',
  onLogs: async (logs) => {
    // Process immediately
    // Broadcast to WebSocket clients
  }
})
```

**Benefits:**
- Sub-second price updates
- Reduced database polling load
- Better UX for active traders

### Phase 5: Historical Backfill & Recovery

Add ability to sync from genesis and fill gaps:

```bash
# Backfill all events from block 0
npm run indexer:backfill -- --from-block 0 --to-block latest

# Check for gaps in indexed blocks
npm run indexer:check-gaps

# Fill detected gaps
npm run indexer:fill-gaps
```

**Use cases:**
- Recover from extended downtime
- Index a new token from its creation
- Verify data integrity

---

## File Reference

| File | Purpose |
|------|---------|
| `scripts/indexer/index.ts` | Main indexer loop |
| `scripts/indexer/refresh-metrics.ts` | Metrics aggregation |
| `scripts/indexer/health.ts` | Health check HTTP server |
| `Dockerfile.indexer` | Container image definition |
| `docker-compose.indexer.yml` | Local Docker testing |
| `railway.toml` | Railway deployment config |
| `lib/db/price-history.ts` | OHLCV candle functions |
| `lib/db/trades.ts` | Trade database functions |
| `lib/db/tokens.ts` | Token database functions |

---

## Performance Considerations

### RPC Rate Limits

Public BSC RPC endpoints have rate limits. For production:
- Use a private RPC provider (Ankr, QuickNode, Alchemy)
- Increase `INDEXER_POLL_INTERVAL` to reduce requests
- Consider batching `getLogs` calls

### Database Connections

The indexer maintains a single Prisma connection pool. For high-volume scenarios:
- Increase PostgreSQL `max_connections`
- Use connection pooling (PgBouncer, Supabase pooler)
- Monitor connection count in Supabase dashboard

### Memory Usage

Expected memory usage: 100-200MB

If processing many tokens (100+):
- Consider processing tokens in smaller batches
- Implement pagination for large datasets
- Monitor with `docker stats` or Railway metrics

---

## Integration with Vercel Frontend

The indexer and the Next.js frontend share the same Supabase PostgreSQL database:

```
┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │   Railway       │
│   (Frontend)    │     │   (Indexer)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    Same DATABASE_URL  │
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
            ┌────────────────┐
            │   Supabase     │
            │   PostgreSQL   │
            └────────────────┘
```

**Key Points:**
- Both services use the same `DATABASE_URL`
- Vercel: Hosts the Next.js app (reads from database)
- Railway: Runs the indexer (writes to database)
- Supabase: Provides PostgreSQL with connection pooling

**Syncing Environment Variables:**

If you update contract addresses or RPC URLs, update them in:
1. Vercel dashboard (for frontend)
2. Railway dashboard (for indexer)
3. Local `.env` file (for development)

---

## Security Notes

1. **Never commit `.env` files** - Contains database credentials
2. **Use secrets management** - Railway variables, Kubernetes secrets, etc.
3. **Non-root container** - Dockerfile creates `indexer` user
4. **Database permissions** - Consider read-only user for indexer if not creating tokens

---

## Support

For issues or questions:
- Check existing GitHub issues
- Review logs for error messages
- Verify environment variables are set correctly

















