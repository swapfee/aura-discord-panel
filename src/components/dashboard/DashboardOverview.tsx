import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Play,
  Clock,
  Music,
  Users,
  Headphones,
  BarChart3,
  Loader2,
} from "lucide-react";
import { useBot } from "@/contexts/BotContext";
import { useGuildWebSocket } from "@/hooks/useGuildWebSocket";

/* ======================
   TYPES
====================== */
type OverviewStats = {
  songsPlayed: number;
  listeningTimeMinutes: number;
  activeListeners: number;
  queueLength: number;
};

type RecentTrack = {
  title: string;
  artist: string;
  cover?: string | null;
  playedAt: string;
};

type TopListener = {
  userId: string;
  username?: string | null;
  listenTimeMinutes: number;
  rank: number;
};

/* ======================
   COMPONENT
====================== */
export default function DashboardOverview() {
  const { currentServerId } = useBot();

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [topListeners, setTopListeners] = useState<TopListener[]>([]);

  const [statsLoading, setStatsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [listenersLoading, setListenersLoading] = useState(false);

  /* ======================
     REST: OVERVIEW STATS
  ====================== */
  useEffect(() => {
    if (!currentServerId) return;

    setStatsLoading(true);

    fetch(`/api/servers/${currentServerId}/overview`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => setStats(data))
      .finally(() => setStatsLoading(false));
  }, [currentServerId]);

  /* ======================
     WEBSOCKET: LIVE UPDATES
  ====================== */
  useGuildWebSocket(currentServerId, {
    onSongPlayed: () => {
      setStats((prev) =>
        prev ? { ...prev, songsPlayed: prev.songsPlayed + 1 } : prev
      );
    },

    onQueueUpdate: (queueLength) => {
      setStats((prev) =>
        prev ? { ...prev, queueLength } : prev
      );
    },

    onVoiceUpdate: (activeListeners) => {
      setStats((prev) =>
        prev ? { ...prev, activeListeners } : prev
      );
    },
  });

  /* ======================
     REST: RECENT ACTIVITY
  ====================== */
  useEffect(() => {
    if (!currentServerId) return;

    setActivityLoading(true);
    fetch(`/api/servers/${currentServerId}/recent-activity`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setRecentTracks(data.tracks ?? []))
      .finally(() => setActivityLoading(false));
  }, [currentServerId]);

  /* ======================
     REST: TOP LISTENERS
  ====================== */
  useEffect(() => {
    if (!currentServerId) return;

    setListenersLoading(true);
    fetch(`/api/servers/${currentServerId}/top-listeners`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setTopListeners(data.listeners ?? []))
      .finally(() => setListenersLoading(false));
  }, [currentServerId]);

  /* ======================
     STATES
  ====================== */
  if (!currentServerId) {
    return <div className="text-muted-foreground">Select a server.</div>;
  }

  if (statsLoading || !stats) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: "Songs Played", value: stats.songsPlayed, icon: Music },
    {
      label: "Listening Time",
      value: `${Math.floor(stats.listeningTimeMinutes / 60)}h ${
        stats.listeningTimeMinutes % 60
      }m`,
      icon: Clock,
    },
    { label: "Active Listeners", value: stats.activeListeners, icon: Users },
    { label: "Queue Length", value: stats.queueLength, icon: BarChart3 },
  ];

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Here’s what’s happening in your server.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className="w-6 h-6 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTracks.slice(0, 7).map((track, i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center">
                <Play className="w-4 h-4" />
              </div>
              <div className="flex-1 truncate">
                <p className="font-medium truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artist}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {track.playedAt}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
