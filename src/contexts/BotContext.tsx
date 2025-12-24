import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type BotContextType = {
  currentServerId: string | null;
  setCurrentServerId: (id: string) => void;
  sendCommand: (command: string, payload?: unknown) => Promise<void>;
  loading: boolean;
  error: string | null;
};

const BotContext = createContext<BotContextType | null>(null);

export function BotProvider({ children }: { children: ReactNode }) {
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCommand = useCallback(
    async (command: string, payload?: unknown) => {
      if (!currentServerId) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/bot/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            command,
            serverId: currentServerId,
            data: payload ?? {},
          }),
        });

        if (!res.ok) {
          throw new Error("Bot command failed");
        }
      } catch (err: any) {
        setError(err?.message ?? "Unknown error");
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
