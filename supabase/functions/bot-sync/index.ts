import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

// Bot secret for authentication (must match BOT_SECRET in your bot's .env)
const BOT_SECRET = Deno.env.get("BOT_SECRET");

interface NowPlaying {
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  position: number;
  requestedBy: string;
  url: string;
}

interface QueueItem {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  requestedBy: string;
  url: string;
  addedAt: string;
}

interface HistoryItem extends QueueItem {
  playedAt: string;
}

interface BotSyncPayload {
  action: "update_now_playing" | "update_queue" | "add_history" | "update_status" | "full_sync" | "bot_connected" | "bot_disconnected" | "bot_connected_batch";
  serverId?: string;
  servers?: string[]; // For batch operations
  // Data can be at root level (from bot) or in data object
  nowPlaying?: NowPlaying | null;
  queue?: QueueItem[];
  history?: HistoryItem[];
  status?: {
    isPlaying: boolean;
    isPaused: boolean;
    volume: number;
    loop: "off" | "track" | "queue" | string;
    shuffle: boolean;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botSecret = req.headers.get("x-bot-secret");
    
    // Verify bot secret
    if (!BOT_SECRET || botSecret !== BOT_SECRET) {
      console.error("Invalid bot secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: BotSyncPayload = await req.json();
    console.log("Received bot sync:", payload.action, "for server:", payload.serverId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle batch bot connection (startup sync for multiple servers)
    if (payload.action === "bot_connected_batch" && payload.servers) {
      console.log(`Batch updating bot_connected for ${payload.servers.length} servers`);
      
      const { error: updateError } = await supabase
        .from("user_servers")
        .update({ bot_connected: true, updated_at: new Date().toISOString() })
        .in("discord_server_id", payload.servers);
      
      if (updateError) {
        console.error("Error batch updating bot_connected:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to batch update connection status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Batch bot connection status updated for ${payload.servers.length} servers`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Bot connected status updated for ${payload.servers.length} servers`,
          servers: payload.servers 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle single bot connection status updates
    if (payload.action === "bot_connected" || payload.action === "bot_disconnected") {
      const isConnected = payload.action === "bot_connected";
      console.log(`Updating bot_connected to ${isConnected} for server:`, payload.serverId);
      
      // Update all user_servers entries for this Discord server
      const { error: updateError } = await supabase
        .from("user_servers")
        .update({ bot_connected: isConnected, updated_at: new Date().toISOString() })
        .eq("discord_server_id", payload.serverId);
      
      if (updateError) {
        console.error("Error updating bot_connected:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update connection status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Bot connection status updated to ${isConnected}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Bot ${isConnected ? "connected" : "disconnected"} status updated`,
          serverId: payload.serverId 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Broadcast to all connected clients via Supabase Realtime
    const channel = supabase.channel(`server:${payload.serverId}`);
    
    // Build the broadcast payload from root-level properties
    const broadcastPayload: Record<string, unknown> = {
      serverId: payload.serverId,
      timestamp: new Date().toISOString(),
    };
    
    if (payload.nowPlaying !== undefined) broadcastPayload.nowPlaying = payload.nowPlaying;
    if (payload.queue !== undefined) broadcastPayload.queue = payload.queue;
    if (payload.history !== undefined) broadcastPayload.history = payload.history;
    if (payload.status !== undefined) broadcastPayload.status = payload.status;
    
    // Subscribe first, then send
    await channel.subscribe();
    
    // Send the update through the channel
    await channel.send({
      type: "broadcast",
      event: payload.action,
      payload: broadcastPayload,
    });

    console.log("Broadcast sent for action:", payload.action, "payload:", broadcastPayload);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${payload.action} broadcast sent`,
        serverId: payload.serverId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Bot sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
