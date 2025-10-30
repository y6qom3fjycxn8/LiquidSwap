import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { CAMM_PAIR_ADDRESS, CAMM_PAIR_ABI, TOKEN0_ADDRESS, TOKEN1_ADDRESS, ERC7984_ABI } from '@/config/contracts';
import { parseUnits, formatUnits } from 'viem';

export interface PendingDecryption {
  requestID: bigint;
  isPending: boolean;
  timestamp: bigint;
  operation: number; // 0=None, 1=AddLiquidity, 2=RemoveLiquidity, 3=Swap
}

// Hook to get token0 address
export function useToken0Address() {
  const { data, isLoading, error } = useReadContract({
    address: CAMM_PAIR_ADDRESS,
    abi: CAMM_PAIR_ABI,
    functionName: 'token0Address',
  });

  return {
    token0Address: data as `0x${string}` | undefined,
    isLoading,
    error,
  };
}

// Hook to get token1 address
export function useToken1Address() {
  const { data, isLoading, error } = useReadContract({
    address: CAMM_PAIR_ADDRESS,
    abi: CAMM_PAIR_ABI,
    functionName: 'token1Address',
  });

  return {
    token1Address: data as `0x${string}` | undefined,
    isLoading,
    error,
  };
}

// Hook to get LP token balance
export function useLPBalance(userAddress?: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CAMM_PAIR_ADDRESS,
    abi: CAMM_PAIR_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
  });

  return {
    lpBalance: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get total LP supply
export function useTotalSupply() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CAMM_PAIR_ADDRESS,
    abi: CAMM_PAIR_ABI,
    functionName: 'totalSupply',
  });

  return {
    totalSupply: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get pending decryption info
export function usePendingDecryptionInfo() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CAMM_PAIR_ADDRESS,
    abi: CAMM_PAIR_ABI,
    functionName: 'getPendingDecryptionInfo',
  });

  const result = data as [bigint, boolean, bigint, number] | undefined;

  return {
    pendingDecryption: result
      ? {
          requestID: result[0],
          isPending: result[1],
          timestamp: result[2],
          operation: result[3],
        }
      : undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get token balance
export function useTokenBalance(tokenAddress?: `0x${string}`, userAddress?: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC7984_ABI,
    functionName: 'balanceOf',
    args: tokenAddress && userAddress ? [userAddress] : undefined,
  });

  return {
    balance: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get token allowance
export function useTokenAllowance(tokenAddress?: `0x${string}`, ownerAddress?: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC7984_ABI,
    functionName: 'allowance',
    args: tokenAddress && ownerAddress ? [ownerAddress, CAMM_PAIR_ADDRESS] : undefined,
  });

  return {
    allowance: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to approve token
export function useApproveToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = async (tokenAddress: `0x${string}`, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: ERC7984_ABI,
      functionName: 'approve',
      args: [CAMM_PAIR_ADDRESS, amount],
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to add liquidity with FHE encryption
export function useAddLiquidity() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addLiquidity = async (
    encryptedAmount0: `0x${string}`,
    encryptedAmount1: `0x${string}`,
    inputProof: `0x${string}`,
    deadline: bigint
  ) => {
    writeContract({
      address: CAMM_PAIR_ADDRESS,
      abi: CAMM_PAIR_ABI,
      functionName: 'addLiquidity',
      args: [encryptedAmount0, encryptedAmount1, deadline, inputProof],
    });
  };

  return {
    addLiquidity,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to remove liquidity with FHE encryption
export function useRemoveLiquidity() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const removeLiquidity = async (
    encryptedLPAmount: `0x${string}`,
    to: `0x${string}`,
    inputProof: `0x${string}`,
    deadline: bigint
  ) => {
    writeContract({
      address: CAMM_PAIR_ADDRESS,
      abi: CAMM_PAIR_ABI,
      functionName: 'removeLiquidity',
      args: [encryptedLPAmount, to, deadline, inputProof],
    });
  };

  return {
    removeLiquidity,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to swap tokens with FHE encryption
export function useSwapTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const swapTokens = async (
    encryptedAmount0In: `0x${string}`,
    encryptedAmount1In: `0x${string}`,
    to: `0x${string}`,
    inputProof: `0x${string}`,
    deadline: bigint
  ) => {
    writeContract({
      address: CAMM_PAIR_ADDRESS,
      abi: CAMM_PAIR_ABI,
      functionName: 'swapTokens',
      args: [encryptedAmount0In, encryptedAmount1In, to, deadline, inputProof],
    });
  };

  return {
    swapTokens,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to request liquidity adding refund
export function useRequestLiquidityAddingRefund() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const requestRefund = async (requestID: bigint) => {
    writeContract({
      address: CAMM_PAIR_ADDRESS,
      abi: CAMM_PAIR_ABI,
      functionName: 'requestLiquidityAddingRefund',
      args: [requestID],
    });
  };

  return {
    requestRefund,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to request swap refund
export function useRequestSwapRefund() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const requestRefund = async (requestID: bigint) => {
    writeContract({
      address: CAMM_PAIR_ADDRESS,
      abi: CAMM_PAIR_ABI,
      functionName: 'requestSwapRefund',
      args: [requestID],
    });
  };

  return {
    requestRefund,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to request liquidity removal refund
export function useRequestLiquidityRemovalRefund() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const requestRefund = async (requestID: bigint) => {
    writeContract({
      address: CAMM_PAIR_ADDRESS,
      abi: CAMM_PAIR_ABI,
      functionName: 'requestLiquidityRemovalRefund',
      args: [requestID],
    });
  };

  return {
    requestRefund,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to mint tokens (for testing)
export function useMintToken(tokenAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = async (
    to: `0x${string}`,
    encryptedAmount: `0x${string}`,
    inputProof: `0x${string}`
  ) => {
    if (!tokenAddress) {
      throw new Error('Token address is required');
    }

    writeContract({
      address: tokenAddress,
      abi: ERC7984_ABI,
      functionName: 'mint',
      args: [to, encryptedAmount, inputProof],
    });
  };

  return {
    mint,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
