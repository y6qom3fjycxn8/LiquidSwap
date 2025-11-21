const hre = require("hardhat");

async function main() {
  console.log("🔄 Requesting refund for pending operation...\n");

  const deploymentPath = "./deployments/sepolia-latest.json";
  const deployment = require(`../${deploymentPath}`);

  const pairAddress = deployment.contracts.swapPair.address;
  console.log(`📍 Swap Pair: ${pairAddress}\n`);

  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 Requesting from: ${signer.address}\n`);

  const pair = await hre.ethers.getContractAt("LiquidSwapPair", pairAddress);

  try {
    // Get current pending status
    const [requestID, isPending, timestamp, operation] = await pair.getPendingDecryptionInfo();

    if (!isPending) {
      console.log("✅ No pending operation. Refund not needed.");
      return;
    }

    const operationNames = ["None", "AddLiquidity", "RemoveLiquidity", "Swap"];
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Pending Operation: ${operationNames[operation]}`);
    console.log(`Request ID:        ${requestID.toString()}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Request refund based on operation type
    let tx;
    const opNum = Number(operation);
    console.log(`🔍 Operation number: ${opNum} (type: ${typeof operation})\n`);

    if (opNum === 1) {
      // AddLiquidity
      console.log("🔄 Requesting liquidity adding refund...");
      tx = await pair.requestLiquidityAddingRefund(requestID);
    } else if (opNum === 2) {
      // RemoveLiquidity
      console.log("🔄 Requesting liquidity removal refund...");
      tx = await pair.requestLiquidityRemovalRefund(requestID);
    } else if (opNum === 3) {
      // Swap
      console.log("🔄 Requesting swap refund...");
      tx = await pair.requestSwapRefund(requestID);
    } else {
      console.log(`❌ Unknown operation type: ${opNum}`);
      return;
    }

    console.log(`📝 Transaction hash: ${tx.hash}`);
    console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);
    console.log("\n⏳ Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log(`✅ Refund confirmed in block ${receipt.blockNumber}`);
    console.log("\n🎉 Refund successful! You can now perform new operations.");

  } catch (error) {
    console.error("❌ Error requesting refund:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
