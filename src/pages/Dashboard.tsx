import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Home, ListMusic, History, FolderOpen, Sliders, 
  Menu, LogOut, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardQueue from "@/components/dashboard/DashboardQueue";
import DashboardHistory from "@/components/dashboard/DashboardHistory";
import DashboardPlaylists from "@/components/dashboard/DashboardPlaylists";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import NowPlaying from "@/components/dashboard/NowPlaying";
import ServerSelector from "@/components/dashboard/ServerSelector";

const navItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "queue", label: "Queue", icon: ListMusic },
  { id: "history", label: "History", icon: History },
  { id: "playlists", label: "Playlists", icon: FolderOpen },
  { id: "filters", label: "Filters & EQ", icon: Sliders },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <DashboardOverview />;
      case "queue":
        return <DashboardQueue />;
      case "history":
        return <DashboardHistory />;
      case "playlists":
        return <DashboardPlaylists />;
      case "filters":
        return <DashboardFilters />;
      default:
        return <DashboardOverview />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const avatarUrl = profile?.discord_avatar || user?.user_metadata?.avatar_url;
  const username = profile?.discord_username || user?.user_metadata?.full_name || "User";
  const discriminator = user?.user_metadata?.custom_claims?.global_name ? "" : "#0000";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <span className="text-lg font-bold text-foreground">SoundWave</span>
          )}
          <Button 
            variant="ghost" 
            size="icon-sm" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-sidebar-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Server Selector */}
        <div className="p-3">
          <ServerSelector collapsed={!sidebarOpen} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3",
                activeTab === item.id 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                !sidebarOpen && "justify-center px-0"
              )}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Button>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-lg",
            sidebarOpen ? "justify-between" : "justify-center"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-primary">
                    {username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{username}</p>
                  <p className="text-xs text-sidebar-foreground truncate">{discriminator}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className="text-sidebar-foreground hover:text-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-16"
      )}>
        {/* Now Playing Bar - Fixed at bottom */}
        <NowPlaying />

        {/* Page Content */}
        <div className="p-6 pb-32">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
