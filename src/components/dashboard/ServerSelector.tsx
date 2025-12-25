import { useEffect, useState } from "react";
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
}

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

export default function ServerSelector({
  servers,
  loading = false,
  collapsed = false,
  onServerChange,
}: ServerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Server | null>(null);

  /* ======================
     AUTO SELECT FIRST THAT MAKES SENSE 
  ====================== */
useEffect(() => {
  if (selected || servers.length === 0) return;

  // 1️⃣ Prefer a server where the bot is already connected
  const botServer = servers.find((s) => s.bot_connected === true);

  const serverToSelect = botServer ?? servers[0];

  setSelected(serverToSelect);
  onServerChange(serverToSelect.discord_server_id);
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
     BOT INVITE
  ====================== */
  const inviteBot = (serverId: string) => {
    if (!DISCORD_CLIENT_ID) return;

    const redirectUri = encodeURIComponent(
      `${window.location.origin}/bot-installed`
    );

    const url =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${DISCORD_CLIENT_ID}` +
      `&permissions=8` +
      `&scope=bot%20applications.commands` +
      `&guild_id=${serverId}` +
      `&disable_guild_select=true` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code`;

    const popup = window.open(url, "_blank", "noopener,noreferrer");

    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        window.location.reload(); // auto-refresh after install
      }
    }, 1000);
  };

  /* ======================
     COLLAPSED MODE
  ====================== */
  if (collapsed) {
    return (
      <Button
        variant="glass"
        size="icon"
        className="w-full aspect-square"
        onClick={() => setIsOpen((v) => !v)}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : selected ? (
          iconUrl(selected) ? (
            <img
              src={iconUrl(selected)}
              alt={selected.server_name}
              className="w-8 h-8 rounded-lg"
            />
          ) : (
            <span className="text-sm font-bold">
              {selected.server_name[0]}
            </span>
          )
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
              <div className="w-8 h-8 rounded-lg bg-secondary overflow-hidden shrink-0">
                {iconUrl(selected) ? (
                  <img
                    src={iconUrl(selected)}
                    alt={selected.server_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="flex items-center justify-center h-full font-bold">
                    {selected.server_name[0]}
                  </span>
                )}
              </div>

              <div className="min-w-0 text-left">
                <p className="text-sm font-medium truncate max-w-[140px]">
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

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
          <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
            {servers.map((server) => {
              const selectedRow = selected?.id === server.id;

              return (
                <div
                  key={server.id}
                  className={cn(
                    "rounded-lg transition-colors",
                    selectedRow
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary"
                  )}
                >
                  <button
                    onClick={() => handleSelect(server)}
                    className="w-full flex items-center gap-3 p-2 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden shrink-0">
                      {iconUrl(server) ? (
                        <img
                          src={iconUrl(server)}
                          alt={server.server_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="flex items-center justify-center h-full font-bold">
                          {server.server_name[0]}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {server.server_name}
                        </p>
                        {selectedRow && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </div>

                      {/* ✅ CONNECTED STATUS RESTORED */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>
                          {typeof server.member_count === "number"
                            ? server.member_count.toLocaleString()
                            : "—"}
                        </span>
                        {server.bot_connected === true && (
                          <span className="text-success">• Connected</span>
                        )}
                        {server.bot_connected === false && (
                          <span className="text-warning">• Not connected</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* ✅ ADD BOT (PERMISSION AWARE) */}
                  {server.bot_connected === false &&
                    server.can_invite_bot === true && (
                      <Button
                        variant="hero"
                        size="sm"
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          inviteBot(server.discord_server_id);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Bot
                      </Button>
                    )}
                </div>
              );
            })}

            {!loading && servers.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No servers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
