import { ethers, network, run } from "hardhat";

// Chain configurations for deployment
const CHAIN_CONFIG: Record<string, {
  name: string;
  weth: string;
  router: string;
  isTestnet: boolean;
}> = {
  // BSC
  bscTestnet: {
    name: "BSC Testnet",
    weth: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", // WBNB
    router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", // PancakeSwap Testnet
    isTestnet: true,
  },
  bscMainnet: {
    name: "BSC Mainnet",
    weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
    isTestnet: false,
  },
  // Base
  baseSepolia: {
    name: "Base Sepolia",
    weth: "0x4200000000000000000000000000000000000006", // WETH
    router: "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602", // Uniswap V2 on Base Sepolia
    isTestnet: true,
  },
  baseMainnet: {
    name: "Base Mainnet",
    weth: "0x4200000000000000000000000000000000000006", // WETH
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", // Uniswap V2
    isTestnet: false,
  },
  // Arbitrum
  arbitrumSepolia: {
    name: "Arbitrum Sepolia",
    weth: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
    router: "0x101F443B4d1b059569D643917553c771E1b9663E", // Uniswap V2 on Arb Sepolia
    isTestnet: true,
  },
  arbitrumMainnet: {
    name: "Arbitrum One",
    weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", // Uniswap V2
    isTestnet: false,
  },
};

async function main() {
  const networkName = network.name;
  const config = CHAIN_CONFIG[networkName];

  if (!config) {
    console.error(`Unknown network: ${networkName}`);
    console.log("Supported networks:", Object.keys(CHAIN_CONFIG).join(", "));
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("========================================");
  console.log(`Deploying to ${config.name}`);
  console.log("========================================");
  console.log(`Network:  ${networkName}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH/BNB`);
  console.log(`WETH:     ${config.weth}`);
  console.log(`Router:   ${config.router}`);
  console.log("========================================\n");

  // Check balance
  if (balance < ethers.parseEther("0.01")) {
    console.error("Insufficient balance for deployment. Need at least 0.01 ETH/BNB");
    process.exit(1);
  }

  // Deploy FairLaunchFactory
  console.log("Deploying FairLaunchFactory...");
  const FairLaunchFactory = await ethers.getContractFactory("FairLaunchFactory");
  const factory = await FairLaunchFactory.deploy(config.weth, config.router);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log(`FairLaunchFactory deployed to: ${factoryAddress}\n`);

  // Wait for confirmations before verification
  console.log("Waiting for block confirmations...");
  await factory.deploymentTransaction()?.wait(5);

  // Verify contract
  if (config.isTestnet || process.env.VERIFY_ON_MAINNET === "true") {
    console.log("Verifying contract on block explorer...");
    try {
      await run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [config.weth, config.router],
      });
      console.log("Contract verified successfully!\n");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract already verified.\n");
      } else {
        console.log("Verification failed:", error.message);
        console.log("You can verify manually later.\n");
      }
    }
  }

  // Print summary
  console.log("========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log(`Network:           ${config.name}`);
  console.log(`FairLaunchFactory: ${factoryAddress}`);
  console.log(`WETH/WBNB:         ${config.weth}`);
  console.log(`DEX Router:        ${config.router}`);
  console.log("========================================\n");

  // Print env var for easy copy
  const envVarName = config.isTestnet
    ? `NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_${networkName.toUpperCase()}`
    : `NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_${networkName.toUpperCase()}`;

  console.log("Add to your .env file:");
  console.log("----------------------------------------");
  console.log(`${envVarName}=${factoryAddress}`);
  console.log("----------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
