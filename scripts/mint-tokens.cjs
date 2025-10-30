const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🪙 Starting Token Minting...\n');

  // Load deployment info
  const deploymentPath = path.join(__dirname, '../deployments/sepolia-latest.json');
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Deployment file not found. Please deploy contracts first.');
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const token0Address = deployment.contracts.token0.address;
  const token1Address = deployment.contracts.token1.address;

  console.log('📍 Token Addresses:');
  console.log('   TOKEN0 (LUSD):', token0Address);
  console.log('   TOKEN1 (LETH):', token1Address);
  console.log('');

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log('👤 Minting from account:', deployer.address);
  console.log('');

  // Get contract instances
  const Token0 = await hre.ethers.getContractFactory('ConfidentialToken');
  const token0 = Token0.attach(token0Address);

  const Token1 = await hre.ethers.getContractFactory('ConfidentialToken');
  const token1 = Token1.attach(token1Address);

  // Get recipient address from command line or use deployer
  const recipientAddress = process.env.RECIPIENT_ADDRESS || deployer.address;
  console.log('🎯 Recipient:', recipientAddress);
  console.log('');

  // Mint amounts (in plaintext for testing)
  const mintAmount = 1000000; // 1M tokens

  console.log('📦 Minting 1,000,000 LUSD...');
  try {
    const mint0Tx = await token0.mintPlaintext(recipientAddress, mintAmount);
    await mint0Tx.wait();
    console.log('✅ Minted 1,000,000 LUSD');
    console.log('   Transaction:', mint0Tx.hash);
  } catch (error) {
    console.error('❌ Failed to mint LUSD:', error.message);
  }
  console.log('');

  console.log('📦 Minting 1,000,000 LETH...');
  try {
    const mint1Tx = await token1.mintPlaintext(recipientAddress, mintAmount);
    await mint1Tx.wait();
    console.log('✅ Minted 1,000,000 LETH');
    console.log('   Transaction:', mint1Tx.hash);
  } catch (error) {
    console.error('❌ Failed to mint LETH:', error.message);
  }
  console.log('');

  console.log('🎉 Minting complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Recipient:', recipientAddress);
  console.log('LUSD Balance: 1,000,000');
  console.log('LETH Balance: 1,000,000');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 TIP: To mint to a different address, use:');
  console.log('   RECIPIENT_ADDRESS=0x... npm run mint');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
