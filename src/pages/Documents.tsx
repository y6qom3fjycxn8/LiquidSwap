import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const CONTRACTS = [
  {
    name: "Swap Pair",
    address: "0xc68abF4A812060b587Cd9CC9Bba6a9e2D1df00e0",
    description: "Main automated market maker contract handling swaps, liquidity, and encrypted storage.",
  },
  {
    name: "Liquid USD (LUSD)",
    address: "0x534df81296D12C971a6BF8BfA609eD744e2610A3",
    description: "Confidential ERC7984 stable token used for the USD side of the pool.",
  },
  {
    name: "Liquid ETH (LETH)",
    address: "0xf678ca1012Cf4AD86F4FD2BbBfc25a34F915b3fA",
    description: "Confidential ERC7984 asset representing wrapped ETH liquidity.",
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
              Learn how Fully Homomorphic Encryption powers our automated market maker, explore the on-chain
              contracts, and watch the platform in action.
            </p>
          </header>

          <section className="grid gap-8">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">System Architecture</h2>
              <div className="grid md:grid-cols-2 gap-6 text-sm md:text-base text-muted-foreground">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">On-Chain Layer</h3>
                  <ul className="space-y-2">
                    <li><strong>Swap Pair</strong> orchestrates liquidity balances, swap execution, and encrypted state.</li>
                    <li><strong>Confidential Tokens</strong> (LUSD & LETH) inherit ERC7984 with homomorphic balances.</li>
                    <li><strong>Sepolia FHE Coprocessor</strong> validates encrypted inputs and produces proof-backed decryptions.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Frontend & Relayer</h3>
                  <ul className="space-y-2">
                    <li>The React/Vite dApp uses the Zama Relayer SDK to encrypt user inputs directly in the browser.</li>
                    <li>Wagmi + RainbowKit manage wallet connections and transaction lifecycle.</li>
                    <li>Encrypted handles and proofs are submitted in a single transaction for every liquidity or swap action.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">Demonstration Video</h2>
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
                The demo walks through minting test tokens, providing liquidity, and executing private swaps end-to-end on Sepolia.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-6">Deployed Contracts</h2>
              <div className="space-y-4">
                {CONTRACTS.map((contract) => (
                  <div key={contract.address} className="rounded-xl border border-border/60 bg-muted/40 p-4">
                    <h3 className="text-lg font-semibold">{contract.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{contract.description}</p>
                    <a
                      href={`https://sepolia.etherscan.io/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {contract.address}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">Key Mechanics</h2>
              <ul className="space-y-3 text-sm md:text-base text-muted-foreground">
                <li><strong>Encrypted Inputs:</strong> Users encrypt swap sizes and liquidity amounts client-side; only ciphertext handles reach the chain.</li>
                <li><strong>Proof Validation:</strong> Each handle is accompanied by a zk-proof validated via Zama's Sepolia coprocessor before state updates.</li>
                <li><strong>Obfuscated Reserves:</strong> Reserve snapshots are randomized before exposure, protecting pool health while informing price oracles.</li>
                <li><strong>Refund Safety:</strong> Pending operations can be rolled back if decryptions stall, preventing fund lock-ups.</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Documents;
