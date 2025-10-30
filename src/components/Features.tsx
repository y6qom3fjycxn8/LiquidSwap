import { Shield, Eye, Layers, Zap, Lock, Users } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Fully Homomorphic Encryption",
    description: "All trading data is encrypted end-to-end using cutting-edge FHE technology, ensuring complete privacy.",
  },
  {
    icon: Eye,
    title: "Zero-Knowledge Trading",
    description: "Execute swaps without revealing your trading strategy or position sizes to anyone.",
  },
  {
    icon: Layers,
    title: "Encrypted Liquidity Pools",
    description: "Pool reserves and LP shares are stored as ciphertext, protecting liquidity provider information.",
  },
  {
    icon: Zap,
    title: "Instant Settlement",
    description: "Lightning-fast swaps with immediate finality, all while maintaining privacy guarantees.",
  },
  {
    icon: Lock,
    title: "Authorized Decryption",
    description: "Only authorized participants and FHE oracles can decrypt specific values when needed.",
  },
  {
    icon: Users,
    title: "Community Governed",
    description: "Decentralized protocol governed by the community with transparent, encrypted voting.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 px-4 bg-gradient-secondary">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm font-semibold text-primary">Features</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Privacy-First DeFi
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built on advanced cryptography to protect your financial privacy
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="mb-6 p-4 rounded-xl bg-gradient-primary w-fit group-hover:shadow-glow transition-all duration-300">
                <feature.icon className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
