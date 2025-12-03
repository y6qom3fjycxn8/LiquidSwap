/**
 * FHE SDK integration for LiquidSwap
 * Updated for fhEVM 0.9.1 with self-relaying decryption pattern
 *
 * References: LuckyVault frontend implementation
 */
import { bytesToHex, getAddress } from "viem";
import type { Address } from "viem";

declare global {
  interface Window {
    RelayerSDK?: any;
    relayerSDK?: any;
    ethereum?: any;
    okxwallet?: any;
  }
}

let fheInstance: any = null;

/**
 * Get the Relayer SDK from window object
 * SDK is loaded via script tag in index.html (0.3.0-5)
 */
const getSDK = () => {
  if (typeof window === "undefined") {
    throw new Error("FHE SDK requires a browser environment");
  }
  const sdk = window.RelayerSDK || window.relayerSDK;
  if (!sdk) {
    throw new Error("Relayer SDK not loaded. Ensure the CDN script tag is present in index.html");
  }
  return sdk;
};

/**
 * Initialize FHE instance with Sepolia network configuration
 * Supports multiple wallet providers (MetaMask, OKX, Coinbase)
 *
 * Updated for fhEVM 0.9.1 SDK
 */
export async function initializeFHE(provider?: any): Promise<any> {
  if (fheInstance) {
    return fheInstance;
  }

  if (typeof window === "undefined") {
    throw new Error("FHE SDK requires browser environment");
  }

  // Get Ethereum provider from multiple sources
  // Priority: passed provider > window.ethereum > window.okxwallet > window.coinbaseWalletExtension
  const ethereumProvider = provider ||
    window.ethereum ||
    window.okxwallet?.provider ||
    window.okxwallet;

  if (!ethereumProvider) {
    throw new Error("No wallet provider detected. Connect a wallet first.");
  }

  console.log('[FHE] Initializing with provider:', {
    isOKX: !!window.okxwallet,
    isMetaMask: !!(window.ethereum as any)?.isMetaMask,
  });

  const sdk = getSDK();
  const { initSDK, createInstance, SepoliaConfig } = sdk;

  await initSDK();

  // Use the built-in SepoliaConfig from the SDK (fhEVM 0.9.1)
  const config = { ...SepoliaConfig, network: ethereumProvider };
  fheInstance = await createInstance(config);

  console.log('[FHE] Instance initialized for Sepolia (fhEVM 0.9.1)');
  return fheInstance;
}

/**
 * Get existing FHE instance or initialize new one
 */
const getInstance = async (provider?: any) => {
  if (fheInstance) return fheInstance;
  return initializeFHE(provider);
};

/**
 * Normalize bytes to bytes32 hex string
 */
const normalizeBytes32 = (bytes: Uint8Array): `0x${string}` => {
  return bytesToHex(bytes) as `0x${string}`;
};

/**
 * Encrypt uint8 value (for option selection 0-255)
 */
export async function encryptOption(
  option: number,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> {
  const fhe = await getInstance(provider);
  const checksumAddress = getAddress(contractAddress as Address);

  const input = fhe.createEncryptedInput(checksumAddress, userAddress);
  input.add8(option);

  const { handles, inputProof } = await input.encrypt();

  return {
    handle: normalizeBytes32(handles[0]),
    proof: bytesToHex(inputProof) as `0x${string}`,
  };
}

/**
 * Encrypt uint64 value (for amounts)
 * This is the main function used by LiquidSwap
 */
export async function encryptAmount(
  amount: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> {
  const fhe = await getInstance(provider);
  const checksumAddress = getAddress(contractAddress as Address);

  const input = fhe.createEncryptedInput(checksumAddress, userAddress);
  input.add64(amount);

  const { handles, inputProof } = await input.encrypt();

  return {
    handle: normalizeBytes32(handles[0]),
    proof: bytesToHex(inputProof) as `0x${string}`,
  };
}

/**
 * Encrypt uint64 value for FHE operations
 * Alias for encryptAmount with explicit typing
 */
export const encryptUint64 = async (
  value: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> => {
  return encryptAmount(value, contractAddress, userAddress, provider);
};

/**
 * Encrypt two uint64 values in a single proof
 * More gas-efficient for operations that need two encrypted values
 * Used for addLiquidity and swap operations
 */
export const encryptTwoUint64 = async (
  first: bigint,
  second: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ firstHandle: `0x${string}`; secondHandle: `0x${string}`; proof: `0x${string}` }> => {
  const fhe = await getInstance(provider);
  const checksumAddress = getAddress(contractAddress as Address);

  console.log('[FHE] Encrypting two uint64 values:', { first, second });

  const input = fhe.createEncryptedInput(checksumAddress, userAddress);
  input.add64(first);
  input.add64(second);

  const { handles, inputProof } = await input.encrypt();

  console.log('[FHE] Encryption complete, handles:', handles.length);

  return {
    firstHandle: normalizeBytes32(handles[0]),
    secondHandle: normalizeBytes32(handles[1]),
    proof: bytesToHex(inputProof) as `0x${string}`,
  };
};

/**
 * Check if FHE SDK is loaded and ready
 */
export const isFHEReady = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!(window.RelayerSDK || window.relayerSDK);
};

/**
 * Check if FHE instance is initialized
 */
export const isFheInstanceReady = (): boolean => {
  return fheInstance !== null;
};

/**
 * Wait for FHE SDK to be loaded (with timeout)
 */
export const waitForFHE = async (timeoutMs: number = 10000): Promise<boolean> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (isFHEReady()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
};

/**
 * Get FHE status for debugging
 */
export const getFHEStatus = (): {
  sdkLoaded: boolean;
  instanceReady: boolean;
} => {
  return {
    sdkLoaded: isFHEReady(),
    instanceReady: fheInstance !== null,
  };
};
