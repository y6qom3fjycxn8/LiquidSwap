import { useState, useEffect } from "react";
import { Coins, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseUnits } from "viem";
import { useMintToken, useTokenBalance, useToken0Address, useToken1Address } from "@/hooks/useSwapPair";
import { encryptUint64 } from "@/lib/fhe";

const MintCard = () => {
  const { address, isConnected } = useAccount();
  const [token0Amount, setToken0Amount] = useState("1000");
  const [token1Amount, setToken1Amount] = useState("1000");
  const [isMinting, setIsMinting] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Get token addresses
  const { token0Address } = useToken0Address();
  const { token1Address } = useToken1Address();

  // Get balances
  const { balance: token0Balance, refetch: refetchToken0 } = useTokenBalance(token0Address, address);
  const { balance: token1Balance, refetch: refetchToken1 } = useTokenBalance(token1Address, address);

  // Mint hooks
  const { mint: mintToken0, hash: hash0, isPending: isPending0, isConfirming: isConfirming0, isSuccess: isSuccess0, error: error0 } = useMintToken(token0Address);
  const { mint: mintToken1, hash: hash1, isPending: isPending1, isConfirming: isConfirming1, isSuccess: isSuccess1, error: error1 } = useMintToken(token1Address);

  // Monitor transaction submission
  useEffect(() => {
    if (isPending0 || isPending1) {
      const token = isPending0 ? "LUSD" : "LETH";
      toast.info(`${token} mint transaction submitted. Waiting for confirmation...`);
    }
  }, [isPending0, isPending1]);

  // Monitor transaction confirmation
  useEffect(() => {
    if (isConfirming0 || isConfirming1) {
      const hash = isConfirming0 ? hash0 : hash1;
      const token = isConfirming0 ? "LUSD" : "LETH";

      toast.loading(
        <div>
          <p className="font-semibold">Confirming {token} mint transaction...</p>
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
        </div>,
        { id: `confirming-${hash}` }
      );
    }
  }, [isConfirming0, isConfirming1, hash0, hash1]);

  // Monitor transaction success
  useEffect(() => {
    if (isSuccess0 || isSuccess1) {
      const hash = isSuccess0 ? hash0 : hash1;
      const token = isSuccess0 ? "LUSD" : "LETH";

      // Dismiss loading toast
      if (hash) toast.dismiss(`confirming-${hash}`);

      toast.success(
        <div>
          <p className="font-semibold">✅ {token} minted successfully!</p>
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

      setIsMinting(false);
      refetchToken0();
      refetchToken1();
    }
  }, [isSuccess0, isSuccess1, hash0, hash1, refetchToken0, refetchToken1]);

  // Monitor transaction errors
  useEffect(() => {
    if (error0) {
      if (hash0) toast.dismiss(`confirming-${hash0}`);

      toast.error(
        <div>
          <p className="font-semibold">❌ LUSD mint failed</p>
          <p className="text-xs mt-1">{error0.message}</p>
          {hash0 && (
            <a
              href={`https://sepolia.etherscan.io/tx/${hash0}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
            >
              View on Etherscan →
            </a>
          )}
        </div>
      );
      setIsMinting(false);
    }
  }, [error0, hash0]);

  useEffect(() => {
    if (error1) {
      if (hash1) toast.dismiss(`confirming-${hash1}`);

      toast.error(
        <div>
          <p className="font-semibold">❌ LETH mint failed</p>
          <p className="text-xs mt-1">{error1.message}</p>
          {hash1 && (
            <a
              href={`https://sepolia.etherscan.io/tx/${hash1}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs underline mt-1 block"
            >
              View on Etherscan →
            </a>
          )}
        </div>
      );
      setIsMinting(false);
    }
  }, [error1, hash1]);

  const handleMintToken0 = async () => {
    if (!address || !token0Amount || !token0Address) {
      toast.error("Please enter an amount");
      return;
    }

    try {
      setIsMinting(true);
      setIsEncrypting(true);
      toast.info("Encrypting mint amount with FHE...");

      const amountBigInt = parseUnits(token0Amount, 6);
      const MAX_UINT64 = BigInt("18446744073709551615");
      if (amountBigInt > MAX_UINT64) {
        throw new Error("Amount too large. Maximum is 18,446,744,073 tokens");
      }

      const { handle, proof } = await encryptUint64(amountBigInt, token0Address, address);

      setIsEncrypting(false);
      toast.success("Encryption complete! Submitting mint transaction...");

      await mintToken0(address, handle, proof);
    } catch (err: any) {
      console.error("Mint error:", err);
      toast.error(err.message || "Failed to mint tokens");
      setIsMinting(false);
      setIsEncrypting(false);
    }
  };

  const handleMintToken1 = async () => {
    if (!address || !token1Amount || !token1Address) {
      toast.error("Please enter an amount");
      return;
    }

    try {
      setIsMinting(true);
      setIsEncrypting(true);
      toast.info("Encrypting mint amount with FHE...");

      const amountBigInt = parseUnits(token1Amount, 6);
      const MAX_UINT64 = BigInt("18446744073709551615");
      if (amountBigInt > MAX_UINT64) {
        throw new Error("Amount too large. Maximum is 18,446,744,073 tokens");
      }

      const { handle, proof } = await encryptUint64(amountBigInt, token1Address, address);

      setIsEncrypting(false);
      toast.success("Encryption complete! Submitting mint transaction...");

      await mintToken1(address, handle, proof);
    } catch (err: any) {
      console.error("Mint error:", err);
      toast.error(err.message || "Failed to mint tokens");
      setIsMinting(false);
      setIsEncrypting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6 shadow-lg border-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6" />
          Mint Test Tokens
        </h2>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <div className="text-center text-muted-foreground py-8">
          Please connect your wallet to mint test tokens
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Liquid USD (LUSD)</Label>
            {token0Balance !== undefined && (
              <div className="text-sm text-muted-foreground">
                Current Balance: {token0Balance.toString()} LUSD (encrypted)
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="number"
                value={token0Amount}
                onChange={(e) => setToken0Amount(e.target.value)}
                placeholder="Amount to mint"
                disabled={isMinting || isPending0}
              />
              <Button
                onClick={handleMintToken0}
                disabled={isMinting || isPending0 || !token0Amount}
                className="min-w-[100px]"
              >
                {isPending0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  "Mint LUSD"
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-lg font-semibold">Liquid ETH (LETH)</Label>
            {token1Balance !== undefined && (
              <div className="text-sm text-muted-foreground">
                Current Balance: {token1Balance.toString()} LETH (encrypted)
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="number"
                value={token1Amount}
                onChange={(e) => setToken1Amount(e.target.value)}
                placeholder="Amount to mint"
                disabled={isMinting || isPending1}
              />
              <Button
                onClick={handleMintToken1}
                disabled={isMinting || isPending1 || !token1Amount}
                className="min-w-[100px]"
              >
                {isPending1 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  "Mint LETH"
                )}
              </Button>
            </div>
          </div>

          {isEncrypting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Encrypting with FHE...
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center pt-4 border-t">
            💡 These are test tokens for the Sepolia testnet. Mint as many as you need for testing!
          </div>
        </div>
      )}
    </Card>
  );
};

export default MintCard;
