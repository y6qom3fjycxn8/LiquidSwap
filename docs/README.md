# LiquidSwap Technical Overview

LiquidSwap is a privacy-preserving automated market maker (AMM) that leverages Zama's Fully Homomorphic Encryption (FHE) stack to keep user balances, liquidity positions, and swap amounts confidential while remaining fully on-chain.

## Architecture Summary

- **Frontend (React + Vite)**: Performs client-side encryption with Zama Relayer SDK and connects to wallets via RainbowKit / wagmi.
- **Smart Contracts (Solidity 0.8.27)**
  - `CAMMPair`: manages encrypted reserves, swaps, liquidity add/remove, obfuscated reserve snapshots, and refund safety valves.
  - `ConfidentialToken` (ERC7984 fork): stores balances as `euint64` and validates encrypted transfers.
  - `SwapLib`: utility library for randomization, obfuscation, and price calculations under encryption.
- **Zama Sepolia Coprocessor**: validates encryption proofs and serves decryption requests via oracle callbacks.

## Deployed Addresses (Sepolia)

- **Liquid USD (LUSD)**: `0xA87F4bAE7F4E267D64fFC222377B9acA9bf98e41`
- **Liquid ETH (LETH)**: `0xfE25b303ea656F8a692ab85B7484A1b94A8249De`
- **Swap Library**: `0xb502a69B54402baeC1B546a0a4a716b6E36B8CfA`
- **CAMM Pair**: `0x6dFD65dC099C04362E19bB1dE60D63D3158a6844`

## User Flow

1. **Mint Test Tokens** (optional)
   - Users encrypt mint amounts using SDK.
   - Confidential tokens mint `euint64` balances on-chain.
2. **Authorize & Add Liquidity**
   - `setOperator` grants the pair contract access to the user's encrypted tokens.
   - Both token amounts are encrypted in a single proof and submitted to `addLiquidity`.
3. **Swap**
   - Swap direction (token0 → token1 or reverse) is encrypted with zero padding to share one proof.
   - The pair contract requests decryption to compute outputs without revealing inputs.
4. **Withdraw / Refund**
   - Pending operations can be refunded if decryptions stall, protecting funds.

## Demo Video

You can watch the full workflow demonstration here: [LiquidSwap walkthrough](https://www.youtube.com/watch?v=ZQswmAqXdWQ).

## Security & Privacy Features

- All balances, swap amounts, and liquidity positions are stored as encrypted integers (`euint64`).
- Obfuscated reserve snapshots prevent leakage of pool state while enabling price estimation.
- Proofs are verified on-chain via the Zama coprocessor before state changes are applied.
- Refund mechanisms ensure liquidity providers can recover funds if decryption callbacks fail.

---

For implementation details, refer to the Solidity sources in `/contracts` and the frontend encryption helpers in `/src/lib/fhe.ts`.
