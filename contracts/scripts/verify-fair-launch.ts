import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractAt("FairLaunchFactory", "0x69895E20e7572D26005C03bBD11ccf3b4bA23b98");

  console.log("\n=== FairLaunchFactory Verification ===");
  console.log("Address:", "0x69895E20e7572D26005C03bBD11ccf3b4bA23b98");
  console.log("Platform Fee (bps):", (await factory.platformFeeBps()).toString());
  console.log("MIN_RAISE:", ethers.formatEther(await factory.MIN_RAISE()), "BNB");
  console.log("MIN_DURATION:", Number(await factory.MIN_DURATION()) / 86400, "days");
  console.log("MAX_DURATION:", Number(await factory.MAX_DURATION()) / 86400, "days");

  const icoCount = await factory.getICOCount();
  console.log("ICO Count:", icoCount.toString());

  if (icoCount > 0) {
    const icos = await factory.getICOs(0, 10);
    console.log("\n=== ICOs ===");
    for (const ico of icos) {
      console.log("ICO Address:", ico);
      const info = await factory.getLaunchInfo(ico);
      console.log("  Token:", info.token);
      console.log("  Treasury:", info.treasury);
      console.log("  Creator:", info.creator);
      console.log("  Name:", info.name);
      console.log("  Symbol:", info.symbol);
      console.log("  Created At:", new Date(Number(info.createdAt) * 1000).toISOString());
    }
  }

  console.log("\nQuote Token (WBNB):", await factory.quoteToken());
  console.log("PancakeSwap Router:", await factory.pancakeRouter());
  console.log("Owner:", await factory.owner());
  console.log("=== Verification Complete ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
