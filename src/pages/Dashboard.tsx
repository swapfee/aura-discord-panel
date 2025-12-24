// src/pages/Dashboard.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home, ListMusic, History, FolderOpen, Sliders, Settings,
  Menu, LogOut, Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useBot } from "@/contexts/BotContext";

import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardQueue from "@/components/dashboard/DashboardQueue";
import DashboardHistory from "@/components/dashboard/DashboardHistory";
import DashboardPlaylists from "@/components/dashboard/DashboardPlaylists";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardSettings from "@/components/dashboard/DashboardSettings";
import NowPlaying from "@/components/dashboard/NowPlaying";
import ServerSelector from "@/components/dashboard/ServerSelector";

const navItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "queue", label: "Queue", icon: ListMusic },
  { id: "history", label: "History", icon: History },
  { id: "playlists", label: "Playlists", icon: FolderOpen },
  { id: "filters", label: "Filters & EQ", icon: Sliders },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, servers = [], loading, signOut } = useAuth();
  const { setCurrentServerId } = useBot();

  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const handleServerChange = (serverId: string) => {
    setCurrentServerId(serverId);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "queue": return <DashboardQueue />;
      case "history": return <DashboardHistory />;
      case "playlists": return <DashboardPlaylists />;
      case "filters": return <DashboardFilters />;
      case "settings": return <DashboardSettings />;
      default: return <DashboardOverview />;
    }
  };

  const username =
    profile?.discord_username ||
    user?.username ||
    "User";

  const avatarUrl =
    profile?.discord_avatar ||
    user?.avatar ||
    null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r transition-all",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {sidebarOpen && <span className="font-bold">SoundWave</span>}
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu />
          </Button>
        </div>

        <div className="p-3">
          <ServerSelector
            servers={servers}
            collapsed={!sidebarOpen}
            onServerChange={handleServerChange}
          />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && item.label}
            </Button>
          ))}
        </nav>

        <div className="p-3 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                {avatarUrl
                  ? <img src={avatarUrl} className="w-full h-full rounded-full" />
                  : username[0]}
              </div>
              {sidebarOpen && <span>{username}</span>}
            </div>
            {sidebarOpen && (
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className={cn("flex-1", sidebarOpen ? "ml-64" : "ml-16")}>
        <NowPlaying />
        <div className="p-6 pb-32">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
