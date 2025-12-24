import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";

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
  refreshUser: (opts?: { silent?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(raw: any): AuthUser | null {
  if (!raw) return null;

  const id = raw.id ?? raw.sub;
  const username = raw.username;

  if (!id || !username) return null;

  return {
    id: String(id),
    username: String(username),
    email: raw.email ?? null,
    avatar: raw.avatar ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);

    try {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) {
        setUser(null);
        return;
      }
      const data = await r.json();
      setUser(normalizeUser(data.user));
    } catch {
      setUser(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser({ silent: false });
  }, [refreshUser]);

  const signInWithDiscord = () => {
    window.location.assign("/auth/discord");
  };

  const signOut = async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, loading, signInWithDiscord, signOut, refreshUser }),
    [user, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
