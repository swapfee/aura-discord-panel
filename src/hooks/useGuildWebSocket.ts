import { useEffect, useRef } from "react";

type GuildWebSocketHandlers = {
  onSongPlayed?: () => void;
  onQueueUpdate?: (queueLength: number) => void;
  onVoiceUpdate?: (activeListeners: number) => void;
};

export function useGuildWebSocket(
  guildId: string | null,
  handlers: GuildWebSocketHandlers
) {
  const wsRef = useRef<WebSocket | null>(null);

  // Keep latest handlers without re-running effect
  const handlersRef = useRef<GuildWebSocketHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!guildId) return;

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          guildId,
        })
      );
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const h = handlersRef.current;

        switch (data.type) {
          case "song_played":
            h.onSongPlayed?.();
            break;

          case "queue_update":
            h.onQueueUpdate?.(data.queueLength);
            break;

          case "voice_update":
            h.onVoiceUpdate?.(data.activeListeners);
            break;
        }
      } catch (err) {
        console.error("[WS] Invalid message:", err);
      }
    };

    ws.onerror = () => ws.close();

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [guildId]);
}
