const { expect } = require("chai");
const { ethers, fhevm } = require("hardhat");

describe("LiquidSwapPair - Swap Tokens Operations", function () {
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

    // Mint tokens and set operators for users
    const users = [user1, user2, user3];
    for (const user of users) {
      const encrypted0 = await fhevm
        .createEncryptedInput(await token0.getAddress(), user.address)
        .add64(MINT_AMOUNT)
        .encrypt();
      await token0.connect(user).mint(user.address, encrypted0.handles[0], encrypted0.inputProof);

      const encrypted1 = await fhevm
        .createEncryptedInput(await token1.getAddress(), user.address)
        .add64(MINT_AMOUNT)
        .encrypt();
      await token1.connect(user).mint(user.address, encrypted1.handles[0], encrypted1.inputProof);

      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await token0.connect(user).setOperator(await swapPair.getAddress(), expiry);
      await token1.connect(user).setOperator(await swapPair.getAddress(), expiry);
    }

    console.log("Test setup complete");
  });

  describe("Swap Token0 -> Token1", function () {
    it("should initiate swap from token0 to token1", async function () {
      const swapAmount = 100n * SCALING_FACTOR;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Create encrypted inputs: amount0In (swap), amount1In (0)
      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(swapAmount)
        .add64(0n)
        .encrypt();

      const tx = await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address, // recipient
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
      console.log("Swap token0->token1 initiated, DecryptionPending event emitted");

      // Verify pending operation
      const [requestID, hasPending, , operation] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(true);
      expect(operation).to.equal(3); // Operation.Swap
      console.log(`User has pending Swap operation with requestID: ${requestID}`);
    });
  });

  describe("Swap Token1 -> Token0", function () {
    it("should initiate swap from token1 to token0", async function () {
      const swapAmount = 50n * SCALING_FACTOR;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Create encrypted inputs: amount0In (0), amount1In (swap)
      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(0n)
        .add64(swapAmount)
        .encrypt();

      const tx = await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
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

      expect(decryptionEvent).to.not.be.undefined;
      console.log("Swap token1->token0 initiated successfully");
    });
  });

  describe("Queue Mode - Concurrent Swaps", function () {
    it("should allow multiple users to swap simultaneously", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // User1 swaps token0 -> token1
      const encrypted1 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted1.handles[0],
        encrypted1.handles[1],
        user1.address,
        deadline,
        encrypted1.inputProof
      );

      // User2 swaps token1 -> token0 (should NOT be blocked)
      const encrypted2 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user2.address)
        .add64(0n)
        .add64(50n * SCALING_FACTOR)
        .encrypt();

      await swapPair.connect(user2).swapTokens(
        encrypted2.handles[0],
        encrypted2.handles[1],
        user2.address,
        deadline,
        encrypted2.inputProof
      );

      // User3 swaps token0 -> token1 (should NOT be blocked)
      const encrypted3 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user3.address)
        .add64(200n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user3).swapTokens(
        encrypted3.handles[0],
        encrypted3.handles[1],
        user3.address,
        deadline,
        encrypted3.inputProof
      );

      // Verify all have pending operations
      const [, hasPending1, , op1] = await swapPair.getUserPendingOperationInfo(user1.address);
      const [, hasPending2, , op2] = await swapPair.getUserPendingOperationInfo(user2.address);
      const [, hasPending3, , op3] = await swapPair.getUserPendingOperationInfo(user3.address);

      expect(hasPending1).to.equal(true);
      expect(hasPending2).to.equal(true);
      expect(hasPending3).to.equal(true);
      expect(op1).to.equal(3); // Swap
      expect(op2).to.equal(3); // Swap
      expect(op3).to.equal(3); // Swap

      console.log("Queue Mode: 3 users swapping simultaneously");
    });

    it("should block same user from concurrent swap", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // User1 first swap
      const encrypted1 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted1.handles[0],
        encrypted1.handles[1],
        user1.address,
        deadline,
        encrypted1.inputProof
      );

      // User1 tries second swap (should be blocked)
      const encrypted2 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(50n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await expect(
        swapPair.connect(user1).swapTokens(
          encrypted2.handles[0],
          encrypted2.handles[1],
          user1.address,
          deadline,
          encrypted2.inputProof
        )
      ).to.be.revertedWithCustomError(swapPair, "UserHasPendingOperation");

      console.log("Same user correctly blocked from concurrent swaps");
    });
  });

  describe("Swap to Different Recipient", function () {
    it("should allow swap to different address", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      // User1 swaps but sends output to user2
      const tx = await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user2.address, // Different recipient
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

      expect(decryptionEvent).to.not.be.undefined;
      console.log("Swap to different recipient initiated successfully");
    });
  });

  describe("DecryptionPending Event Details", function () {
    it("should emit DecryptionPending with correct swap details", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      const tx = await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
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
      expect(decoded.args.operation).to.equal(3); // Swap
      expect(decoded.args.handles.length).to.be.greaterThan(0);

      console.log("DecryptionPending event details:");
      console.log(`  from: ${decoded.args.from}`);
      console.log(`  requestID: ${decoded.args.requestID}`);
      console.log(`  operation: Swap (3)`);
      console.log(`  handles count: ${decoded.args.handles.length}`);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero swap amounts", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(0n)
        .add64(0n)
        .encrypt();

      // Zero amounts should still initiate (handled in callback)
      await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
        deadline,
        encrypted.inputProof
      );

      const [, hasPending] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(true);
      console.log("Zero swap amounts handled gracefully");
    });

    it("should reject expired deadline", async function () {
      const pastDeadline = Math.floor(Date.now() / 1000) - 100;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await expect(
        swapPair.connect(user1).swapTokens(
          encrypted.handles[0],
          encrypted.handles[1],
          user1.address,
          pastDeadline,
          encrypted.inputProof
        )
      ).to.be.revertedWithCustomError(swapPair, "Expired");

      console.log("Expired deadline correctly rejected");
    });
  });

  describe("Mixed Operations - Queue Mode", function () {
    it("should allow user to swap while another adds liquidity", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // User1 adds liquidity
      const encryptedLiq = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(1000n * SCALING_FACTOR)
        .add64(500n * SCALING_FACTOR)
        .encrypt();

      await swapPair.connect(user1).addLiquidity(
        encryptedLiq.handles[0],
        encryptedLiq.handles[1],
        deadline,
        encryptedLiq.inputProof
      );

      // User2 swaps (should NOT be blocked)
      const encryptedSwap = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user2.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user2).swapTokens(
        encryptedSwap.handles[0],
        encryptedSwap.handles[1],
        user2.address,
        deadline,
        encryptedSwap.inputProof
      );

      // Verify both have pending operations
      const [, hasPending1, , op1] = await swapPair.getUserPendingOperationInfo(user1.address);
      const [, hasPending2, , op2] = await swapPair.getUserPendingOperationInfo(user2.address);

      expect(hasPending1).to.equal(true);
      expect(hasPending2).to.equal(true);
      expect(op1).to.equal(1); // AddLiquidity
      expect(op2).to.equal(3); // Swap

      console.log("Queue Mode: AddLiquidity and Swap running concurrently");
    });
  });
});
