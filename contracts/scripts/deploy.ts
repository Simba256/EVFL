import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network.name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  // Configuration
  const LAUNCH_FEE = ethers.parseEther("0.01"); // 0.01 BNB launch fee
  const FEE_RECIPIENT = deployer.address; // Change for production

  // WBNB addresses
  const WBNB_ADDRESSES: { [key: string]: string } = {
    bscMainnet: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    bscTestnet: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", // BSC Testnet WBNB
    hardhat: "", // Will be deployed
    localhost: "", // Will be deployed
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

  // Deploy PoolRegistry
  console.log("\nDeploying PoolRegistry...");
  const PoolRegistry = await ethers.getContractFactory("PoolRegistry");
  const registry = await PoolRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("PoolRegistry deployed to:", registryAddress);

  // Deploy TokenFactory
  console.log("\nDeploying TokenFactory...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const factory = await TokenFactory.deploy(
    wbnbAddress,
    registryAddress,
    LAUNCH_FEE,
    FEE_RECIPIENT
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("TokenFactory deployed to:", factoryAddress);

  // Authorize factory in registry
  console.log("\nAuthorizing TokenFactory in PoolRegistry...");
  const authTx = await registry.authorizeFactory(factoryAddress);
  await authTx.wait();
  console.log("TokenFactory authorized");

  // Summary
  console.log("\n========================================");
  console.log("Deployment Summary");
  console.log("========================================");
  console.log("Network:        ", network.name);
  console.log("WBNB:           ", wbnbAddress);
  console.log("PoolRegistry:   ", registryAddress);
  console.log("TokenFactory:   ", factoryAddress);
  console.log("Launch Fee:     ", ethers.formatEther(LAUNCH_FEE), "BNB");
  console.log("Fee Recipient:  ", FEE_RECIPIENT);
  console.log("========================================");

  // Output for .env file
  console.log("\nAdd to your .env file:");
  console.log("----------------------------------------");
  if (network.name === "bscTestnet") {
    console.log(`NEXT_PUBLIC_WBNB_ADDRESS_TESTNET=${wbnbAddress}`);
    console.log(`NEXT_PUBLIC_POOL_REGISTRY_ADDRESS_TESTNET=${registryAddress}`);
    console.log(`NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS_TESTNET=${factoryAddress}`);
  } else if (network.name === "bscMainnet") {
    console.log(`NEXT_PUBLIC_WBNB_ADDRESS=${wbnbAddress}`);
    console.log(`NEXT_PUBLIC_POOL_REGISTRY_ADDRESS=${registryAddress}`);
    console.log(`NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=${factoryAddress}`);
  } else {
    console.log(`WBNB_ADDRESS=${wbnbAddress}`);
    console.log(`POOL_REGISTRY_ADDRESS=${registryAddress}`);
    console.log(`TOKEN_FACTORY_ADDRESS=${factoryAddress}`);
  }
  console.log("----------------------------------------");

  return {
    wbnb: wbnbAddress,
    registry: registryAddress,
    factory: factoryAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
