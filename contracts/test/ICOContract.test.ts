import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ICOContract, LaunchToken, Treasury } from "../typechain-types";

describe("ICOContract", function () {
  const ONE_HOUR = 60 * 60;
  const ONE_DAY = 24 * ONE_HOUR;
  const TOKEN_SUPPLY = ethers.parseEther("10000000"); // 10M tokens
  const MINIMUM_RAISE = ethers.parseEther("10"); // 10 BNB
  const PLATFORM_FEE_BPS = 100n; // 1%

  async function deployICOFixture() {
    const [owner, user1, user2, user3, treasury, factory] = await ethers.getSigners();

    // Deploy token
    const LaunchToken = await ethers.getContractFactory("LaunchToken");
    const token = await LaunchToken.deploy(
      "Test Token",
      "TEST",
      "ipfs://test",
      TOKEN_SUPPLY,
      owner.address
    );

    // Get times
    const startTime = await time.latest() + ONE_HOUR;
    const endTime = startTime + ONE_DAY * 4; // 4-day ICO

    // Deploy ICO contract
    const ICOContract = await ethers.getContractFactory("ICOContract");
    const ico = await ICOContract.deploy({
      token: await token.getAddress(),
      treasury: treasury.address,
      factory: factory.address,
      tokenSupply: TOKEN_SUPPLY,
      minimumRaise: MINIMUM_RAISE,
      startTime: startTime,
      endTime: endTime,
      platformFeeBps: PLATFORM_FEE_BPS,
      teamTokens: 0, // No team tokens
      teamWallet: ethers.ZeroAddress,
      router: ethers.ZeroAddress,
      lpBnbBps: 0,
      lpTokens: 0,
    });

    // Transfer tokens to ICO contract
    await token.transfer(await ico.getAddress(), TOKEN_SUPPLY);

    return { ico, token, owner, user1, user2, user3, treasury, factory, startTime, endTime };
  }

  describe("Deployment", function () {
    it("should set correct initial state", async function () {
      const { ico, token, treasury, factory } = await loadFixture(deployICOFixture);

      expect(await ico.token()).to.equal(await token.getAddress());
      expect(await ico.treasury()).to.equal(treasury.address);
      expect(await ico.factory()).to.equal(factory.address);
      expect(await ico.tokenSupply()).to.equal(TOKEN_SUPPLY);
      expect(await ico.minimumRaise()).to.equal(MINIMUM_RAISE);
      expect(await ico.status()).to.equal(0); // PENDING
      expect(await ico.totalCommitted()).to.equal(0);
    });

    it("should reject invalid token address", async function () {
      const [owner, treasury, factory] = await ethers.getSigners();
      const startTime = await time.latest() + ONE_HOUR;
      const endTime = startTime + ONE_DAY;

      const ICOContract = await ethers.getContractFactory("ICOContract");
      await expect(
        ICOContract.deploy({
          token: ethers.ZeroAddress,
          treasury: treasury.address,
          factory: factory.address,
          tokenSupply: TOKEN_SUPPLY,
          minimumRaise: MINIMUM_RAISE,
          startTime: startTime,
          endTime: endTime,
          platformFeeBps: PLATFORM_FEE_BPS,
          teamTokens: 0,
          teamWallet: ethers.ZeroAddress,
          router: ethers.ZeroAddress,
          lpBnbBps: 0,
          lpTokens: 0,
        })
      ).to.be.revertedWithCustomError(ICOContract, "InvalidConfig");
    });

    it("should reject team allocation > 20%", async function () {
      const [owner, treasury, factory] = await ethers.getSigners();
      const startTime = await time.latest() + ONE_HOUR;
      const endTime = startTime + ONE_DAY;

      const LaunchToken = await ethers.getContractFactory("LaunchToken");
      const token = await LaunchToken.deploy("Test", "TEST", "", TOKEN_SUPPLY, owner.address);

      const teamTokens = (TOKEN_SUPPLY * 21n) / 100n; // 21% - too high

      const ICOContract = await ethers.getContractFactory("ICOContract");
      await expect(
        ICOContract.deploy({
          token: await token.getAddress(),
          treasury: treasury.address,
          factory: factory.address,
          tokenSupply: TOKEN_SUPPLY,
          minimumRaise: MINIMUM_RAISE,
          startTime: startTime,
          endTime: endTime,
          platformFeeBps: PLATFORM_FEE_BPS,
          teamTokens: teamTokens,
          teamWallet: owner.address,
          router: ethers.ZeroAddress,
          lpBnbBps: 0,
          lpTokens: 0,
        })
      ).to.be.revertedWithCustomError(ICOContract, "InvalidConfig");
    });
  });

  describe("Commitments", function () {
    it("should reject commitments before start time", async function () {
      const { ico, user1 } = await loadFixture(deployICOFixture);

      await expect(
        ico.connect(user1).commit({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(ico, "NotStarted");
    });

    it("should accept commitments after start time", async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      await expect(
        ico.connect(user1).commit({ value: ethers.parseEther("1") })
      ).to.emit(ico, "Committed");

      expect(await ico.commitments(user1.address)).to.equal(ethers.parseEther("1"));
      expect(await ico.totalCommitted()).to.equal(ethers.parseEther("1"));
      expect(await ico.status()).to.equal(1); // ACTIVE
    });

    it("should accumulate multiple commitments from same user", async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      await ico.connect(user1).commit({ value: ethers.parseEther("1") });
      await ico.connect(user1).commit({ value: ethers.parseEther("2") });

      expect(await ico.commitments(user1.address)).to.equal(ethers.parseEther("3"));
      expect(await ico.participantCount()).to.equal(1); // Still 1 participant
    });

    it("should track participant count correctly", async function () {
      const { ico, user1, user2, user3, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      await ico.connect(user1).commit({ value: ethers.parseEther("1") });
      await ico.connect(user2).commit({ value: ethers.parseEther("2") });
      await ico.connect(user3).commit({ value: ethers.parseEther("3") });

      expect(await ico.participantCount()).to.equal(3);
    });

    it("should reject zero value commitment", async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      await expect(
        ico.connect(user1).commit({ value: 0 })
      ).to.be.revertedWithCustomError(ico, "ZeroAmount");
    });

    it("should reject commitments after end time", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("1") });

      await time.increaseTo(endTime + 1);

      await expect(
        ico.connect(user1).commit({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(ico, "AlreadyEnded");
    });
  });

  describe("Finalization", function () {
    it("should finalize successfully when minimum is met", async function () {
      const { ico, user1, user2, treasury, factory, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);

      // Commit more than minimum
      await ico.connect(user1).commit({ value: ethers.parseEther("6") });
      await ico.connect(user2).commit({ value: ethers.parseEther("5") });

      // Move past end time
      await time.increaseTo(endTime + 1);

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      const factoryBalanceBefore = await ethers.provider.getBalance(factory.address);

      await expect(ico.finalize())
        .to.emit(ico, "Finalized");

      expect(await ico.status()).to.equal(2); // FINALIZED

      // Check funds distribution
      const totalRaised = ethers.parseEther("11");
      const platformFee = (totalRaised * PLATFORM_FEE_BPS) / 10000n;
      const treasuryAmount = totalRaised - platformFee;

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      const factoryBalanceAfter = await ethers.provider.getBalance(factory.address);

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(treasuryAmount);
      expect(factoryBalanceAfter - factoryBalanceBefore).to.equal(platformFee);
    });

    it("should reject finalization before end time", async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("15") });

      await expect(ico.finalize()).to.be.revertedWithCustomError(ico, "NotEnded");
    });

    it("should reject finalization if minimum not met", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("5") }); // Below minimum

      await time.increaseTo(endTime + 1);

      await expect(ico.finalize()).to.be.revertedWithCustomError(ico, "MinimumNotMet");
    });

    it("should calculate correct token price", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("20") });

      await time.increaseTo(endTime + 1);
      await ico.finalize();

      // Price = totalCommitted * 1e18 / tokenSupply
      const expectedPrice = (ethers.parseEther("20") * ethers.parseEther("1")) / TOKEN_SUPPLY;
      expect(await ico.tokenPrice()).to.equal(expectedPrice);
    });
  });

  describe("Failed ICO", function () {
    it("should mark as failed when minimum not met", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("5") }); // Below minimum

      await time.increaseTo(endTime + 1);

      await expect(ico.markFailed())
        .to.emit(ico, "ICOFailed");

      expect(await ico.status()).to.equal(3); // FAILED
    });

    it("should reject markFailed if minimum was met", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("15") });

      await time.increaseTo(endTime + 1);

      await expect(ico.markFailed()).to.be.revertedWithCustomError(ico, "MinimumWasMet");
    });
  });

  describe("Token Claims", function () {
    it("should allow token claims after finalization", async function () {
      const { ico, token, user1, user2, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("10") });
      await ico.connect(user2).commit({ value: ethers.parseEther("10") });

      await time.increaseTo(endTime + 1);
      await ico.finalize();

      const user1BalanceBefore = await token.balanceOf(user1.address);
      await ico.connect(user1).claimTokens();
      const user1BalanceAfter = await token.balanceOf(user1.address);

      // User1 committed 50% so should get 50% of tokens
      const expectedAllocation = TOKEN_SUPPLY / 2n;
      expect(user1BalanceAfter - user1BalanceBefore).to.equal(expectedAllocation);
    });

    it("should prevent double claims", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("15") });

      await time.increaseTo(endTime + 1);
      await ico.finalize();

      await ico.connect(user1).claimTokens();

      await expect(
        ico.connect(user1).claimTokens()
      ).to.be.revertedWithCustomError(ico, "AlreadyClaimed");
    });

    it("should reject claims before finalization", async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("15") });

      await expect(
        ico.connect(user1).claimTokens()
      ).to.be.revertedWithCustomError(ico, "NotFinalized");
    });

    it("should reject claims from non-participants", async function () {
      const { ico, user1, user2, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("15") });

      await time.increaseTo(endTime + 1);
      await ico.finalize();

      await expect(
        ico.connect(user2).claimTokens()
      ).to.be.revertedWithCustomError(ico, "NoCommitment");
    });
  });

  describe("Refunds", function () {
    it("should allow refunds after failure", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      const commitAmount = ethers.parseEther("5");
      await ico.connect(user1).commit({ value: commitAmount });

      await time.increaseTo(endTime + 1);
      await ico.markFailed();

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await ico.connect(user1).refund();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(balanceAfter - balanceBefore + gasCost).to.equal(commitAmount);
      expect(await ico.commitments(user1.address)).to.equal(0);
    });

    it("should reject refunds before failure", async function () {
      const { ico, user1, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("5") });

      await expect(
        ico.connect(user1).refund()
      ).to.be.revertedWithCustomError(ico, "NotFailed");
    });

    it("should reject refunds from non-participants", async function () {
      const { ico, user1, user2, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("5") });

      await time.increaseTo(endTime + 1);
      await ico.markFailed();

      await expect(
        ico.connect(user2).refund()
      ).to.be.revertedWithCustomError(ico, "NoCommitment");
    });
  });

  describe("View Functions", function () {
    it("should calculate allocation correctly", async function () {
      const { ico, user1, user2, startTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("10") });
      await ico.connect(user2).commit({ value: ethers.parseEther("30") });

      // User1 = 25%, User2 = 75%
      const user1Allocation = await ico.getAllocation(user1.address);
      const user2Allocation = await ico.getAllocation(user2.address);

      expect(user1Allocation).to.equal(TOKEN_SUPPLY / 4n);
      expect(user2Allocation).to.equal((TOKEN_SUPPLY * 3n) / 4n);
    });

    it("should return correct ICO info", async function () {
      const { ico, user1, startTime, endTime } = await loadFixture(deployICOFixture);

      await time.increaseTo(startTime);
      await ico.connect(user1).commit({ value: ethers.parseEther("5") });

      const info = await ico.getICOInfo();
      expect(info.status).to.equal(1); // ACTIVE
      expect(info.totalCommitted).to.equal(ethers.parseEther("5"));
      expect(info.participantCount).to.equal(1);
      expect(info.minimumRaise).to.equal(MINIMUM_RAISE);
      expect(info.tokenSupply).to.equal(TOKEN_SUPPLY);
      expect(info.startTime).to.equal(startTime);
      expect(info.endTime).to.equal(endTime);
    });

    it("should return correct time remaining", async function () {
      const { ico, startTime, endTime } = await loadFixture(deployICOFixture);

      // Before start
      const remainingBeforeStart = await ico.getTimeRemaining();
      expect(remainingBeforeStart).to.equal(endTime - startTime);

      // During ICO
      await time.increaseTo(startTime + ONE_HOUR);
      const remainingDuring = await ico.getTimeRemaining();
      expect(remainingDuring).to.be.lessThan(endTime - startTime);

      // After end
      await time.increaseTo(endTime + 1);
      const remainingAfter = await ico.getTimeRemaining();
      expect(remainingAfter).to.equal(0);
    });
  });
});
