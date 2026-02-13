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

  let wbnbAddress = WBNB_ADDRESSES[network.name];

  // Deploy WBNB for local testing
  if (!wbnbAddress) {
    console.log("\nDeploying WBNB for testing...");
    const WBNB = await ethers.getContractFactory("WBNB");
    const wbnb = await WBNB.deploy();
    await wbnb.waitForDeployment();
    wbnbAddress = await wbnb.getAddress();
    console.log("WBNB deployed to:", wbnbAddress);
  } else {
    console.log("\nUsing existing WBNB at:", wbnbAddress);
  }

  // Deploy FairLaunchFactory
  console.log("\nDeploying FairLaunchFactory...");
  const FairLaunchFactory = await ethers.getContractFactory("FairLaunchFactory");
  const factory = await FairLaunchFactory.deploy(wbnbAddress);
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
        constructorArguments: [wbnbAddress],
      });
      console.log("FairLaunchFactory verified successfully!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("FairLaunchFactory already verified");
      } else {
        console.log("Verification failed:", error.message);
        console.log("You can verify manually with:");
        console.log(`npx hardhat verify --network ${network.name} ${factoryAddress} ${wbnbAddress}`);
      }
    }
  }

  // Summary
  console.log("\n========================================");
  console.log("Fair Launch Factory Deployment Summary");
  console.log("========================================");
  console.log("Network:             ", network.name);
  console.log("WBNB:                ", wbnbAddress);
  console.log("FairLaunchFactory:   ", factoryAddress);
  console.log("Platform Fee:         1% (100 bps)");
  console.log("Min Duration:         1 day");
  console.log("Max Duration:         14 days");
  console.log("Min Raise:            10 BNB");
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
