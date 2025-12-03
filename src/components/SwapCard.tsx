import { useState, useEffect, useRef } from "react";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseUnits } from "viem";
import {
  useSwapTokens,
  useToken0Address,
  useToken1Address,
  usePendingDecryptionInfo,
  useApproveToken,
  useTokenAllowance,
  useHasLiquidity,
  useRequestSwapRefund,
} from "@/hooks/useSwapPair";
import { useDecryptionCallback } from "@/hooks/useDecryptionCallback";
import { encryptTwoUint64 } from "@/lib/fhe";
import { SWAP_PAIR_ADDRESS } from "@/lib/contracts";

const SwapCard = () => {
  const { address, isConnected } = useAccount();
  const [fromAmount, setFromAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [swapDirection, setSwapDirection] = useState<"0to1" | "1to0">("0to1"); // 0to1 means swap token0 for token1

  // fhEVM 0.9.1 - Decryption callback hook
  const {
    isDecrypting,
    isSubmitting: isCallbackSubmitting,
    isConfirming: isCallbackConfirming,
    isSuccess: isCallbackSuccess,
  } = useDecryptionCallback(address);

  // Get token addresses
  const { token0Address } = useToken0Address();
  const { token1Address } = useToken1Address();

  // Get allowances
  const { allowance: token0Allowance, refetch: refetchAllowance0 } = useTokenAllowance(token0Address, address);
  const { allowance: token1Allowance, refetch: refetchAllowance1 } = useTokenAllowance(token1Address, address);

  const { hasLiquidity } = useHasLiquidity();

  // Get pending decryption status (Queue Mode: per-user)
  const { pendingDecryption, refetch: refetchPending } = usePendingDecryptionInfo(address);

  // Contract hooks
  const { swapTokens, hash, isPending, isConfirming, isSuccess, error } = useSwapTokens();
  const { approve, hash: approveHash, isPending: isApproving, isConfirming: isApprovingConfirm, isSuccess: isApproved, error: approveError } = useApproveToken();
  const {
    requestRefund: triggerSwapRefund,
    hash: swapRefundHash,
    isPending: _isSwapRefundPending,
    isConfirming: isSwapRefundConfirming,
    isSuccess: isSwapRefundSuccess,
    error: swapRefundError,
  } = useRequestSwapRefund();

  const fromToken = swapDirection === "0to1" ? token0Address : token1Address;
  const fromAllowance = swapDirection === "0to1" ? token0Allowance : token1Allowance;

  // Monitor swap transaction submission
  useEffect(() => {
    if (isPending) {
      toast.info("Swap transaction submitted. Waiting for confirmation...");
    }
  }, [isPending]);

  // Monitor swap transaction confirmation
  useEffect(() => {
    if (isConfirming && hash) {
      toast.loading(
        <div>
          <p className="font-semibold">Confirming swap transaction...</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>,
        { id: `confirming-${hash}` }
      );
    }
  }, [isConfirming, hash]);

  // Monitor swap transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      toast.dismiss(`confirming-${hash}`);

      toast.success(
        <div>
          <p className="font-semibold">✅ Swap successful! Waiting for decryption...</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>
      );

      setFromAmount("");
      setIsSwapping(false);
      refetchPending();
    }
  }, [isSuccess, hash, refetchPending]);

  // Monitor swap transaction errors
  useEffect(() => {
    if (error) {
      if (hash) toast.dismiss(`confirming-${hash}`);

      toast.error(
        <div>
          <p className="font-semibold">❌ Swap failed</p>
          <p className="text-xs mt-1">{error.message}</p>
          {hash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
            >
              View on Etherscan →
            </a>
          )}
        </div>
      );
      setIsSwapping(false);
    }
  }, [error, hash]);

  // Monitor approval transaction confirmation
  useEffect(() => {
    if (isApprovingConfirm && approveHash) {
      toast.loading(
        <div>
          <p className="font-semibold">Confirming approval transaction...</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${approveHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>,
        { id: `confirming-${approveHash}` }
      );
    }
  }, [isApprovingConfirm, approveHash]);

  // Monitor approval transaction success
  useEffect(() => {
    if (isApproved && approveHash) {
      toast.dismiss(`confirming-${approveHash}`);

      toast.success(
        <div>
          <p className="font-semibold">✅ Authorization successful!</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${approveHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>
      );

      refetchAllowance0();
      refetchAllowance1();
    }
  }, [isApproved, approveHash, refetchAllowance0, refetchAllowance1]);

  // Monitor approval transaction errors
  useEffect(() => {
    if (approveError) {
      if (approveHash) toast.dismiss(`confirming-${approveHash}`);

      toast.error(
        <div>
          <p className="font-semibold">❌ Authorization failed</p>
          <p className="text-xs mt-1">{approveError.message}</p>
          {approveHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${approveHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
            >
              View on Etherscan →
            </a>
          )}
        </div>
      );
    }
  }, [approveError, approveHash]);

  useEffect(() => {
    if (!pendingDecryption?.isPending) {
      if (!isSwapping) {
        autoRefundState.current = { started: false, requestId: null, executed: false };
      }
      return;
    }

    const operation = Number(pendingDecryption.operation);
    if (operation !== 3) {
      return;
    }

    if (!autoRefundState.current.started) {
      return;
    }

    const requestId = pendingDecryption.requestID;
    if (autoRefundState.current.requestId === null || autoRefundState.current.requestId !== requestId) {
      autoRefundState.current.requestId = requestId;
      autoRefundState.current.executed = false;
    }

    const timestamp = Number(pendingDecryption.timestamp);
    const now = Math.floor(Date.now() / 1000);

    if (
      !autoRefundState.current.executed &&
      timestamp > 0 &&
      now - timestamp > AUTO_REFUND_DELAY_SECONDS
    ) {
      autoRefundState.current.executed = true;
      toast.warning("Swap decryption timeout detected. Initiating automatic refund...");
      try {
        triggerSwapRefund(requestId);
      } catch (err: any) {
        console.error("Auto swap refund failed", err);
        toast.error(err.message || "Swap refund could not be submitted");
        autoRefundState.current.executed = false;
      }
    }
  }, [pendingDecryption, triggerSwapRefund, isSwapping]);

  useEffect(() => {
    if (swapRefundError) {
      toast.error(swapRefundError.message || "Automatic swap refund failed");
      autoRefundState.current.executed = false;
    }
  }, [swapRefundError]);

  useEffect(() => {
    if (isSwapRefundConfirming && swapRefundHash) {
      toast.loading(
        <div>
          <p className="font-semibold">Processing swap refund...</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${swapRefundHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>,
        { id: `confirming-swap-refund-${swapRefundHash}` }
      );
    }
  }, [isSwapRefundConfirming, swapRefundHash]);

  useEffect(() => {
    if (isSwapRefundSuccess && swapRefundHash) {
      toast.dismiss(`confirming-swap-refund-${swapRefundHash}`);
      toast.success(
        <div>
          <p className="font-semibold">Swap refund completed</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${swapRefundHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>
      );
      autoRefundState.current = { started: false, requestId: null, executed: false };
    }
  }, [isSwapRefundSuccess, swapRefundHash]);

  const handleSwapDirection = () => {
    setSwapDirection((prev) => (prev === "0to1" ? "1to0" : "0to1"));
    setFromAmount("");
  };

  const handleMaxClick = () => {
    toast.info("Confidential balances cannot be auto-filled. Please enter the amount manually.");
  };

  const autoRefundState = useRef<{ started: boolean; requestId: bigint | null; executed: boolean }>({
    started: false,
    requestId: null,
    executed: false,
  });

  const AUTO_REFUND_DELAY_SECONDS = 90;

  const needsAuthorization = () => {
    if (!fromToken) return false;
    return fromAllowance !== true;
  };

  const handleApprove = async () => {
    if (!fromToken) return;
    try {
      await approve(fromToken);
    } catch (err: any) {
      toast.error(err.message || "Authorization failed");
    }
  };

  const handleSwap = async () => {
    if (!address || !fromAmount) {
      toast.error("Please enter an amount");
      return;
    }

    if (hasLiquidity === false) {
      toast.error("Pool has no liquidity yet. Please add liquidity first.");
      return;
    }

    if (pendingDecryption?.isPending) {
      toast.error("Please wait for the current operation to complete");
      return;
    }

    try {
      setIsSwapping(true);
      setIsEncrypting(true);
      autoRefundState.current = { started: true, requestId: null, executed: false };
      toast.info("Encrypting swap amounts with FHE...");

      const fromAmountBigInt = parseUnits(fromAmount, 6);
      const MAX_UINT64 = BigInt("18446744073709551615");
      if (fromAmountBigInt > MAX_UINT64) {
        throw new Error("Amount too large. Max is 18,446,744.073705 tokens");
      }
      const zeroAmount = BigInt(0);

      // Encrypt both inputs in a single proof to satisfy FHE.fromExternal pairing
      let encryptedAmount0: `0x${string}`;
      let encryptedAmount1: `0x${string}`;
      let proof: `0x${string}`;

      if (swapDirection === "0to1") {
        const { firstHandle, secondHandle, proof: sharedProof } = await encryptTwoUint64(
          fromAmountBigInt,
          zeroAmount,
          SWAP_PAIR_ADDRESS,
          address
        );
        encryptedAmount0 = firstHandle;
        encryptedAmount1 = secondHandle;
        proof = sharedProof;
      } else {
        const { firstHandle, secondHandle, proof: sharedProof } = await encryptTwoUint64(
          zeroAmount,
          fromAmountBigInt,
          SWAP_PAIR_ADDRESS,
          address
        );
        encryptedAmount0 = firstHandle;
        encryptedAmount1 = secondHandle;
        proof = sharedProof;
      }

      setIsEncrypting(false);
      toast.success("Encryption complete! Submitting swap...");

      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      await swapTokens(encryptedAmount0, encryptedAmount1, address, proof, deadline);
    } catch (err: any) {
      console.error("Swap error:", err);
      toast.error(err.message || "Failed to swap tokens");
      setIsSwapping(false);
      setIsEncrypting(false);
      autoRefundState.current.started = false;
    }
  };

  const canSwap = () => {
    if (!isConnected || !fromAmount) return false;
    if (isSwapping || isPending || isConfirming) return false;
    if (pendingDecryption?.isPending) return false;
    if (hasLiquidity === false) return false;
    const amount = parseFloat(fromAmount);
    return amount > 0;
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (isEncrypting) return "Encrypting...";
    if (isPending) return "Confirming Transaction...";
    if (isConfirming) return "Waiting for Confirmation...";
    if (isDecrypting) return "Decrypting Values...";
    if (isCallbackSubmitting) return "Submitting Callback...";
    if (isCallbackConfirming) return "Finalizing Swap...";
    if (pendingDecryption?.isPending) return "Processing...";
    if (hasLiquidity === false) return "Add Liquidity First";
    if (needsAuthorization()) return "Authorize Token First";
    return "Swap";
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6 shadow-lg border-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Swap</h2>
        <ConnectButton />
      </div>

      {/* From Token */}
      <div className="space-y-2 mb-2">
        <Label className="text-sm text-muted-foreground">From</Label>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="text-2xl font-semibold h-16 pr-32 border-2"
            disabled={isSwapping}
          />
          <div className="absolute right-2 top-2 bg-secondary px-4 py-2 rounded-full font-semibold text-sm">
            {swapDirection === "0to1" ? "LUSD" : "LETH"}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMaxClick}
            disabled={isSwapping}
            className="flex-1 text-xs font-semibold"
          >
            MAX
          </Button>
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center my-4">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-4 border-background shadow-md hover:shadow-lg transition-all hover:rotate-180 duration-300"
          onClick={handleSwapDirection}
          disabled={isSwapping}
        >
          <ArrowDownUp className="w-5 h-5" />
        </Button>
      </div>

      {/* To Token */}
      <div className="space-y-2 mb-6">
        <Label className="text-sm text-muted-foreground">To (estimated)</Label>
        <div className="relative">
          <Input
            type="text"
            placeholder="0.0"
            value="~"
            className="text-2xl font-semibold h-16 pr-32 border-2"
            disabled
          />
          <div className="absolute right-2 top-2 bg-secondary px-4 py-2 rounded-full font-semibold text-sm">
            {swapDirection === "0to1" ? "LETH" : "LUSD"}
          </div>
        </div>
      </div>

      {/* Encrypted Transaction Notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">FHE-Encrypted Swap</p>
            <p className="text-xs text-muted-foreground">
              Your swap amounts are encrypted end-to-end using Zama FHE technology
            </p>
          </div>
        </div>
      </div>

      {/* Approve/Swap Button */}
      {needsAuthorization() ? (
        <Button
          className="w-full h-14 text-lg font-semibold mb-2"
          onClick={handleApprove}
          disabled={isApproving}
        >
          {isApproving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Authorize {swapDirection === "0to1" ? "LUSD" : "LETH"}
        </Button>
      ) : null}

      <Button
        className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:shadow-glow transition-all"
        disabled={hasLiquidity !== false && (!canSwap() || needsAuthorization())}
        onClick={() => {
          if (hasLiquidity === false) {
            // Navigate to mint section to add liquidity
            document.getElementById('liquidity')?.scrollIntoView({ behavior: 'smooth' });
            toast.info('Please add liquidity to the pool first');
          } else {
            handleSwap();
          }
        }}
      >
        {(isSwapping || isPending || isConfirming) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {getButtonText()}
      </Button>

      {/* Pending Decryption/Callback Status */}
      {(pendingDecryption?.isPending || isDecrypting || isCallbackSubmitting || isCallbackConfirming) && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
            {isDecrypting && "🔓 Decrypting encrypted values..."}
            {isCallbackSubmitting && "📤 Submitting decryption proof..."}
            {isCallbackConfirming && "⏳ Finalizing swap on-chain..."}
            {!isDecrypting && !isCallbackSubmitting && !isCallbackConfirming && pendingDecryption?.isPending && "⏳ Processing operation..."}
          </p>
        </div>
      )}

      {/* Callback Success */}
      {isCallbackSuccess && (
        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-600 dark:text-green-400 text-center">
            ✅ Swap completed successfully!
          </p>
        </div>
      )}
    </Card>
  );
};

export default SwapCard;
