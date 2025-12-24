// src/contexts/BotContext.tsx
import { createContext, useContext, useState, useCallback } from "react";

type BotContextType = {
  // Server selection
  currentServerId: string | null;
  setCurrentServerId: (id: string) => void;

  // Bot commands
  sendCommand: (command: string, payload?: unknown) => Promise<any>;
  loading: boolean;
  error: string | null;
};

const BotContext = createContext<BotContextType | null>(null);

export function BotProvider({ children }: { children: React.ReactNode }) {
  // Server state
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);

  // Command state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCommand = useCallback(
    async (command: string, payload?: unknown) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/bot/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            command,
            payload,
            serverId: currentServerId, // 👈 included safely
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error ?? "Bot command failed");
        }

        return data;
      } catch (err: any) {
        setError(err?.message ?? "Unknown error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [currentServerId]
  );

  return (
    <BotContext.Provider
      value={{
        currentServerId,
        setCurrentServerId,
        sendCommand,
        loading,
        error,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const ctx = useContext(BotContext);
  if (!ctx) {
    throw new Error("useBot must be used within BotProvider");
  }
  return ctx;
}
