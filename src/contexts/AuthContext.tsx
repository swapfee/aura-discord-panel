import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type AuthUser = {
  id: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (!API_BASE) {
      console.error("Missing VITE_API_BASE_URL");
      setUser(null);
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/api/me`, {
        credentials: "include",
      });

      if (!r.ok) {
        setUser(null);
        return;
      }

      const data = await r.json();
      setUser(data.user ?? null);
    } catch (e) {
      console.error("Failed to refresh user:", e);
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshUser();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithDiscord = async () => {
    if (!API_BASE) throw new Error("Missing VITE_API_BASE_URL");
    // Redirect to backend which starts the OAuth flow
    window.location.href = `${API_BASE}/auth/discord`;
  };

  const signOut = async () => {
    if (!API_BASE) throw new Error("Missing VITE_API_BASE_URL");

    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout request failed:", e);
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithDiscord,
      signOut,
      refreshUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
