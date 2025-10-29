import { useState, useEffect } from "react";
import { ArrowDownUp, Settings, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseUnits, formatUnits } from "viem";
import {
  useSwapTokens,
  useTokenBalance,
  useToken0Address,
  useToken1Address,
  usePendingDecryptionInfo,
  useApproveToken,
  useTokenAllowance,
} from "@/hooks/useCAMMPair";
import { encryptUint64 } from "@/lib/fhe";
import { CAMM_PAIR_ADDRESS } from "@/config/contracts";

const SwapCard = () => {
  const { address, isConnected } = useAccount();
  const [fromAmount, setFromAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [swapDirection, setSwapDirection] = useState<"0to1" | "1to0">("0to1"); // 0to1 means swap token0 for token1

  // Get token addresses
  const { token0Address } = useToken0Address();
  const { token1Address } = useToken1Address();

  // Get balances
  const { balance: token0Balance, refetch: refetchToken0 } = useTokenBalance(token0Address, address);
  const { balance: token1Balance, refetch: refetchToken1 } = useTokenBalance(token1Address, address);

  // Get allowances
  const { allowance: token0Allowance, refetch: refetchAllowance0 } = useTokenAllowance(token0Address, address);
  const { allowance: token1Allowance, refetch: refetchAllowance1 } = useTokenAllowance(token1Address, address);

  // Get pending decryption status
  const { pendingDecryption, refetch: refetchPending } = usePendingDecryptionInfo();

  // Contract hooks
  const { swapTokens, isPending, isConfirming, isSuccess, error } = useSwapTokens();
  const { approve, isPending: isApproving, isSuccess: isApproved } = useApproveToken();

  const fromToken = swapDirection === "0to1" ? token0Address : token1Address;
  const toToken = swapDirection === "0to1" ? token1Address : token0Address;
  const fromBalance = swapDirection === "0to1" ? token0Balance : token1Balance;
  const toBalance = swapDirection === "0to1" ? token1Balance : token0Balance;
  const fromAllowance = swapDirection === "0to1" ? token0Allowance : token1Allowance;

  useEffect(() => {
    if (isSuccess) {
      toast.success("Swap submitted successfully! Waiting for decryption...");
      setFromAmount("");
      setIsSwapping(false);
      refetchToken0();
      refetchToken1();
      refetchPending();
    }
  }, [isSuccess]);

  useEffect(() => {
    if (error) {
      toast.error(`Swap failed: ${error.message}`);
      setIsSwapping(false);
    }
  }, [error]);

  useEffect(() => {
    if (isApproved) {
      toast.success("Approval successful!");
      refetchAllowance0();
      refetchAllowance1();
    }
  }, [isApproved]);

  const handleSwapDirection = () => {
    setSwapDirection((prev) => (prev === "0to1" ? "1to0" : "0to1"));
    setFromAmount("");
  };

  const handleMaxClick = () => {
    if (fromBalance) {
      setFromAmount(formatUnits(fromBalance, 18));
    }
  };

  const needsApproval = () => {
    if (!fromAmount || !fromAllowance) return false;
    const amountBigInt = parseUnits(fromAmount, 18);
    return fromAllowance < amountBigInt;
  };

  const handleApprove = async () => {
    if (!fromToken) return;
    try {
      // Approve max uint256 for simplicity
      const maxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      await approve(fromToken, maxUint256);
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    }
  };

  const handleSwap = async () => {
    if (!address || !fromAmount) {
      toast.error("Please enter an amount");
      return;
    }

    if (pendingDecryption?.isPending) {
      toast.error("Please wait for the current operation to complete");
      return;
    }

    try {
      setIsSwapping(true);
      setIsEncrypting(true);
      toast.info("Encrypting swap amounts with FHE...");

      const fromAmountBigInt = parseUnits(fromAmount, 18);
      const zeroAmount = BigInt(0);

      // Encrypt amounts based on direction
      let encryptedAmount0: `0x${string}`;
      let encryptedAmount1: `0x${string}`;
      let proof: `0x${string}`;

      if (swapDirection === "0to1") {
        // Swapping token0 for token1
        const { handle, proof: p } = await encryptUint64(fromAmountBigInt, CAMM_PAIR_ADDRESS, address);
        encryptedAmount0 = handle;
        proof = p;
        // Amount1 is zero (need to encrypt zero as well)
        const zeroEncrypted = await encryptUint64(zeroAmount, CAMM_PAIR_ADDRESS, address);
        encryptedAmount1 = zeroEncrypted.handle;
      } else {
        // Swapping token1 for token0
        const zeroEncrypted = await encryptUint64(zeroAmount, CAMM_PAIR_ADDRESS, address);
        encryptedAmount0 = zeroEncrypted.handle;
        const { handle, proof: p } = await encryptUint64(fromAmountBigInt, CAMM_PAIR_ADDRESS, address);
        encryptedAmount1 = handle;
        proof = p;
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
    }
  };

  const canSwap = () => {
    if (!isConnected || !fromAmount) return false;
    if (isSwapping || isPending || isConfirming) return false;
    if (pendingDecryption?.isPending) return false;
    const amount = parseFloat(fromAmount);
    return amount > 0;
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (isEncrypting) return "Encrypting...";
    if (isPending) return "Confirming Transaction...";
    if (isConfirming) return "Waiting for Confirmation...";
    if (pendingDecryption?.isPending) return "Decryption Pending...";
    if (needsApproval()) return "Approve Token First";
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
        <div className="flex justify-between">
          <Label className="text-sm text-muted-foreground">From</Label>
          {fromBalance && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
              onClick={handleMaxClick}
            >
              Balance: {parseFloat(formatUnits(fromBalance, 18)).toFixed(6)} MAX
            </Button>
          )}
        </div>
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
            {swapDirection === "0to1" ? "TOKEN0" : "TOKEN1"}
          </div>
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
        <div className="flex justify-between">
          <Label className="text-sm text-muted-foreground">To (estimated)</Label>
          {toBalance && (
            <span className="text-xs text-muted-foreground">
              Balance: {parseFloat(formatUnits(toBalance, 18)).toFixed(6)}
            </span>
          )}
        </div>
        <div className="relative">
          <Input
            type="text"
            placeholder="0.0"
            value="~"
            className="text-2xl font-semibold h-16 pr-32 border-2"
            disabled
          />
          <div className="absolute right-2 top-2 bg-secondary px-4 py-2 rounded-full font-semibold text-sm">
            {swapDirection === "0to1" ? "TOKEN1" : "TOKEN0"}
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
      {needsApproval() ? (
        <Button
          className="w-full h-14 text-lg font-semibold mb-2"
          onClick={handleApprove}
          disabled={isApproving}
        >
          {isApproving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Approve {swapDirection === "0to1" ? "TOKEN0" : "TOKEN1"}
        </Button>
      ) : null}

      <Button
        className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:shadow-glow transition-all"
        disabled={!canSwap() || needsApproval()}
        onClick={handleSwap}
      >
        {(isSwapping || isPending || isConfirming) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {getButtonText()}
      </Button>

      {/* Pending Decryption Warning */}
      {pendingDecryption?.isPending && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
            ⏳ Decryption in progress... Please wait
          </p>
        </div>
      )}
    </Card>
  );
};

export default SwapCard;
