import { createContext, useContext, ReactNode } from "react";

type BotContextType = {
  currentServerId: string | null;
  setCurrentServerId: (id: string) => void;
  sendCommand: (command: string, payload?: unknown) => Promise<void>;
  loading: boolean;
  error: string | null;
};

const BotContext = createContext<BotContextType | null>(null);

export function BotProvider({ children }: { children: ReactNode }) {
  const value: BotContextType = {
    currentServerId: "demo-server",
    setCurrentServerId: () => {},
    sendCommand: async () => {},
    loading: false,
    error: null,
  };

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
}

export function useBot() {
  const ctx = useContext(BotContext);
  if (!ctx) {
    throw new Error("useBot must be used within BotProvider");
  }
  return ctx;
}
