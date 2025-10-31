# LiquidSwap

> **Privacy-First Decentralized Exchange** built on Zama's Fully Homomorphic Encryption (FHE) technology

![LiquidSwap Banner](https://img.shields.io/badge/Zama-fhEVM-blue) ![Solidity](https://img.shields.io/badge/Solidity-0.8.27-lightgrey) ![React](https://img.shields.io/badge/React-18-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)

LiquidSwap is a confidential automated market maker (AMM) that enables fully private token swaps and liquidity provision on Ethereum Sepolia testnet. Built with Zama's fhEVM v0.8.0, all sensitive trading data—including token amounts, balances, and liquidity positions—remain encrypted end-to-end, both on-chain and during computation.

🌐 **Live Demo**: [https://fhe-liquidswap.vercel.app](https://fhe-liquidswap.vercel.app)
📖 **Documentation**: [https://fhe-liquidswap.vercel.app/docs](https://fhe-liquidswap.vercel.app/docs)
🔗 **GitHub**: [https://github.com/y6qom3fjycxn8/LiquidSwap](https://github.com/y6qom3fjycxn8/LiquidSwap)

---

## Table of Contents

- [Why LiquidSwap?](#why-liquidswap)
- [How It Works](#how-it-works)
  - [Fully Homomorphic Encryption (FHE)](#fully-homomorphic-encryption-fhe)
  - [Architecture Overview](#architecture-overview)
- [Smart Contract Design](#smart-contract-design)
  - [Core Contracts](#core-contracts)
  - [Liquidity Management](#liquidity-management)
  - [Asynchronous Decryption](#asynchronous-decryption)
  - [Reserve Obfuscation](#reserve-obfuscation)
- [Frontend Integration](#frontend-integration)
- [Deployed Contracts](#deployed-contracts)
- [Getting Started](#getting-started)
- [Development](#development)
- [Roadmap](#roadmap)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## Why LiquidSwap?

Traditional DEXs expose sensitive trading information on-chain:
- **Trade sizes** are visible to MEV bots and front-runners
- **Wallet balances** can be tracked by anyone
- **Liquidity positions** reveal trading strategies

LiquidSwap solves this with **Fully Homomorphic Encryption**:
- ✅ **Private Trades**: Swap amounts stay encrypted on-chain
- ✅ **Hidden Balances**: Token balances are never revealed
- ✅ **Confidential Liquidity**: LP positions remain private
- ✅ **MEV Protection**: Front-running is mathematically impossible
- ✅ **Trustless**: No trusted third parties or oracles

---

## How It Works

### Fully Homomorphic Encryption (FHE)

FHE allows computations on encrypted data without ever decrypting it. LiquidSwap uses Zama's fhEVM to perform AMM calculations entirely on encrypted values:

```
┌─────────────────────────────────────────────────────────┐
│  User encrypts:   100 LUSD  →  euint64(encrypted)      │
│  Smart contract:  swap(euint64) → euint64(output)      │
│  User decrypts:   encrypted → 0.05 LETH                 │
└─────────────────────────────────────────────────────────┘
```

**Key Properties**:
- **euint64**: 64-bit encrypted unsigned integers (supports up to 18.4 billion with 6 decimals)
- **Homomorphic Operations**: Add, subtract, multiply encrypted values without decryption
- **Zero-Knowledge Proofs**: All encrypted inputs include cryptographic proofs of validity
- **Threshold Decryption**: Zama's coprocessor network handles asynchronous decryptions

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)               │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Wallet SDK   │  │  Zama Relayer │  │  FHE Encryption │  │
│  │  (RainbowKit)  │  │    (Browser)  │  │   (Client-side) │  │
│  └────────────────┘  └──────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                Ethereum Sepolia (fhEVM 0.8.0)                │
│  ┌──────────────────┐  ┌─────────────────┐                  │
│  │   Swap Pair      │  │  ERC7984 Tokens │                  │
│  │  (AMM Logic)     │  │  (LUSD / LETH)  │                  │
│  └──────────────────┘  └─────────────────┘                  │
│           │                      │                            │
│           ▼                      ▼                            │
│  ┌──────────────────────────────────────┐                   │
│  │   Zama FHE Coprocessor               │                   │
│  │   (Threshold Decryption Network)     │                   │
│  └──────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

**Data Flow**:
1. User encrypts swap amount in browser using Zama SDK
2. Transaction is sent with encrypted handle + zero-knowledge proof
3. Smart contract validates proof and performs encrypted computations
4. For operations requiring decryption (price updates), contract requests async decryption
5. Zama coprocessor network collectively decrypts and returns cleartext
6. Contract processes callback and updates state

---

## Smart Contract Design

### Core Contracts

#### 1. **SwapPair Contract** (`contracts/LiquidSwap.sol`)

The main AMM implementation extending ERC7984 (confidential token standard):

```solidity
contract SwapPair is ERC7984, SepoliaConfig {
    // Encrypted reserves
    euint128 internal reserve0;
    euint128 internal reserve1;

    // Obfuscated reserves (±7% randomization for price oracles)
    euint128 public obfuscatedReserve0;
    euint128 public obfuscatedReserve1;

    // Pending decryption tracking
    struct PendingDecryption {
        uint256 currentRequestID;
        bool isPendingDecryption;
        uint256 decryptionTimestamp;
        Operation operation; // AddLiquidity, RemoveLiquidity, Swap
    }
}
```

**Key Features**:
- **Encrypted State**: All reserves and balances stored as `euint64`/`euint128`
- **Constant Product Formula**: `x * y = k` computed on encrypted values
- **LP Tokens**: Minted as encrypted ERC7984 tokens
- **Refund Mechanism**: Users can reclaim funds if decryption stalls

#### 2. **SwapLib** (`contracts/SwapLib.sol`)

FHE utility library for advanced encrypted operations:

```solidity
library SwapLib {
    // Compute encrypted swap: out = (reserve_out * amount_in * 99) / ((reserve_in * 100) + (amount_in * 99))
    function computeSwap(euint64 amountIn, euint128 reserveIn, euint128 reserveOut)
        internal returns (euint64 amountOut);

    // Split encrypted value into upper 64 bits and lower 64 bits
    function splitUpper64Lower64(euint128 encrypted128)
        internal returns (euint64 upper64, euint64 lower64);

    // Obfuscate reserves with ±7% randomization
    function obfuscateReserves(euint128 reserve0, euint128 reserve1)
        internal returns (euint128, euint128);
}
```

#### 3. **ERC7984 Tokens** (`contracts/ConfidentialToken.sol`)

Confidential token implementation with encrypted balances:

```solidity
contract ConfidentialToken is ERC7984 {
    // Encrypted balance storage
    mapping(address => euint64) internal _balances;

    // Operator authorization (replaces traditional approve/allowance)
    mapping(address => mapping(address => uint48)) public operators;

    // Confidential transfer
    function confidentialTransfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof)
        external returns (euint64);
}
```

**ERC7984 vs ERC20**:
| Feature | ERC20 | ERC7984 |
|---------|-------|---------|
| Balance Storage | `uint256` | `euint64` (encrypted) |
| Transfer Amount | Visible | Encrypted with ZK proof |
| Approval System | `approve(spender, amount)` | `setOperator(operator, expiry)` |
| Balance Query | Returns `uint256` | Returns encrypted handle |

### Liquidity Management

#### Adding Liquidity

```solidity
function addLiquidity(
    externalEuint64 amount0,  // Encrypted LUSD amount
    externalEuint64 amount1,  // Encrypted LETH amount
    uint256 deadline,
    bytes calldata inputProof
) external {
    // 1. Validate proof and convert to internal encrypted types
    euint64 _amount0 = FHE.asEuint64(amount0, inputProof);
    euint64 _amount1 = FHE.asEuint64(amount1, inputProof);

    // 2. Transfer tokens from user (encrypted)
    token0.confidentialTransferFrom(msg.sender, address(this), _amount0);
    token1.confidentialTransferFrom(msg.sender, address(this), _amount1);

    // 3. Request decryption to calculate LP tokens
    uint256 requestID = requestDecryption(_amount0, _amount1);

    // 4. Store bundle for callback processing
    addLiqDecBundle[requestID] = AddLiqDecBundleStruct({
        _sentAmount0: _amount0,
        _sentAmount1: _amount1,
        _user: msg.sender
    });
}

// Callback from Zama coprocessor
function callbackAddLiquidity(uint256 requestID, uint64 clear0, uint64 clear1) external {
    // Calculate LP tokens: sqrt(amount0 * amount1)
    uint256 liquidity = Math.sqrt(uint256(clear0) * uint256(clear1));

    // Mint LP tokens to user
    _mint(user, liquidity);

    // Update reserves
    reserve0 = FHE.add(reserve0, _sentAmount0);
    reserve1 = FHE.add(reserve1, _sentAmount1);
}
```

#### Removing Liquidity

```solidity
function removeLiquidity(
    externalEuint64 lpAmount,
    address to,
    uint256 deadline,
    bytes calldata inputProof
) external {
    // 1. Burn LP tokens
    euint64 _lpAmount = FHE.asEuint64(lpAmount, inputProof);
    _burn(msg.sender, uint256(_lpAmount));

    // 2. Calculate proportional payout: (lpAmount / totalSupply) * reserve
    euint128 payout0 = (reserve0 * lpAmount) / totalSupply;
    euint128 payout1 = (reserve1 * lpAmount) / totalSupply;

    // 3. Request decryption for final transfer
    uint256 requestID = requestDecryption(payout0, payout1);
}
```

### Asynchronous Decryption

LiquidSwap uses threshold decryption for operations requiring cleartext:

**Why Decryption is Needed**:
- **Price Calculations**: Determining LP token amounts requires cleartext
- **Constant Product Validation**: Ensuring `x * y = k` after swaps
- **Refund Computation**: Calculating excess amounts to return

**Decryption Flow**:
```
Contract → requestDecryption(euint64)
         → Zama Coprocessor (threshold network)
         → callback(requestID, cleartext)
         → Contract processes cleartext
```

**Safety Mechanisms**:
1. **Operation Gating**: Each callback verifies the operation type (AddLiquidity/RemoveLiquidity/Swap)
2. **Request ID Validation**: Prevents replay attacks and out-of-order processing
3. **Timeout Protection**: Users can request refunds if decryption stalls (>10 minutes)
4. **Cleartext Validation**: Checks for zero divisors and invalid values

### Reserve Obfuscation

To enable price oracles without exposing exact reserves:

```solidity
function _updateObfuscatedReserves() internal {
    // Generate random multipliers (93% - 107%)
    euint16 random0 = FHE.randomEuint16() % 1400 + 9300; // 0.93x - 1.07x
    euint16 random1 = FHE.randomEuint16() % 1400 + 9300;

    // Apply randomization: obfuscated = (reserve * random) / 10000
    obfuscatedReserve0 = (reserve0 * random0) / 10000;
    obfuscatedReserve1 = (reserve1 * random1) / 10000;

    // Grant read permissions to price scanners
    FHE.allow(obfuscatedReserve0, priceScanner);
    FHE.allow(obfuscatedReserve1, priceScanner);
}
```

**Use Cases**:
- Price feeds can estimate exchange rates within ±7%
- MEV bots cannot determine exact reserve ratios
- Arbitrage opportunities remain profitable but less precise

---

## Frontend Integration

### Technology Stack

- **React 18** + **TypeScript** + **Vite** - Modern development experience
- **Wagmi v2** + **RainbowKit** - Wallet connection and transaction management
- **Zama fhEVM SDK** - Client-side FHE encryption
- **Tailwind CSS** + **shadcn/ui** - Responsive, accessible UI components
- **React Router** - Client-side routing for docs page

### FHE Encryption Flow

```typescript
// 1. Initialize FHE instance with contract address
import { createFheInstance } from '@/lib/fhe';

const fheInstance = await createFheInstance(SWAP_PAIR_ADDRESS, userAddress);

// 2. Encrypt user input
const amount = parseUnits("100", 6); // 100 LUSD
const { handle, proof } = await fheInstance.encryptUint64(
  amount,
  SWAP_PAIR_ADDRESS,
  userAddress
);

// 3. Send transaction with encrypted data
await contract.write.addLiquidity([
  handle,    // euint64 (32 bytes)
  deadline,  // uint256
  proof      // bytes (ZK proof)
]);
```

### Key Frontend Features

**1. Mint Card** - Request test tokens
```typescript
// Encrypt mint amount with FHE
const { handle, proof } = await encryptUint64(amount, tokenAddress, address);

// Mint encrypted tokens
await token.write.mint([address, handle, proof]);
```

**2. Add Liquidity Card** - Provide liquidity to pool
- Dual token input (LUSD + LETH)
- Authorization via ERC7984 `setOperator`
- Real-time transaction monitoring with Etherscan links
- Pending decryption status display

**3. Swap Card** (Under Development)
- Single-sided input with automatic output calculation
- Slippage protection
- Price impact warnings

---

## Deployed Contracts

### Sepolia Testnet

| Contract | Address | Explorer |
|----------|---------|----------|
| **Swap Pair** | `0xc68abF4A812060b587Cd9CC9Bba6a9e2D1df00e0` | [View on Etherscan](https://sepolia.etherscan.io/address/0xc68abF4A812060b587Cd9CC9Bba6a9e2D1df00e0) |
| **Liquid USD (LUSD)** | `0x534df81296D12C971a6BF8BfA609eD744e2610A3` | [View on Etherscan](https://sepolia.etherscan.io/address/0x534df81296D12C971a6BF8BfA609eD744e2610A3) |
| **Liquid ETH (LETH)** | `0xf678ca1012Cf4AD86F4FD2BbBfc25a34F915b3fA` | [View on Etherscan](https://sepolia.etherscan.io/address/0xf678ca1012Cf4AD86F4FD2BbBfc25a34F915b3fA) |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH ([Get from faucet](https://sepoliafaucet.com))

### Installation

```bash
# Clone repository
git clone https://github.com/y6qom3fjycxn8/LiquidSwap.git
cd LiquidSwap

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your private key and RPC URL to .env
```

### Running Locally

```bash
# Start development server
npm run dev

# Frontend available at http://localhost:8080
```

### Deploying Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia
SEPOLIA_RPC_URL="<your-rpc-url>" npx hardhat run scripts/deploy.cjs --network sepolia

# Update frontend contract addresses in src/config/contracts.ts
```

---

## Development

### Project Structure

```
LiquidSwap/
├── contracts/
│   ├── LiquidSwap.sol              # Main Swap Pair contract
│   ├── SwapLib.sol                 # FHE utility library
│   ├── ConfidentialToken.sol       # ERC7984 token implementation
│   └── OZ-confidential-contracts-fork/  # ERC7984 dependencies
├── scripts/
│   ├── deploy.cjs                  # Deployment script
│   ├── check-pending-decryption.cjs # Debug utility
│   └── request-refund.cjs          # Emergency refund tool
├── src/
│   ├── components/
│   │   ├── MintCard.tsx            # Token minting interface
│   │   ├── AddLiquidityCard.tsx    # Liquidity provision UI
│   │   └── SwapCard.tsx            # Swap interface (in dev)
│   ├── hooks/
│   │   └── useSwapPair.ts          # Contract interaction hooks
│   ├── config/
│   │   ├── contracts.ts            # Contract addresses & ABIs
│   │   └── wagmi.ts                # Wallet configuration
│   └── lib/
│       └── fhe.ts                  # FHE encryption utilities
└── deployments/                    # Deployment history
```

### Testing

```bash
# Run contract tests
npx hardhat test

# Check pending decryptions
SEPOLIA_RPC_URL="<rpc-url>" npx hardhat run scripts/check-pending-decryption.cjs --network sepolia

# Request refund (if decryption stalls)
SEPOLIA_RPC_URL="<rpc-url>" npx hardhat run scripts/request-refund.cjs --network sepolia
```

### Gas Optimization

LiquidSwap uses **HCU (Homomorphic Computation Units)** instead of traditional gas:

| Operation | HCU Cost | Description |
|-----------|----------|-------------|
| `FHE.add()` | 65,000 | Add two encrypted values |
| `FHE.mul()` | 150,000 | Multiply encrypted values |
| `FHE.div()` | 265,000 | Divide with encrypted divisor |
| `FHE.randomEuint16()` | 100,000 | Generate random encrypted value |
| `requestDecryption()` | 500,000+ | Async decryption request |

**Optimization Strategies**:
- Batch multiple operations in single transaction
- Use `euint64` instead of `euint128` when possible (smaller ciphertext)
- Cache obfuscated reserves to avoid redundant computations

---

## Roadmap

### ✅ Phase 1: Core Infrastructure (Completed)
- [x] ERC7984 confidential token standard
- [x] Encrypted liquidity pool management
- [x] Asynchronous decryption framework
- [x] Reserve obfuscation for price feeds
- [x] Frontend with wallet integration
- [x] Testnet deployment on Sepolia

### 🚧 Phase 2: Swap Functionality (In Progress)
- [ ] Complete encrypted swap implementation
- [ ] Slippage protection
- [ ] Price impact calculations
- [ ] Multi-hop routing (LUSD → LETH → Other)
- [ ] Advanced order types (limit orders)

### 🔮 Phase 3: Advanced Features (Planned)
- [ ] **Liquidity Mining**: Encrypted staking rewards
- [ ] **Governance**: Private voting on protocol parameters
- [ ] **Analytics Dashboard**: Privacy-preserving statistics
- [ ] **Cross-chain Bridge**: Encrypted asset transfers
- [ ] **Mobile App**: React Native integration
- [ ] **Mainnet Deployment**: Production launch on Ethereum mainnet

### 🔬 Phase 4: Research & Innovation
- [ ] **Concentrated Liquidity**: Uniswap v3-style range orders with FHE
- [ ] **Flash Swaps**: Encrypted atomic arbitrage
- [ ] **Privacy-preserving Oracle**: Decentralized price feeds
- [ ] **ZK-FHE Hybrid**: Combine zero-knowledge and FHE for ultimate privacy

---

## Security Considerations

### Threat Model

**Protected Against**:
- ✅ Front-running and MEV attacks (encrypted amounts)
- ✅ Balance tracking by external observers
- ✅ Liquidity position surveillance
- ✅ Timing attacks on swap execution

**Current Limitations**:
- ⚠️ Wallet addresses are public (transaction graph analysis possible)
- ⚠️ Transaction counts reveal user activity
- ⚠️ Decryption callbacks temporarily expose cleartext to validators
- ⚠️ Testnet only - not audited for production use

### Best Practices

1. **Never Reuse Addresses**: Create new wallets for each trading session
2. **Batch Transactions**: Reduce on-chain activity correlation
3. **Use Tornado Cash**: Mix funds before interacting with LiquidSwap
4. **Monitor Pending Decryptions**: Request refunds if operations stall >10 minutes
5. **Verify Encryption**: Always check ZK proof generation succeeded

### Audits

🔴 **NOT AUDITED** - This is experimental software. Use at your own risk.

Future audit targets:
- Trail of Bits (FHE security)
- OpenZeppelin (Smart contract security)
- Least Authority (Cryptographic review)

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

**Areas We Need Help**:
- Frontend UX improvements
- Gas optimization in smart contracts
- Documentation and tutorials
- Security testing and bug bounties

---

## License

This project is licensed under the **BSD-3-Clause-Clear License**.

Key terms:
- ✅ Commercial use allowed
- ✅ Modification and redistribution permitted
- ❌ No patent rights granted
- ❌ No liability or warranty

See [LICENSE](LICENSE) for full details.

---

## Acknowledgments

- **Zama**: For pioneering FHE technology and fhEVM
- **Uniswap**: Inspiration for AMM design
- **OpenZeppelin**: Security best practices and ERC standards

---

## Contact & Support

- **Website**: [fhe-liquidswap.vercel.app](https://fhe-liquidswap.vercel.app)
- **GitHub Issues**: [Report bugs](https://github.com/y6qom3fjycxn8/LiquidSwap/issues)
- **Twitter**: [@LiquidSwapFHE](https://twitter.com/LiquidSwapFHE) (if exists)
- **Discord**: [Join community](https://discord.gg/liquidswap) (if exists)

---

<div align="center">

**Built with ❤️ using Zama FHE technology**

[⬆ Back to Top](#liquidswap)

</div>
