const { expect } = require("chai");
const { ethers, fhevm } = require("hardhat");

describe("LiquidSwapPair - Add Liquidity Operations", function () {
  let swapLib;
  let token0, token1;
  let swapPair;
  let owner, user1, user2, user3;

  const SCALING_FACTOR = BigInt(10 ** 6);
  const MINT_AMOUNT = 10000n * SCALING_FACTOR;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      throw new Error("This test must run in FHEVM mock environment");
    }

    await fhevm.initializeCLIApi();
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy contracts
    const SwapLibFactory = await ethers.getContractFactory("SwapLib");
    swapLib = await SwapLibFactory.deploy();
    await swapLib.waitForDeployment();

    const TokenFactory = await ethers.getContractFactory("ConfidentialToken");
    token0 = await TokenFactory.deploy("Liquid USD", "LUSD");
    await token0.waitForDeployment();

    token1 = await TokenFactory.deploy("Liquid ETH", "LETH");
    await token1.waitForDeployment();

    const SwapPairFactory = await ethers.getContractFactory("LiquidSwapPair", {
      libraries: {
        SwapLib: await swapLib.getAddress(),
      },
    });
    swapPair = await SwapPairFactory.deploy(owner.address);
    await swapPair.waitForDeployment();

    await swapPair.initialize(await token0.getAddress(), await token1.getAddress());

    // Mint tokens to users
    const users = [user1, user2, user3];
    for (const user of users) {
      // Mint token0
      const encrypted0 = await fhevm
        .createEncryptedInput(await token0.getAddress(), user.address)
        .add64(MINT_AMOUNT)
        .encrypt();
      await token0.connect(user).mint(user.address, encrypted0.handles[0], encrypted0.inputProof);

      // Mint token1
      const encrypted1 = await fhevm
        .createEncryptedInput(await token1.getAddress(), user.address)
        .add64(MINT_AMOUNT)
        .encrypt();
      await token1.connect(user).mint(user.address, encrypted1.handles[0], encrypted1.inputProof);

      // Set operators
      const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      await token0.connect(user).setOperator(await swapPair.getAddress(), expiry);
      await token1.connect(user).setOperator(await swapPair.getAddress(), expiry);
    }

    console.log("Test setup complete: tokens minted and operators set");
  });

  describe("First Liquidity Addition (Pool Initialization)", function () {
    it("should initiate first liquidity addition", async function () {
      const amount0 = 1000n * SCALING_FACTOR;
      const amount1 = 500n * SCALING_FACTOR;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Create encrypted inputs
      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(amount0)
        .add64(amount1)
        .encrypt();

      // Add liquidity
      const tx = await swapPair.connect(user1).addLiquidity(
        encrypted.handles[0],
        encrypted.handles[1],
        deadline,
        encrypted.inputProof
      );

      const receipt = await tx.wait();

      // Check for DecryptionPending event
      const decryptionEvent = receipt.logs.find(log => {
        try {
          const decoded = swapPair.interface.parseLog(log);
          return decoded.name === 'DecryptionPending';
        } catch {
          return false;
        }
      });

      expect(decryptionEvent).to.not.be.undefined;
      console.log("First liquidity addition initiated, DecryptionPending event emitted");

      // Verify user has pending operation
      const [requestID, hasPending, , operation] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(true);
      expect(operation).to.equal(1); // Operation.AddLiquidity
      console.log(`User has pending AddLiquidity operation with requestID: ${requestID}`);
    });

    it("should emit DecryptionPending with correct handles", async function () {
      const amount0 = 1000n * SCALING_FACTOR;
      const amount1 = 500n * SCALING_FACTOR;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(amount0)
        .add64(amount1)
        .encrypt();

      const tx = await swapPair.connect(user1).addLiquidity(
        encrypted.handles[0],
        encrypted.handles[1],
        deadline,
        encrypted.inputProof
      );

      const receipt = await tx.wait();
      const decryptionEvent = receipt.logs.find(log => {
        try {
          const decoded = swapPair.interface.parseLog(log);
          return decoded.name === 'DecryptionPending';
        } catch {
          return false;
        }
      });

      const decoded = swapPair.interface.parseLog(decryptionEvent);
      expect(decoded.args.from).to.equal(user1.address);
      expect(decoded.args.operation).to.equal(1); // AddLiquidity
      expect(decoded.args.handles.length).to.be.greaterThan(0);
      console.log(`DecryptionPending event: requestID=${decoded.args.requestID}, handles=${decoded.args.handles.length}`);
    });
  });

  describe("Queue Mode - Concurrent Liquidity Operations", function () {
    it("should allow different users to add liquidity simultaneously", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // User1 adds liquidity
      const encrypted1 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(1000n * SCALING_FACTOR)
        .add64(500n * SCALING_FACTOR)
        .encrypt();

      await swapPair.connect(user1).addLiquidity(
        encrypted1.handles[0],
        encrypted1.handles[1],
        deadline,
        encrypted1.inputProof
      );

      // User2 adds liquidity (should NOT be blocked)
      const encrypted2 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user2.address)
        .add64(2000n * SCALING_FACTOR)
        .add64(1000n * SCALING_FACTOR)
        .encrypt();

      await swapPair.connect(user2).addLiquidity(
        encrypted2.handles[0],
        encrypted2.handles[1],
        deadline,
        encrypted2.inputProof
      );

      // User3 adds liquidity (should NOT be blocked)
      const encrypted3 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user3.address)
        .add64(500n * SCALING_FACTOR)
        .add64(250n * SCALING_FACTOR)
        .encrypt();

      await swapPair.connect(user3).addLiquidity(
        encrypted3.handles[0],
        encrypted3.handles[1],
        deadline,
        encrypted3.inputProof
      );

      // Verify all users have pending operations
      const [, hasPending1] = await swapPair.getUserPendingOperationInfo(user1.address);
      const [, hasPending2] = await swapPair.getUserPendingOperationInfo(user2.address);
      const [, hasPending3] = await swapPair.getUserPendingOperationInfo(user3.address);

      expect(hasPending1).to.equal(true);
      expect(hasPending2).to.equal(true);
      expect(hasPending3).to.equal(true);
      console.log("Queue Mode: All 3 users have pending operations simultaneously");
    });

    it("should block same user from multiple operations", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // User1 first operation
      const encrypted1 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(1000n * SCALING_FACTOR)
        .add64(500n * SCALING_FACTOR)
        .encrypt();

      await swapPair.connect(user1).addLiquidity(
        encrypted1.handles[0],
        encrypted1.handles[1],
        deadline,
        encrypted1.inputProof
      );

      // User1 tries second operation (should be blocked)
      const encrypted2 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(500n * SCALING_FACTOR)
        .add64(250n * SCALING_FACTOR)
        .encrypt();

      await expect(
        swapPair.connect(user1).addLiquidity(
          encrypted2.handles[0],
          encrypted2.handles[1],
          deadline,
          encrypted2.inputProof
        )
      ).to.be.revertedWithCustomError(swapPair, "UserHasPendingOperation");

      console.log("Queue Mode: Same user correctly blocked from multiple operations");
    });
  });

  describe("Deadline Enforcement", function () {
    it("should revert when deadline has passed", async function () {
      const pastDeadline = Math.floor(Date.now() / 1000) - 100; // Past deadline

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(1000n * SCALING_FACTOR)
        .add64(500n * SCALING_FACTOR)
        .encrypt();

      await expect(
        swapPair.connect(user1).addLiquidity(
          encrypted.handles[0],
          encrypted.handles[1],
          pastDeadline,
          encrypted.inputProof
        )
      ).to.be.revertedWithCustomError(swapPair, "Expired");

      console.log("Expired deadline correctly rejected");
    });
  });

  describe("FHE Input Validation", function () {
    it("should accept valid encrypted inputs", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(1000n * SCALING_FACTOR)
        .add64(500n * SCALING_FACTOR)
        .encrypt();

      // Should not revert
      await swapPair.connect(user1).addLiquidity(
        encrypted.handles[0],
        encrypted.handles[1],
        deadline,
        encrypted.inputProof
      );

      console.log("Valid FHE inputs accepted successfully");
    });

    it("should handle zero amount inputs gracefully", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(0n)
        .add64(0n)
        .encrypt();

      // Zero amounts should still initiate operation (will be handled in callback)
      await swapPair.connect(user1).addLiquidity(
        encrypted.handles[0],
        encrypted.handles[1],
        deadline,
        encrypted.inputProof
      );

      const [, hasPending] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(true);
      console.log("Zero amount inputs handled gracefully");
    });
  });

  describe("Performance - Multiple Operations", function () {
    it("should handle rapid sequential operations from different users", async function () {
      const startTime = Date.now();
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const users = [user1, user2, user3];

      for (const user of users) {
        const encrypted = await fhevm
          .createEncryptedInput(await swapPair.getAddress(), user.address)
          .add64(1000n * SCALING_FACTOR)
          .add64(500n * SCALING_FACTOR)
          .encrypt();

        await swapPair.connect(user).addLiquidity(
          encrypted.handles[0],
          encrypted.handles[1],
          deadline,
          encrypted.inputProof
        );
      }

      const duration = Date.now() - startTime;
      console.log(`3 concurrent addLiquidity operations completed in ${duration}ms`);
      expect(duration).to.be.lessThan(30000); // Should complete in under 30 seconds
    });
  });
});
