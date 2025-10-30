import { ArrowRight, Shield, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-secondary" />
      <div className="absolute inset-0 bg-gradient-primary opacity-10" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="container relative z-10 px-4 mx-auto">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-card border border-border shadow-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">FHE-Powered Privacy Protocol</span>
          </div>
          
          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Trade with
            <span className="block mt-2 bg-gradient-accent bg-clip-text text-transparent">
              Complete Privacy
            </span>
          </h1>
          
          {/* Description */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            LiquidSwap uses Fully Homomorphic Encryption to keep your trades, 
            liquidity, and balances completely confidential.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={() => {
                const mintSection = document.getElementById('mint');
                mintSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 text-lg px-8 py-6"
            >
              Launch App
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                window.open('https://github.com/y6qom3fjycxn8/LiquidSwap', '_blank');
              }}
              className="border-2 text-lg px-8 py-6 hover:bg-secondary"
            >
              Learn More
            </Button>
          </div>
          
          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all">
              <div className="p-3 rounded-full bg-primary/10">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold">Encrypted Reserves</h3>
              <p className="text-sm text-muted-foreground">All pool data is encrypted end-to-end</p>
            </div>
            
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all">
              <div className="p-3 rounded-full bg-accent/10">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold">Instant Swaps</h3>
              <p className="text-sm text-muted-foreground">Lightning-fast encrypted transactions</p>
            </div>
            
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border shadow-sm hover:shadow-md transition-all">
              <div className="p-3 rounded-full bg-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold">Zero Knowledge</h3>
              <p className="text-sm text-muted-foreground">Trade without revealing your strategy</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
