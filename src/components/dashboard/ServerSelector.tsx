import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Check, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Server = {
  id: string;
  discord_server_id: string;
  server_name: string;
  server_icon?: string | null;
  member_count?: number | null;
  bot_connected?: boolean | null;
  can_invite_bot?: boolean | null;
};

interface ServerSelectorProps {
  servers: Server[];
  loading?: boolean;
  collapsed?: boolean;
  onServerChange: (serverId: string) => void;
  refetchServers?: () => Promise<void>; // ✅ ADD
}

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

export default function ServerSelector({
  servers,
  loading = false,
  collapsed = false,
  onServerChange,
  refetchServers,
}: ServerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Server | null>(null);
  const [installingGuild, setInstallingGuild] = useState<string | null>(null);

  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!selected && servers.length > 0) {
      setSelected(servers[0]);
      onServerChange(servers[0].discord_server_id);
    }
  }, [servers, selected, onServerChange]);

  const handleSelect = (server: Server) => {
    setSelected(server);
    onServerChange(server.discord_server_id);
    setIsOpen(false);
  };

  const iconUrl = (s: Server) =>
    s.server_icon
      ? `https://cdn.discordapp.com/icons/${s.discord_server_id}/${s.server_icon}.png?size=64`
      : null;

  /* ======================
     BOT INVITE + POLLING
  ====================== */
  const inviteBot = (serverId: string) => {
    if (!DISCORD_CLIENT_ID || !refetchServers) return;

    const url =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${DISCORD_CLIENT_ID}` +
      `&permissions=8` +
      `&scope=bot%20applications.commands` +
      `&guild_id=${serverId}` +
      `&disable_guild_select=true`;

    window.open(url, "_blank", "noopener,noreferrer");

    startPolling(serverId);
  };

  const startPolling = (serverId: string) => {
    if (!refetchServers) return;

    setInstallingGuild(serverId);
    const startedAt = Date.now();

    pollTimer.current = window.setInterval(async () => {
      await refetchServers();

      const updated = servers.find(
        (s) =>
          s.discord_server_id === serverId &&
          s.bot_connected === true
      );

      const timeout = Date.now() - startedAt > 30_000;

      if (updated || timeout) {
        stopPolling();
      }
    }, 4000);
  };

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setInstallingGuild(null);
  };

  /* ======================
     COLLAPSED MODE
  ====================== */
  if (collapsed) {
    return (
      <Button variant="glass" size="icon" className="w-full aspect-square">
        {selected && iconUrl(selected) ? (
          <img
            src={iconUrl(selected)!}
            alt={selected.server_name}
            className="w-8 h-8 rounded-lg"
          />
        ) : null}
      </Button>
    );
  }

  /* ======================
     FULL MODE
  ====================== */
  return (
    <div className="relative">
      <Button
        variant="glass"
        className="w-full justify-between h-12 px-3"
        onClick={() => setIsOpen((v) => !v)}
        disabled={loading}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selected && (
            <>
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                {iconUrl(selected) ? (
                  <img
                    src={iconUrl(selected)!}
                    alt={selected.server_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold">
                    {selected.server_name[0]}
                  </span>
                )}
              </div>

              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {selected.server_name}
                </p>
                {typeof selected.member_count === "number" && (
                  <p className="text-xs text-muted-foreground">
                    {selected.member_count.toLocaleString()} members
                  </p>
                )}
              </div>
            </>
          )}
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
          <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
            {servers.map((server) => {
              const installing = installingGuild === server.discord_server_id;

              return (
                <div
                  key={server.id}
                  className="w-full p-2 rounded-lg hover:bg-secondary"
                >
                  <button
                    onClick={() => handleSelect(server)}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                      {iconUrl(server) ? (
                        <img
                          src={iconUrl(server)!}
                          alt={server.server_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold">
                          {server.server_name[0]}
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium truncate">
                        {server.server_name}
                      </p>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <Users className="w-3 h-3" />
                        {server.bot_connected ? "Connected" : "Not connected"}
                      </div>
                    </div>

                    {server.bot_connected && (
                      <Check className="w-4 h-4 text-success" />
                    )}
                  </button>

                  {server.bot_connected === false &&
                    server.can_invite_bot && (
                      <Button
                        variant="hero"
                        size="sm"
                        className="w-full mt-2"
                        disabled={installing}
                        onClick={(e) => {
                          e.stopPropagation();
                          inviteBot(server.discord_server_id);
                        }}
                      >
                        {installing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Installing…
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Bot
                          </>
                        )}
                      </Button>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
