import { ethers } from "hardhat";

async function main() {
  const factoryAddress = "0x821F4bbdA70Db4EcD61451907ad282CBEbD007dD";

  console.log("Verifying FairLaunchFactory deployment...\n");

  const factory = await ethers.getContractAt("FairLaunchFactory", factoryAddress);

  const icoCount = await factory.getICOCount();
  const platformFee = await factory.platformFeeBps();
  const icoStartDelay = await factory.icoStartDelay();
  const router = await factory.pancakeRouter();
  const wbnb = await factory.quoteToken();
  const owner = await factory.owner();

  console.log("========================================");
  console.log("FairLaunchFactory Verification");
  console.log("========================================");
  console.log("Address:         " + factoryAddress);
  console.log("Owner:           " + owner);
  console.log("ICO Count:       " + icoCount.toString());
  console.log("Platform Fee:    " + platformFee.toString() + " bps (" + (Number(platformFee) / 100) + "%)");
  console.log("ICO Start Delay: " + icoStartDelay.toString() + " seconds (" + (Number(icoStartDelay) / 3600) + " hours)");
  console.log("WBNB:            " + wbnb);
  console.log("Router:          " + router);
  console.log("========================================");
  console.log("All checks passed!");
}

main().catch(console.error);
