import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { FairLaunchFactory, WBNB } from "../typechain-types";

describe("FairLaunchFactory", function () {
  const ONE_HOUR = 60 * 60;
  const ONE_DAY = 24 * ONE_HOUR;
  const TOKEN_SUPPLY = ethers.parseEther("10000000"); // 10M tokens
  const MINIMUM_RAISE = ethers.parseEther("10"); // 10 BNB

  async function deployFactoryFixture() {
    const [owner, creator, user1, user2, treasuryOwner] = await ethers.getSigners();

    // Deploy WBNB
    const WBNB = await ethers.getContractFactory("WBNB");
    const wbnb = await WBNB.deploy();

    // Deploy Factory (with router set to zero address for tests without LP)
    const FairLaunchFactory = await ethers.getContractFactory("FairLaunchFactory");
    const factory = await FairLaunchFactory.deploy(await wbnb.getAddress(), ethers.ZeroAddress);

    return { factory, wbnb, owner, creator, user1, user2, treasuryOwner };
  }

  describe("Deployment", function () {
    it("should set correct initial values", async function () {
      const { factory, wbnb, owner } = await loadFixture(deployFactoryFixture);

      expect(await factory.quoteToken()).to.equal(await wbnb.getAddress());
      expect(await factory.owner()).to.equal(owner.address);
      expect(await factory.platformFeeBps()).to.equal(100); // 1%
    });

    it("should reject zero address for quote token", async function () {
      const FairLaunchFactory = await ethers.getContractFactory("FairLaunchFactory");
      await expect(
        FairLaunchFactory.deploy(ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(FairLaunchFactory, "ZeroAddress");
    });
  });

  describe("Create Fair Launch", function () {
    it("should create a fair launch successfully", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "ipfs://test",
        description: "A test token",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY * 4, // 4 days
        teamTokensBps: 0,
        teamWallet: ethers.ZeroAddress,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      const tx = await factory.connect(creator).createFairLaunch(params);
      const receipt = await tx.wait();

      // Find FairLaunchCreated event
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "FairLaunchCreated"
      );
      expect(event).to.not.be.undefined;

      // Check ICO count
      expect(await factory.getICOCount()).to.equal(1);
    });

    it("should deploy all contracts correctly", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "ipfs://test",
        description: "A test token",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY * 4,
        teamTokensBps: 1000, // 10% team tokens
        teamWallet: creator.address,
        monthlyBudget: ethers.parseEther("100"),
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      const tx = await factory.connect(creator).createFairLaunch(params);
      await tx.wait();

      const icos = await factory.getICOs(0, 10);
      const icoAddress = icos[0];

      // Get all contract addresses
      const [token, treasury, timelock] = await factory.getContracts(icoAddress);

      expect(token).to.not.equal(ethers.ZeroAddress);
      expect(treasury).to.not.equal(ethers.ZeroAddress);
      expect(timelock).to.equal(treasuryOwner.address);

      // Check token supply
      const LaunchToken = await ethers.getContractFactory("LaunchToken");
      const tokenContract = LaunchToken.attach(token);
      const totalSupply = await tokenContract.totalSupply();
      const expectedSupply = TOKEN_SUPPLY + (TOKEN_SUPPLY * 1000n) / 10000n; // +10% team
      expect(totalSupply).to.equal(expectedSupply);
    });

    it("should transfer tokens to ICO contract", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "ipfs://test",
        description: "",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY * 4,
        teamTokensBps: 0,
        teamWallet: ethers.ZeroAddress,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      await factory.connect(creator).createFairLaunch(params);

      const icos = await factory.getICOs(0, 10);
      const icoAddress = icos[0];
      const [token] = await factory.getContracts(icoAddress);

      const LaunchToken = await ethers.getContractFactory("LaunchToken");
      const tokenContract = LaunchToken.attach(token);

      // ICO contract should have the tokens
      const icoBalance = await tokenContract.balanceOf(icoAddress);
      expect(icoBalance).to.equal(TOKEN_SUPPLY);
    });

    it("should transfer team tokens to treasury", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      const teamBps = 2000n; // 20%
      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "ipfs://test",
        description: "",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY * 4,
        teamTokensBps: teamBps,
        teamWallet: creator.address,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      await factory.connect(creator).createFairLaunch(params);

      const icos = await factory.getICOs(0, 10);
      const icoAddress = icos[0];
      const [token, treasury] = await factory.getContracts(icoAddress);

      const LaunchToken = await ethers.getContractFactory("LaunchToken");
      const tokenContract = LaunchToken.attach(token);

      // Treasury should have team tokens
      const teamTokens = (TOKEN_SUPPLY * teamBps) / 10000n;
      const treasuryBalance = await tokenContract.balanceOf(treasury);
      expect(treasuryBalance).to.equal(teamTokens);
    });

    it("should reject invalid supply", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "",
        description: "",
        tokenSupply: ethers.parseEther("100"), // Too low (min is 1M)
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY * 4,
        teamTokensBps: 0,
        teamWallet: ethers.ZeroAddress,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      await expect(
        factory.connect(creator).createFairLaunch(params)
      ).to.be.revertedWithCustomError(factory, "InvalidSupply");
    });

    it("should reject invalid duration", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      // Too short
      let params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "",
        description: "",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_HOUR, // Too short (min is 1 day)
        teamTokensBps: 0,
        teamWallet: ethers.ZeroAddress,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      await expect(
        factory.connect(creator).createFairLaunch(params)
      ).to.be.revertedWithCustomError(factory, "InvalidDuration");

      // Too long
      params.icoDuration = ONE_DAY * 20; // Too long (max is 14 days)
      await expect(
        factory.connect(creator).createFairLaunch(params)
      ).to.be.revertedWithCustomError(factory, "InvalidDuration");
    });

    it("should reject team allocation > 20%", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "",
        description: "",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY * 4,
        teamTokensBps: 2100, // 21% - too high
        teamWallet: creator.address,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      await expect(
        factory.connect(creator).createFairLaunch(params)
      ).to.be.revertedWithCustomError(factory, "InvalidTeamAllocation");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update platform fee", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);

      await factory.connect(owner).setPlatformFee(200); // 2%
      expect(await factory.platformFeeBps()).to.equal(200);
    });

    it("should reject non-owner updating fee", async function () {
      const { factory, creator } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(creator).setPlatformFee(200)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should reject fee > 5%", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(owner).setPlatformFee(600) // 6%
      ).to.be.reverted;
    });

    it("should allow owner to withdraw fees", async function () {
      const { factory, owner, creator, treasuryOwner, user1 } = await loadFixture(deployFactoryFixture);

      // Create a launch
      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "",
        description: "",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY,
        teamTokensBps: 0,
        teamWallet: ethers.ZeroAddress,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      await factory.connect(creator).createFairLaunch(params);

      const icos = await factory.getICOs(0, 10);
      const icoAddress = icos[0];

      // Commit and finalize ICO
      const ICOContract = await ethers.getContractFactory("ICOContract");
      const ico = ICOContract.attach(icoAddress);

      // Move to start time
      const startTime = await ico.startTime();
      await time.increaseTo(startTime);

      // Commit BNB
      await ico.connect(user1).commit({ value: ethers.parseEther("15") });

      // Move past end time
      const endTime = await ico.endTime();
      await time.increaseTo(endTime + 1n);

      // Finalize
      await ico.finalize();

      // Factory should have received platform fee
      const factoryBalance = await ethers.provider.getBalance(await factory.getAddress());
      expect(factoryBalance).to.be.greaterThan(0);

      // Withdraw
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await factory.connect(owner).withdrawFees(owner.address);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalanceAfter - ownerBalanceBefore + gasCost).to.equal(factoryBalance);
    });
  });

  describe("View Functions", function () {
    it("should return launch info", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Token",
        symbol: "TEST",
        imageURI: "ipfs://test",
        description: "",
        tokenSupply: TOKEN_SUPPLY,
        minimumRaise: MINIMUM_RAISE,
        icoDuration: ONE_DAY * 4,
        teamTokensBps: 0,
        teamWallet: ethers.ZeroAddress,
        monthlyBudget: 0,
        treasuryOwner: treasuryOwner.address,
        lpBnbBps: 0,
        lpTokensBps: 0,
      };

      await factory.connect(creator).createFairLaunch(params);

      const icos = await factory.getICOs(0, 10);
      const info = await factory.getLaunchInfo(icos[0]);

      expect(info.name).to.equal("Test Token");
      expect(info.symbol).to.equal("TEST");
      expect(info.creator).to.equal(creator.address);
      expect(info.tokenSupply).to.equal(TOKEN_SUPPLY);
      expect(info.minimumRaise).to.equal(MINIMUM_RAISE);
    });

    it("should return ICOs with pagination", async function () {
      const { factory, creator, treasuryOwner } = await loadFixture(deployFactoryFixture);

      // Create 3 launches
      for (let i = 0; i < 3; i++) {
        const params = {
          name: `Token ${i}`,
          symbol: `TKN${i}`,
          imageURI: "",
          description: "",
          tokenSupply: TOKEN_SUPPLY,
          minimumRaise: MINIMUM_RAISE,
          icoDuration: ONE_DAY * 4,
          teamTokensBps: 0,
          teamWallet: ethers.ZeroAddress,
          monthlyBudget: 0,
          treasuryOwner: treasuryOwner.address,
          lpBnbBps: 0,
          lpTokensBps: 0,
        };
        await factory.connect(creator).createFairLaunch(params);
      }

      expect(await factory.getICOCount()).to.equal(3);

      const page1 = await factory.getICOs(0, 2);
      expect(page1.length).to.equal(2);

      const page2 = await factory.getICOs(2, 2);
      expect(page2.length).to.equal(1);

      const outOfBounds = await factory.getICOs(10, 2);
      expect(outOfBounds.length).to.equal(0);
    });
  });
});
