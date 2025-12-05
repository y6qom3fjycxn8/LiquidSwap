require('@nomicfoundation/hardhat-toolbox');
require('@fhevm/hardhat-plugin');
require('dotenv').config();

// Chai configuration for better error messages
const chai = require('chai');
chai.config.truncateThreshold = 0;

module.exports = {
  solidity: {
    version: '0.8.27',
    settings: {
      optimizer: {
        enabled: true,
        runs: 50,
      },
      evmVersion: 'cancun',
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 'auto',
      timeout: 120000,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};
