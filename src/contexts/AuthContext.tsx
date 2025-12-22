import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type UserServer = Tables<"user_servers">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  servers: UserServer[];
  loading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshServers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [servers, setServers] = useState<UserServer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    return data;
  };

  const fetchServers = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_servers")
      .select("*")
      .eq("user_id", userId)
      .order("server_name");

    if (error) {
      console.error("Error fetching servers:", error);
      return [];
    }
    return data || [];
  };

  const refreshServers = async () => {
    if (user) {
      const userServers = await fetchServers(user.id);
      setServers(userServers);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile and server fetching with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(async () => {
            const userProfile = await fetchProfile(session.user.id);
            setProfile(userProfile);
            const userServers = await fetchServers(session.user.id);
            setServers(userServers);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setServers([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchServers(session.user.id)
        ]).then(([userProfile, userServers]) => {
          setProfile(userProfile);
          setServers(userServers);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithDiscord = async () => {
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-auth?action=login`;
    
    const response = await fetch(functionUrl);
    const data = await response.json();
    
    if (data.error) {
      console.error("Error getting Discord auth URL:", data.error);
      throw new Error(data.error);
    }
    
    // Store state for verification
    sessionStorage.setItem('discord_oauth_state', data.state);
    
    // Redirect to Discord
    window.location.href = data.url;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      throw error;
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setServers([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        servers,
        loading,
        signInWithDiscord,
        signOut,
        refreshServers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
