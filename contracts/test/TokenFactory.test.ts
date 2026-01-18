import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("TokenFactory", function () {
  const LAUNCH_FEE = ethers.parseEther("0.01");
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const INITIAL_QUOTE = ethers.parseEther("1"); // 1 WBNB
  const TOKEN_WEIGHT = ethers.parseEther("0.8"); // 80%

  async function deployFixture() {
    const [owner, creator, user] = await ethers.getSigners();

    // Deploy WBNB
    const WBNB = await ethers.getContractFactory("WBNB");
    const wbnb = await WBNB.deploy();

    // Deploy PoolRegistry
    const PoolRegistry = await ethers.getContractFactory("PoolRegistry");
    const registry = await PoolRegistry.deploy();

    // Deploy TokenFactory
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    const factory = await TokenFactory.deploy(
      await wbnb.getAddress(),
      await registry.getAddress(),
      LAUNCH_FEE,
      owner.address
    );

    // Authorize factory in registry
    await registry.authorizeFactory(await factory.getAddress());

    // Give creator some WBNB
    await wbnb.connect(creator).deposit({ value: ethers.parseEther("10") });
    await wbnb.connect(creator).approve(await factory.getAddress(), ethers.MaxUint256);

    return { wbnb, registry, factory, owner, creator, user };
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { factory, owner } = await loadFixture(deployFixture);
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should set the correct launch fee", async function () {
      const { factory } = await loadFixture(deployFixture);
      expect(await factory.launchFee()).to.equal(LAUNCH_FEE);
    });

    it("Should set the correct default weights", async function () {
      const { factory } = await loadFixture(deployFixture);
      expect(await factory.defaultTokenWeight()).to.equal(ethers.parseEther("0.8"));
      expect(await factory.defaultQuoteWeight()).to.equal(ethers.parseEther("0.2"));
    });
  });

  describe("Token Creation", function () {
    it("Should create a new token and pool", async function () {
      const { factory, creator, registry } = await loadFixture(deployFixture);

      const tx = await factory.connect(creator).createToken(
        "RoboToken",
        "ROBO",
        "ipfs://metadata",
        INITIAL_SUPPLY,
        INITIAL_QUOTE,
        TOKEN_WEIGHT,
        { value: LAUNCH_FEE }
      );

      const receipt = await tx.wait();

      // Check token was created
      expect(await factory.getTokenCount()).to.equal(1);

      // Get token address from event
      const tokens = await factory.getAllTokens();
      expect(tokens.length).to.equal(1);

      const tokenInfo = await factory.getTokenInfo(tokens[0]);
      expect(tokenInfo.name).to.equal("RoboToken");
      expect(tokenInfo.symbol).to.equal("ROBO");
      expect(tokenInfo.creator).to.equal(creator.address);
    });

    it("Should fail with insufficient launch fee", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      await expect(
        factory.connect(creator).createToken(
          "RoboToken",
          "ROBO",
          "ipfs://metadata",
          INITIAL_SUPPLY,
          INITIAL_QUOTE,
          TOKEN_WEIGHT,
          { value: LAUNCH_FEE - 1n }
        )
      ).to.be.revertedWithCustomError(factory, "InsufficientFee");
    });

    it("Should fail with invalid supply", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      // Too low
      await expect(
        factory.connect(creator).createToken(
          "RoboToken",
          "ROBO",
          "ipfs://metadata",
          ethers.parseEther("100"), // Below minimum
          INITIAL_QUOTE,
          TOKEN_WEIGHT,
          { value: LAUNCH_FEE }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidSupply");
    });

    it("Should fail with invalid weight", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      await expect(
        factory.connect(creator).createToken(
          "RoboToken",
          "ROBO",
          "ipfs://metadata",
          INITIAL_SUPPLY,
          INITIAL_QUOTE,
          ethers.parseEther("0.4"), // Below 50%
          { value: LAUNCH_FEE }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidWeight");
    });
  });

  describe("Pool Operations", function () {
    it("Should allow swapping tokens", async function () {
      const { factory, wbnb, creator, user } = await loadFixture(deployFixture);

      // Create token
      await factory.connect(creator).createToken(
        "RoboToken",
        "ROBO",
        "ipfs://metadata",
        INITIAL_SUPPLY,
        INITIAL_QUOTE,
        TOKEN_WEIGHT,
        { value: LAUNCH_FEE }
      );

      const tokens = await factory.getAllTokens();
      const tokenInfo = await factory.getTokenInfo(tokens[0]);

      const pool = await ethers.getContractAt("WeightedPool", tokenInfo.pool);
      const token = await ethers.getContractAt("LaunchToken", tokens[0]);

      // User gets some WBNB
      await wbnb.connect(user).deposit({ value: ethers.parseEther("0.1") });
      await wbnb.connect(user).approve(tokenInfo.pool, ethers.MaxUint256);

      // Calculate expected output
      const amountIn = ethers.parseEther("0.1");
      const expectedOut = await pool.calcOutGivenIn(
        await wbnb.getAddress(),
        tokens[0],
        amountIn
      );

      // Swap WBNB for token
      const balanceBefore = await token.balanceOf(user.address);

      await pool.connect(user).swap(
        await wbnb.getAddress(),
        tokens[0],
        amountIn,
        expectedOut * 99n / 100n, // 1% slippage
        user.address
      );

      const balanceAfter = await token.balanceOf(user.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should return spot price", async function () {
      const { factory, wbnb, creator } = await loadFixture(deployFixture);

      // Create token
      await factory.connect(creator).createToken(
        "RoboToken",
        "ROBO",
        "ipfs://metadata",
        INITIAL_SUPPLY,
        INITIAL_QUOTE,
        TOKEN_WEIGHT,
        { value: LAUNCH_FEE }
      );

      const tokens = await factory.getAllTokens();
      const tokenInfo = await factory.getTokenInfo(tokens[0]);

      const pool = await ethers.getContractAt("WeightedPool", tokenInfo.pool);

      const spotPrice = await pool.getSpotPrice(
        await wbnb.getAddress(),
        tokens[0]
      );

      // With 80/20 weights and 1M tokens / 1 BNB:
      // spotPrice = (1 BNB / 0.2) / (1M tokens / 0.8) = 5 / 1.25M = 0.000004
      expect(spotPrice).to.be.gt(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update launch fee", async function () {
      const { factory, owner } = await loadFixture(deployFixture);

      const newFee = ethers.parseEther("0.02");
      await factory.connect(owner).setLaunchFee(newFee);
      expect(await factory.launchFee()).to.equal(newFee);
    });

    it("Should not allow non-owner to update launch fee", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      await expect(
        factory.connect(creator).setLaunchFee(ethers.parseEther("0.02"))
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });
});
