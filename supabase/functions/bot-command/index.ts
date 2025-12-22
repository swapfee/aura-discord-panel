import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Your bot's API endpoint (you'll set this when hosting locally)
const BOT_API_URL = Deno.env.get("BOT_API_URL") || "http://localhost:3001";

interface CommandPayload {
  command: "play" | "pause" | "skip" | "stop" | "shuffle" | "loop" | "volume" | "seek" | "remove" | "clear" | "add";
  serverId: string;
  data?: {
    query?: string;      // For play/add command
    volume?: number;     // For volume command (0-100)
    position?: number;   // For seek command (seconds)
    index?: number;      // For remove command
    loop?: "off" | "track" | "queue"; // For loop command
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user's session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: CommandPayload = await req.json();
    console.log("Command from user:", user.id, "->", payload.command, "for server:", payload.serverId);

    // Verify user has access to this server
    const { data: serverAccess, error: accessError } = await supabase
      .from("user_servers")
      .select("id, is_admin")
      .eq("user_id", user.id)
      .eq("discord_server_id", payload.serverId)
      .single();

    if (accessError || !serverAccess) {
      console.error("Server access error:", accessError);
      return new Response(
        JSON.stringify({ error: "No access to this server" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward command to the Discord bot
    const botResponse = await fetch(`${BOT_API_URL}/api/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": user.id,
        "X-Server-Id": payload.serverId,
      },
      body: JSON.stringify({
        command: payload.command,
        serverId: payload.serverId,
        userId: user.id,
        data: payload.data,
      }),
    });

    if (!botResponse.ok) {
      const errorText = await botResponse.text();
      console.error("Bot API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Bot command failed", details: errorText }),
        { status: botResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await botResponse.json();
    console.log("Bot response:", result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Command error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
