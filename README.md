# LiquidSwap

LiquidSwap is a confidential automated market maker (AMM) built on Zama's fhEVM.
Pairs execute swaps, liquidity adds, and removals entirely over encrypted
amounts, while still exposing obfuscated reserve insights to approved scanners.

## Contracts & Layout

- `contracts/LiquidSwap.sol`: main `CAMMPair` implementation (extends the confidential ERC-20 fork).
- `contracts/CAMMPairLib.sol`: FHE helpers for randomisation, reserve obfuscation, and arithmetic splits.
- `contracts/OZ-confidential-contracts-fork/`: self-contained copy of the ERC-7984 token stack required by
  `CAMMPair` (balance storage, operator support, safe FHE math, transfer callbacks).
- `scripts/` & `docs/`: placeholders for deployment automation or protocol notes (no content yet).

## Core Workflows

- **Add Liquidity**: deposits encrypted token pairs. After the first mint, the pair
  requests an fhEVM decryption to reconstruct pricing targets, refunds any excess,
  and mints LP tokens. Random multipliers keep the decrypted values unlinkable.
- **Remove Liquidity**: burns LP positions, decrypts proportional payouts
  asynchronously, and streams encrypted outflows back to the user.
- **Swap**: moves encrypted input into the pool, runs a randomised constant-product
  computation via `CAMMPairLib.computeSwap`, decrypts divisors, and transfers the
  encrypted outputs to the taker. A 1% fee is folded into the random factor.
- **Reserve Obfuscation**: every reserve update calls `_updateObfuscatedReserves`,
  granting fresh FHE permissions to the price scanner and any authorised viewers.
  Exposed values stay within ±7 % of the real state to enable analytics without
  leaking exact liquidity.
- **Refunds**: if a gateway response stalls, callers can reclaim their encrypted
  inputs (`requestLiquidityAddingRefund`, `requestSwapRefund`,
  `requestLiquidityRemovalRefund`). Reserves are restored only when they were
  previously included in state.

## Asynchronous Decryption Safety

- `pendingDecryption` now records the active operation (`AddLiquidity`,
  `RemoveLiquidity`, or `Swap`). Each callback asserts the expected operation
  before touching state, preventing cross-callback confusion when request IDs
  overlap or arrive out-of-order.
- Cleartexts are validated for non-zero divisors (`InvalidCleartext`) to avoid
  inconsistent state updates or division-by-zero faults caused by malformed
  gateway payloads.
- All per-request bundles (`addLiqDecBundle`, `removeLiqDecBundle`,
  `swapDecBundle`, `swapOutput`) are cleaned up after success or refund, so stale
  handles cannot accidentally leak into later computations.
- `getPendingDecryptionInfo()` now returns the operation enum alongside the
  request ID, pending flag, and timestamp; front-ends can display precise status.

## Access Control & Admin Hooks

- Only the factory can initialize the pair, update the price scanner, or grant
  reserve viewer privileges. Reserve viewers receive FHE permissions to the
  obfuscated reserve handles on every update.
- Users interact through the confidential ERC-7984 interfaces:
  `confidentialTransfer`, `confidentialTransferFrom`, and `confidentialBalanceOf`.
  LP tokens inherit the same encrypted balance guarantees.

## Development Notes

- The project targets Solidity `0.8.27` and expects Zama's `@fhevm/solidity`
  libraries (already referenced via imports).
- Compile & test with Hardhat/Foundry by pointing the toolchain at the
  `contracts/` folder and ensuring the fhEVM precompiles are available in your
  environment (for local testing, use the Zama fhEVM toolchain).
- Gas costs in comments (HCU) reflect fhEVM budgeting and can guide simulation
  of transaction fees.
- When extending the protocol:
  - Maintain the operation gating when introducing new decryption requests.
  - Always refresh `FHE.allowThis` permissions on mutated ciphertexts.
  - Consider wrapping new async flows with the existing refund pattern to avoid
    stranded liquidity.

## Changelog

- Bundled the confidential ERC-7984 fork and `CAMMPairLib` locally so the pair
  compiles in isolation.
- Added operation tracking to the pending decryption state, enforced in every
  callback, and exposed via `getPendingDecryptionInfo`.
- Guarded against zero divisors in decrypted payloads, with graceful refunds on
  invalid cleartexts.
- Ensured all per-request bundles are deleted after success or refund, preventing
  stale FHE handles from persisting in storage.
