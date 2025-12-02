/**
 * useDecryptionCallback - fhEVM 0.9.1 Self-Relaying Decryption Hook
 *
 * This hook implements the client-side decryption and callback flow required by fhEVM 0.9.1:
 * 1. Listen for DecryptionPending events from the contract
 * 2. Extract handles from the event
 * 3. Use relayer SDK to decrypt the handles
 * 4. Submit the decrypted values + proof back to the contract via callback
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog, encodeAbiParameters, parseAbiParameters, type Log } from 'viem';
import { SWAP_PAIR_ADDRESS, SWAP_PAIR_ABI } from '@/lib/contracts';
import { toast } from 'sonner';

// Operation types matching the contract enum
export enum Operation {
  None = 0,
  AddLiquidity = 1,
  RemoveLiquidity = 2,
  Swap = 3,
}

interface DecryptionPendingEvent {
  from: `0x${string}`;
  requestID: bigint;
  operation: Operation;
  handles: `0x${string}`[];
}

interface DecryptionResult {
  cleartexts: `0x${string}`;
  proof: `0x${string}`;
}

declare global {
  interface Window {
    RelayerSDK?: {
      decrypt: (handles: string[]) => Promise<{
        cleartexts: Uint8Array;
        proof: Uint8Array;
      }>;
      decryptMultiple?: (handles: string[]) => Promise<{
        values: bigint[];
        proof: Uint8Array;
      }>;
    };
    relayerSDK?: any;
  }
}

/**
 * Get the relayer SDK instance
 */
const getRelayerSDK = () => {
  if (typeof window === 'undefined') {
    throw new Error('Relayer SDK requires browser environment');
  }
  const sdk = window.RelayerSDK || window.relayerSDK;
  if (!sdk) {
    throw new Error('Relayer SDK not loaded. Check that the CDN script is in index.html');
  }
  return sdk;
};

/**
 * Decrypt handles using the relayer SDK
 * Returns ABI-encoded cleartexts and the decryption proof
 */
async function decryptHandles(
  handles: `0x${string}`[],
  operation: Operation
): Promise<DecryptionResult> {
  const sdk = getRelayerSDK();

  console.log('[Decrypt] Decrypting handles for operation:', Operation[operation], handles);

  try {
    // The relayer SDK decrypt function returns cleartexts and proof
    const result = await sdk.decrypt(handles);

    // Determine how to encode cleartexts based on operation type
    let encodedCleartexts: `0x${string}`;

    if (operation === Operation.AddLiquidity) {
      // AddLiquidity expects: (uint128, uint128, uint128, uint128)
      // divLowerPart0, divLowerPart1, obfuscatedReserve0, obfuscatedReserve1
      const values = decodeUint128Array(result.cleartexts, 4);
      encodedCleartexts = encodeAbiParameters(
        parseAbiParameters('uint128, uint128, uint128, uint128'),
        [values[0], values[1], values[2], values[3]]
      );
    } else if (operation === Operation.RemoveLiquidity || operation === Operation.Swap) {
      // RemoveLiquidity and Swap expect: (uint128, uint128)
      // divLowerPart0, divLowerPart1
      const values = decodeUint128Array(result.cleartexts, 2);
      encodedCleartexts = encodeAbiParameters(
        parseAbiParameters('uint128, uint128'),
        [values[0], values[1]]
      );
    } else {
      throw new Error(`Unsupported operation: ${operation}`);
    }

    const proof = bytesToHex(result.proof);

    console.log('[Decrypt] Decryption successful');
    return { cleartexts: encodedCleartexts, proof };
  } catch (error) {
    console.error('[Decrypt] Decryption failed:', error);
    throw error;
  }
}

/**
 * Decode uint128 values from raw bytes
 */
