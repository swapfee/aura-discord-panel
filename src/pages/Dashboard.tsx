// src/pages/Dashboard.tsx
import { useState } from "react";
import {
  Home,
  ListMusic,
  History,
  FolderOpen,
  Sliders,
  Settings,
  Menu,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardQueue from "@/components/dashboard/DashboardQueue";
import DashboardHistory from "@/components/dashboard/DashboardHistory";
import DashboardPlaylists from "@/components/dashboard/DashboardPlaylists";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardSettings from "@/components/dashboard/DashboardSettings";
import NowPlaying from "@/components/dashboard/NowPlaying";
import ServerSelector, { Server } from "@/components/dashboard/ServerSelector";

const navItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "queue", label: "Queue", icon: ListMusic },
  { id: "history", label: "History", icon: History },
  { id: "playlists", label: "Playlists", icon: FolderOpen },
  { id: "filters", label: "Filters & EQ", icon: Sliders },
  { id: "settings", label: "Settings", icon: Settings },
];

// Demo servers - replace with real data from your bot API later
const demoServers: Server[] = [
  {
    id: "1",
    discord_server_id: "1403488603027279872",
    server_name: "Revert Development",
    server_icon: null,
    member_count: 10,
    bot_connected: true,
  },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [servers] = useState<Server[]>(demoServers);

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
