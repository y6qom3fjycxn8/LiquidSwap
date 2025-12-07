import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const CONTRACTS = [
  {
    name: "LiquidSwapPair",
    address: "0xBd616c7bC7423D07a11018ed324d178586DC6128",
    description: "Core AMM contract with Queue Mode architecture. Handles swaps, liquidity operations, and encrypted state management using fhEVM 0.9.1 self-relaying pattern.",
  },
  {
    name: "Liquid USD (LUSD)",
    address: "0x1A15cF37a5E13e01774d2007DEA79Fc6eA52CEa9",
    description: "Confidential ERC7984 stablecoin with encrypted balances and operator-based transfer authorization.",
  },
  {
    name: "Liquid ETH (LETH)",
    address: "0xc5731f5Da1E7d8dBfc99f187E1766f91e8e59bFB",
    description: "Confidential ERC7984 wrapped ETH token for private liquidity provision and swaps.",
  },
];

const FEATURES = [
  {
    title: "Queue Mode",
    description: "Per-user pending operations allow multiple users to interact simultaneously. No global locks - only the same user is blocked from concurrent operations.",
    icon: "queue",
  },
  {
    title: "Self-Relaying Decryption",
    description: "fhEVM 0.9.1 pattern where any user can submit decryption proofs to complete pending operations, improving liveness and UX.",
    icon: "relay",
  },
  {
    title: "5-Minute Refund Window",
    description: "Operations not completed within MAX_OPERATION_TIME can be refunded, preventing permanent fund lock-ups.",
    icon: "refund",
  },
  {
    title: "Encrypted Reserves",
    description: "Pool reserves are stored as encrypted values. Obfuscated snapshots protect MEV while enabling price discovery.",
    icon: "lock",
  },
];

const Documents = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="py-16 px-4 md:py-24">
        <div className="container mx-auto max-w-5xl space-y-16">
          <header className="text-center space-y-4">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Documentation</p>
            <h1 className="text-4xl md:text-5xl font-bold">How LiquidSwap Works</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              A confidential DEX powered by Fully Homomorphic Encryption. Queue Mode architecture enables concurrent user operations while maintaining complete privacy.
            </p>
          </header>

          <section className="grid gap-8">
            {/* Queue Mode Architecture */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">Queue Mode Architecture</h2>
              <div className="grid md:grid-cols-2 gap-6 text-sm md:text-base text-muted-foreground">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Per-User Operations</h3>
                  <ul className="space-y-2">
                    <li><strong>Concurrent Access:</strong> Multiple users can add liquidity, swap, or withdraw simultaneously.</li>
                    <li><strong>User Isolation:</strong> Each user's pending operation is tracked independently via <code className="text-xs bg-muted px-1 rounded">userPendingOperations</code> mapping.</li>
                    <li><strong>No Global Lock:</strong> Unlike traditional FHE AMMs, one user's pending decryption doesn't block others.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Operation Lifecycle</h3>
                  <ul className="space-y-2">
                    <li><strong>1. Initiate:</strong> User submits encrypted amounts, receives requestID.</li>
                    <li><strong>2. Decrypt:</strong> Gateway processes FHE decryption, anyone can relay the callback.</li>
                    <li><strong>3. Complete:</strong> Callback executes the actual swap/liquidity change on-chain.</li>
                    <li><strong>4. Refund:</strong> After 5 minutes, user can cancel and recover funds if stuck.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Key Features */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-6">Key Features</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {FEATURES.map((feature) => (
                  <div key={feature.title} className="rounded-xl border border-border/60 bg-muted/40 p-4">
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* System Architecture */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">System Architecture</h2>
              <div className="grid md:grid-cols-2 gap-6 text-sm md:text-base text-muted-foreground">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">On-Chain Layer</h3>
                  <ul className="space-y-2">
                    <li><strong>LiquidSwapPair:</strong> Core AMM with Queue Mode, encrypted reserves, and callback-based execution.</li>
                    <li><strong>SwapLib:</strong> Library for constant-product calculations and liquidity math.</li>
                    <li><strong>ERC7984 Tokens:</strong> Confidential tokens with encrypted balances and operator permissions.</li>
                    <li><strong>Zama Gateway:</strong> FHE coprocessor for decryption proof generation.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Frontend & SDK</h3>
                  <ul className="space-y-2">
                    <li><strong>fhevmjs:</strong> Browser-side FHE encryption using Zama's SDK.</li>
                    <li><strong>Wagmi + RainbowKit:</strong> Wallet connection and transaction management.</li>
                    <li><strong>Decryption Callback:</strong> React hook monitors pending operations and auto-submits proofs.</li>
                    <li><strong>React/Vite:</strong> Modern frontend with real-time operation status.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Demo Video */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">Demo Video</h2>
              <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-black">
                <video
                  controls
                  className="w-full h-full"
                  poster="/placeholder.svg"
                >
                  <source src="/demo.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Watch the complete flow: mint test tokens, provide liquidity with encrypted amounts, execute private swaps, and see Queue Mode in action with concurrent users.
              </p>
            </div>

            {/* Deployed Contracts */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-6">Deployed Contracts (Sepolia)</h2>
              <div className="space-y-4">
                {CONTRACTS.map((contract) => (
                  <div key={contract.address} className="rounded-xl border border-border/60 bg-muted/40 p-4">
                    <h3 className="text-lg font-semibold">{contract.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{contract.description}</p>
                    <a
                      href={`https://sepolia.etherscan.io/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all font-mono"
                    >
                      {contract.address}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Details */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">Technical Details</h2>
              <div className="space-y-4 text-sm md:text-base text-muted-foreground">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Encrypted Operations</h3>
                  <ul className="space-y-2">
                    <li><strong>Encrypted Inputs:</strong> Swap amounts and liquidity values are encrypted client-side using fhevmjs before submission.</li>
                    <li><strong>Proof Validation:</strong> Each encrypted handle includes a ZK proof validated by Zama's coprocessor.</li>
                    <li><strong>Ciphertext Storage:</strong> All sensitive values (reserves, balances) remain encrypted on-chain.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Safety Mechanisms</h3>
                  <ul className="space-y-2">
                    <li><strong>MAX_OPERATION_TIME:</strong> 5 minutes timeout prevents indefinite fund locks.</li>
                    <li><strong>Request Ownership:</strong> Only the operation initiator can request refunds.</li>
                    <li><strong>Deadline Enforcement:</strong> Transactions revert if submitted after user-specified deadline.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Events</h3>
                  <ul className="space-y-2">
                    <li><strong>DecryptionPending:</strong> Emitted when operation needs callback, includes requestID and handles.</li>
                    <li><strong>Refund:</strong> Emitted when user cancels a timed-out operation.</li>
                    <li><strong>liquidityMinted/liquidityBurnt:</strong> Track LP token changes.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Documents;
