import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Music, Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth callback error:", error);
          setError(error.message);
          return;
        }

        if (data.session) {
          // Sync Discord guilds to user_servers
          const accessToken = data.session.provider_token;
          
          if (accessToken) {
            try {
              // Fetch user's Discord guilds
              const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });

              if (guildsResponse.ok) {
                const guilds = await guildsResponse.json();
                
                // Filter to servers where user has admin permissions
                const adminGuilds = guilds.filter((guild: any) => 
                  (guild.permissions & 0x8) === 0x8 || guild.owner
                );

                // Upsert servers to database
                for (const guild of adminGuilds) {
                  await supabase.from("user_servers").upsert({
                    user_id: data.session.user.id,
                    discord_server_id: guild.id,
                    server_name: guild.name,
                    server_icon: guild.icon 
                      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                      : null,
                    member_count: guild.approximate_member_count || 0,
                    is_admin: true,
                    bot_connected: false, // Default to false, update when bot is added
                  }, {
                    onConflict: "user_id,discord_server_id",
                  });
                }
              }
            } catch (guildError) {
              console.error("Error fetching guilds:", guildError);
              // Don't block login if guild fetch fails
            }
          }

          // Update profile with Discord info
          const { user } = data.session;
          await supabase.from("profiles").upsert({
            id: user.id,
            discord_id: user.user_metadata?.provider_id || user.user_metadata?.sub,
            discord_username: user.user_metadata?.full_name || user.user_metadata?.name,
            discord_avatar: user.user_metadata?.avatar_url,
            discord_access_token: accessToken,
          });

          navigate("/dashboard");
        } else {
          navigate("/");
        }
      } catch (err) {
        console.error("Callback error:", err);
        setError("An unexpected error occurred");
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Authentication Error</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => navigate("/")}
            className="text-primary hover:underline"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Authenticating</h1>
        <p className="text-muted-foreground">Syncing your Discord servers...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
