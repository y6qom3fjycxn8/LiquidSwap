import { sepolia } from 'wagmi/chains';

// Swap Pair Contract Address on Sepolia (fhEVM 0.9.1 - Queue Mode)
export const SWAP_PAIR_ADDRESS = '0xBd616c7bC7423D07a11018ed324d178586DC6128' as const;

// Token addresses (LUSD/LETH)
export const TOKEN0_ADDRESS = '0x1A15cF37a5E13e01774d2007DEA79Fc6eA52CEa9' as const;
export const TOKEN1_ADDRESS = '0xc5731f5Da1E7d8dBfc99f187E1766f91e8e59bFB' as const;

export const CHAIN_ID = sepolia.id;

// Swap Pair ABI - Core functions for liquidity and swapping (fhEVM 0.9.1)
export const SWAP_PAIR_ABI = [
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
    name: 'getPendingOperationInfo',
    outputs: [
      { internalType: 'uint256', name: 'requestID', type: 'uint256' },
      { internalType: 'bool', name: 'isPending', type: 'bool' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'enum LiquidSwapPair.Operation', name: 'operation', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Queue Mode: Get pending operation for a specific user
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getUserPendingOperationInfo',
    outputs: [
      { internalType: 'uint256', name: 'requestID', type: 'uint256' },
      { internalType: 'bool', name: 'hasPending', type: 'bool' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'enum LiquidSwapPair.Operation', name: 'operation', type: 'uint8' },
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
  {
    inputs: [],
    name: 'hasLiquidity',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // Write functions - Add Liquidity (encrypted)
  {
    inputs: [
      { internalType: 'externalEuint64', name: 'amount0', type: 'bytes32' },
      { internalType: 'externalEuint64', name: 'amount1', type: 'bytes32' },
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
      { internalType: 'externalEuint64', name: 'lpAmount', type: 'bytes32' },
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
      { internalType: 'externalEuint64', name: 'encryptedAmount0In', type: 'bytes32' },
      { internalType: 'externalEuint64', name: 'encryptedAmount1In', type: 'bytes32' },
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

  // Callback functions (fhEVM 0.9.1 self-relaying pattern)
  {
    inputs: [
      { internalType: 'uint256', name: 'requestID', type: 'uint256' },
      { internalType: 'bytes', name: 'cleartexts', type: 'bytes' },
      { internalType: 'bytes', name: 'decryptionProof', type: 'bytes' },
    ],
    name: 'addLiquidityCallback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'requestID', type: 'uint256' },
      { internalType: 'bytes', name: 'cleartexts', type: 'bytes' },
      { internalType: 'bytes', name: 'decryptionProof', type: 'bytes' },
    ],
    name: 'removeLiquidityCallback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'requestID', type: 'uint256' },
      { internalType: 'bytes', name: 'cleartexts', type: 'bytes' },
      { internalType: 'bytes', name: 'decryptionProof', type: 'bytes' },
    ],
    name: 'swapTokensCallback',
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
  // DecryptionPending event (fhEVM 0.9.1) - emitted when operation needs client-side decryption
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'requestID', type: 'uint256' },
      { indexed: false, internalType: 'enum LiquidSwapPair.Operation', name: 'operation', type: 'uint8' },
      { indexed: false, internalType: 'bytes32[]', name: 'handles', type: 'bytes32[]' },
    ],
    name: 'DecryptionPending',
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
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'from', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'requestID', type: 'uint256' },
    ],
    name: 'Refund',
    type: 'event',
  },
] as const;

// ERC7984 Token ABI (subset for basic operations)
export const ERC7984_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'confidentialBalanceOf',
    outputs: [{ internalType: 'euint64', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'holder', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'isOperator',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'operator', type: 'address' },
      { internalType: 'uint48', name: 'until', type: 'uint48' },
    ],
    name: 'setOperator',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'externalEuint64', name: 'encryptedAmount', type: 'bytes32' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'mint',
    outputs: [{ internalType: 'euint64', name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
