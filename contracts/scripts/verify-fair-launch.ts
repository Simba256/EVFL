import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractAt("FairLaunchFactory", "0xfCE25F103CeB934Da891f9C5843112952a2d5fA2");

  console.log("\n=== FairLaunchFactory Verification ===");
  console.log("Address:", "0xfCE25F103CeB934Da891f9C5843112952a2d5fA2");
  console.log("Platform Fee (bps):", (await factory.platformFeeBps()).toString());
  console.log("MIN_RAISE:", ethers.formatEther(await factory.MIN_RAISE()), "BNB");
  console.log("MIN_DURATION:", Number(await factory.MIN_DURATION()) / 86400, "days");
  console.log("MAX_DURATION:", Number(await factory.MAX_DURATION()) / 86400, "days");
  console.log("ICO Count:", (await factory.getICOCount()).toString());
  console.log("Quote Token (WBNB):", await factory.quoteToken());
  console.log("Owner:", await factory.owner());
  console.log("=== Verification Complete ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
