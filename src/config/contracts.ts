import { sepolia } from 'wagmi/chains';

// CAMMPair Contract Address on Sepolia (to be filled after deployment)
export const CAMM_PAIR_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// Token addresses (to be filled after deployment)
export const TOKEN0_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const TOKEN1_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export const CHAIN_ID = sepolia.id;

// CAMMPair ABI - Core functions for liquidity and swapping
export const CAMM_PAIR_ABI = [
  // Read functions
  {
    inputs: [],
    name: 'scalingFactor',
    outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MINIMUM_LIQUIDITY',
    outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0Address',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1Address',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPendingDecryptionInfo',
    outputs: [
      { internalType: 'uint256', name: 'requestID', type: 'uint256' },
      { internalType: 'bool', name: 'isPending', type: 'bool' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'enum CAMMPair.Operation', name: 'operation', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // Write functions - Add Liquidity (encrypted)
  {
    inputs: [
      { internalType: 'externalEuint64', name: 'amount0', type: 'bytes' },
      { internalType: 'externalEuint64', name: 'amount1', type: 'bytes' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'addLiquidity',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // Write functions - Remove Liquidity (encrypted)
  {
    inputs: [
      { internalType: 'externalEuint64', name: 'lpAmount', type: 'bytes' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'removeLiquidity',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // Write functions - Swap Tokens (encrypted)
  {
    inputs: [
      { internalType: 'externalEuint64', name: 'encryptedAmount0In', type: 'bytes' },
      { internalType: 'externalEuint64', name: 'encryptedAmount1In', type: 'bytes' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'swapTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // Refund functions
  {
    inputs: [{ internalType: 'uint256', name: 'requestID', type: 'uint256' }],
    name: 'requestLiquidityAddingRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'requestID', type: 'uint256' }],
    name: 'requestSwapRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'requestID', type: 'uint256' }],
    name: 'requestLiquidityRemovalRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'liquidityMinted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'liquidityBurnt',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'from', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'requestID', type: 'uint256' },
    ],
    name: 'decryptionRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'from', type: 'address' },
      { indexed: false, internalType: 'euint64', name: 'amount0In', type: 'uint256' },
      { indexed: false, internalType: 'euint64', name: 'amount1In', type: 'uint256' },
      { indexed: false, internalType: 'euint64', name: 'amount0Out', type: 'uint256' },
      { indexed: false, internalType: 'euint64', name: 'amount1Out', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'to', type: 'address' },
    ],
    name: 'Swap',
    type: 'event',
  },
] as const;

// ERC7984 Token ABI (subset for basic operations)
export const ERC7984_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
