import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Play, Clock, Music, Users, TrendingUp, Headphones,
  BarChart3
} from "lucide-react";

const stats = [
  { label: "Songs Played", value: "1,247", icon: Music, change: "+12%" },
  { label: "Listening Time", value: "48h 23m", icon: Clock, change: "+8%" },
  { label: "Active Listeners", value: "23", icon: Users, change: "+5" },
  { label: "Queue Length", value: "15", icon: BarChart3, change: "" },
];

const recentTracks = [
  { title: "Blinding Lights", artist: "The Weeknd", playedAt: "Now Playing", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop" },
  { title: "Starboy", artist: "The Weeknd", playedAt: "2 min ago", cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop" },
  { title: "Levitating", artist: "Dua Lipa", playedAt: "5 min ago", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop" },
  { title: "Save Your Tears", artist: "The Weeknd", playedAt: "9 min ago", cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop" },
  { title: "Don't Start Now", artist: "Dua Lipa", playedAt: "13 min ago", cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop" },
];

const topListeners = [
  { name: "Alex", avatar: "A", listenTime: "4h 23m" },
  { name: "Jordan", avatar: "J", listenTime: "3h 45m" },
  { name: "Sam", avatar: "S", listenTime: "2h 12m" },
  { name: "Casey", avatar: "C", listenTime: "1h 56m" },
];

const DashboardOverview = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening in your server.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} variant="stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                {stat.change && (
                  <p className="text-xs text-success mt-1">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {stat.change}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Tracks */}
        <Card variant="glass" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTracks.map((track, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group cursor-pointer"
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                  <img src={track.cover} alt={track.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-5 h-5 text-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{track.playedAt}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Listeners */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Top Listeners
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topListeners.map((listener, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-primary">{listener.avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{listener.name}</p>
                  <p className="text-xs text-muted-foreground">{listener.listenTime} today</p>
                </div>
                <span className="text-xs text-muted-foreground">#{index + 1}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;
