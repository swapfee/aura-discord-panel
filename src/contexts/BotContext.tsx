import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { 
  ServerMusicState, 
  NowPlaying, 
  QueueItem, 
  HistoryItem, 
  PlayerStatus, 
  BotCommand,
  BotSyncEvent 
} from "@/types/bot";

interface BotContextType {
  currentServerId: string | null;
  setCurrentServerId: (id: string | null) => void;
  musicState: ServerMusicState | null;
  isConnected: boolean;
  isLoading: boolean;
  sendCommand: (command: BotCommand, data?: Record<string, unknown>) => Promise<boolean>;
}

const defaultMusicState: ServerMusicState = {
  serverId: "",
  nowPlaying: null,
  queue: [],
  history: [],
  status: {
    isPlaying: false,
    isPaused: false,
    volume: 50,
    loop: "off",
    shuffle: false,
  },
  lastUpdated: new Date().toISOString(),
};

const BotContext = createContext<BotContextType | undefined>(undefined);

export function BotProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [musicState, setMusicState] = useState<ServerMusicState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to real-time updates for the current server
  useEffect(() => {
    if (!currentServerId) {
      setMusicState(null);
      setIsConnected(false);
      return;
    }

    console.log("Subscribing to server channel:", currentServerId);
    
    // Initialize with default state for this server
    setMusicState({
      ...defaultMusicState,
      serverId: currentServerId,
    });

    const channel = supabase.channel(`server:${currentServerId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "update_now_playing" }, (payload) => {
        console.log("Now playing update:", payload);
        setMusicState((prev) => prev ? {
          ...prev,
          nowPlaying: payload.payload.nowPlaying as NowPlaying | null,
          lastUpdated: payload.payload.timestamp,
        } : null);
      })
      .on("broadcast", { event: "update_queue" }, (payload) => {
        console.log("Queue update:", payload);
        setMusicState((prev) => prev ? {
          ...prev,
          queue: payload.payload.queue as QueueItem[],
          lastUpdated: payload.payload.timestamp,
        } : null);
      })
      .on("broadcast", { event: "add_history" }, (payload) => {
        console.log("History update:", payload);
        setMusicState((prev) => prev ? {
          ...prev,
          history: payload.payload.history as HistoryItem[],
          lastUpdated: payload.payload.timestamp,
        } : null);
      })
      .on("broadcast", { event: "update_status" }, (payload) => {
        console.log("Status update:", payload);
        setMusicState((prev) => prev ? {
          ...prev,
          status: payload.payload.status as PlayerStatus,
          lastUpdated: payload.payload.timestamp,
        } : null);
      })
      .on("broadcast", { event: "full_sync" }, (payload) => {
        console.log("Full sync:", payload);
        setMusicState({
          serverId: currentServerId,
          nowPlaying: payload.payload.nowPlaying as NowPlaying | null,
          queue: (payload.payload.queue as QueueItem[]) || [],
          history: (payload.payload.history as HistoryItem[]) || [],
          status: (payload.payload.status as PlayerStatus) || defaultMusicState.status,
          lastUpdated: payload.payload.timestamp,
        });
      })
      .subscribe((status) => {
        console.log("Channel subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      console.log("Unsubscribing from server channel:", currentServerId);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [currentServerId]);

  // Send command to the bot via edge function
  const sendCommand = useCallback(async (
    command: BotCommand, 
    data?: Record<string, unknown>
  ): Promise<boolean> => {
    if (!currentServerId || !session?.access_token) {
      toast.error("Not connected to a server");
      return false;
    }

    setIsLoading(true);
    try {
      const { data: response, error } = await supabase.functions.invoke("bot-command", {
        body: {
          command,
          serverId: currentServerId,
          data,
        },
      });

      if (error) {
        console.error("Command error:", error);
        toast.error(`Command failed: ${error.message}`);
        return false;
      }

      console.log("Command response:", response);
      return true;
    } catch (err) {
      console.error("Command error:", err);
      toast.error("Failed to send command");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentServerId, session?.access_token]);

  return (
    <BotContext.Provider
      value={{
        currentServerId,
        setCurrentServerId,
        musicState,
        isConnected,
        isLoading,
        sendCommand,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const context = useContext(BotContext);
  if (context === undefined) {
    throw new Error("useBot must be used within a BotProvider");
  }
  return context;
}
