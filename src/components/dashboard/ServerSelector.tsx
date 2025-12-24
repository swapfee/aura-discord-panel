import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Check,
  Users,
  ServerOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Server type definition
export interface Server {
  id: string;
  discord_server_id: string;
  server_name: string;
  server_icon?: string | null;
  member_count?: number;
  bot_connected?: boolean;
}

interface ServerSelectorProps {
  collapsed?: boolean;
  onServerChange?: (serverId: string) => void;
  servers: Server[];
  onRefresh?: () => Promise<void>;
}

const ServerSelector = ({
  collapsed = false,
  onServerChange,
  servers,
  onRefresh,
}: ServerSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Auto-select first server */
  useEffect(() => {
    if (!servers.length) return;

    const stillExists = servers.some(s => s.id === selectedServerId);

    if (!initializedRef.current || !stillExists) {
      const first = servers[0];
      setSelectedServerId(first.id);
      onServerChange?.(first.discord_server_id);
      initializedRef.current = true;
    }
  }, [servers, selectedServerId, onServerChange]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const selectedServer =
    servers.find(s => s.id === selectedServerId) ?? servers[0];

  const handleServerSelect = (server: Server) => {
    setSelectedServerId(server.id);
    setIsOpen(false);
    onServerChange?.(server.discord_server_id);
  };

  /* No servers */
  if (!servers.length) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="w-full aspect-square"
        disabled
      >
        <ServerOff className="w-5 h-5 text-muted-foreground" />
      </Button>
    );
  }

  /* Collapsed mode */
  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="w-full aspect-square"
        onClick={() => setIsOpen(o => !o)}
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

  /* Full selector */
  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        className="w-full justify-between h-12 px-3"
        onClick={() => setIsOpen(o => !o)}
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
            <p className="text-sm font-medium truncate max-w-[140px]">
              {selectedServer?.server_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedServer?.member_count?.toLocaleString() ?? 0} members
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-50">
          <div className="p-2 border-b flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Your Servers</span>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn("w-3 h-3", isRefreshing && "animate-spin")}
                />
              </Button>
            )}
          </div>

          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {servers.map(server => (
              <div
                key={server.id}
                className={cn(
                  "p-2 rounded-lg",
                  server.id === selectedServerId
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-secondary"
                )}
              >
                <button
                  onClick={() => handleServerSelect(server)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden">
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
                      <p className="truncate">{server.server_name}</p>
                      {server.id === selectedServerId && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {server.member_count}
                      <span>
                        • {server.bot_connected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerSelector;
