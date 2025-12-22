import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Music, Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Initializing...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        
        console.log("Auth callback started", { code: !!code, state: !!state, error: errorParam });

        // Handle Discord error
        if (errorParam) {
          setError(`Discord error: ${errorParam}`);
          return;
        }

        if (!code) {
          setStatus("Checking existing session...");
          // Check if this is a magic link callback or if already logged in
          const { data, error: sessionError } = await supabase.auth.getSession();
          console.log("Session check:", { hasSession: !!data.session, error: sessionError });
          
          if (data.session) {
            navigate("/dashboard");
            return;
          }
          setError("No authorization code received");
          return;
        }

        setStatus("Exchanging code with Discord...");

        // Exchange code for session via edge function
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-auth?action=callback&code=${encodeURIComponent(code)}`;
        
        console.log("Calling callback function...");
        const response = await fetch(functionUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.error("Callback response not OK:", response.status);
          setError(`Server error: ${response.status}`);
          return;
        }
        
        const data = await response.json();
        console.log("Callback response:", data);

        if (data.error) {
          console.error("Discord callback error:", data.error);
          setError(data.error);
          return;
        }

        if (data.success && data.magicLink) {
          setStatus("Verifying session...");
          
          // Use the magic link to sign in
          const url = new URL(data.magicLink);
          
          // Log all URL params for debugging
          console.log("Magic link URL:", data.magicLink);
          console.log("All URL params:", Object.fromEntries(url.searchParams.entries()));
          
          // Try both token_hash (PKCE) and token (legacy) params
          const token_hash = url.searchParams.get('token_hash') || url.searchParams.get('token');
          const type = url.searchParams.get('type');

          console.log("Magic link params:", { token_hash: token_hash ? token_hash.substring(0, 10) + '...' : null, type });

          if (token_hash && type) {
            console.log("Calling verifyOtp...");
            const { data: otpData, error: verifyError } = await supabase.auth.verifyOtp({
              token_hash,
              type: type as any,
            });

            console.log("verifyOtp result:", { success: !!otpData?.session, error: verifyError });

            if (verifyError) {
              console.error("OTP verification error:", verifyError);
              setError(verifyError.message);
              return;
            }
            
            console.log("OTP verified successfully, session created");
          } else {
            console.error("Missing token_hash or type from magic link");
            console.error("Available params:", Object.fromEntries(url.searchParams.entries()));
            setError("Invalid authentication response - missing token");
            return;
          }

          setStatus("Success! Redirecting...");
          navigate("/dashboard");
        } else {
          console.error("Missing success or magicLink in response:", data);
          setError("Authentication failed - no session created");
        }
      } catch (err) {
        console.error("Callback error:", err);
        setError(`An unexpected error occurred: ${err instanceof Error ? err.message : 'Unknown'}`);
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
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
