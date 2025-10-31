import { hexlify, getAddress } from "ethers";

declare global {
  interface Window {
    relayerSDK?: {
      initSDK: () => Promise<void>;
      createInstance: (config: Record<string, unknown>) => Promise<any>;
      SepoliaConfig: Record<string, unknown>;
    };
    ethereum?: any;
    okxwallet?: any;
  }
}

let fheInstance: any = null;
let sdkPromise: Promise<any> | null = null;

const SDK_URL = 'https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs';

/**
 * Dynamically load Zama FHE SDK from CDN
 */
const loadSdk = async (): Promise<any> => {
  if (typeof window === 'undefined') {
    throw new Error('FHE SDK requires browser environment');
  }

  if (window.relayerSDK) {
    console.log('✅ SDK already loaded');
    return window.relayerSDK;
  }

  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SDK_URL}"]`) as HTMLScriptElement | null;
      if (existing) {
        console.log('⏳ SDK script tag exists, waiting...');
        // Wait a bit for SDK to initialize
        const checkInterval = setInterval(() => {
          if (window.relayerSDK) {
            clearInterval(checkInterval);
            resolve(window.relayerSDK);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (window.relayerSDK) {
            resolve(window.relayerSDK);
          } else {
            reject(new Error('SDK script exists but window.relayerSDK not initialized'));
          }
        }, 5000);
        return;
      }

      console.log('📦 Loading SDK from CDN...');
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;

      script.onload = () => {
        console.log('📦 Script loaded, waiting for SDK initialization...');
        // Give SDK time to initialize
        setTimeout(() => {
          if (window.relayerSDK) {
            console.log('✅ SDK initialized');
            resolve(window.relayerSDK);
          } else {
            console.error('❌ window.relayerSDK still undefined after load');
            reject(new Error('relayerSDK unavailable after load'));
          }
        }, 500);
      };

      script.onerror = () => {
        console.error('❌ Failed to load SDK script');
        reject(new Error('Failed to load FHE SDK'));
      };

      document.body.appendChild(script);
    });
  }

  return sdkPromise;
};

/**
 * Initialize FHE instance with Sepolia network configuration
 * Supports multiple wallet providers (MetaMask, OKX, Coinbase)
 */
export async function initializeFHE(provider?: any): Promise<any> {
  if (fheInstance) {
    return fheInstance;
  }

  if (typeof window === 'undefined') {
    throw new Error('FHE SDK requires browser environment');
  }

  // Get Ethereum provider from multiple sources
  // Priority: passed provider > window.ethereum > window.okxwallet > window.coinbaseWalletExtension
  const ethereumProvider = provider ||
    window.ethereum ||
    (window as any).okxwallet?.provider ||
    (window as any).okxwallet ||
    (window as any).coinbaseWalletExtension;

  if (!ethereumProvider) {
    throw new Error('Ethereum provider not found. Please connect your wallet first.');
  }

  console.log('🔌 Using Ethereum provider:', {
    isOKX: !!(window as any).okxwallet,
    isMetaMask: !!(window.ethereum as any)?.isMetaMask,
    provider: ethereumProvider
  });

  const sdk = await loadSdk();
  if (!sdk) {
    throw new Error('FHE SDK not available');
  }

  await sdk.initSDK();

  // Use the built-in SepoliaConfig from the SDK
  const config = {
    ...sdk.SepoliaConfig,
    network: ethereumProvider,
  };

  fheInstance = await sdk.createInstance(config);
  console.log('✅ FHE instance initialized for Sepolia');

  return fheInstance;
}

/**
 * Encrypt uint8 value (for option selection 0-255)
 */
export async function encryptOption(
  option: number,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: string; proof: string }> {
  const fhe = await initializeFHE(provider);
  const checksumAddress = getAddress(contractAddress);

  const input = fhe.createEncryptedInput(checksumAddress, userAddress);
  input.add8(option);

  const { handles, inputProof } = await input.encrypt();

  return {
    handle: normalizeBytes32(handles[0]),
    proof: hexlify(inputProof),
  };
}

/**
 * Encrypt uint64 value (for bet amounts)
 */
export async function encryptAmount(
  amount: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: string; proof: string }> {
  const fhe = await initializeFHE(provider);
  const checksumAddress = getAddress(contractAddress);

  const input = fhe.createEncryptedInput(checksumAddress, userAddress);
  input.add64(amount);

  const { handles, inputProof } = await input.encrypt();

  return {
    handle: normalizeBytes32(handles[0]),
    proof: hexlify(inputProof),
  };
}

/**
 * Encrypt both option and amount in single proof
 * This is more gas-efficient than two separate encryptions
 */
export async function encryptBet(
  option: number,
  amountWei: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ optionHandle: string; amountHandle: string; proof: string }> {
  const fhe = await initializeFHE(provider);
  const checksumAddress = getAddress(contractAddress);

  const input = fhe.createEncryptedInput(checksumAddress, userAddress);

  input.add8(option);
  input.add64(amountWei);

  const { handles, inputProof } = await input.encrypt();

  return {
    optionHandle: normalizeBytes32(handles[0]),
    amountHandle: normalizeBytes32(handles[1]),
    proof: hexlify(inputProof),
  };
}

/**
 * Encrypt uint64 value for FHE operations
 * This is the main function used by LiquidSwap
 */
export const encryptUint64 = async (
  value: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> => {
  const result = await encryptAmount(value, contractAddress, userAddress, provider);
  return {
    handle: result.handle as `0x${string}`,
    proof: result.proof as `0x${string}`,
  };
};

export const encryptTwoUint64 = async (
  first: bigint,
  second: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ firstHandle: `0x${string}`; secondHandle: `0x${string}`; proof: `0x${string}` }> => {
  const fhe = await initializeFHE(provider);
  const checksumAddress = getAddress(contractAddress);

  const input = fhe.createEncryptedInput(checksumAddress, userAddress);
  input.add64(first);
  input.add64(second);

  const { handles, inputProof } = await input.encrypt();

  return {
    firstHandle: normalizeBytes32(handles[0]),
    secondHandle: normalizeBytes32(handles[1]),
    proof: hexlify(inputProof) as `0x${string}`,
  };
};
export const normalizeBytes32 = (bytes: Uint8Array): `0x${string}` => {
  if (bytes.length === 32) {
    return hexlify(bytes) as `0x${string}`;
  }

  const normalized = new Uint8Array(32);
  if (bytes.length >= 32) {
    normalized.set(bytes.slice(0, 32));
  } else {
    normalized.set(bytes);
  }

  return hexlify(normalized) as `0x${string}`;
};
