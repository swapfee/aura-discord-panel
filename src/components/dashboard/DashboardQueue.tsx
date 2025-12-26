import React, { useState, useEffect, useCallback, useRef } from "react";
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

type QueueApiTrack = {
  id?: string;
  title: string;
  artist: string;
  duration?: string;
  durationMs?: number;
  requestedBy?: string | null;
  cover?: string | null;
  position?: number | null;
};

type QueuePageResponse = {
  nowPlaying?: QueueApiTrack | null;
  tracks: QueueApiTrack[];
  queueLength: number;
  page: number;
  limit: number;
  totalPages: number;
};

/* ---------------------------
   Constants for virtualization
   --------------------------- */
const ITEM_HEIGHT = 64; // px per row (approx)
const VIRTUAL_BUFFER = 3; // render this many items above/below visible

/* ---------------------------
   Component
   --------------------------- */
const DashboardQueue: React.FC = () => {
  const { currentServerId } = useBot();

  const [tracks, setTracks] = useState<QueueApiTrack[]>([]);
  const [nowPlayingIndex, setNowPlayingIndex] = useState<number>(0);
  const [nowPlaying, setNowPlaying] = useState<QueueApiTrack | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [queueLength, setQueueLength] = useState<number>(0);

  // virtualization refs
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(400);

  useEffect(() => {
    // observe resize to set container height
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT) || 5;

  // helpers
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

  const totalSeconds = tracks.reduce((s, t) => s + durationToSeconds(t), 0);
  const formatTotalDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // fetch current page from server
  const fetchQueuePage = useCallback(
    async (p: number, lim: number) => {
      if (!currentServerId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/servers/${currentServerId}/queue?page=${p}&limit=${lim}`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) throw new Error("Failed to fetch queue");
        const data = (await res.json()) as QueuePageResponse;
        setTracks(data.tracks ?? []);
        setNowPlaying(data.nowPlaying ?? null);
        setQueueLength(data.queueLength ?? 0);
        setTotalPages(Math.max(1, data.totalPages ?? 1));
        // adjust nowPlayingIndex to within page bounds
        setNowPlayingIndex((prev) =>
          Math.min(prev, Math.max(0, (data.tracks?.length ?? 0) - 1))
        );
        setError(null);
      } catch (err) {
        console.error("fetchQueuePage error", err);
        setError("Failed to load queue page.");
        setTracks([]);
        setNowPlaying(null);
        setQueueLength(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [currentServerId]
  );

  // initial load & when page/limit change
  useEffect(() => {
    if (!currentServerId) return;
    fetchQueuePage(page, limit);
  }, [currentServerId, page, limit, fetchQueuePage]);

  // ws updates
  useGuildWebSocket(currentServerId, {
    onQueueUpdate: async (qlen: number) => {
      setQueueLength(qlen);
      if (qlen === 0) {
        setTracks([]);
        setNowPlaying(null);
        return;
      }
      // If queue length changed such that current page is now out-of-range, clamp or navigate
      const globalIndexStart = (page - 1) * limit;
      const globalIndexEnd = globalIndexStart + limit - 1;
      // If the update likely affects current page (simple heuristic: if qlen changed or page changed), refetch
      await fetchQueuePage(page, limit);
    },
  });

  // scroll handler for virtualization
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Calculate virtual window and spacers
  const pageItemCount = tracks.length;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ITEM_HEIGHT) - VIRTUAL_BUFFER
  );
  const endIndex = Math.min(
    pageItemCount,
    startIndex + visibleCount + VIRTUAL_BUFFER * 2
  );
  const topPadding = startIndex * ITEM_HEIGHT;
  const bottomPadding = Math.max(0, (pageItemCount - endIndex) * ITEM_HEIGHT);

  // pagination controls
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const changeLimit = (v: number) => {
    setLimit(v);
    setPage(1);
  };

  // optimistic remove
  const removeFromQueue = (id?: string) => {
    setTracks((prev) => prev.filter((t) => (id ? t.id !== id : true)));
    // optionally call backend endpoint to remove — TODO
  };

  const clearQueue = () => {
    setTracks([]);
    setQueueLength(0);
    // TODO: call backend clear
  };

  const playAll = () => {
    if (tracks.length > 0) setNowPlayingIndex(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Queue</h1>
          <p className="text-muted-foreground">
            {queueLength} tracks • {formatTotalDuration(totalSeconds)} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground mr-2">
            Page size
          </label>
          <select
            value={limit}
            onChange={(e) => changeLimit(Number(e.target.value))}
            className="mr-4"
          >
            {[20, 50, 100, 200].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

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
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs text-muted-foreground border-b border-border">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Title</div>
              <div className="col-span-2">
                <User className="w-3 h-3 inline mr-1" />
                Requested
              </div>
              <div className="col-span-2">
                <Clock className="w-3 h-3 inline mr-1" />
                Duration
              </div>
              <div className="col-span-2"></div>
            </div>

            {loading && <div className="p-4">Loading...</div>}
            {!loading && error && (
              <div className="p-4 text-destructive">{error}</div>
            )}
            {!loading && !error && queueLength === 0 && (
              <div className="p-4 text-muted-foreground">
                No songs in the queue.
              </div>
            )}

            {/* Virtualized list container */}
            {!loading && !error && queueLength > 0 && (
              <div
                ref={listRef}
                onScroll={onScroll}
                style={{ height: 400, overflow: "auto" }}
              >
                <div style={{ height: topPadding }} />
                {tracks.slice(startIndex, endIndex).map((item, idx) => {
                  const realIndex = startIndex + idx;
                  return (
                    <div
                      key={item.id ?? realIndex}
                      style={{ height: ITEM_HEIGHT }}
                      className={`grid grid-cols-12 gap-4 px-3 py-3 rounded-lg group transition-colors ${
                        realIndex === nowPlayingIndex
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-secondary/50"
                      }`}
                    >
                      <div className="col-span-1 flex items-center">
                        <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab mr-2" />
                        <span className="text-sm text-muted-foreground group-hover:hidden">
                          {realIndex + 1 + (page - 1) * limit}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hidden group-hover:flex"
                          onClick={() => setNowPlayingIndex(realIndex)}
                        >
                          {realIndex === nowPlayingIndex ? (
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
                              realIndex === nowPlayingIndex
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
                  );
                })}
                <div style={{ height: bottomPadding }} />
              </div>
            )}

            {/* Pagination controls */}
            {!loading && !error && queueLength > 0 && (
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goPrev}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <div className="px-2">Page</div>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={page}
                    onChange={(e) =>
                      setPage(
                        Math.min(
                          Math.max(1, Number(e.target.value || 1)),
                          totalPages
                        )
                      )
                    }
                    className="w-16 text-sm px-2 py-1 border rounded"
                  />
                  <div>/ {totalPages}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goNext}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1}—
                  {Math.min(page * limit, queueLength)} of {queueLength}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardQueue;
