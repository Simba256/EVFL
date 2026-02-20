import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing Fair Launch with LP using account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB\n");

  // Get factory contract
  const factoryAddress = "0x69895E20e7572D26005C03bBD11ccf3b4bA23b98";
  const factory = await ethers.getContractAt("FairLaunchFactory", factoryAddress);

  console.log("=== Factory Info ===");
  console.log("Address:", factoryAddress);
  console.log("PancakeSwap Router:", await factory.pancakeRouter());
  console.log("Platform Fee:", (await factory.platformFeeBps()).toString(), "bps");
  console.log("MIN_RAISE:", ethers.formatEther(await factory.MIN_RAISE()), "BNB");

  // Create test Fair Launch with LP enabled
  console.log("\n=== Creating Test Fair Launch with LP ===");

  const launchParams = {
    name: "TestLP Token",
    symbol: "TESTLP",
    imageURI: "",
    description: "Testing LP creation on finalize",
    tokenSupply: ethers.parseEther("1000000"), // 1M tokens
    minimumRaise: ethers.parseEther("0.1"), // 0.1 BNB minimum
    icoDuration: BigInt(86400), // 1 day
    teamTokensBps: BigInt(0), // No team tokens
    teamWallet: ethers.ZeroAddress,
    monthlyBudget: BigInt(0),
    treasuryOwner: deployer.address,
    lpBnbBps: BigInt(3000), // 30% of BNB for LP
    lpTokensBps: BigInt(3000), // 30% of tokens for LP
  };

  console.log("Launch Params:");
  console.log("  - Name:", launchParams.name);
  console.log("  - Symbol:", launchParams.symbol);
  console.log("  - Token Supply:", ethers.formatEther(launchParams.tokenSupply));
  console.log("  - Minimum Raise:", ethers.formatEther(launchParams.minimumRaise), "BNB");
  console.log("  - Duration:", Number(launchParams.icoDuration) / 86400, "days");
  console.log("  - LP BNB %:", Number(launchParams.lpBnbBps) / 100, "%");
  console.log("  - LP Tokens %:", Number(launchParams.lpTokensBps) / 100, "%");

  console.log("\nSending transaction...");
  const tx = await factory.createFairLaunch(launchParams);
  console.log("Tx hash:", tx.hash);

  const receipt = await tx.wait();
  console.log("Tx confirmed in block:", receipt?.blockNumber);

  // Parse events to get addresses
  const fairLaunchCreatedEvent = receipt?.logs.find((log: any) => {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
      return parsed?.name === "FairLaunchCreated";
    } catch {
      return false;
    }
  });

  if (fairLaunchCreatedEvent) {
    const parsed = factory.interface.parseLog({
      topics: fairLaunchCreatedEvent.topics as string[],
      data: fairLaunchCreatedEvent.data
    });

    console.log("\n=== Fair Launch Created ===");
    console.log("ICO Address:", parsed?.args.ico);
    console.log("Token Address:", parsed?.args.token);
    console.log("Treasury Address:", parsed?.args.treasury);

    // Get ICO contract and verify LP config
    const icoAddress = parsed?.args.ico;
    const ico = await ethers.getContractAt("ICOContract", icoAddress);

    console.log("\n=== ICO Contract Verification ===");
    console.log("Token Supply:", ethers.formatEther(await ico.tokenSupply()));
    console.log("Minimum Raise:", ethers.formatEther(await ico.minimumRaise()), "BNB");
    console.log("Router:", await ico.router());
    console.log("LP BNB Bps:", (await ico.lpBnbBps()).toString());
    console.log("LP Tokens:", ethers.formatEther(await ico.lpTokens()));
    console.log("Start Time:", new Date(Number(await ico.startTime()) * 1000).toISOString());
    console.log("End Time:", new Date(Number(await ico.endTime()) * 1000).toISOString());
    console.log("Status:", await ico.status());
  }

  // Check ICO count
  const icoCount = await factory.getICOCount();
  console.log("\n=== Factory Stats ===");
  console.log("Total ICOs:", icoCount.toString());

  console.log("\n=== Test Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
