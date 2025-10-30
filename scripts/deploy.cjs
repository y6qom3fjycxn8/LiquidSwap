const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Starting LiquidSwap Deployment...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('📍 Deploying from account:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', hre.ethers.formatEther(balance), 'ETH\n');

  if (balance < hre.ethers.parseEther('0.1')) {
    console.warn('⚠️  Warning: Low balance. You may need more ETH for gas fees.\n');
  }

  // Step 1: Deploy Token0 (ConfidentialToken)
  console.log('📦 Step 1: Deploying TOKEN0 (Private Token)...');
  const Token0 = await hre.ethers.getContractFactory('ConfidentialToken');
  const token0 = await Token0.deploy('Liquid USD', 'LUSD', '');
  await token0.waitForDeployment();
  const token0Address = await token0.getAddress();
  console.log('✅ TOKEN0 deployed to:', token0Address);
  console.log('   Name: Liquid USD');
  console.log('   Symbol: LUSD\n');

  // Step 2: Deploy Token1 (ConfidentialToken)
  console.log('📦 Step 2: Deploying TOKEN1 (Private Token)...');
  const Token1 = await hre.ethers.getContractFactory('ConfidentialToken');
  const token1 = await Token1.deploy('Liquid ETH', 'LETH', '');
  await token1.waitForDeployment();
  const token1Address = await token1.getAddress();
  console.log('✅ TOKEN1 deployed to:', token1Address);
  console.log('   Name: Liquid ETH');
  console.log('   Symbol: LETH\n');

  // Step 3: Deploy PairLib library
  console.log('📦 Step 3: Deploying Swap Library...');
  const CAMMPairLib = await hre.ethers.getContractFactory('CAMMPairLib');
  const cammPairLib = await CAMMPairLib.deploy();
  await cammPairLib.waitForDeployment();
  const cammPairLibAddress = await cammPairLib.getAddress();
  console.log('✅ Swap Library deployed to:', cammPairLibAddress, '\n');

  // Step 4: Deploy Swap Pair with linked library
  console.log('📦 Step 4: Deploying Swap Pair Contract...');
  const CAMMPair = await hre.ethers.getContractFactory('CAMMPair', {
    libraries: {
      CAMMPairLib: cammPairLibAddress,
    },
  });
  const cammPair = await CAMMPair.deploy(hre.ethers.ZeroAddress);
  await cammPair.waitForDeployment();
  const cammPairAddress = await cammPair.getAddress();
  console.log('✅ Swap Pair deployed to:', cammPairAddress, '\n');

  // Step 5: Initialize Swap Pair with token addresses
  console.log('📦 Step 5: Initializing Swap Pair with tokens...');
  const initTx = await cammPair.initialize(token0Address, token1Address);
  await initTx.wait();
  console.log('✅ Swap Pair initialized successfully\n');

  // Step 6: Mint initial tokens to deployer (optional, for testing)
  console.log('📦 Step 6: Minting initial tokens for testing...');
  const mintAmount = 1000000; // 1M tokens each (plaintext)

  try {
    const mint0Tx = await token0.mintPlaintext(deployer.address, mintAmount);
    await mint0Tx.wait();
    console.log('✅ Minted 1,000,000 LUSD to deployer');

    const mint1Tx = await token1.mintPlaintext(deployer.address, mintAmount);
    await mint1Tx.wait();
    console.log('✅ Minted 1,000,000 LETH to deployer\n');
  } catch (error) {
    console.log('⚠️  Skipping initial minting (can be done later)\n');
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      token0: {
        address: token0Address,
        name: 'Liquid USD',
        symbol: 'LUSD',
      },
      token1: {
        address: token1Address,
        name: 'Liquid ETH',
        symbol: 'LETH',
      },
      swapLib: {
        address: cammPairLibAddress,
      },
      swapPair: {
        address: cammPairAddress,
        token0: token0Address,
        token1: token1Address,
      },
    },
  };

  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const timestamp = Date.now();
  fs.writeFileSync(
    path.join(deploymentsDir, `${hre.network.name}-${timestamp}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  fs.writeFileSync(
    path.join(deploymentsDir, `${hre.network.name}-latest.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log('📄 Deployment info saved to:');
  console.log(`   - deployments/${hre.network.name}-${timestamp}.json`);
  console.log(`   - deployments/${hre.network.name}-latest.json\n`);

  console.log('🎉 Deployment complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TOKEN0 (LUSD):', token0Address);
  console.log('TOKEN1 (LETH):', token1Address);
  console.log('Swap Pair:    ', cammPairAddress);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📋 NEXT STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Update src/config/contracts.ts:');
  console.log(`   SWAP_PAIR_ADDRESS = '${cammPairAddress}'`);
  console.log(`   TOKEN0_ADDRESS = '${token0Address}'`);
  console.log(`   TOKEN1_ADDRESS = '${token1Address}'`);
  console.log('');
  console.log('2. Verify contracts (optional):');
  console.log('   npx hardhat verify --network sepolia', token0Address, '"Liquid USD" "LUSD" ""');
  console.log('   npx hardhat verify --network sepolia', token1Address, '"Liquid ETH" "LETH" ""');
  console.log('   npx hardhat verify --network sepolia', cammPairAddress, hre.ethers.ZeroAddress);
  console.log('');
  console.log('3. View on Etherscan:');
  console.log(`   https://sepolia.etherscan.io/address/${cammPairAddress}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
