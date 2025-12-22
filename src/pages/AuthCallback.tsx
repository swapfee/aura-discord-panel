import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Music, Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const storedState = sessionStorage.getItem('discord_oauth_state');

        // Clear stored state
        sessionStorage.removeItem('discord_oauth_state');

        if (!code) {
          // Check if this is a magic link callback
          const { data, error } = await supabase.auth.getSession();
          if (data.session) {
            navigate("/dashboard");
            return;
          }
          setError("No authorization code received");
          return;
        }

        if (state && storedState && state !== storedState) {
          setError("Invalid state parameter");
          return;
        }

        // Exchange code for session via edge function
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-auth?action=callback&code=${code}`;
        
        const response = await fetch(functionUrl);
        const data = await response.json();

        if (data.error) {
          console.error("Discord callback error:", data.error);
          setError(data.error);
          return;
        }

        if (data.success && data.magicLink) {
          // Use the magic link to sign in
          const url = new URL(data.magicLink);
          const token_hash = url.searchParams.get('token_hash');
          const type = url.searchParams.get('type');

          if (token_hash && type) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash,
              type: type as any,
            });

            if (verifyError) {
              console.error("OTP verification error:", verifyError);
              setError(verifyError.message);
              return;
            }
          }

          navigate("/dashboard");
        } else {
          setError("Authentication failed");
        }
      } catch (err) {
        console.error("Callback error:", err);
        setError("An unexpected error occurred");
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

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
