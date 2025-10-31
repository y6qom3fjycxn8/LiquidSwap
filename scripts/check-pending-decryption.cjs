const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking pending decryption status...\n");

  const deploymentPath = "./deployments/sepolia-latest.json";
  const deployment = require(`../${deploymentPath}`);

  const pairAddress = deployment.contracts.swapPair.address;
  console.log(`📍 Swap Pair: ${pairAddress}\n`);

  const pair = await hre.ethers.getContractAt("CAMMPair", pairAddress);

  try {
    const [requestID, isPending, timestamp, operation] = await pair.getPendingDecryptionInfo();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 PENDING DECRYPTION STATUS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Request ID:   ${requestID.toString()}`);
    console.log(`Is Pending:   ${isPending}`);
    console.log(`Timestamp:    ${timestamp.toString()}`);

    const operationNames = ["None", "AddLiquidity", "RemoveLiquidity", "Swap"];
    console.log(`Operation:    ${operationNames[operation] || operation}`);

    if (isPending) {
      const now = Math.floor(Date.now() / 1000);
      const age = now - Number(timestamp);
      console.log(`Age:          ${age} seconds (${Math.floor(age / 60)} minutes)`);

      console.log("\n⚠️  Decryption is pending!");
      console.log("This will block new operations until:");
      console.log("1. The decryption completes (handled by Zama oracle)");
      console.log("2. Or you request a refund using requestLiquidityAddingRefund/requestSwapRefund");
    } else {
      console.log("\n✅ No pending decryption. Ready for new operations.");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  } catch (error) {
    console.error("❌ Error checking pending decryption:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
