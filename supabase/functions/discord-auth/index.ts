import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCORD_CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!;
const DISCORD_CLIENT_SECRET = Deno.env.get('DISCORD_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'login') {
      // Get the origin from the request headers or use a fallback
      const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/$/, '') || '';
      const redirectUri = `${origin}/auth/callback`;
      const state = crypto.randomUUID();
      
      const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
      discordAuthUrl.searchParams.set('client_id', DISCORD_CLIENT_ID);
      discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
      discordAuthUrl.searchParams.set('response_type', 'code');
      discordAuthUrl.searchParams.set('scope', 'identify guilds');
      discordAuthUrl.searchParams.set('state', `${state}|${encodeURIComponent(redirectUri)}`);

      return new Response(JSON.stringify({ url: discordAuthUrl.toString(), state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'No code provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract redirect URI from state
      let redirectUri = '';
      if (stateParam && stateParam.includes('|')) {
        const parts = stateParam.split('|');
        redirectUri = decodeURIComponent(parts[1] || '');
      }
      
      if (!redirectUri) {
        // Fallback - get from referer or origin header
        const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/$/, '').replace(/\/auth\/callback.*$/, '') || '';
        redirectUri = `${origin}/auth/callback`;
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Token exchange failed:', error);
        return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens = await tokenResponse.json();
      console.log('Discord tokens received');

      // Get user info
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to get user info' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const discordUser = await userResponse.json();
      console.log('Discord user:', discordUser.username);

      // Get user guilds
      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let guilds = [];
      if (guildsResponse.ok) {
        guilds = await guildsResponse.json();
        console.log('Fetched guilds:', guilds.length);
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
        // Update profile
        await supabaseAdmin.from('profiles').update({
          discord_username: discordUser.username,
          discord_avatar: discordUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          discord_access_token: tokens.access_token,
          discord_refresh_token: tokens.refresh_token,
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
          console.error('Auth user creation failed:', authError);
          return new Response(JSON.stringify({ error: 'Failed to create user' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        userId = authUser.user.id;

        // Update profile with tokens (trigger creates profile)
        await supabaseAdmin.from('profiles').update({
          discord_access_token: tokens.access_token,
          discord_refresh_token: tokens.refresh_token,
        }).eq('id', userId);
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
        console.log('Synced servers:', adminGuilds.length);
      }

      // Generate session token for the user
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: `${discordUser.id}@discord.user`,
      });

      if (sessionError) {
        console.error('Session generation failed:', sessionError);
        return new Response(JSON.stringify({ error: 'Failed to generate session' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        magicLink: sessionData.properties?.action_link,
        userId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Discord auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
