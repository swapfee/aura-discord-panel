import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    (async () => {
      // Backend already handled code exchange + cookie.
      // We just refresh session and go to dashboard.
      await refreshUser();
      navigate("/dashboard", { replace: true });
    })();
  }, [navigate, refreshUser]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-muted-foreground mt-3">Finishing login…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
