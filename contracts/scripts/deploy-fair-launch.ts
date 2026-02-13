import { ethers, network, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying FairLaunchFactory with account:", deployer.address);
  console.log("Network:", network.name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  // WBNB addresses
  const WBNB_ADDRESSES: { [key: string]: string } = {
    bscMainnet: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    bscTestnet: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    hardhat: "",
    localhost: "",
  };

  // PancakeSwap Router addresses
  const PANCAKE_ROUTER_ADDRESSES: { [key: string]: string } = {
    bscMainnet: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2 Router
    bscTestnet: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", // PancakeSwap V2 Router (Testnet)
    hardhat: "",
    localhost: "",
  };

  let wbnbAddress = WBNB_ADDRESSES[network.name];
  let pancakeRouterAddress = PANCAKE_ROUTER_ADDRESSES[network.name];

  // Deploy WBNB for local testing
  if (!wbnbAddress) {
    console.log("\nDeploying WBNB for testing...");
    const WBNB = await ethers.getContractFactory("WBNB");
    const wbnb = await WBNB.deploy();
    await wbnb.waitForDeployment();
    wbnbAddress = await wbnb.getAddress();
    console.log("WBNB deployed to:", wbnbAddress);
    // For local testing, set router to zero address (LP disabled)
    pancakeRouterAddress = ethers.ZeroAddress;
  } else {
    console.log("\nUsing existing WBNB at:", wbnbAddress);
    console.log("Using PancakeSwap Router at:", pancakeRouterAddress || "not set");
  }

  // Deploy FairLaunchFactory
  console.log("\nDeploying FairLaunchFactory...");
  const FairLaunchFactory = await ethers.getContractFactory("FairLaunchFactory");
  const factory = await FairLaunchFactory.deploy(
    wbnbAddress,
    pancakeRouterAddress || ethers.ZeroAddress
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("FairLaunchFactory deployed to:", factoryAddress);

  // Verify contracts on BscScan (skip for local networks)
  if (network.name === "bscTestnet" || network.name === "bscMainnet") {
    console.log("\nWaiting for block confirmations before verification...");
    // Wait for 5 block confirmations
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("\nVerifying FairLaunchFactory on BscScan...");
    try {
      await run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [wbnbAddress, pancakeRouterAddress || ethers.ZeroAddress],
      });
      console.log("FairLaunchFactory verified successfully!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("FairLaunchFactory already verified");
      } else {
        console.log("Verification failed:", error.message);
        console.log("You can verify manually with:");
        console.log(`npx hardhat verify --network ${network.name} ${factoryAddress} ${wbnbAddress} ${pancakeRouterAddress}`);
      }
    }
  }

  // Summary
  console.log("\n========================================");
  console.log("Fair Launch Factory Deployment Summary");
  console.log("========================================");
  console.log("Network:             ", network.name);
  console.log("WBNB:                ", wbnbAddress);
  console.log("PancakeSwap Router:  ", pancakeRouterAddress || "not set");
  console.log("FairLaunchFactory:   ", factoryAddress);
  console.log("Platform Fee:         1% (100 bps)");
  console.log("Min Duration:         1 day");
  console.log("Max Duration:         14 days");
  console.log("Min Raise:            0.1 BNB");
  console.log("LP Support:           Enabled (if router set)");
  console.log("========================================");

  // Output for .env file
  console.log("\nAdd to your .env.local file:");
  console.log("----------------------------------------");
  if (network.name === "bscTestnet") {
    console.log(`NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_ADDRESS_TESTNET=${factoryAddress}`);
  } else if (network.name === "bscMainnet") {
    console.log(`NEXT_PUBLIC_FAIR_LAUNCH_FACTORY_ADDRESS=${factoryAddress}`);
  } else {
    console.log(`FAIR_LAUNCH_FACTORY_ADDRESS=${factoryAddress}`);
  }
  console.log("----------------------------------------");

  return {
    wbnb: wbnbAddress,
    factory: factoryAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
