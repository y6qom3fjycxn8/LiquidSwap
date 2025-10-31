import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseUnits } from "viem";
import {
  useAddLiquidity,
  useTokenBalance,
  useToken0Address,
  useToken1Address,
  usePendingDecryptionInfo,
  useApproveToken,
  useTokenAllowance,
} from "@/hooks/useCAMMPair";
import { encryptTwoUint64 } from "@/lib/fhe";
import { CAMM_PAIR_ADDRESS } from "@/config/contracts";

const AddLiquidityCard = () => {
  const { address, isConnected } = useAccount();
  const [token0Amount, setToken0Amount] = useState("");
  const [token1Amount, setToken1Amount] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);

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
  const { addLiquidity, hash, isPending, isConfirming, isSuccess, error } = useAddLiquidity();
  const {
    approve,
    hash: approveHash,
    isPending: isApproving,
    isConfirming: isApprovingConfirm,
    isSuccess: isApproved,
    error: approveError,
  } = useApproveToken();

  // Monitor transaction submission
  useEffect(() => {
    if (isPending) {
      toast.info("Add liquidity transaction submitted. Waiting for confirmation...");
    }
  }, [isPending]);

  // Monitor transaction confirmation
  useEffect(() => {
    if (isConfirming && hash) {
      toast.loading(
        <div>
          <p className="font-semibold">Confirming add liquidity transaction...</p>
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
          <p className="font-semibold">✅ Liquidity added successfully!</p>
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

      setToken0Amount("");
      setToken1Amount("");
      setIsAdding(false);
      refetchToken0();
      refetchToken1();
      refetchPending();
    }
  }, [isSuccess, hash, refetchToken0, refetchToken1, refetchPending]);

  // Monitor transaction errors
  useEffect(() => {
    if (error) {
      if (hash) toast.dismiss(`confirming-${hash}`);

      toast.error(
        <div>
          <p className="font-semibold">❌ Add liquidity failed</p>
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
      setIsAdding(false);
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

  // Monitor approval success
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

  // Monitor approval errors
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

  const handleMaxClick = (tokenNumber: 0 | 1) => {
    const tokenLabel = tokenNumber === 0 ? "LUSD" : "LETH";
    toast.info(`Balances are encrypted. Please enter your ${tokenLabel} amount manually.`);
  };

  const needsAuthorization = (tokenNumber: 0 | 1) => {
    if (!address) return false;
    const allowance = tokenNumber === 0 ? token0Allowance : token1Allowance;
    const tokenAddress = tokenNumber === 0 ? token0Address : token1Address;
    if (!tokenAddress) return false;
    return allowance !== true;
  };

  const handleApprove = async (tokenNumber: 0 | 1) => {
    const tokenAddress = tokenNumber === 0 ? token0Address : token1Address;
    if (!tokenAddress) return;

    try {
      await approve(tokenAddress);
    } catch (err: any) {
      toast.error(err.message || "Authorization failed");
    }
  };

  const handleAddLiquidity = async () => {
    if (!address || !token0Amount || !token1Amount) {
      toast.error("Please enter both token amounts");
      return;
    }

    if (pendingDecryption?.isPending) {
      toast.error("Please wait for the current operation to complete");
      return;
    }

    try {
      setIsAdding(true);
      setIsEncrypting(true);
      toast.info("Encrypting token amounts with FHE...");

      const amount0BigInt = parseUnits(token0Amount, 6);
      const amount1BigInt = parseUnits(token1Amount, 6);

      // Check uint64 limits
      const MAX_UINT64 = BigInt("18446744073709551615");
      if (amount0BigInt > MAX_UINT64 || amount1BigInt > MAX_UINT64) {
        throw new Error("Amount too large. Maximum is 18,446,744,073 tokens");
      }

      const { firstHandle: handle0, secondHandle: handle1, proof } = await encryptTwoUint64(
        amount0BigInt,
        amount1BigInt,
        CAMM_PAIR_ADDRESS,
        address
      );

      setIsEncrypting(false);
      toast.success("Encryption complete! Adding liquidity...");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      await addLiquidity(handle0, handle1, deadline, proof);
    } catch (err: any) {
      console.error("Add liquidity error:", err);
      toast.error(err.message || "Failed to add liquidity");
      setIsAdding(false);
      setIsEncrypting(false);
    }
  };

  const canAddLiquidity = () => {
    if (!isConnected || !token0Amount || !token1Amount) return false;
    if (isAdding || isPending || isConfirming) return false;
    if (pendingDecryption?.isPending) return false;
    const amount0 = parseFloat(token0Amount);
    const amount1 = parseFloat(token1Amount);
    return amount0 > 0 && amount1 > 0;
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (isEncrypting) return "Encrypting...";
    if (isPending) return "Confirming Transaction...";
    if (isConfirming) return "Waiting for Confirmation...";
    if (pendingDecryption?.isPending) return "Decryption Pending...";
      if (needsAuthorization(0) || needsAuthorization(1)) return "Authorize Tokens First";
    return "Add Liquidity";
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6 shadow-lg border-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Add Liquidity</h2>
        <ConnectButton />
      </div>

      {/* Token 0 Input */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <Label className="text-sm text-muted-foreground">LUSD Amount</Label>
          {token0Balance && <span className="text-xs text-muted-foreground">Balance: Encrypted</span>}
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            value={token0Amount}
            onChange={(e) => setToken0Amount(e.target.value)}
            className="text-2xl font-semibold h-16 pr-32 border-2"
            disabled={isAdding}
          />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMaxClick(0)}
              disabled={isAdding}
              className="text-xs font-semibold"
            >
              MAX
            </Button>
            <div className="bg-secondary px-3 py-2 rounded-full font-semibold text-sm">LUSD</div>
          </div>
        </div>
        {needsAuthorization(0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleApprove(0)}
            disabled={isApproving}
            className="w-full"
          >
            {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Authorize LUSD
          </Button>
        )}
      </div>

      {/* Plus Icon */}
      <div className="flex justify-center my-4">
        <div className="p-2 rounded-full bg-secondary">
          <Plus className="w-5 h-5" />
        </div>
      </div>

      {/* Token 1 Input */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center">
          <Label className="text-sm text-muted-foreground">LETH Amount</Label>
          {token1Balance && <span className="text-xs text-muted-foreground">Balance: Encrypted</span>}
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            value={token1Amount}
            onChange={(e) => setToken1Amount(e.target.value)}
            className="text-2xl font-semibold h-16 pr-32 border-2"
            disabled={isAdding}
          />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMaxClick(1)}
              disabled={isAdding}
              className="text-xs font-semibold"
            >
              MAX
            </Button>
            <div className="bg-secondary px-3 py-2 rounded-full font-semibold text-sm">LETH</div>
          </div>
        </div>
        {needsAuthorization(1) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleApprove(1)}
            disabled={isApproving}
            className="w-full"
          >
            {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Authorize LETH
          </Button>
        )}
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
            <p className="font-semibold text-sm mb-1">FHE-Encrypted Liquidity</p>
            <p className="text-xs text-muted-foreground">
              Your liquidity amounts are encrypted end-to-end using Zama FHE technology
            </p>
          </div>
        </div>
      </div>

      {/* Add Liquidity Button */}
      <Button
        className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:shadow-glow transition-all"
        disabled={!canAddLiquidity() || needsAuthorization(0) || needsAuthorization(1)}
        onClick={handleAddLiquidity}
      >
        {(isAdding || isPending || isConfirming) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
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

export default AddLiquidityCard;
