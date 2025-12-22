import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origin for CORS - restrict to app domain only
const ALLOWED_ORIGIN = 'https://jamwzfymmrqvdeoptlid.lovable.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCORD_CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!;
const DISCORD_CLIENT_SECRET = Deno.env.get('DISCORD_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Hardcoded redirect URI - must match exactly what's registered in Discord Developer Portal
const REDIRECT_URI = 'https://jamwzfymmrqvdeoptlid.lovable.app/auth/callback';

// Generic error message for clients - never expose internal details
const GENERIC_AUTH_ERROR = 'Authentication failed. Please try again.';

serve(async (req) => {
  // Validate origin for security
  const origin = req.headers.get('origin');
  const responseHeaders = origin === ALLOWED_ORIGIN 
    ? corsHeaders 
    : { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: responseHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'login') {
      const state = crypto.randomUUID();
      
      const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
      discordAuthUrl.searchParams.set('client_id', DISCORD_CLIENT_ID);
      discordAuthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      discordAuthUrl.searchParams.set('response_type', 'code');
      discordAuthUrl.searchParams.set('scope', 'identify guilds');
      discordAuthUrl.searchParams.set('state', state);

      return new Response(JSON.stringify({ url: discordAuthUrl.toString(), state }), {
        headers: { ...responseHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      
      if (!code) {
        console.error('Callback called without authorization code');
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...responseHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Exchange code for tokens using the same hardcoded redirect URI
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorDetails = await tokenResponse.text();
        console.error('Discord token exchange failed:', errorDetails);
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...responseHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens = await tokenResponse.json();
      console.log('Discord tokens received successfully');

      // Get user info
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userResponse.ok) {
        console.error('Failed to fetch Discord user info:', userResponse.status);
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...responseHeaders, 'Content-Type': 'application/json' },
        });
      }

      const discordUser = await userResponse.json();
      console.log('Discord user authenticated:', discordUser.id);

      // Get user guilds
      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let guilds = [];
      if (guildsResponse.ok) {
        guilds = await guildsResponse.json();
        console.log('Fetched guilds count:', guilds.length);
      } else {
        console.error('Failed to fetch guilds:', guildsResponse.status);
      }

      // Create Supabase client
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check if user exists by discord_id
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('discord_id', discordUser.id)
        .maybeSingle();

      let userId: string;

      if (existingProfile) {
        userId = existingProfile.id;
        // Update profile (no tokens stored for security)
        await supabaseAdmin.from('profiles').update({
          discord_username: discordUser.username,
          discord_avatar: discordUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
      } else {
        // Create new user in auth.users
        const email = `${discordUser.id}@discord.user`;
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            provider_id: discordUser.id,
            full_name: discordUser.username,
            avatar_url: discordUser.avatar 
              ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
              : null,
          },
        });

        if (authError) {
          console.error('User creation failed:', authError.message);
          return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
            status: 500,
            headers: { ...responseHeaders, 'Content-Type': 'application/json' },
          });
        }

        userId = authUser.user.id;
      }

      // Sync guilds - filter for admin guilds (permission 0x8 = ADMINISTRATOR)
      const adminGuilds = guilds.filter((g: any) => (parseInt(g.permissions) & 0x8) === 0x8);
      
      // Delete old servers and insert new ones
      await supabaseAdmin.from('user_servers').delete().eq('user_id', userId);
      
      if (adminGuilds.length > 0) {
        const serverData = adminGuilds.map((guild: any) => ({
          user_id: userId,
          discord_server_id: guild.id,
          server_name: guild.name,
          server_icon: guild.icon 
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
            : null,
          is_admin: true,
          member_count: guild.approximate_member_count || 0,
        }));

        await supabaseAdmin.from('user_servers').insert(serverData);
        console.log('Synced admin servers:', adminGuilds.length);
      }

      // Generate session token for the user
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: `${discordUser.id}@discord.user`,
      });

      if (sessionError) {
        console.error('Session generation failed:', sessionError.message);
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 500,
          headers: { ...responseHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        magicLink: sessionData.properties?.action_link,
        userId,
      }), {
        headers: { ...responseHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
      status: 400,
      headers: { ...responseHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Discord auth error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
      status: 500,
      headers: { ...responseHeaders, 'Content-Type': 'application/json' },
    });
  }
});
