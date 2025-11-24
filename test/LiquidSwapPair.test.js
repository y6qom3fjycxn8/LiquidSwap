const { expect } = require("chai");
const { ethers, fhevm } = require("hardhat");

describe("LiquidSwapPair - Queue Mode Basic Functionality", function () {
  let swapLib;
  let token0, token1;
  let swapPair;
  let owner, user1, user2, user3;

  const SCALING_FACTOR = BigInt(10 ** 6); // 6 decimals
  const MINIMUM_LIQUIDITY = 100n * SCALING_FACTOR;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      throw new Error("This test must run in FHEVM mock environment");
    }

    await fhevm.initializeCLIApi();
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy SwapLib library
    const SwapLibFactory = await ethers.getContractFactory("SwapLib");
    swapLib = await SwapLibFactory.deploy();
    await swapLib.waitForDeployment();
    console.log(`SwapLib deployed at: ${await swapLib.getAddress()}`);

    // Deploy ConfidentialToken for token0 (LUSD)
    const TokenFactory = await ethers.getContractFactory("ConfidentialToken");
    token0 = await TokenFactory.deploy("Liquid USD", "LUSD");
    await token0.waitForDeployment();
    console.log(`Token0 (LUSD) deployed at: ${await token0.getAddress()}`);

    // Deploy ConfidentialToken for token1 (LETH)
    token1 = await TokenFactory.deploy("Liquid ETH", "LETH");
    await token1.waitForDeployment();
    console.log(`Token1 (LETH) deployed at: ${await token1.getAddress()}`);

    // Deploy LiquidSwapPair with owner as price scanner
    const SwapPairFactory = await ethers.getContractFactory("LiquidSwapPair", {
      libraries: {
        SwapLib: await swapLib.getAddress(),
      },
    });
    swapPair = await SwapPairFactory.deploy(owner.address);
    await swapPair.waitForDeployment();
    console.log(`LiquidSwapPair deployed at: ${await swapPair.getAddress()}`);

    // Initialize pair with tokens
    await swapPair.initialize(await token0.getAddress(), await token1.getAddress());
    console.log("LiquidSwapPair initialized with token addresses");
  });

  describe("Deployment & Initialization", function () {
    it("should deploy contracts successfully", async function () {
      expect(await swapLib.getAddress()).to.be.properAddress;
      expect(await token0.getAddress()).to.be.properAddress;
      expect(await token1.getAddress()).to.be.properAddress;
      expect(await swapPair.getAddress()).to.be.properAddress;
      console.log("All contracts deployed successfully");
    });

    it("should have correct initial state", async function () {
      expect(await swapPair.token0Address()).to.equal(await token0.getAddress());
      expect(await swapPair.token1Address()).to.equal(await token1.getAddress());
      expect(await swapPair.factory()).to.equal(owner.address);
      expect(await swapPair.scalingFactor()).to.equal(SCALING_FACTOR);
      expect(await swapPair.MINIMUM_LIQUIDITY()).to.equal(MINIMUM_LIQUIDITY);
      expect(await swapPair.hasLiquidity()).to.equal(false);
      console.log("Initial state verified correctly");
    });

    it("should have correct token metadata", async function () {
      expect(await token0.name()).to.equal("Liquid USD");
      expect(await token0.symbol()).to.equal("LUSD");
      expect(await token1.name()).to.equal("Liquid ETH");
      expect(await token1.symbol()).to.equal("LETH");
      console.log("Token metadata verified correctly");
    });
  });

  describe("Queue Mode - Per-User Pending Operations", function () {
    it("should return no pending operation for new user", async function () {
      const [requestID, hasPending, timestamp, operation] = await swapPair.getUserPendingOperationInfo(user1.address);

      expect(hasPending).to.equal(false);
      expect(requestID).to.equal(0n);
      expect(timestamp).to.equal(0n);
      expect(operation).to.equal(0); // Operation.None
      console.log("New user has no pending operation");
    });

    it("should return caller's pending operation via getPendingOperationInfo", async function () {
      const [requestID, isPending, timestamp, operation] = await swapPair.connect(user1).getPendingOperationInfo();

      expect(isPending).to.equal(false);
      console.log("Legacy getPendingOperationInfo works correctly");
    });
  });

  describe("Token Minting with FHE", function () {
    it("should mint tokens with encrypted amounts", async function () {
      const mintAmount = 1000n * SCALING_FACTOR;

      // Create encrypted input for minting
      const encrypted = await fhevm
        .createEncryptedInput(await token0.getAddress(), owner.address)
        .add64(mintAmount)
        .encrypt();

      // Mint tokens to owner
      await token0.connect(owner).mint(
        owner.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      // Verify balance handle exists (encrypted)
      const balance = await token0.confidentialBalanceOf(owner.address);
      expect(balance).to.not.be.undefined;
      console.log("Tokens minted successfully with encrypted amount");
    });

    it("should mint tokens to different users", async function () {
      const users = [user1, user2, user3];
      const mintAmounts = [1000n, 2000n, 3000n].map(a => a * SCALING_FACTOR);

      for (let i = 0; i < users.length; i++) {
        const encrypted = await fhevm
          .createEncryptedInput(await token0.getAddress(), users[i].address)
          .add64(mintAmounts[i])
          .encrypt();

        await token0.connect(users[i]).mint(
          users[i].address,
          encrypted.handles[0],
          encrypted.inputProof
        );
      }

      console.log("Tokens minted to multiple users successfully");
    });
  });

  describe("Operator Approval (ERC7984)", function () {
    it("should set operator for token transfers", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      // Set LiquidSwapPair as operator for token0
      await token0.connect(user1).setOperator(await swapPair.getAddress(), expiry);

      const isOperator = await token0.isOperator(user1.address, await swapPair.getAddress());
      expect(isOperator).to.equal(true);
      console.log("Operator set successfully for token transfers");
    });

    it("should allow multiple users to set operators independently", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const pairAddress = await swapPair.getAddress();

      // Multiple users set operators
      await token0.connect(user1).setOperator(pairAddress, expiry);
      await token0.connect(user2).setOperator(pairAddress, expiry);
      await token1.connect(user1).setOperator(pairAddress, expiry);
      await token1.connect(user2).setOperator(pairAddress, expiry);

      expect(await token0.isOperator(user1.address, pairAddress)).to.equal(true);
      expect(await token0.isOperator(user2.address, pairAddress)).to.equal(true);
      expect(await token1.isOperator(user1.address, pairAddress)).to.equal(true);
      expect(await token1.isOperator(user2.address, pairAddress)).to.equal(true);
      console.log("Multiple users can set operators independently");
    });
  });

  describe("Reserve Viewer Management", function () {
    it("should register price scanner as reserve viewer", async function () {
      const isViewer = await swapPair.isReserveViewer(owner.address);
      expect(isViewer).to.equal(true);
      console.log("Price scanner registered as reserve viewer");
    });

    it("should add additional reserve viewers", async function () {
      await swapPair.connect(owner).addReserveViewer(user1.address);

      expect(await swapPair.isReserveViewer(user1.address)).to.equal(true);
      console.log("Additional reserve viewer added successfully");
    });

    it("should batch add reserve viewers", async function () {
      await swapPair.connect(owner).addReserveViewers([user1.address, user2.address]);

      expect(await swapPair.isReserveViewer(user1.address)).to.equal(true);
      expect(await swapPair.isReserveViewer(user2.address)).to.equal(true);
      console.log("Batch reserve viewers added successfully");
    });

    it("should return all reserve viewers", async function () {
      await swapPair.connect(owner).addReserveViewers([user1.address, user2.address]);

      const viewers = await swapPair.getReserveViewers();
      expect(viewers.length).to.be.greaterThanOrEqual(3); // owner + user1 + user2
      console.log("Reserve viewers list retrieved successfully");
    });
  });

  describe("Access Control", function () {
    it("should revert when non-factory tries to initialize", async function () {
      // Deploy new pair
      const SwapPairFactory = await ethers.getContractFactory("LiquidSwapPair", {
        libraries: {
          SwapLib: await swapLib.getAddress(),
        },
      });
      const newPair = await SwapPairFactory.connect(user1).deploy(owner.address);
      await newPair.waitForDeployment();

      // Try to initialize from non-factory
      await expect(
        newPair.connect(user2).initialize(await token0.getAddress(), await token1.getAddress())
      ).to.be.revertedWithCustomError(newPair, "Forbidden");
      console.log("Non-factory initialization correctly rejected");
    });

    it("should revert when adding invalid reserve viewer address", async function () {
      await expect(
        swapPair.connect(owner).addReserveViewer(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(swapPair, "InvalidAddress");
      console.log("Invalid reserve viewer address correctly rejected");
    });

    it("should revert when setting invalid price scanner address", async function () {
      await expect(
        swapPair.connect(owner).setPriceScanner(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(swapPair, "InvalidAddress");
      console.log("Invalid price scanner address correctly rejected");
    });
  });

  describe("Constants and Configuration", function () {
    it("should have correct scaling factor (6 decimals)", async function () {
      const factor = await swapPair.scalingFactor();
      expect(factor).to.equal(1000000n); // 10^6
      console.log("Scaling factor is correct: 10^6");
    });

    it("should have correct minimum liquidity", async function () {
      const minLiq = await swapPair.MINIMUM_LIQUIDITY();
      expect(minLiq).to.equal(100000000n); // 100 * 10^6
      console.log("Minimum liquidity is correct: 100 * scalingFactor");
    });
  });
});
