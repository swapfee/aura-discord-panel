// src/components/dashboard/ServerSelector.tsx
import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Server = {
  id: string;
  discord_server_id: string;
  server_name: string;
  server_icon?: string | null;
  member_count?: number;
  bot_connected?: boolean;
};

type ServerSelectorProps = {
  servers: Server[];
  loading?: boolean;
  collapsed?: boolean;
  onServerChange: (serverId: string) => void;
};

export default function ServerSelector({
  servers,
  loading = false,
  collapsed = false,
  onServerChange,
}: ServerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Server | null>(null);

  // Auto-select first server when list loads
  useEffect(() => {
    if (!selected && servers.length > 0) {
      setSelected(servers[0]);
      onServerChange(servers[0].discord_server_id);
    }
  }, [servers, selected, onServerChange]);

  const handleSelect = (server: Server) => {
    setSelected(server);
    onServerChange(server.discord_server_id);
    setOpen(false);
  };

  if (collapsed) {
    return (
      <div className="flex items-center justify-center h-10">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          selected && (
            <img
              src={
                selected.server_icon
                  ? `https://cdn.discordapp.com/icons/${selected.discord_server_id}/${selected.server_icon}.png?size=32`
                  : undefined
              }
              alt={selected.server_name}
              className="w-8 h-8 rounded-full"
            />
          )
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="w-full flex items-center justify-between px-3 py-2 rounded-md border bg-background"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected?.server_icon && (
            <img
              src={`https://cdn.discordapp.com/icons/${selected.discord_server_id}/${selected.server_icon}.png?size=32`}
              alt={selected.server_name}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="truncate text-sm">
            {selected?.server_name || "Select server"}
          </span>
        </div>

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-64 overflow-auto">
          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => handleSelect(server)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted",
                selected?.id === server.id && "bg-muted"
              )}
            >
              {server.server_icon && (
                <img
                  src={`https://cdn.discordapp.com/icons/${server.discord_server_id}/${server.server_icon}.png?size=32`}
                  alt={server.server_name}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">
                  {server.server_name}
                </div>
                {typeof server.member_count === "number" && (
                  <div className="text-xs text-muted-foreground">
                    {server.member_count.toLocaleString()} members
                  </div>
                )}
              </div>
            </button>
          ))}

          {servers.length === 0 && !loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No servers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
