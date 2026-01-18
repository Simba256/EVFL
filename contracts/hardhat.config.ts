import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const BSC_TESTNET_RPC = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const BSC_MAINNET_RPC = process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed.bnbchain.org";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC,
      chainId: 97,
      accounts: [PRIVATE_KEY],
      gasPrice: 10000000000, // 10 gwei
    },
    bscMainnet: {
      url: BSC_MAINNET_RPC,
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gasPrice: 3000000000, // 3 gwei
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },
};

export default config;
