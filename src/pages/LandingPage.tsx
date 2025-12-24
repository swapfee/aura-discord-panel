import { forwardRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Music, Zap, Users, Sliders, Play } from "lucide-react";
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

// Discord brand icon (UI only)
const DiscordIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg ref={ref} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
);
DiscordIcon.displayName = "DiscordIcon";

export default function LandingPage() {
  const { user, signInWithDiscord } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-spotlight pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">SoundWave</span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                Dashboard
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={signInWithDiscord}>
                Login
              </Button>
            )}
            <Button 
              variant="hero" 
              size="sm"
              onClick={() => window.open("https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=8&scope=bot%20applications.commands", "_blank")}
            >
              <DiscordIcon className="w-4 h-4" />
              Add to Discord
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 container mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <Zap className="w-4 h-4" />
          Trusted by 50,000+ Discord servers
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          The Ultimate
          <span className="block text-gradient-accent">Music Experience</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Transform your Discord server with crystal-clear audio and a stunning dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            variant="hero" 
            size="xl"
            onClick={() => window.open("https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=8&scope=bot%20applications.commands", "_blank")}
          >
            <DiscordIcon className="w-5 h-5" />
            Add to Discord
          </Button>
          <Button 
            variant="hero-outline" 
            size="xl" 
            onClick={() => navigate("/dashboard")}
          >
            <Play className="w-5 h-5" />
            Open Dashboard
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 container mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} variant="glass" className="p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-background/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-8 flex items-center justify-between">
          <span className="font-semibold">SoundWave</span>
          <span className="text-sm text-muted-foreground">
            © 2024 SoundWave. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
