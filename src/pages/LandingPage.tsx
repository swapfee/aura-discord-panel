import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Music, Zap, Users, Sliders, Play, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  {
    icon: Music,
    title: "Crystal Clear Audio",
    description: "Premium 320kbps streaming with zero latency and buffer-free playback.",
  },
  {
    icon: Sliders,
    title: "Advanced EQ & Filters",
    description: "Fine-tune your sound with bass boost, nightcore, 8D audio, and more.",
  },
  {
    icon: Users,
    title: "Multi-Server Support",
    description: "Manage queues across all your servers from one unified dashboard.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Instant track loading with smart caching and predictive buffering.",
  },
];

// Discord brand icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, loading, signInWithDiscord } = useAuth();

  // Bot invite URL - permissions: Connect, Speak, Use Voice Activity
  const BOT_INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID || "1319737099020414976"}&permissions=3145728&scope=bot%20applications.commands`;

  const handleAddToDiscord = () => {
    window.open(BOT_INVITE_URL, "_blank");
  };

  const handleDiscordLogin = async () => {
    try {
      await signInWithDiscord();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleDashboard = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      handleDiscordLogin();
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-spotlight pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Navigation */}
      <nav className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">SoundWave</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Features
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Commands
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Premium
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Support
            </a>
          </div>
          
          <div className="flex items-center gap-3">
            {loading ? (
              <Button variant="ghost" size="sm" disabled>
                <Loader2 className="w-4 h-4 animate-spin" />
              </Button>
            ) : user ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleDiscordLogin}>
                <DiscordIcon className="w-4 h-4 mr-2" />
                Login
              </Button>
            )}
            <Button variant="hero" size="sm" onClick={handleAddToDiscord}>
              <DiscordIcon className="w-4 h-4" />
              Add to Discord
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Zap className="w-4 h-4" />
            <span>Trusted by 50,000+ Discord servers</span>
          </div>
          
          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            The Ultimate
            <span className="block text-gradient-accent">Music Experience</span>
          </h1>
          
          {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Transform your Discord server with crystal-clear audio, powerful controls, 
            and a stunning dashboard to manage everything.
          </p>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Button variant="hero" size="xl" onClick={handleAddToDiscord}>
              <DiscordIcon className="w-5 h-5" />
              Add to Discord
            </Button>
            <Button variant="hero-outline" size="xl" onClick={handleDashboard}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              Open Dashboard
            </Button>
          </div>
          
          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-16 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">50K+</div>
              <div className="text-sm text-muted-foreground">Servers</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">2M+</div>
              <div className="text-sm text-muted-foreground">Users</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">24/7</div>
              <div className="text-sm text-muted-foreground">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Packed with powerful features to elevate your server's music experience.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={feature.title}
              variant="glass"
              className="p-6 hover:border-primary/30 transition-all duration-300 group animate-fade-in"
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-6 py-24">
        <Card variant="glass-strong" className="p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 gradient-radial opacity-50 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Join thousands of servers already using SoundWave for the best music experience.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="lg" onClick={handleAddToDiscord}>
                <DiscordIcon className="w-5 h-5" />
                Add to Discord — It's Free
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-background/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Music className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold">SoundWave</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 SoundWave. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
