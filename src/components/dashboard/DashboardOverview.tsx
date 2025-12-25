import { useEffect, useState, useRef } from "react";
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
  listenTimeMinutes: number;
  rank: number;
};

/* ======================
   COMPONENT
====================== */
export default function DashboardOverview() {
  const { currentServerId } = useBot();
  const wsRef = useRef<WebSocket | null>(null);

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [topListeners, setTopListeners] = useState<TopListener[]>([]);

  const [statsLoading, setStatsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [listenersLoading, setListenersLoading] = useState(false);

  /* ======================
     LOAD OVERVIEW STATS (FIX)
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
     WEBSOCKET LIVE UPDATES
  ====================== */
  useEffect(() => {
    if (!currentServerId || !stats) return;

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          guildId: currentServerId,
        })
      );
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      setStats((prev) => {
        if (!prev) return prev;

        switch (data.type) {
          case "song_played":
            return { ...prev, songsPlayed: prev.songsPlayed + 1 };

          case "queue_update":
            return { ...prev, queueLength: data.queueLength };

          case "voice_update":
            return { ...prev, activeListeners: data.activeListeners };

          default:
            return prev;
        }
      });
    };

    ws.onerror = () => ws.close();

    return () => ws.close();
  }, [currentServerId, stats]);

  /* ======================
     LOAD RECENT ACTIVITY
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
     LOAD TOP LISTENERS
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
     EMPTY / LOADING STATES
  ====================== */
  if (!currentServerId) {
    return (
      <div className="text-muted-foreground">
        Select a server to view dashboard data.
      </div>
    );
  }

  if (statsLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
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

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Here’s what’s happening in your server.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} variant="stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity + Top Listeners unchanged */}
      {/* (rest of your render code stays exactly the same) */}
    </div>
  );
}
