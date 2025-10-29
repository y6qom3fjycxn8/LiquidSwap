import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SwapCard from "@/components/SwapCard";
import Features from "@/components/Features";
import Stats from "@/components/Stats";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        
        {/* Swap Section */}
        <section id="swap" className="py-24 px-4 bg-background">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Start Trading
              </h2>
              <p className="text-xl text-muted-foreground">
                Experience privacy-first decentralized exchange
              </p>
            </div>
            <SwapCard />
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
              <button className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-all">
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
