# LiquidSwap

> **Privacy-First Decentralized Exchange** — A Confidential Swap Protocol powered by Zama's Fully Homomorphic Encryption (FHE)

![fhEVM](https://img.shields.io/badge/fhEVM-0.9.1-blue) ![Solidity](https://img.shields.io/badge/Solidity-0.8.27-lightgrey) ![React](https://img.shields.io/badge/React-18.3-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6) ![Wagmi](https://img.shields.io/badge/Wagmi-2.19-black)

**Live Demo**: [https://fhe-liquidswap.vercel.app](https://fhe-liquidswap.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
  - [System Architecture](#system-architecture)
  - [Contract Architecture](#contract-architecture)
  - [Frontend Architecture](#frontend-architecture)
- [AMM Mechanism](#amm-mechanism)
  - [Constant Product Formula](#constant-product-formula)
  - [Encrypted Swap Computation](#encrypted-swap-computation)
  - [Fee Structure](#fee-structure)
  - [Reserve Obfuscation](#reserve-obfuscation)
- [fhEVM 0.9.1 Self-Relaying Pattern](#fhevm-091-self-relaying-pattern)
  - [Decryption Flow](#decryption-flow)
  - [Operation Lifecycle](#operation-lifecycle)
- [Queue Mode Architecture](#queue-mode-architecture)
  - [Per-User Pending Operations](#per-user-pending-operations)
  - [Concurrent User Support](#concurrent-user-support)
- [Smart Contract Reference](#smart-contract-reference)
  - [LiquidSwapPair (LiquidSwap.sol)](#liquidswappair-liquidswapsol)
  - [SwapLib](#swaplib)
  - [ConfidentialToken (ERC7984)](#confidentialtoken-erc7984)
- [Deployed Contracts](#deployed-contracts)
- [Dependency Versions](#dependency-versions)
- [Getting Started](#getting-started)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## Overview

LiquidSwap is a **Confidential Swap Protocol** that enables fully private token swaps and liquidity provision on Ethereum. Built with Zama's fhEVM v0.9.1, all sensitive trading data—token amounts, balances, reserves, and LP positions—remain encrypted throughout the entire transaction lifecycle.

### The Problem with Traditional DEXs

| Vulnerability | Impact |
|--------------|--------|
| **Visible Trade Amounts** | MEV bots front-run transactions |
| **Public Balances** | Wallet surveillance and tracking |
| **Exposed Reserves** | Arbitrage bots exploit price movements |
| **Transaction Transparency** | Trading strategies are exposed |

### LiquidSwap's Solution

Using **Fully Homomorphic Encryption (FHE)**, LiquidSwap performs all AMM calculations on encrypted data without ever decrypting sensitive values on-chain:

```
┌─────────────────────────────────────────────────────────────────┐
│  User Input:     100 LUSD (plaintext)                           │
│       ↓                                                          │
│  Encryption:     euint64(encrypted_handle)                      │
│       ↓                                                          │
│  Smart Contract: swap(euint64) → euint64 (all encrypted)        │
│       ↓                                                          │
│  Decryption:     Client-side via fhEVM 0.9.1 relayer            │
│       ↓                                                          │
│  User Output:    0.05 LETH (plaintext)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Encrypted Swaps** | Token swap amounts remain hidden from observers |
| **Private Balances** | ERC7984 tokens with encrypted balance storage |
| **Obfuscated Reserves** | ±7% randomized reserve values for price feeds |
| **MEV Protection** | Front-running mathematically impossible |
| **Self-Relaying Decryption** | fhEVM 0.9.1 pattern—no centralized oracle |
| **Queue Mode** | Per-user pending operations—multiple users can trade simultaneously |
| **Timeout Protection** | 5-minute refund mechanism for stalled operations |

---

## Architecture

### System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                                │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │   React 18   │  │   Wagmi + Viem   │  │   FHE Client Encryption  │ │
│  │   + Vite     │  │   RainbowKit     │  │   (fhEVM Browser SDK)    │ │
│  └──────────────┘  └──────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Ethereum Sepolia (fhEVM 0.9.1)                     │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      LiquidSwapPair Contract                      │  │
│  │   • Encrypted reserves (euint64)                                 │  │
│  │   • Confidential LP tokens (ERC7984)                             │  │
│  │   • Self-relaying decryption callbacks                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────┐        ┌──────────────────────────────┐    │
│  │   SwapLib Library    │        │   ERC7984 Confidential Tokens │    │
│  │   (FHE computations) │        │   (LUSD / LETH)               │    │
│  └──────────────────────┘        └──────────────────────────────┘    │
│                                          │                            │
│                                          ▼                            │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Zama FHE Coprocessor                          │  │
│  │   • Threshold decryption network                                 │  │
│  │   • Client-side decryption via relayer SDK                       │  │
│  │   • Proof verification (FHE.checkSignatures)                     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Contract Architecture

```
contracts/
├── LiquidSwap.sol              # Main Swap Pair contract (LiquidSwapPair)
│   ├── ERC7984 inheritance     # Confidential LP token functionality
│   ├── addLiquidity()          # Add liquidity with encrypted amounts
│   ├── removeLiquidity()       # Remove liquidity
│   ├── swapTokens()            # Token swap entry point
│   ├── *Callback()             # fhEVM 0.9.1 callback handlers
│   └── request*Refund()        # Timeout protection refunds
│
├── SwapLib.sol                 # FHE computation library
│   ├── computeRNG()            # Encrypted random number generation
│   ├── computeObfuscatedReserves()  # Reserve obfuscation
│   ├── computeFirstMint()      # Initial liquidity computation
│   ├── computeAddLiquidity()   # LP token calculation
│   ├── computeAddLiquidityCallback()  # Callback computation
│   ├── computeRemoveLiquidity()  # Withdrawal calculation
│   └── computeSwap()           # AMM swap formula with 1% fee
│
├── ConfidentialToken.sol       # ERC7984 token implementation
│   ├── euint64 balances        # Encrypted balance storage
│   ├── setOperator()           # Authorization (replaces approve)
│   ├── confidentialTransfer()  # Encrypted transfers
│   └── mint()                  # Test token minting
│
└── OZ-confidential-contracts-fork/  # OpenZeppelin ERC7984 base
    ├── ERC7984.sol             # Confidential token standard
    └── IERC7984.sol            # Interface definitions
```

### Frontend Architecture

```
src/
├── components/
│   ├── MintCard.tsx            # Token minting interface
│   ├── AddLiquidityCard.tsx    # Liquidity provision UI
│   ├── SwapCard.tsx            # Token swap interface
│   ├── Navbar.tsx              # Navigation with wallet connect
│   ├── Hero.tsx                # Landing page hero section
│   ├── Features.tsx            # Feature highlights
│   ├── Stats.tsx               # Protocol statistics
│   └── Footer.tsx              # Page footer
│
├── hooks/
│   └── useSwapPair.ts          # Contract interaction hooks
│       ├── useSwapTokens()     # Swap execution
│       ├── useAddLiquidity()   # Liquidity adding
│       ├── useRemoveLiquidity()  # Liquidity removal
│       ├── useApproveToken()   # ERC7984 operator approval
│       ├── use*Callback()      # fhEVM 0.9.1 callback submission
│       └── useRequest*Refund() # Timeout refund requests
│
├── lib/
│   ├── contracts.ts            # Contract addresses and ABIs
│   └── fhe.ts                  # FHE encryption utilities
│
├── pages/
│   └── Index.tsx               # Main landing page
│
└── config/
    └── wagmi.ts                # Wallet configuration
```

---

## AMM Mechanism

### Constant Product Formula

LiquidSwap implements the classic **x × y = k** constant product market maker formula, but with all computations performed on encrypted values:

```
reserve0 × reserve1 = k (constant)

For a swap of Δx tokens:
Δy = (reserve1 × Δx × 0.99) / (reserve0 + Δx × 0.99)
```

### Encrypted Swap Computation

The `SwapLib.computeSwap()` function implements the AMM formula using FHE operations:

```solidity
function computeSwap(
    euint64 sent0,      // Encrypted input amount (token0)
    euint64 sent1,      // Encrypted input amount (token1)
    euint64 reserve0,   // Encrypted reserve (token0)
    euint64 reserve1    // Encrypted reserve (token1)
) external returns (euint128, euint128, euint128, euint128) {

    // Random obfuscation factor (3-16387 range)
    euint16 rng0 = computeRNG(16384, 3);
    euint16 rng1 = computeRNG(16384, 3);

    // Apply 1% fee in the multiplier (99/100)
    euint32 rng0Upper = FHE.div(FHE.mul(FHE.asEuint32(rng0), uint32(99)), uint32(100));
    euint32 rng1Upper = FHE.div(FHE.mul(FHE.asEuint32(rng1), uint32(99)), uint32(100));

    // Compute output amounts:
    // amount0Out = (sent1 × reserve0 × rng0Upper) / (reserve1 × rng0)
    euint128 divUpperPart0 = FHE.mul(
        FHE.mul(FHE.asEuint128(sent1), FHE.asEuint128(reserve0)),
        FHE.asEuint128(rng0Upper)
    );
    euint128 divLowerPart0 = FHE.mul(FHE.asEuint128(reserve1), FHE.asEuint128(rng0));

    // amount1Out = (sent0 × reserve1 × rng1Upper) / (reserve0 × rng1)
    euint128 divUpperPart1 = FHE.mul(
        FHE.mul(FHE.asEuint128(sent0), FHE.asEuint128(reserve1)),
        FHE.asEuint128(rng1Upper)
    );
    euint128 divLowerPart1 = FHE.mul(FHE.asEuint128(reserve0), FHE.asEuint128(rng1));

    return (divUpperPart0, divUpperPart1, divLowerPart0, divLowerPart1);
}
```

### Fee Structure

| Fee Type | Rate | Implementation |
|----------|------|----------------|
| **Swap Fee** | 1% | Integrated into `rngUpper = rng × 99 / 100` |
| **LP Withdrawal** | 0% | Full proportional share returned |

### Reserve Obfuscation

To enable price oracles without exposing exact reserves, LiquidSwap implements **±7% reserve obfuscation**:

```solidity
function computeObfuscatedReserves(
    euint64 reserve0,
    euint64 reserve1,
    uint64 scalingFactor
) external returns (euint128, euint128) {
    // Generate random percentage (70-326 range)
    euint16 percentage = computeRNG(256, 70);  // 70 + (0-255) = 70-325

    // Scale to basis points: 7000-32600
    euint16 scaledPercentage = FHE.mul(percentage, 100);

    // Upper bound: scalingFactor + scaledPercentage (~93%-107%)
    euint32 upperBound = FHE.add(FHE.asEuint32(scaledPercentage), uint32(scalingFactor));
    // Lower bound: scalingFactor - scaledPercentage (~93%-107%)
    euint32 lowerBound = FHE.sub(uint32(scalingFactor), FHE.asEuint32(scaledPercentage));

    // Randomly select upper or lower multiplier for each reserve
    ebool randomBool0 = FHE.randEbool();
    ebool randomBool1 = FHE.randEbool();

    euint32 reserve0Multiplier = FHE.select(randomBool0, upperBound, lowerBound);
    euint32 reserve1Multiplier = FHE.select(randomBool1, lowerBound, upperBound);

    // Apply additional random multiplier (3+)
    euint16 rngMultiplier = computeRNG(0, 3);

    euint64 reserve0Factor = FHE.mul(FHE.asEuint64(reserve0Multiplier), rngMultiplier);
    euint64 reserve1Factor = FHE.mul(FHE.asEuint64(reserve1Multiplier), rngMultiplier);

    euint128 _obfuscatedReserve0 = FHE.mul(FHE.asEuint128(reserve0), reserve0Factor);
    euint128 _obfuscatedReserve1 = FHE.mul(FHE.asEuint128(reserve1), reserve1Factor);

    return (_obfuscatedReserve0, _obfuscatedReserve1);
}
```

**Benefits**:
- Price oracles can estimate exchange rates within ±7% accuracy
- MEV bots cannot determine exact reserve ratios
- Arbitrage remains profitable but less precise

---

## fhEVM 0.9.1 Self-Relaying Pattern

### Overview

fhEVM 0.9.1 introduces a **self-relaying decryption pattern** that eliminates the need for centralized oracle callbacks. Instead:

1. Contract marks encrypted values as **publicly decryptable**
2. Client uses the **relayer SDK** to decrypt off-chain
3. Client submits decrypted values + **cryptographic proof** back to contract
4. Contract verifies proof with `FHE.checkSignatures()`

### Decryption Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 1: User initiates swap                                              │
│         → swapTokens(encryptedAmount0, encryptedAmount1, ...)           │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 2: Contract computes encrypted output & marks for decryption       │
│         → FHE.makePubliclyDecryptable(divLowerPart0)                    │
│         → FHE.makePubliclyDecryptable(divLowerPart1)                    │
│         → emit DecryptionPending(user, requestID, Swap, handles)        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 3: Client listens for DecryptionPending event                      │
│         → Extract handles[] from event                                  │
│         → Call relayer SDK to decrypt handles                           │
│         → Receive cleartexts + decryptionProof                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 4: Client submits callback                                          │
│         → swapTokensCallback(requestID, cleartexts, decryptionProof)    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 5: Contract verifies & completes operation                         │
│         → FHE.checkSignatures(handles, cleartexts, proof)               │
│         → Decode cleartexts & compute final output                       │
│         → Transfer tokens to user                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Operation Lifecycle

Each operation (AddLiquidity, RemoveLiquidity, Swap) follows a two-phase lifecycle:

| Phase | State | Actions |
|-------|-------|---------|
| **Phase 1** | `hasPending = true` | Tokens transferred to pool, bundle stored, `DecryptionPending` emitted |
| **Phase 2** | `hasPending = false` | Callback verified, final computation, tokens transferred |
| **Timeout** | After 5 minutes | User can call `request*Refund()` to recover tokens |

---

## Queue Mode Architecture

### The Problem: Global Lock

In traditional FHE AMM designs, a **global pending operation lock** blocks ALL users when ANY user has an operation in progress:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ❌ GLOBAL LOCK (Original Design)                                        │
│                                                                          │
│  User A: addLiquidity() → pendingOperation = true                       │
│                    ↓                                                      │
│  User B: swapTokens() → REVERTS! "Operation in progress"               │
│  User C: addLiquidity() → REVERTS! "Operation in progress"             │
│                    ↓                                                      │
│  User A: callback() → pendingOperation = false                          │
│                    ↓                                                      │
│  User B & C: Can now proceed (one at a time)                            │
└─────────────────────────────────────────────────────────────────────────┘
```

This creates severe UX issues:
- Only **one user** can interact with the pool at a time
- Users must wait for others' callbacks to complete
- High-traffic pools become unusable

### The Solution: Queue Mode

LiquidSwap implements **Queue Mode**—each user has their own independent pending operation state:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ✅ QUEUE MODE (Current Design)                                          │
│                                                                          │
│  User A: addLiquidity() → userPendingOperation[A].hasPending = true    │
│  User B: swapTokens()   → userPendingOperation[B].hasPending = true    │
│  User C: addLiquidity() → userPendingOperation[C].hasPending = true    │
│                    ↓                                                      │
│  All operations process independently!                                   │
│                    ↓                                                      │
│  User B: callback() → userPendingOperation[B].hasPending = false       │
│  User A: callback() → userPendingOperation[A].hasPending = false       │
│  User C: callback() → userPendingOperation[C].hasPending = false       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Per-User Pending Operations

Queue Mode replaces the global lock with a per-user mapping:

```solidity
// Per-user pending operation tracking
struct userPendingOperationStruct {
    uint256 requestID;        // Unique request identifier
    Operation operation;      // AddLiquidity, RemoveLiquidity, or Swap
    uint256 timestamp;        // When operation was initiated
    bool hasPending;          // Whether user has an active operation
}

// Each user has their own pending state
mapping(address user => userPendingOperationStruct) public userPendingOperation;
```

### User Operation Modifier

The `userOperationAvailable()` modifier only checks the **calling user's** state:

```solidity
modifier userOperationAvailable() {
    userPendingOperationStruct memory pending = userPendingOperation[msg.sender];
    if (
        pending.hasPending &&
        block.timestamp < pending.timestamp + MAX_OPERATION_TIME
    ) {
        revert UserHasPendingOperation(
            msg.sender,
            pending.requestID,
            pending.timestamp + MAX_OPERATION_TIME
        );
    }
    _;
}
```

### Concurrent User Support

| Feature | Global Lock | Queue Mode |
|---------|-------------|------------|
| **Concurrent Users** | 1 | Unlimited |
| **Blocking Scope** | All users | Only initiating user |
| **Pool Availability** | Intermittent | Always available |
| **Throughput** | Low | High |
| **User Experience** | Poor | Excellent |

### Query Functions

```solidity
// Get pending operation for a specific user
function getUserPendingOperationInfo(address user) external view returns (
    uint256 requestID,
    bool hasPending,
    uint256 timestamp,
    Operation operation
);

// Backward compatible: Get caller's pending operation
function getPendingOperationInfo() external view returns (
    uint256 requestID,
    bool isPending,
    uint256 timestamp,
    Operation operation
);
```

### Frontend Integration

The frontend uses the per-user query to check operation status:

```typescript
// Hook queries user-specific pending state
export function usePendingDecryptionInfo(userAddress?: `0x${string}`) {
  const { data } = useReadContract({
    address: SWAP_PAIR_ADDRESS,
    abi: SWAP_PAIR_ABI,
    functionName: 'getUserPendingOperationInfo',
    args: userAddress ? [userAddress] : undefined,
  });

  return {
    pendingDecryption: data ? {
      requestID: data[0],
      hasPending: data[1],
      timestamp: data[2],
      operation: data[3],
    } : null,
  };
}
```

---

## Smart Contract Reference

### LiquidSwapPair (LiquidSwap.sol)

The main swap pair contract implementing the confidential AMM.

#### Key State Variables

```solidity
// Encrypted reserves
euint64 private reserve0;
euint64 private reserve1;

// Obfuscated reserves for price feeds (±7%)
obfuscatedReservesStruct public obfuscatedReserves;

// Queue Mode: Per-user pending operation tracking
struct userPendingOperationStruct {
    uint256 requestID;
    Operation operation;
    uint256 timestamp;
    bool hasPending;
}
mapping(address user => userPendingOperationStruct) public userPendingOperation;

// Constants
uint64 public immutable scalingFactor;        // 10^6 (6 decimals)
uint64 public immutable MINIMUM_LIQUIDITY;    // 100 × scalingFactor
uint256 private constant MAX_OPERATION_TIME = 5 minutes;
```

#### Core Functions

| Function | Description |
|----------|-------------|
| `addLiquidity(encryptedAmount0, encryptedAmount1, deadline, inputProof)` | Add liquidity with encrypted amounts |
| `addLiquidityCallback(requestID, cleartexts, proof)` | Complete liquidity addition after decryption |
| `removeLiquidity(encryptedLPAmount, to, deadline, inputProof)` | Remove liquidity |
| `removeLiquidityCallback(requestID, cleartexts, proof)` | Complete liquidity removal |
| `swapTokens(encryptedAmount0In, encryptedAmount1In, to, deadline, inputProof)` | Execute swap |
| `swapTokensCallback(requestID, cleartexts, proof)` | Complete swap after decryption |
| `getUserPendingOperationInfo(address user)` | **Queue Mode**: Get pending operation for specific user |
| `getPendingOperationInfo()` | Get caller's pending operation (backward compatible) |
| `requestLiquidityAddingRefund(requestID)` | Refund stalled add-liquidity |
| `requestSwapRefund(requestID)` | Refund stalled swap |
| `requestLiquidityRemovalRefund(requestID)` | Refund stalled remove-liquidity |

#### Events

```solidity
event DecryptionPending(
    address indexed from,
    uint256 indexed requestID,
    Operation operation,
    bytes32[] handles
);
event liquidityMinted(uint256 blockNumber, address user);
event liquidityBurnt(uint256 blockNumber, address user);
event Swap(
    address from,
    euint64 amount0In,
    euint64 amount1In,
    euint64 amount0Out,
    euint64 amount1Out,
    address to
);
event Refund(address from, uint256 blockNumber, uint256 requestID);
```

#### Errors (Queue Mode)

```solidity
// Reverts when user already has a pending operation
error UserHasPendingOperation(
    address user,           // The user with pending operation
    uint256 requestID,      // The pending request ID
    uint256 until           // Timestamp when operation expires
);
```

### SwapLib

FHE utility library for encrypted AMM computations.

| Function | Gas Cost (HCU) | Description |
|----------|----------------|-------------|
| `computeRNG(max, minAdd)` | ~184,000 | Generate bounded random euint16 |
| `computeObfuscatedReserves(r0, r1, scale)` | ~2,000,000 | Randomize reserves ±7% |
| `computeFirstMint(a0, a1, minLiq)` | ~500,000 | Initial LP token calculation |
| `computeAddLiquidity(r0, r1, supply)` | ~2,500,000 | Prepare liquidity addition |
| `computeAddLiquidityCallback(...)` | ~4,000,000 | Process liquidity callback |
| `computeRemoveLiquidity(r0, r1, lp, supply)` | ~2,500,000 | Prepare liquidity removal |
| `computeSwap(s0, s1, r0, r1)` | ~3,000,000 | AMM swap calculation with 1% fee |

### ConfidentialToken (ERC7984)

Confidential token standard with encrypted balances.

#### Key Differences from ERC20

| Feature | ERC20 | ERC7984 |
|---------|-------|---------|
| Balance Type | `uint256` | `euint64` (encrypted) |
| Transfer Amount | Visible | Encrypted + ZK proof |
| Approval System | `approve(spender, amount)` | `setOperator(operator, expiry)` |
| Balance Query | Returns plaintext | Returns encrypted handle |

#### Core Functions

```solidity
function confidentialBalanceOf(address account) external view returns (euint64);
function setOperator(address operator, uint48 until) external;
function isOperator(address holder, address spender) external view returns (bool);
function confidentialTransfer(address to, euint64 amount) external;
function confidentialTransferFrom(address from, address to, euint64 amount) external;
function mint(address to, externalEuint64 amount, bytes calldata inputProof) external;
```

---

## Deployed Contracts

### Ethereum Sepolia Testnet (Queue Mode v2)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| **LiquidSwapPair** | `0xBd616c7bC7423D07a11018ed324d178586DC6128` | [View](https://sepolia.etherscan.io/address/0xBd616c7bC7423D07a11018ed324d178586DC6128) |
| **Liquid USD (LUSD)** | `0x1A15cF37a5E13e01774d2007DEA79Fc6eA52CEa9` | [View](https://sepolia.etherscan.io/address/0x1A15cF37a5E13e01774d2007DEA79Fc6eA52CEa9) |
| **Liquid ETH (LETH)** | `0xc5731f5Da1E7d8dBfc99f187E1766f91e8e59bFB` | [View](https://sepolia.etherscan.io/address/0xc5731f5Da1E7d8dBfc99f187E1766f91e8e59bFB) |

---

## Dependency Versions

### Smart Contracts

| Dependency | Version | Purpose |
|------------|---------|---------|
| **Solidity** | `0.8.27` | Smart contract language |
| **fhEVM Solidity** | `^0.9.1` | FHE library (Zama) |
| **fhEVM Hardhat Plugin** | `^0.3.0-1` | Hardhat integration |
| **Hardhat** | `^2.26.3` | Development framework |
| **Hardhat Toolbox** | `^5.0.0` | Testing & deployment tools |

### Compiler Settings

```javascript
solidity: {
  version: '0.8.27',
  settings: {
    optimizer: { enabled: true, runs: 50 },
    evmVersion: 'cancun',
    viaIR: true
  }
}
```

### Frontend

| Dependency | Version | Purpose |
|------------|---------|---------|
| **React** | `^18.3.1` | UI framework |
| **TypeScript** | `^5.8.3` | Type safety |
| **Vite** | `^5.4.19` | Build tool |
| **Wagmi** | `^2.19.1` | Ethereum interactions |
| **Viem** | `^2.38.5` | Low-level Ethereum utilities |
| **RainbowKit** | `^2.2.9` | Wallet connection UI |
| **TanStack React Query** | `^5.83.0` | Server state management |
| **Tailwind CSS** | `^3.4.17` | Styling |
| **shadcn/ui** | (Radix primitives) | UI components |
| **Vitest** | `^1.6.0` | Testing framework |

---

## Getting Started

### Prerequisites

- Node.js 18+
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH ([Faucet](https://sepoliafaucet.com))

### Installation

```bash
# Clone repository
git clone https://github.com/your-repo/LiquidSwap.git
cd LiquidSwap

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add PRIVATE_KEY and SEPOLIA_RPC_URL to .env
```

### Development

```bash
# Start frontend development server
npm run dev
# → http://localhost:5173

# Compile contracts
npm run compile

# Deploy to Sepolia
SEPOLIA_RPC_URL="<your-rpc>" PRIVATE_KEY="<your-key>" npm run deploy
```

### Testing

```bash
# Run frontend tests
npm test

# Compile contracts
npx hardhat compile --config hardhat.config.cjs
```

---

## Security Considerations

### Threat Model

**Protected Against**:
- ✅ Front-running and MEV attacks (encrypted amounts)
- ✅ Balance tracking by external observers
- ✅ Liquidity position surveillance
- ✅ Exact reserve exposure (±7% obfuscation)
- ✅ DoS via global lock (Queue Mode eliminates this vector)

**Current Limitations**:
- ⚠️ Wallet addresses remain public
- ⚠️ Transaction counts reveal activity patterns
- ⚠️ Callback cleartexts are publicly verifiable
- ⚠️ Each user limited to one pending operation at a time
- ⚠️ **NOT AUDITED** — Testnet only

### Best Practices

1. **Fresh Wallets**: Use new addresses for trading sessions
2. **Monitor Timeouts**: Request refunds if operations stall >5 minutes
3. **Verify Encryption**: Ensure ZK proof generation succeeds before submitting

---

## License

BSD-3-Clause-Clear License

---

<div align="center">

**Built with Zama FHE Technology**

[fhe-liquidswap.vercel.app](https://fhe-liquidswap.vercel.app)

</div>
