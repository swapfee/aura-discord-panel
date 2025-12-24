import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type AuthUser = {
  id: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signInWithDiscord: () => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) {
        setUser(null);
        return;
      }
      const data = await r.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshUser();
      setLoading(false);
    })();
  }, []);

  const signInWithDiscord = () => {
    window.location.href = "/auth/discord";
  };

  const signOut = async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, signInWithDiscord, signOut, refreshUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
