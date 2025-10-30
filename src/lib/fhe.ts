import { getAddress, toHex } from 'viem';

declare global {
  interface Window {
    relayerSDK?: {
      initSDK: () => Promise<void>;
      createInstance: (config: Record<string, unknown>) => Promise<any>;
      SepoliaConfig: Record<string, unknown>;
    };
    ethereum?: any;
    okxwallet?: { provider?: any } | any;
    coinbaseWalletExtension?: any;
  }
}

const SDK_URL = 'https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs';

let fheInstance: any = null;
let sdkPromise: Promise<any> | null = null;

// Dynamic SDK loading to avoid SSR issues
const loadSdk = async (): Promise<any> => {
  console.log('[FHE] Starting SDK load...');

  if (typeof window === 'undefined') {
    console.error('[FHE] Window is undefined - not in browser environment');
    throw new Error('FHE SDK requires browser environment');
  }

  if (window.relayerSDK) {
    console.log('[FHE] SDK already loaded from window.relayerSDK');
    return window.relayerSDK;
  }

  if (!sdkPromise) {
    console.log('[FHE] Creating new SDK promise, loading from:', SDK_URL);
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => {
        console.log('[FHE] SDK script loaded successfully');
        if (window.relayerSDK) {
          console.log('[FHE] window.relayerSDK is available:', {
            hasInitSDK: typeof window.relayerSDK.initSDK === 'function',
            hasCreateInstance: typeof window.relayerSDK.createInstance === 'function',
            hasSepoliaConfig: !!window.relayerSDK.SepoliaConfig,
          });
          resolve(window.relayerSDK);
        } else {
          console.error('[FHE] SDK script loaded but window.relayerSDK is undefined');
          reject(new Error('relayerSDK unavailable after load'));
        }
      };
      script.onerror = (error) => {
        console.error('[FHE] Failed to load SDK script:', error);
        reject(new Error('Failed to load FHE SDK'));
      };
      document.body.appendChild(script);
      console.log('[FHE] SDK script tag appended to body');
    });
  } else {
    console.log('[FHE] Reusing existing SDK promise');
  }

  return sdkPromise;
};

// Get the proper provider from various wallet types
const getEthereumProvider = (provider?: any): any => {
  if (provider) return provider;
  if (typeof window === 'undefined') return null;

  // Try OKX Wallet first
  if (window.okxwallet?.provider) {
    return window.okxwallet.provider;
  }
  if (window.okxwallet && typeof window.okxwallet.request === 'function') {
    return window.okxwallet;
  }

  // Try Coinbase Wallet
  if (window.coinbaseWalletExtension) {
    return window.coinbaseWalletExtension;
  }

  // Default to MetaMask/injected
  return window.ethereum;
};

export async function initializeFHE(provider?: any): Promise<any> {
  console.log('[FHE] initializeFHE called');

  if (fheInstance) {
    console.log('[FHE] Reusing existing FHE instance');
    return fheInstance;
  }

  console.log('[FHE] Loading SDK...');
  const sdk = await loadSdk();

  console.log('[FHE] Initializing SDK...');
  await sdk.initSDK();
  console.log('[FHE] SDK initialized successfully');

  console.log('[FHE] Getting Ethereum provider...');
  const ethereumProvider = getEthereumProvider(provider);
  if (!ethereumProvider) {
    console.error('[FHE] No Ethereum provider found');
    throw new Error('No Ethereum provider found. Please install MetaMask, OKX Wallet, or Coinbase Wallet.');
  }
  console.log('[FHE] Ethereum provider found:', ethereumProvider.constructor?.name || 'unknown');

  console.log('[FHE] Creating FHE instance with Sepolia config...');
  const config = {
    ...sdk.SepoliaConfig,
    network: ethereumProvider,
  };
  console.log('[FHE] Config:', { ...config, network: 'provider' });

  fheInstance = await sdk.createInstance(config);
  console.log('[FHE] FHE instance created successfully');
  return fheInstance;
}

export const encryptUint64 = async (
  value: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> => {
  console.log('[FHE] encryptUint64 called with value:', value);

  console.log('[FHE] Initializing FHE...');
  const fhe = await initializeFHE(provider);

  const checksumContract = getAddress(contractAddress);
  const checksumUser = getAddress(userAddress);
  console.log('[FHE] Addresses - Contract:', checksumContract, 'User:', checksumUser);

  console.log('[FHE] Creating encrypted input...');
  const input = fhe.createEncryptedInput(checksumContract, checksumUser);
  input.add64(value);

  console.log('[FHE] Encrypting...');
  const { handles, inputProof } = await input.encrypt();
  console.log('[FHE] Encryption complete - Handles:', handles, 'Proof length:', inputProof?.length);

  const result = ensureHexPayload(handles, inputProof);
  console.log('[FHE] Final result:', { handleLength: result.handle.length, proofLength: result.proof.length });
  return result;
};

export const encryptUint128 = async (
  value: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> => {
  const fhe = await initializeFHE(provider);

  const checksumContract = getAddress(contractAddress);
  const checksumUser = getAddress(userAddress);

  const input = fhe.createEncryptedInput(checksumContract, checksumUser);
  input.add128(value);

  const { handles, inputProof } = await input.encrypt();

  return ensureHexPayload(handles, inputProof);
};

function ensureHexPayload(
  handles: string | string[],
  inputProof: string
): { handle: `0x${string}`; proof: `0x${string}` } {
  const handleArray = Array.isArray(handles) ? handles : [handles];
  const firstHandle = handleArray[0];

  const handle = (firstHandle.startsWith('0x') ? firstHandle : `0x${firstHandle}`) as `0x${string}`;
  const proof = (inputProof.startsWith('0x') ? inputProof : `0x${inputProof}`) as `0x${string}`;

  return { handle, proof };
}

export async function getFHEInstance(provider?: any): Promise<any> {
  return initializeFHE(provider);
}
