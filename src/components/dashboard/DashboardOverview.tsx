import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Play,
  Clock,
  Music,
  Users,
  TrendingUp,
  Headphones,
  BarChart3,
  Loader2,
} from "lucide-react";
import { useBot } from "@/contexts/BotContext";

type OverviewStats = {
  songsPlayed: number;
  listeningTimeMinutes: number;
  activeListeners: number;
  queueLength: number;
};

export default function DashboardOverview() {
  const { currentServerId } = useBot();

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentServerId) return;

    setLoading(true);
    fetch(`/api/servers/${currentServerId}/overview`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, [currentServerId]);

  if (!currentServerId) {
    return (
      <div className="text-muted-foreground">
        Select a server to view dashboard data.
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Songs Played",
      value: stats.songsPlayed.toLocaleString(),
      icon: Music,
    },
    {
      label: "Listening Time",
      value: `${Math.floor(stats.listeningTimeMinutes / 60)}h ${
        stats.listeningTimeMinutes % 60
      }m`,
      icon: Clock,
    },
    {
      label: "Active Listeners",
      value: stats.activeListeners,
      icon: Users,
    },
    {
      label: "Queue Length",
      value: stats.queueLength,
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Here’s what’s happening in your server.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} variant="stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* You will plug Recent Activity + Top Listeners here next */}
    </div>
  );
}
