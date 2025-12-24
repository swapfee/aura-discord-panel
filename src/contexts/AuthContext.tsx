import { createContext, useContext, ReactNode } from "react";

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
  const value: AuthContextType = {
    user: {
      id: "demo",
      username: "Demo User",
      avatar: null,
      email: null,
    },
    loading: false,
    signInWithDiscord: () => {},
    signOut: async () => {},
    refreshUser: async () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
