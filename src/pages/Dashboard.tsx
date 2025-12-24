// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  ListMusic,
  History,
  FolderOpen,
  Sliders,
  Settings,
  Menu,
  LogOut,
  Loader2,
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

type Server = {
  id: string;
  discord_server_id: string;
  server_name: string;
  server_icon?: string | null;
  member_count?: number;
  bot_connected?: boolean;
};

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
  const { user, loading, signOut } = useAuth();
  const { setCurrentServerId } = useBot();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoading, setServersLoading] = useState(true);

  // Redirect if logged out
  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [loading, user, navigate]);

  // Fetch servers once authenticated
  useEffect(() => {
    if (!user) return;

    setServersLoading(true);
    fetch("/api/servers", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setServers(Array.isArray(data.servers) ? data.servers : []);
      })
      .catch(() => setServers([]))
      .finally(() => setServersLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const renderContent = () => {
    switch (activeTab) {
      case "queue":
        return <DashboardQueue />;
      case "history":
        return <DashboardHistory />;
      case "playlists":
        return <DashboardPlaylists />;
      case "filters":
        return <DashboardFilters />;
      case "settings":
        return <DashboardSettings />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r transition-all",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {sidebarOpen && <span className="font-bold">SoundWave</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <Menu />
          </Button>
        </div>

        {/* Server Selector */}
        <div className="p-3">
          <ServerSelector
            servers={servers}
            loading={serversLoading}
            collapsed={!sidebarOpen}
            onServerChange={setCurrentServerId}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3",
                !sidebarOpen && "justify-center"
              )}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && item.label}
            </Button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && "Sign out"}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className={cn("flex-1", sidebarOpen ? "ml-64" : "ml-16")}>
        <NowPlaying />
        <div className="p-6 pb-32">{renderContent()}</div>
      </main>
    </div>
  );
}
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {sidebarOpen && <span className="font-bold">SoundWave</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Server selector */}
        <div className="p-3">
          <ServerSelector
            servers={servers}
            collapsed={!sidebarOpen}
            onServerChange={(serverId) => console.log("Selected:", serverId)}
          />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              U
            </div>
            {sidebarOpen && <span>User</span>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        <NowPlaying />

        <div className="p-6 pb-32">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
