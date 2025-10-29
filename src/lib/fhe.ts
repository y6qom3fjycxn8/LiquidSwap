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
  if (typeof window === 'undefined') {
    throw new Error('FHE SDK requires browser environment');
  }

  if (window.relayerSDK) {
    return window.relayerSDK;
  }

  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => {
        if (window.relayerSDK) {
          resolve(window.relayerSDK);
        } else {
          reject(new Error('relayerSDK unavailable after load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load FHE SDK'));
      document.body.appendChild(script);
    });
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
  if (fheInstance) {
    return fheInstance;
  }

  const sdk = await loadSdk();
  await sdk.initSDK();

  const ethereumProvider = getEthereumProvider(provider);
  if (!ethereumProvider) {
    throw new Error('No Ethereum provider found. Please install MetaMask, OKX Wallet, or Coinbase Wallet.');
  }

  const config = {
    ...sdk.SepoliaConfig,
    network: ethereumProvider,
  };

  fheInstance = await sdk.createInstance(config);
  return fheInstance;
}

export const encryptUint64 = async (
  value: bigint,
  contractAddress: string,
  userAddress: string,
  provider?: any
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> => {
  const fhe = await initializeFHE(provider);

  const checksumContract = getAddress(contractAddress);
  const checksumUser = getAddress(userAddress);

  const input = fhe.createEncryptedInput(checksumContract, checksumUser);
  input.add64(value);

  const { handles, inputProof } = await input.encrypt();

  return ensureHexPayload(handles, inputProof);
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
