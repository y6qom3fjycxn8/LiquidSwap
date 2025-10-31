import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SwapCard from "@/components/SwapCard";
import MintCard from "@/components/MintCard";
import AddLiquidityCard from "@/components/AddLiquidityCard";
import Features from "@/components/Features";
import Stats from "@/components/Stats";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        
        {/* Mint Section */}
        <section id="mint" className="py-24 px-4 bg-muted/50">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Get Test Tokens
              </h2>
              <p className="text-xl text-muted-foreground">
                Mint LUSD and LETH tokens to start testing
              </p>
            </div>
            <MintCard />
          </div>
        </section>

        {/* Add Liquidity Section */}
        <section id="liquidity" className="py-24 px-4 bg-background">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Add Liquidity
              </h2>
              <p className="text-xl text-muted-foreground">
                Provide liquidity to earn trading fees
              </p>
            </div>
            <AddLiquidityCard />
          </div>
        </section>

        {/* Swap Section - Under Development */}
        <section id="swap" className="py-24 px-4 bg-muted/50">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Start Trading
              </h2>
              <p className="text-xl text-muted-foreground">
                Experience privacy-first decentralized exchange
              </p>
            </div>
            <div className="max-w-md mx-auto p-12 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-card">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold">Under Development</h3>
                <p className="text-muted-foreground">
                  The swap functionality is currently being optimized. Please check back soon!
                </p>
              </div>
            </div>
          </div>
        </section>

        <Features />
        <Stats />
        
        {/* CTA Section */}
        <section className="py-24 px-4 bg-gradient-secondary">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to Trade Privately?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join the future of private DeFi. Connect your wallet and start trading
                with complete confidence.
              </p>
              <button
                onClick={() => {
                  const swapSection = document.getElementById('swap');
                  swapSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-all cursor-pointer"
              >
                Launch App Now
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
