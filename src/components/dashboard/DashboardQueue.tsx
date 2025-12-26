// src/components/DashboardQueue.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Trash2,
  GripVertical,
  MoreHorizontal,
  Clock,
  User,
  ListMusic,
} from "lucide-react";
import { useBot } from "@/contexts/BotContext";
import { useGuildWebSocket } from "@/hooks/useGuildWebSocket";

/* ----------------------
   Types
   ---------------------- */
interface QueueApiTrack {
  id?: string;
  title: string;
  artist: string;
  duration?: string;
  durationMs?: number;
  requestedBy?: string | null;
  cover?: string | null;
  position?: number | null;
}

interface QueueApiResponse {
  nowPlaying?: QueueApiTrack | null;
  tracks?: QueueApiTrack[];
  queueLength?: number;
}

/* ----------------------
   Component
   ---------------------- */
const DashboardQueue: React.FC = () => {
  const { currentServerId } = useBot();

  const [queue, setQueue] = useState<QueueApiTrack[]>([]);
  const [nowPlayingIndex, setNowPlayingIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState<number>(0);

  /* ----------------------
     Helpers
     ---------------------- */
  const durationToSeconds = (t?: QueueApiTrack) => {
    if (!t) return 0;
    if (typeof t.durationMs === "number")
      return Math.floor(t.durationMs / 1000);
    if (typeof t.duration === "string") {
      const parts = t.duration.split(":").map(Number);
      if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0);
      if (parts.length === 3)
        return parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    return 0;
  };

  const totalDurationSeconds = queue.reduce(
    (acc, it) => acc + durationToSeconds(it),
    0
  );
  const formatTotalDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /* ----------------------
     Fetch overview (light)
     ---------------------- */
  const fetchOverview = useCallback(async () => {
    if (!currentServerId) return null;
    try {
      const res = await fetch(`/api/servers/${currentServerId}/overview`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load overview");
      const data = (await res.json()) as { queueLength?: number } | null;
      return data;
    } catch (err) {
      console.error("overview fetch error", err);
      setError("Failed to load overview.");
      return null;
    }
  }, [currentServerId]);

  /* ----------------------
     Fetch full queue (typed)
     ---------------------- */
  const fetchQueue = useCallback(async () => {
    if (!currentServerId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/servers/${currentServerId}/queue`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load queue");
      // Explicitly type the response
      const data = (await res.json()) as QueueApiResponse;

      const tracks = (Array.isArray(data.tracks) ? data.tracks : []).map(
        (t, i) => ({
          id: t.id ?? t.title ?? String(i),
          title: t.title,
          artist: t.artist,
          duration: t.duration,
          durationMs: t.durationMs,
          requestedBy: t.requestedBy ?? null,
          cover: t.cover ?? null,
          position: typeof t.position === "number" ? t.position : i + 1,
        })
      );

      setQueue(tracks);
      setQueueLength(
        typeof data.queueLength === "number" ? data.queueLength : tracks.length
      );
      setNowPlayingIndex((prev) =>
        Math.min(prev, Math.max(0, tracks.length - 1))
      );
    } catch (err) {
      console.error("queue fetch error", err);
      setError("Failed to load queue.");
      setQueue([]);
      setQueueLength(0);
    } finally {
      setLoading(false);
    }
  }, [currentServerId]);

  /* ----------------------
     Initial load
     ---------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentServerId) return;
      setLoading(true);
      const overview = await fetchOverview();
      if (cancelled) return;
      const qlen = overview?.queueLength ?? 0;
      setQueueLength(qlen);
      if (qlen > 0) {
        await fetchQueue();
      } else {
        setQueue([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentServerId, fetchOverview, fetchQueue]);

  /* ----------------------
     WebSocket live updates
     ---------------------- */
  useGuildWebSocket(currentServerId, {
    onQueueUpdate: async (qlen: number) => {
      setQueueLength(qlen);
      if (qlen === 0) {
        setQueue([]);
        return;
      }
      // If our local list is stale, re-fetch
      if (qlen !== queue.length) {
        await fetchQueue();
      }
    },
  });

  /* ----------------------
     UI actions (optimistic)
     ---------------------- */
  const removeFromQueue = async (id?: string) => {
    setQueue((prev) => prev.filter((i) => (id ? i.id !== id : true)));
    // TODO: call backend to perform removal (POST /api/servers/:id/queue/remove)
  };

  const clearQueue = async () => {
    setQueue([]);
    setQueueLength(0);
    // TODO: call backend to clear queue (POST /api/servers/:id/queue/clear)
  };

  const playAll = () => {
    if (queue.length > 0) setNowPlayingIndex(0);
    // TODO: instruct bot to start playback if necessary
  };

  /* ----------------------
     Render
     ---------------------- */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Queue</h1>
          <p className="text-muted-foreground">
            {queueLength} tracks • {formatTotalDuration(totalDurationSeconds)}{" "}
            total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearQueue}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Queue
          </Button>
          <Button variant="hero" size="sm" onClick={playAll}>
            <Play className="w-4 h-4 mr-2" />
            Play All
          </Button>
        </div>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-primary" />
            Up Next
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs text-muted-foreground border-b border-border">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Title</div>
              <div className="col-span-2">
                <User className="w-3 h-3 inline mr-1" />
                Requested By
              </div>
              <div className="col-span-2">
                <Clock className="w-3 h-3 inline mr-1" />
                Duration
              </div>
              <div className="col-span-2"></div>
            </div>

            {/* Loading / Empty */}
            {loading && <div className="p-4">Loading queue…</div>}
            {!loading && error && (
              <div className="p-4 text-destructive">{error}</div>
            )}
            {!loading && !error && queueLength === 0 && (
              <div className="p-4 text-muted-foreground">
                No songs in the queue.
              </div>
            )}

            {/* Queue Items */}
            {!loading &&
              !error &&
              queueLength > 0 &&
              queue.map((item, index) => (
                <div
                  key={item.id ?? index}
                  className={`grid grid-cols-12 gap-4 px-3 py-3 rounded-lg group transition-colors ${
                    index === nowPlayingIndex
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="col-span-1 flex items-center">
                    <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab mr-2" />
                    <span className="text-sm text-muted-foreground group-hover:hidden">
                      {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hidden group-hover:flex"
                      onClick={() => setNowPlayingIndex(index)}
                    >
                      {index === nowPlayingIndex ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      {item.cover ? (
                        <img
                          src={item.cover}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          index === nowPlayingIndex
                            ? "text-primary"
                            : "text-foreground"
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.artist}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-muted-foreground">
                      {item.requestedBy}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-muted-foreground">
                      {(() => {
                        const s = durationToSeconds(item);
                        const m = Math.floor(s / 60);
                        const sec = s % 60;
                        return `${m}:${sec.toString().padStart(2, "0")}`;
                      })()}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => removeFromQueue(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardQueue;
