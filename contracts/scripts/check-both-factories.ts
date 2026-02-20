import { ethers } from "hardhat";

async function main() {
  const OLD_FACTORY = "0x69895E20e7572D26005C03bBD11ccf3b4bA23b98";
  const NEW_FACTORY = "0x821F4bbdA70Db4EcD61451907ad282CBEbD007dD";

  console.log("=== CHECKING BOTH FACTORIES ===\n");

  console.log("OLD Factory:", OLD_FACTORY);
  const oldFactory = await ethers.getContractAt("FairLaunchFactory", OLD_FACTORY);
  const oldCount = await oldFactory.getICOCount();
  console.log("  ICO Count:", oldCount.toString());

  if (oldCount > 0) {
    const oldICOs = await oldFactory.getICOs(0, 10);
    console.log("  ICO Addresses:");
    for (const ico of oldICOs) {
      console.log("    -", ico);
      const info = await oldFactory.getLaunchInfo(ico);
      console.log("      Name:", info.name);
      console.log("      Symbol:", info.symbol);
      console.log("      Token:", info.token);
    }
  }

  console.log("\nNEW Factory:", NEW_FACTORY);
  const newFactory = await ethers.getContractAt("FairLaunchFactory", NEW_FACTORY);
  const newCount = await newFactory.getICOCount();
  console.log("  ICO Count:", newCount.toString());

  if (newCount > 0) {
    const newICOs = await newFactory.getICOs(0, 10);
    console.log("  ICO Addresses:");
    for (const ico of newICOs) {
      console.log("    -", ico);
      const info = await newFactory.getLaunchInfo(ico);
      console.log("      Name:", info.name);
      console.log("      Symbol:", info.symbol);
      console.log("      Token:", info.token);
    }
  }
}

main().catch(console.error);
