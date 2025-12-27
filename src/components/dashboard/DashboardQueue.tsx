// src/components/DashboardQueue.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import PageSizeSelector from "@/components/dashboard/PageSizeSelector";

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

const ITEM_HEIGHT = 64;
const VIRTUAL_BUFFER = 3;

/**
 * DashboardQueue
 * - uses server-side pagination
 * - PageSizeSelector for page size (styled like ServerSelector)
 * - virtualization of rows within current page window
 * - professional empty state
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const PAGE_OPTIONS = [20, 50, 100, 200];

export default function DashboardQueue(): JSX.Element {
  const { currentServerId } = useBot();

  // Try restore page-size from localStorage (same key PageSizeSelector uses)
  const initialLimit = useMemo(() => {
    try {
      const v = localStorage.getItem("aura:pageSize");
      if (v) {
        const n = Number(v);
        if (!Number.isNaN(n) && PAGE_OPTIONS.includes(n)) return n;
      }
    } catch {
      /* empty */
    }
    return DEFAULT_LIMIT;
  }, []);

  const [tracks, setTracks] = useState<QueueApiTrack[]>([]);
  const [nowPlayingIndex, setNowPlayingIndex] = useState<number>(0);
  const [nowPlaying, setNowPlaying] = useState<QueueApiTrack | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // pagination
  const [page, setPage] = useState<number>(DEFAULT_PAGE);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [queueLength, setQueueLength] = useState<number>(0);

  // virtualization
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(400);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const visibleCount = Math.max(3, Math.ceil(containerHeight / ITEM_HEIGHT));

  // convert varying duration forms to seconds
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

  // fetch one page of the queue
  const fetchQueuePage = useCallback(
    async (p: number, lim: number) => {
      if (!currentServerId) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/servers/${currentServerId}/queue?page=${p}&limit=${lim}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to fetch queue");
        const data = (await res.json()) as QueuePageResponse;

        setTracks(data.tracks ?? []);
        setNowPlaying(data.nowPlaying ?? null);
        setQueueLength(data.queueLength ?? 0);
        setTotalPages(Math.max(1, data.totalPages ?? 1));

        // keep nowPlayingIndex bounded
        setNowPlayingIndex((prev) =>
          Math.min(prev, Math.max(0, (data.tracks?.length ?? 0) - 1))
        );
      } catch (err) {
        console.error("fetchQueuePage error", err);
        // Show a professional empty state on failure (per your request)
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

  useEffect(() => {
    if (!currentServerId) return;
    fetchQueuePage(page, limit);
  }, [currentServerId, page, limit, fetchQueuePage]);

  // websocket updates: refresh current page on queue_update
  useGuildWebSocket(currentServerId, {
    onQueueUpdate: async (qlen: number) => {
      setQueueLength(qlen);
      if (qlen === 0) {
        setTracks([]);
        setNowPlaying(null);
        return;
      }
      // If queue changed, refresh current page — safe and simple
      await fetchQueuePage(page, limit);
    },
  });

  const onScroll = (e: React.UIEvent<HTMLDivElement>) =>
    setScrollTop(e.currentTarget.scrollTop);

  // virtual window calculations
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

  // optimistic UI actions; TODO: wire to backend/bot for real effects
  const removeFromQueue = (id?: string) =>
    setTracks((prev) => prev.filter((t) => (id ? t.id !== id : true)));
  const clearQueue = () => {
    setTracks([]);
    setQueueLength(0);
  };
  const playAll = () => {
    if (tracks.length > 0) setNowPlayingIndex(0);
  };

  // page-size selector integration
  const pageSizeOptions = PAGE_OPTIONS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Queue</h1>
          <p className="text-muted-foreground">
            {queueLength} tracks • {formatTotalDuration(totalSeconds)} total
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Page size</label>
            {/* PageSizeSelector (styled like ServerSelector) */}
            <div style={{ width: 140 }}>
              <PageSizeSelector
                options={pageSizeOptions}
                value={limit}
                onChange={(v) => changeLimit(v)}
                storageKey="aura:pageSize"
              />
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={clearQueue}>
            <Trash2 className="w-4 h-4 mr-2" /> Clear Queue
          </Button>
          <Button variant="hero" size="sm" onClick={playAll}>
            <Play className="w-4 h-4 mr-2" /> Play All
          </Button>
        </div>
      </div>

      {/* Card */}
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
              <div className="col-span-2" />
            </div>

            {/* Loading */}
            {loading && <div className="p-4">Loading...</div>}

            {/* Professional empty state */}
            {!loading && queueLength === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <div className="mb-2 text-lg font-medium">Nothing in queue</div>
                <div className="text-sm opacity-80">
                  Add songs to get started
                </div>
              </div>
            )}

            {/* Virtualized page list */}
            {!loading && queueLength > 0 && tracks.length > 0 && (
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
            {!loading && queueLength > 0 && (
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
}
