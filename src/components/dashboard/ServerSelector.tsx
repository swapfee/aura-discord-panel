import { useState } from "react";
import { ChevronDown, Plus, Check, Users, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface ServerSelectorProps {
  collapsed?: boolean;
  onServerChange?: (serverId: string) => void;
}

const ServerSelector = ({ collapsed = false, onServerChange }: ServerSelectorProps) => {
  const { servers } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(
    servers.length > 0 ? servers[0].id : null
  );

  const selectedServer = servers.find(s => s.id === selectedServerId) || servers[0];

  const handleServerSelect = (serverId: string) => {
    setSelectedServerId(serverId);
    setIsOpen(false);
    onServerChange?.(serverId);
  };

  // No servers available
  if (servers.length === 0) {
    if (collapsed) {
      return (
        <Button
          variant="glass"
          size="icon"
          className="w-full aspect-square"
          disabled
        >
          <ServerOff className="w-5 h-5 text-muted-foreground" />
        </Button>
      );
    }

    return (
      <div className="p-3 rounded-xl bg-secondary/50 border border-border text-center">
        <ServerOff className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No servers found</p>
        <p className="text-xs text-muted-foreground mt-1">
          You need admin access to manage servers
        </p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <Button
        variant="glass"
        size="icon"
        className="w-full aspect-square"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedServer?.server_icon ? (
          <img 
            src={selectedServer.server_icon} 
            alt={selectedServer.server_name}
            className="w-6 h-6 rounded-md"
          />
        ) : (
          <span className="text-lg">🎵</span>
        )}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="glass"
        className="w-full justify-between h-12 px-3"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
            {selectedServer?.server_icon ? (
              <img 
                src={selectedServer.server_icon} 
                alt={selectedServer.server_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg">🎵</span>
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground truncate max-w-[120px]">
              {selectedServer?.server_name || "Select Server"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedServer?.member_count?.toLocaleString() || 0} members
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {servers.map((server) => (
              <div
                key={server.id}
                className={cn(
                  "w-full p-2 rounded-lg transition-colors",
                  selectedServerId === server.id 
                    ? "bg-primary/10 border border-primary/20" 
                    : "hover:bg-secondary"
                )}
              >
                <button
                  onClick={() => handleServerSelect(server.id)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                    {server.server_icon ? (
                      <img 
                        src={server.server_icon} 
                        alt={server.server_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">🎵</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {server.server_name}
                      </p>
                      {selectedServerId === server.id && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{server.member_count?.toLocaleString() || 0}</span>
                      {server.bot_connected ? (
                        <span className="text-success">• Connected</span>
                      ) : (
                        <span className="text-warning">• Not connected</span>
                      )}
                    </div>
                  </div>
                </button>
                {!server.bot_connected && (
                  <Button
                    variant="hero"
                    size="sm"
                    className="w-full mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open Discord bot invite URL
                      window.open(
                        `https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=3145728&scope=bot%20applications.commands&guild_id=${server.discord_server_id}`,
                        "_blank"
                      );
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Bot
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerSelector;
