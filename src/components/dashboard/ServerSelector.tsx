import { useState } from "react";
import { ChevronDown, Plus, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Server {
  id: string;
  name: string;
  icon: string;
  memberCount: number;
  botConnected: boolean;
}

const mockServers: Server[] = [
  { id: "1", name: "Gaming Lounge", icon: "🎮", memberCount: 1234, botConnected: true },
  { id: "2", name: "Music Central", icon: "🎵", memberCount: 567, botConnected: true },
  { id: "3", name: "Chill Zone", icon: "☕", memberCount: 890, botConnected: false },
  { id: "4", name: "Dev Community", icon: "💻", memberCount: 2345, botConnected: false },
];

interface ServerSelectorProps {
  collapsed?: boolean;
}

const ServerSelector = ({ collapsed = false }: ServerSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server>(mockServers[0]);

  const handleServerSelect = (server: Server) => {
    setSelectedServer(server);
    setIsOpen(false);
  };

  if (collapsed) {
    return (
      <Button
        variant="glass"
        size="icon"
        className="w-full aspect-square"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-lg">{selectedServer.icon}</span>
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
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-lg">
            {selectedServer.icon}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground truncate max-w-[120px]">
              {selectedServer.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedServer.memberCount.toLocaleString()} members
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
            {mockServers.map((server) => (
              <button
                key={server.id}
                onClick={() => handleServerSelect(server)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                  selectedServer.id === server.id 
                    ? "bg-primary/10 border border-primary/20" 
                    : "hover:bg-secondary"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl shrink-0">
                  {server.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {server.name}
                    </p>
                    {selectedServer.id === server.id && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>{server.memberCount.toLocaleString()}</span>
                    {server.botConnected ? (
                      <span className="text-success">• Connected</span>
                    ) : (
                      <span className="text-warning">• Not connected</span>
                    )}
                  </div>
                </div>
                {!server.botConnected && (
                  <Button
                    variant="hero"
                    size="sm"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle add bot action
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Bot
                  </Button>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerSelector;