function decodeUint128Array(data: Uint8Array, count: number): bigint[] {
  const values: bigint[] = [];
  const bytesPerValue = 16; // uint128 = 16 bytes

  for (let i = 0; i < count; i++) {
    const start = i * bytesPerValue;
    const end = start + bytesPerValue;
    const slice = data.slice(start, end);

    // Convert bytes to bigint (big-endian)
    let value = BigInt(0);
    for (let j = 0; j < slice.length; j++) {
      value = (value << BigInt(8)) | BigInt(slice[j]);
    }
    values.push(value);
  }

  return values;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Hook to handle decryption callbacks for a specific user
 */
export function useDecryptionCallback(userAddress?: `0x${string}`) {
  const publicClient = usePublicClient();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<DecryptionPendingEvent | null>(null);
  const processedRequests = useRef<Set<string>>(new Set());

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  /**
   * Process a DecryptionPending event
   */
  const processDecryptionEvent = useCallback(
    async (event: DecryptionPendingEvent) => {
      const requestKey = `${event.requestID.toString()}-${event.operation}`;

      // Skip if already processed
      if (processedRequests.current.has(requestKey)) {
        console.log('[Callback] Request already processed:', requestKey);
        return;
      }

      // Only process events for the current user
      if (userAddress && event.from.toLowerCase() !== userAddress.toLowerCase()) {
        console.log('[Callback] Event not for current user, skipping');
        return;
      }

      console.log('[Callback] Processing event:', event);
      processedRequests.current.add(requestKey);
      setPendingEvent(event);
      setIsDecrypting(true);

      try {
        toast.info('Decrypting values using FHE relayer...');

        // Step 1: Decrypt the handles
        const { cleartexts, proof } = await decryptHandles(event.handles, event.operation);

        toast.success('Decryption complete! Submitting callback...');

        // Step 2: Determine which callback function to call
        let functionName: string;
        switch (event.operation) {
          case Operation.AddLiquidity:
            functionName = 'addLiquidityCallback';
            break;
          case Operation.RemoveLiquidity:
            functionName = 'removeLiquidityCallback';
            break;
          case Operation.Swap:
            functionName = 'swapTokensCallback';
            break;
          default:
            throw new Error(`Unknown operation: ${event.operation}`);
        }

        // Step 3: Submit the callback transaction
        writeContract({
          address: SWAP_PAIR_ADDRESS,
          abi: SWAP_PAIR_ABI,
          functionName: functionName as any,
          args: [event.requestID, cleartexts, proof],
        });
      } catch (err: any) {
        console.error('[Callback] Error processing decryption:', err);
        toast.error(`Decryption failed: ${err.message}`);
        setIsDecrypting(false);
        // Remove from processed so it can be retried
        processedRequests.current.delete(requestKey);
      }
    },
    [userAddress, writeContract]
  );

  /**
   * Watch for DecryptionPending events
   */
  useEffect(() => {
    if (!publicClient || !userAddress) return;

    console.log('[Callback] Starting event watcher for user:', userAddress);

    const unwatch = publicClient.watchContractEvent({
      address: SWAP_PAIR_ADDRESS,
      abi: SWAP_PAIR_ABI,
      eventName: 'DecryptionPending',
      onLogs: (logs) => {
        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: SWAP_PAIR_ABI,
              data: log.data,
              topics: log.topics,
            });

            if (decoded.eventName === 'DecryptionPending') {
              const args = decoded.args as any;
              const event: DecryptionPendingEvent = {
                from: args.from,
                requestID: args.requestID,
                operation: args.operation as Operation,
                handles: args.handles,
              };

              console.log('[Callback] Received DecryptionPending event:', event);
              processDecryptionEvent(event);
            }
          } catch (err) {
            console.error('[Callback] Error decoding event:', err);
          }
        }
      },
      onError: (err) => {
        console.error('[Callback] Event watcher error:', err);
      },
    });

    return () => {
      console.log('[Callback] Stopping event watcher');
      unwatch();
    };
  }, [publicClient, userAddress, processDecryptionEvent]);

  /**
   * Monitor callback transaction status
   */
  useEffect(() => {
    if (isSuccess && hash) {
      toast.success(
        <div>
          <p className="font-semibold">Operation completed successfully!</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan
          </a>
        </div>
      );
      setIsDecrypting(false);
      setPendingEvent(null);
    }
  }, [isSuccess, hash]);

  useEffect(() => {
    if (error) {
      toast.error(`Callback failed: ${error.message}`);
      setIsDecrypting(false);
      // Allow retry
      if (pendingEvent) {
        const requestKey = `${pendingEvent.requestID.toString()}-${pendingEvent.operation}`;
        processedRequests.current.delete(requestKey);
      }
    }
  }, [error, pendingEvent]);

  /**
   * Manually trigger decryption for a pending operation
   */
  const triggerDecryption = useCallback(
    async (requestID: bigint, operation: Operation, handles: `0x${string}`[]) => {
      const event: DecryptionPendingEvent = {
        from: userAddress || '0x0',
        requestID,
        operation,
        handles,
      };
      await processDecryptionEvent(event);
    },
    [userAddress, processDecryptionEvent]
  );

  /**
   * Clear processed requests (useful for testing)
   */
  const clearProcessedRequests = useCallback(() => {
    processedRequests.current.clear();
  }, []);

  return {
    isDecrypting,
    isSubmitting: isPending,
    isConfirming,
    isSuccess,
    pendingEvent,
    hash,
    error,
    triggerDecryption,
    clearProcessedRequests,
  };
}

/**
 * Hook for manual callback submission (for cases where auto-detection fails)
 */
export function useManualCallback() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submitAddLiquidityCallback = useCallback(
    async (requestID: bigint, cleartexts: `0x${string}`, proof: `0x${string}`) => {
      writeContract({
        address: SWAP_PAIR_ADDRESS,
        abi: SWAP_PAIR_ABI,
        functionName: 'addLiquidityCallback',
        args: [requestID, cleartexts, proof],
      });
    },
    [writeContract]
  );

  const submitSwapCallback = useCallback(
    async (requestID: bigint, cleartexts: `0x${string}`, proof: `0x${string}`) => {
      writeContract({
        address: SWAP_PAIR_ADDRESS,
        abi: SWAP_PAIR_ABI,
        functionName: 'swapTokensCallback',
        args: [requestID, cleartexts, proof],
      });
    },
    [writeContract]
  );

  const submitRemoveLiquidityCallback = useCallback(
    async (requestID: bigint, cleartexts: `0x${string}`, proof: `0x${string}`) => {
      writeContract({
        address: SWAP_PAIR_ADDRESS,
        abi: SWAP_PAIR_ABI,
        functionName: 'removeLiquidityCallback',
        args: [requestID, cleartexts, proof],
      });
    },
    [writeContract]
  );

  return {
    submitAddLiquidityCallback,
    submitSwapCallback,
    submitRemoveLiquidityCallback,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
