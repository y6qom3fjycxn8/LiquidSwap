const { expect } = require("chai");
const { ethers, fhevm } = require("hardhat");

describe("LiquidSwapPair - Refund Mechanism", function () {
  let swapLib;
  let token0, token1;
  let swapPair;
  let owner, user1, user2;

  const SCALING_FACTOR = BigInt(10 ** 6);
  const MINT_AMOUNT = 10000n * SCALING_FACTOR;
  const MAX_OPERATION_TIME = 5 * 60; // 5 minutes in seconds

  beforeEach(async function () {
    if (!fhevm.isMock) {
      throw new Error("This test must run in FHEVM mock environment");
    }

    await fhevm.initializeCLIApi();
    [owner, user1, user2] = await ethers.getSigners();

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

    // Mint tokens and set operators
    const users = [user1, user2];
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

  describe("Swap Refund", function () {
    it("should not allow refund before timeout", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Initiate swap
      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
        deadline,
        encrypted.inputProof
      );

      // Get request ID
      const [requestID, hasPending] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(true);

      // Try to refund immediately (should fail - not expired)
      await expect(
        swapPair.connect(user1).requestSwapRefund(requestID)
      ).to.be.revertedWithCustomError(swapPair, "OperationNotExpired");

      console.log("Refund before timeout correctly rejected");
    });

    it("should allow refund after timeout", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Initiate swap
      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
        deadline,
        encrypted.inputProof
      );

      const [requestID] = await swapPair.getUserPendingOperationInfo(user1.address);

      // Advance time past MAX_OPERATION_TIME
      await ethers.provider.send("evm_increaseTime", [MAX_OPERATION_TIME + 1]);
      await ethers.provider.send("evm_mine", []);

      // Request refund (should succeed)
      const tx = await swapPair.connect(user1).requestSwapRefund(requestID);
      const receipt = await tx.wait();

      // Check for Refund event
      const refundEvent = receipt.logs.find(log => {
        try {
          const decoded = swapPair.interface.parseLog(log);
          return decoded.name === 'Refund';
        } catch {
          return false;
        }
      });

      expect(refundEvent).to.not.be.undefined;
      console.log("Swap refund successful after timeout");

      // Verify user no longer has pending operation
      const [, hasPending] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(false);
      console.log("User pending operation cleared after refund");
    });

    it("should emit Refund event with correct details", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
        deadline,
        encrypted.inputProof
      );

      const [requestID] = await swapPair.getUserPendingOperationInfo(user1.address);

      await ethers.provider.send("evm_increaseTime", [MAX_OPERATION_TIME + 1]);
      await ethers.provider.send("evm_mine", []);

      const tx = await swapPair.connect(user1).requestSwapRefund(requestID);
      const receipt = await tx.wait();

      const refundEvent = receipt.logs.find(log => {
        try {
          const decoded = swapPair.interface.parseLog(log);
          return decoded.name === 'Refund';
        } catch {
          return false;
        }
      });

      const decoded = swapPair.interface.parseLog(refundEvent);
      expect(decoded.args.from).to.equal(user1.address);
      expect(decoded.args.requestID).to.equal(requestID);

      console.log("Refund event details:");
      console.log(`  from: ${decoded.args.from}`);
      console.log(`  blockNumber: ${decoded.args.blockNumber}`);
      console.log(`  requestID: ${decoded.args.requestID}`);
    });
  });

  describe("Add Liquidity Refund", function () {
    it("should allow liquidity adding refund after timeout", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(1000n * SCALING_FACTOR)
        .add64(500n * SCALING_FACTOR)
        .encrypt();

      await swapPair.connect(user1).addLiquidity(
        encrypted.handles[0],
        encrypted.handles[1],
        deadline,
        encrypted.inputProof
      );

      const [requestID, hasPending, , operation] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(true);
      expect(operation).to.equal(1); // AddLiquidity

      // Advance time
      await ethers.provider.send("evm_increaseTime", [MAX_OPERATION_TIME + 1]);
      await ethers.provider.send("evm_mine", []);

      // Request refund
      const tx = await swapPair.connect(user1).requestLiquidityAddingRefund(requestID);
      const receipt = await tx.wait();

      const refundEvent = receipt.logs.find(log => {
        try {
          const decoded = swapPair.interface.parseLog(log);
          return decoded.name === 'Refund';
        } catch {
          return false;
        }
      });

      expect(refundEvent).to.not.be.undefined;
      console.log("Liquidity adding refund successful after timeout");
    });
  });

  describe("Access Control for Refunds", function () {
    it("should only allow request owner to refund", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // User1 initiates swap
      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
        deadline,
        encrypted.inputProof
      );

      const [requestID] = await swapPair.getUserPendingOperationInfo(user1.address);

      // Advance time
      await ethers.provider.send("evm_increaseTime", [MAX_OPERATION_TIME + 1]);
      await ethers.provider.send("evm_mine", []);

      // User2 tries to refund User1's operation (should fail)
      await expect(
        swapPair.connect(user2).requestSwapRefund(requestID)
      ).to.be.revertedWithCustomError(swapPair, "NotRequestOwner");

      console.log("Non-owner refund correctly rejected");
    });

    it("should reject refund for invalid request ID", async function () {
      const invalidRequestID = 999999n;

      await expect(
        swapPair.connect(user1).requestSwapRefund(invalidRequestID)
      ).to.be.revertedWithCustomError(swapPair, "RequestNotActive");

      console.log("Invalid request ID correctly rejected");
    });
  });

  describe("Queue Mode - Refund Independence", function () {
    it("should allow user to initiate new operation after refund", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // First operation
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

      const [requestID1] = await swapPair.getUserPendingOperationInfo(user1.address);

      // Advance time and refund
      await ethers.provider.send("evm_increaseTime", [MAX_OPERATION_TIME + 1]);
      await ethers.provider.send("evm_mine", []);

      await swapPair.connect(user1).requestSwapRefund(requestID1);

      // User should now be able to initiate new operation
      const encrypted2 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(200n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted2.handles[0],
        encrypted2.handles[1],
        user1.address,
        deadline + 7200, // New deadline
        encrypted2.inputProof
      );

      const [requestID2, hasPending] = await swapPair.getUserPendingOperationInfo(user1.address);
      expect(hasPending).to.equal(true);
      expect(requestID2).to.not.equal(requestID1);

      console.log("User can initiate new operation after refund");
    });

    it("should not affect other users when one user refunds", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // User1 initiates swap
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

      // User2 initiates swap
      const encrypted2 = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user2.address)
        .add64(200n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user2).swapTokens(
        encrypted2.handles[0],
        encrypted2.handles[1],
        user2.address,
        deadline,
        encrypted2.inputProof
      );

      const [requestID1] = await swapPair.getUserPendingOperationInfo(user1.address);

      // Advance time
      await ethers.provider.send("evm_increaseTime", [MAX_OPERATION_TIME + 1]);
      await ethers.provider.send("evm_mine", []);

      // User1 refunds
      await swapPair.connect(user1).requestSwapRefund(requestID1);

      // User2's operation should still be pending
      const [, hasPending2] = await swapPair.getUserPendingOperationInfo(user2.address);
      expect(hasPending2).to.equal(true);

      console.log("User1 refund does not affect User2's pending operation");
    });
  });

  describe("Timeout Constants", function () {
    it("should have correct MAX_OPERATION_TIME (5 minutes)", async function () {
      // This is implicitly tested by the refund timing tests
      // MAX_OPERATION_TIME = 5 minutes = 300 seconds
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const encrypted = await fhevm
        .createEncryptedInput(await swapPair.getAddress(), user1.address)
        .add64(100n * SCALING_FACTOR)
        .add64(0n)
        .encrypt();

      await swapPair.connect(user1).swapTokens(
        encrypted.handles[0],
        encrypted.handles[1],
        user1.address,
        deadline,
        encrypted.inputProof
      );

      const [requestID] = await swapPair.getUserPendingOperationInfo(user1.address);

      // At 4 minutes, should still fail
      await ethers.provider.send("evm_increaseTime", [4 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        swapPair.connect(user1).requestSwapRefund(requestID)
      ).to.be.revertedWithCustomError(swapPair, "OperationNotExpired");

      // At 5+ minutes, should succeed
      await ethers.provider.send("evm_increaseTime", [2 * 60]); // Total 6 minutes
      await ethers.provider.send("evm_mine", []);

      await swapPair.connect(user1).requestSwapRefund(requestID);

      console.log("MAX_OPERATION_TIME (5 minutes) verified correctly");
    });
  });
});
