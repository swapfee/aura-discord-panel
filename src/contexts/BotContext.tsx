import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type {
  ServerMusicState,
  NowPlaying,
  QueueItem,
  HistoryItem,
  PlayerStatus,
  BotCommand,
} from "@/types/bot";

/**
 * How this works without Supabase:
 * - Commands: POST /api/bot/command (cookie-auth)
 * - Realtime: optional WebSocket at /ws (or disable until ready)
 *
 * If you don't have realtime yet, this still works: it will just
 * show "disconnected" and you can still send commands.
 */

interface BotContextType {
  currentServerId: string | null;
  setCurrentServerId: (id: string | null) => void;
  musicState: ServerMusicState | null;
  isConnected: boolean;
  isLoading: boolean;
  sendCommand: (command: BotCommand, data?: Record<string, unknown>) => Promise<boolean>;
}

const defaultStatus: PlayerStatus = {
  isPlaying: false,
  isPaused: false,
  volume: 50,
  loop: "off",
  shuffle: false,
};

const defaultMusicState: ServerMusicState = {
  serverId: "",
  nowPlaying: null,
  queue: [],
  history: [],
  status: defaultStatus,
  lastUpdated: new Date().toISOString(),
};

type BotEvent =
  | {
      type: "update_now_playing";
      serverId: string;
      nowPlaying: NowPlaying | null;
      timestamp: string;
    }
  | {
      type: "update_queue";
      serverId: string;
      queue: QueueItem[];
      timestamp: string;
    }
  | {
      type: "add_history";
      serverId: string;
      history: HistoryItem[];
      timestamp: string;
    }
  | {
      type: "update_status";
      serverId: string;
      status: PlayerStatus;
      timestamp: string;
    }
  | {
      type: "full_sync";
      serverId: string;
      nowPlaying: NowPlaying | null;
      queue: QueueItem[];
      history: HistoryItem[];
      status: PlayerStatus;
      timestamp: string;
    };

const BotContext = createContext<BotContextType | undefined>(undefined);

export function BotProvider({ children }: { children: React.ReactNode }) {
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [musicState, setMusicState] = useState<ServerMusicState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Optional WS for realtime updates
  const wsRef = useRef<WebSocket | null>(null);

  const applyEvent = useCallback(
    (evt: BotEvent) => {
      if (!currentServerId || evt.serverId !== currentServerId) return;

      setMusicState((prev) => {
        const base =
          prev ??
          ({
            ...defaultMusicState,
            serverId: currentServerId,
          } as ServerMusicState);

        switch (evt.type) {
          case "update_now_playing":
            return {
              ...base,
              nowPlaying: evt.nowPlaying,
              lastUpdated: evt.timestamp,
            };
          case "update_queue":
            return {
              ...base,
              queue: evt.queue ?? [],
              lastUpdated: evt.timestamp,
            };
          case "add_history":
            return {
              ...base,
              history: evt.history ?? [],
              lastUpdated: evt.timestamp,
            };
          case "update_status":
            return {
              ...base,
              status: evt.status ?? defaultStatus,
              lastUpdated: evt.timestamp,
            };
          case "full_sync":
            return {
              serverId: currentServerId,
              nowPlaying: evt.nowPlaying ?? null,
              queue: evt.queue ?? [],
              history: evt.history ?? [],
              status: evt.status ?? defaultStatus,
              lastUpdated: evt.timestamp,
            };
          default:
            return base;
        }
      });
    },
    [currentServerId]
  );

  /**
   * Realtime subscription (WebSocket)
   * Backend should implement a WS endpoint and send BotEvent JSON messages.
   *
   * If you don’t have WS yet, you can keep this block and it will just fail
   * quietly (still allowing commands).
   */
  useEffect(() => {
    // Reset state if no server selected
    if (!currentServerId) {
      setMusicState(null);
      setIsConnected(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Initialize state for this server
    setMusicState({ ...defaultMusicState, serverId: currentServerId });

    // Close any existing WS
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Build WS URL from current origin (same-domain deploy)
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${window.location.host}/ws?serverId=${encodeURIComponent(
      currentServerId
    )}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = () => {
        // If you haven't built WS yet, this will happen — that's okay.
        setIsConnected(false);
      };

      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data) as BotEvent;
          applyEvent(evt);
        } catch {
          // ignore bad messages
        }
      };
    } catch {
      setIsConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [currentServerId, applyEvent]);

  /**
   * Send a command to your backend (no Supabase).
   * Your server should implement:
   * POST /api/bot/command
   * body: { command, serverId, data }
   */
  const sendCommand = useCallback(
    async (command: BotCommand, data?: Record<string, unknown>) => {
      if (!currentServerId) {
        toast.error("Select a server first");
        return false;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/bot/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            command,
            serverId: currentServerId,
            data: data ?? {},
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          toast.error(`Command failed (${res.status})`);
          console.error("Command failed:", res.status, text);
          return false;
        }

        const json = await res.json().catch(() => ({}));
        if (json?.ok === false) {
          toast.error(json?.error || "Command failed");
          return false;
        }

        return true;
      } catch (err) {
        console.error("Command error:", err);
        toast.error("Failed to send command");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentServerId]
  );

  const value = useMemo(
    () => ({
      currentServerId,
      setCurrentServerId,
      musicState,
      isConnected,
      isLoading,
      sendCommand,
    }),
    [currentServerId, musicState, isConnected, isLoading, sendCommand]
  );

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
}

export function useBot() {
  const context = useContext(BotContext);
  if (!context) throw new Error("useBot must be used within a BotProvider");
  return context;
}
