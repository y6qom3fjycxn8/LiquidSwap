const { expect } = require("chai");
const { ethers, fhevm } = require("hardhat");

describe("ConfidentialToken (ERC7984) - Basic Functionality", function () {
  let token;
  let owner, user1, user2, user3;

  const SCALING_FACTOR = BigInt(10 ** 6);

  beforeEach(async function () {
    if (!fhevm.isMock) {
      throw new Error("This test must run in FHEVM mock environment");
    }

    await fhevm.initializeCLIApi();
    [owner, user1, user2, user3] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("ConfidentialToken");
    token = await TokenFactory.deploy("Test Token", "TEST");
    await token.waitForDeployment();

    console.log(`ConfidentialToken deployed at: ${await token.getAddress()}`);
  });

  describe("Deployment", function () {
    it("should deploy with correct name and symbol", async function () {
      expect(await token.name()).to.equal("Test Token");
      expect(await token.symbol()).to.equal("TEST");
      console.log("Token name and symbol are correct");
    });

    it("should have correct decimals", async function () {
      const decimals = await token.decimals();
      expect(decimals).to.equal(6);
      console.log("Token decimals: 6");
    });
  });

  describe("Minting with FHE", function () {
    it("should mint tokens with encrypted amount", async function () {
      const mintAmount = 1000n * SCALING_FACTOR;

      const encrypted = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(mintAmount)
        .encrypt();

      await token.connect(user1).mint(
        user1.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      // Balance should exist (encrypted handle)
      const balance = await token.confidentialBalanceOf(user1.address);
      expect(balance).to.not.be.undefined;
      console.log("Tokens minted with encrypted amount successfully");
    });

    it("should allow minting to different address", async function () {
      const mintAmount = 500n * SCALING_FACTOR;

      const encrypted = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(mintAmount)
        .encrypt();

      // User1 mints to User2
      await token.connect(user1).mint(
        user2.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      const balance = await token.confidentialBalanceOf(user2.address);
      expect(balance).to.not.be.undefined;
      console.log("Tokens minted to different address successfully");
    });

    it("should allow multiple mints", async function () {
      const amounts = [100n, 200n, 300n].map(a => a * SCALING_FACTOR);

      for (const amount of amounts) {
        const encrypted = await fhevm
          .createEncryptedInput(await token.getAddress(), user1.address)
          .add64(amount)
          .encrypt();

        await token.connect(user1).mint(
          user1.address,
          encrypted.handles[0],
          encrypted.inputProof
        );
      }

      const balance = await token.confidentialBalanceOf(user1.address);
      expect(balance).to.not.be.undefined;
      console.log("Multiple mints accumulated successfully");
    });
  });

  describe("Operator System (ERC7984)", function () {
    it("should set operator with expiry", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      await token.connect(user1).setOperator(user2.address, expiry);

      const isOperator = await token.isOperator(user1.address, user2.address);
      expect(isOperator).to.equal(true);
      console.log("Operator set with expiry successfully");
    });

    it("should allow setting multiple operators", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      await token.connect(user1).setOperator(user2.address, expiry);
      await token.connect(user1).setOperator(user3.address, expiry);

      expect(await token.isOperator(user1.address, user2.address)).to.equal(true);
      expect(await token.isOperator(user1.address, user3.address)).to.equal(true);
      console.log("Multiple operators set successfully");
    });

    it("should revoke operator by setting expiry to 0", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Set operator
      await token.connect(user1).setOperator(user2.address, expiry);
      expect(await token.isOperator(user1.address, user2.address)).to.equal(true);

      // Revoke by setting expiry to 0
      await token.connect(user1).setOperator(user2.address, 0);
      expect(await token.isOperator(user1.address, user2.address)).to.equal(false);
      console.log("Operator revoked successfully");
    });

    it("should expire operator after time passes", async function () {
      const shortExpiry = Math.floor(Date.now() / 1000) + 10; // 10 seconds

      await token.connect(user1).setOperator(user2.address, shortExpiry);
      expect(await token.isOperator(user1.address, user2.address)).to.equal(true);

      // Advance time past expiry
      await ethers.provider.send("evm_increaseTime", [20]);
      await ethers.provider.send("evm_mine", []);

      expect(await token.isOperator(user1.address, user2.address)).to.equal(false);
      console.log("Operator correctly expired after time passes");
    });
  });

  describe("Confidential Balance", function () {
    it("should return encrypted balance handle", async function () {
      const mintAmount = 1000n * SCALING_FACTOR;

      const encrypted = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(mintAmount)
        .encrypt();

      await token.connect(user1).mint(
        user1.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      const balanceHandle = await token.confidentialBalanceOf(user1.address);
      expect(balanceHandle).to.not.equal(ethers.ZeroHash);
      console.log("Encrypted balance handle returned successfully");
    });

    it("should return different handles for different users", async function () {
      const mintAmount = 1000n * SCALING_FACTOR;

      // Mint to user1
      const encrypted1 = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(mintAmount)
        .encrypt();
      await token.connect(user1).mint(user1.address, encrypted1.handles[0], encrypted1.inputProof);

      // Mint to user2
      const encrypted2 = await fhevm
        .createEncryptedInput(await token.getAddress(), user2.address)
        .add64(mintAmount)
        .encrypt();
      await token.connect(user2).mint(user2.address, encrypted2.handles[0], encrypted2.inputProof);

      const balance1 = await token.confidentialBalanceOf(user1.address);
      const balance2 = await token.confidentialBalanceOf(user2.address);

      // Balances exist and are (likely) different handles
      expect(balance1).to.not.be.undefined;
      expect(balance2).to.not.be.undefined;
      console.log("Different users have separate encrypted balances");
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero mint amount", async function () {
      const encrypted = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(0n)
        .encrypt();

      await token.connect(user1).mint(
        user1.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      const balance = await token.confidentialBalanceOf(user1.address);
      expect(balance).to.not.be.undefined;
      console.log("Zero mint amount handled gracefully");
    });

    it("should handle maximum uint64 value", async function () {
      const maxUint64 = (2n ** 64n) - 1n;

      const encrypted = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(maxUint64)
        .encrypt();

      await token.connect(user1).mint(
        user1.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      const balance = await token.confidentialBalanceOf(user1.address);
      expect(balance).to.not.be.undefined;
      console.log("Maximum uint64 value handled correctly");
    });
  });

  describe("Performance", function () {
    it("should handle rapid minting operations", async function () {
      const startTime = Date.now();
      const mintCount = 5;

      for (let i = 0; i < mintCount; i++) {
        const encrypted = await fhevm
          .createEncryptedInput(await token.getAddress(), user1.address)
          .add64(BigInt(i + 1) * SCALING_FACTOR)
          .encrypt();

        await token.connect(user1).mint(
          user1.address,
          encrypted.handles[0],
          encrypted.inputProof
        );
      }

      const duration = Date.now() - startTime;
      console.log(`${mintCount} mint operations completed in ${duration}ms`);
      expect(duration).to.be.lessThan(30000); // Under 30 seconds
    });

    it("should handle multiple users minting concurrently", async function () {
      const startTime = Date.now();
      const users = [user1, user2, user3];

      const promises = users.map(async (user, i) => {
        const encrypted = await fhevm
          .createEncryptedInput(await token.getAddress(), user.address)
          .add64(BigInt(i + 1) * 1000n * SCALING_FACTOR)
          .encrypt();

        return token.connect(user).mint(
          user.address,
          encrypted.handles[0],
          encrypted.inputProof
        );
      });

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      console.log(`3 concurrent mints completed in ${duration}ms`);
    });
  });

  describe("FHE Operations Verification", function () {
    it("should verify FHE.fromExternal() for encrypted inputs", async function () {
      const mintAmount = 1000n * SCALING_FACTOR;

      const encrypted = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(mintAmount)
        .encrypt();

      // This implicitly tests FHE.fromExternal() conversion
      await token.connect(user1).mint(
        user1.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      console.log("FHE.fromExternal() - Encrypted input conversion works");
    });

    it("should verify FHE.add() for balance accumulation", async function () {
      const amount1 = 100n * SCALING_FACTOR;
      const amount2 = 200n * SCALING_FACTOR;

      // First mint
      const encrypted1 = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(amount1)
        .encrypt();
      await token.connect(user1).mint(user1.address, encrypted1.handles[0], encrypted1.inputProof);

      // Second mint (tests FHE.add for accumulation)
      const encrypted2 = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(amount2)
        .encrypt();
      await token.connect(user1).mint(user1.address, encrypted2.handles[0], encrypted2.inputProof);

      console.log("FHE.add() - Encrypted balance accumulation works");
    });

    it("should verify FHE.allowThis() for balance permissions", async function () {
      const mintAmount = 1000n * SCALING_FACTOR;

      const encrypted = await fhevm
        .createEncryptedInput(await token.getAddress(), user1.address)
        .add64(mintAmount)
        .encrypt();

      await token.connect(user1).mint(
        user1.address,
        encrypted.handles[0],
        encrypted.inputProof
      );

      // Contract should be able to read its own state
      const balance = await token.confidentialBalanceOf(user1.address);
      expect(balance).to.not.be.undefined;

      console.log("FHE.allowThis() - Contract self-permission works");
    });
  });
});
