import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function BotInstalled() {
  const navigate = useNavigate();

  useEffect(() => {
    // Small delay to let Discord finish guild add
    setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 1000);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-center">
      <div>
        <h1 className="text-xl font-semibold">Bot installed 🎉</h1>
        <p className="text-muted-foreground mt-2">
          Syncing your servers…
        </p>
      </div>
    </div>
  );
}
