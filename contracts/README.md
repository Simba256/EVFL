# RoboLaunch Smart Contracts

Solidity smart contracts for the RoboLaunch memecoin launchpad. Uses Balancer-style weighted pools on BSC.

## Contracts

| Contract | Description |
|----------|-------------|
| `LaunchToken.sol` | ERC20 token deployed for each memecoin |
| `WeightedPool.sol` | Balancer-style AMM with configurable weights |
| `WeightedMath.sol` | Math library for weighted pool calculations |
| `TokenFactory.sol` | Factory for creating tokens and pools |
| `PoolRegistry.sol` | Central registry for all pools |
| `WBNB.sol` | Wrapped BNB (for testing only) |

## Setup

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with your private key
```

## Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Deploy to BSC Testnet
npm run deploy:testnet

# Deploy to BSC Mainnet
npm run deploy:mainnet

# Start local node
npm run node
```

## Configuration

Edit `.env` file:

```env
DEPLOYER_PRIVATE_KEY=your_private_key_here
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BSCSCAN_API_KEY=your_bscscan_api_key
```

## Getting BSC Testnet BNB

1. Go to [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)
2. Enter your wallet address
3. Receive test BNB

## Weighted Pool Math

The pools use Balancer's weighted pool formula:

**Spot Price:**
```
spotPrice = (balanceIn / weightIn) / (balanceOut / weightOut)
```

**Swap Out Given In:**
```
amountOut = balanceOut * (1 - (balanceIn / (balanceIn + amountIn))^(weightIn/weightOut))
```

**Example:** With 80/20 weights (80% token, 20% BNB):
- Lower BNB requirement for initial liquidity
- Token price more sensitive to BNB trades
- Good for memecoin launches where token supply is high

## Deployment Flow

1. Deploy `PoolRegistry`
2. Deploy `TokenFactory` with registry address
3. Authorize factory in registry
4. Users can now create tokens via factory

## Creating a Token

```solidity
factory.createToken(
    "MyToken",           // name
    "MTK",               // symbol
    "ipfs://...",        // metadata URI
    1_000_000e18,        // initial supply (1M tokens)
    1e18,                // initial BNB liquidity (1 BNB)
    0.8e18,              // token weight (80%)
    { value: launchFee }
);
```

## Security Notes

- Contracts are NOT audited - use at your own risk
- Test thoroughly on testnet before mainnet deployment
- Review all parameters before deployment
