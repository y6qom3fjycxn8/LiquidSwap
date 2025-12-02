import { useState, useEffect, useRef } from "react";
import { Minus, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseUnits } from "viem";
import {
  useRemoveLiquidity,
  useLPBalance,
  usePendingDecryptionInfo,
  useHasLiquidity,
  useRequestLiquidityRemovalRefund,
} from "@/hooks/useSwapPair";
import { useDecryptionCallback } from "@/hooks/useDecryptionCallback";
import { encryptUint64 } from "@/lib/fhe";
import { SWAP_PAIR_ADDRESS } from "@/lib/contracts";

const RemoveLiquidityCard = () => {
  const { address, isConnected } = useAccount();
  const [lpAmount, setLpAmount] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // fhEVM 0.9.1 - Decryption callback hook
  const {
    isDecrypting,
    isSubmitting: isCallbackSubmitting,
    isConfirming: isCallbackConfirming,
    isSuccess: isCallbackSuccess,
  } = useDecryptionCallback(address);

  // Get LP balance
  const { lpBalance, refetch: refetchLPBalance } = useLPBalance(address);

  // Get pending decryption status
  const { pendingDecryption, refetch: refetchPending } = usePendingDecryptionInfo();
  const { hasLiquidity, refetch: refetchHasLiquidity } = useHasLiquidity();

  // Contract hooks
  const { removeLiquidity, hash, isPending, isConfirming, isSuccess, error } = useRemoveLiquidity();
  const {
    requestRefund: triggerRefund,
    hash: refundHash,
    isPending: _isRefundPending,
    isConfirming: isRefundConfirming,
    isSuccess: isRefundSuccess,
    error: refundError,
  } = useRequestLiquidityRemovalRefund();

  // Auto-refund state
  const autoRefundState = useRef<{ started: boolean; requestId: bigint | null; executed: boolean }>({
    started: false,
    requestId: null,
    executed: false,
  });
  const AUTO_REFUND_DELAY_SECONDS = 90;

  // Monitor transaction submission
  useEffect(() => {
    if (isPending) {
      toast.info("Remove liquidity transaction submitted. Waiting for confirmation...");
    }
  }, [isPending]);

  // Monitor transaction confirmation
  useEffect(() => {
    if (isConfirming && hash) {
      toast.loading(
        <div>
          <p className="font-semibold">Confirming remove liquidity transaction...</p>
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

  // Monitor transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      toast.dismiss(`confirming-${hash}`);
      toast.success(
        <div>
          <p className="font-semibold">✅ Remove liquidity initiated! Waiting for decryption...</p>
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

      setLpAmount("");
      setIsRemoving(false);
      refetchLPBalance();
      refetchPending();
      refetchHasLiquidity();
    }
  }, [isSuccess, hash, refetchLPBalance, refetchPending, refetchHasLiquidity]);

  // Monitor transaction errors
  useEffect(() => {
    if (error) {
      if (hash) toast.dismiss(`confirming-${hash}`);
      toast.error(
        <div>
          <p className="font-semibold">❌ Remove liquidity failed</p>
          <p className="text-xs mt-1">{error.message}</p>
        </div>
      );
      setIsRemoving(false);
    }
  }, [error, hash]);

  // Auto-refund logic
  useEffect(() => {
    if (!pendingDecryption?.isPending) {
      if (!isRemoving) {
        autoRefundState.current = { started: false, requestId: null, executed: false };
      }
      return;
    }

    const operation = Number(pendingDecryption.operation);
    if (operation !== 2) { // RemoveLiquidity = 2
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
      toast.warning("Decryption timeout detected. Initiating automatic refund...");
      try {
        triggerRefund(requestId);
      } catch (err: any) {
        console.error("Auto refund failed", err);
        toast.error(err.message || "Auto refund could not be submitted");
        autoRefundState.current.executed = false;
      }
    }
  }, [pendingDecryption, triggerRefund, isRemoving]);

  // Monitor refund status
  useEffect(() => {
    if (refundError) {
      toast.error(refundError.message || "Automatic refund failed");
      autoRefundState.current.executed = false;
    }
  }, [refundError]);

  useEffect(() => {
    if (isRefundConfirming && refundHash) {
      toast.loading(
        <div>
          <p className="font-semibold">Processing refund...</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${refundHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>,
        { id: `confirming-refund-${refundHash}` }
      );
    }
  }, [isRefundConfirming, refundHash]);

  useEffect(() => {
    if (isRefundSuccess && refundHash) {
      toast.dismiss(`confirming-refund-${refundHash}`);
      toast.success(
        <div>
          <p className="font-semibold">Refund completed</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${refundHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
          >
            View on Etherscan →
          </a>
        </div>
      );
      autoRefundState.current = { started: false, requestId: null, executed: false };
      refetchLPBalance();
      refetchHasLiquidity();
    }
  }, [isRefundSuccess, refundHash, refetchLPBalance, refetchHasLiquidity]);

  const handleMaxClick = () => {
    toast.info("LP balances are encrypted. Please enter your LP token amount manually.");
  };

  const handleRemoveLiquidity = async () => {
    if (!address || !lpAmount) {
      toast.error("Please enter an LP token amount");
      return;
    }

    if (pendingDecryption?.isPending) {
      toast.error("Please wait for the current operation to complete");
      return;
    }

    try {
      setIsRemoving(true);
      setIsEncrypting(true);
      autoRefundState.current = { started: true, requestId: null, executed: false };
      toast.info("Encrypting LP amount with FHE...");

      const lpAmountBigInt = parseUnits(lpAmount, 6);

      // Check uint64 limits
      const MAX_UINT64 = BigInt("18446744073709551615");
      if (lpAmountBigInt > MAX_UINT64) {
        throw new Error("Amount too large. Maximum is 18,446,744,073 tokens");
      }

      const { handle, proof } = await encryptUint64(
        lpAmountBigInt,
        SWAP_PAIR_ADDRESS,
        address
      );

      setIsEncrypting(false);
      toast.success("Encryption complete! Removing liquidity...");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      await removeLiquidity(handle, address, proof, deadline);
    } catch (err: any) {
      console.error("Remove liquidity error:", err);
      toast.error(err.message || "Failed to remove liquidity");
      setIsRemoving(false);
      setIsEncrypting(false);
      autoRefundState.current.started = false;
    }
  };

  const canRemoveLiquidity = () => {
    if (!isConnected || !lpAmount) return false;
    if (isRemoving || isPending || isConfirming) return false;
    if (pendingDecryption?.isPending) return false;
    if (hasLiquidity === false) return false;
    const amount = parseFloat(lpAmount);
    return amount > 0;
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (isEncrypting) return "Encrypting...";
    if (isPending) return "Confirming Transaction...";
    if (isConfirming) return "Waiting for Confirmation...";
    if (isDecrypting) return "Decrypting Values...";
    if (isCallbackSubmitting) return "Submitting Callback...";
    if (isCallbackConfirming) return "Finalizing...";
    if (pendingDecryption?.isPending) return "Processing...";
    if (hasLiquidity === false) return "No Liquidity";
    return "Remove Liquidity";
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6 shadow-lg border-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Remove Liquidity</h2>
        <ConnectButton />
      </div>

      {/* LP Token Input */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center">
          <Label className="text-sm text-muted-foreground">LP Token Amount</Label>
          {lpBalance !== undefined && (
            <span className="text-xs text-muted-foreground">Balance: Encrypted</span>
          )}
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            value={lpAmount}
            onChange={(e) => setLpAmount(e.target.value)}
            className="text-2xl font-semibold h-16 pr-32 border-2"
            disabled={isRemoving}
          />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMaxClick}
              disabled={isRemoving}
              className="text-xs font-semibold"
            >
              MAX
            </Button>
            <div className="bg-secondary px-3 py-2 rounded-full font-semibold text-sm">LP</div>
          </div>
        </div>
      </div>

      {/* Output Preview */}
      <div className="flex justify-center my-4">
        <div className="p-2 rounded-full bg-secondary">
          <Minus className="w-5 h-5" />
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="p-4 rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground mb-2">You will receive:</p>
          <div className="flex justify-between items-center">
            <span className="font-semibold">LUSD</span>
            <span className="text-muted-foreground">~ Encrypted</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="font-semibold">LETH</span>
            <span className="text-muted-foreground">~ Encrypted</span>
          </div>
        </div>
      </div>

      {/* FHE Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">FHE-Encrypted Withdrawal</p>
            <p className="text-xs text-muted-foreground">
              Your withdrawal amounts are encrypted end-to-end using Zama FHE technology
            </p>
          </div>
        </div>
      </div>

      {/* Remove Liquidity Button */}
      <Button
        className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:shadow-glow transition-all"
        disabled={!canRemoveLiquidity()}
        onClick={handleRemoveLiquidity}
      >
        {(isRemoving || isPending || isConfirming) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {getButtonText()}
      </Button>

      {/* Pending Decryption/Callback Status */}
      {(pendingDecryption?.isPending || isDecrypting || isCallbackSubmitting || isCallbackConfirming) && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
            {isDecrypting && "🔓 Decrypting encrypted values..."}
            {isCallbackSubmitting && "📤 Submitting decryption proof..."}
            {isCallbackConfirming && "⏳ Finalizing liquidity removal..."}
            {!isDecrypting && !isCallbackSubmitting && !isCallbackConfirming && pendingDecryption?.isPending && "⏳ Processing operation..."}
          </p>
        </div>
      )}

      {/* Callback Success */}
      {isCallbackSuccess && (
        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-600 dark:text-green-400 text-center">
            ✅ Liquidity removed successfully!
          </p>
        </div>
      )}
    </Card>
  );
};

export default RemoveLiquidityCard;
