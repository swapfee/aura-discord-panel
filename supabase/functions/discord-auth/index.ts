import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - production and preview domains
const ALLOWED_ORIGINS = [
  'https://aura-discord-panel.lovable.app',
];

// Check if origin is allowed (includes lovableproject.com preview domains and lovable.app domains)
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow preview domains (*.lovableproject.com)
  if (origin.endsWith('.lovableproject.com')) return true;
  // Allow any lovable.app subdomain
  if (origin.endsWith('.lovable.app')) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (isAllowedOrigin(origin)) {
    return {
      'Access-Control-Allow-Origin': origin!,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const DISCORD_CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!;
const DISCORD_CLIENT_SECRET = Deno.env.get('DISCORD_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Hardcoded redirect URI - must match exactly what's registered in Discord Developer Portal
const REDIRECT_URI = 'https://aura-discord-panel.lovable.app/auth/callback';

// Generic error message for clients - never expose internal details
const GENERIC_AUTH_ERROR = 'Authentication failed. Please try again.';

// Simple in-memory rate limiting (resets on cold start, but provides basic protection)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    console.warn('Rate limit exceeded for client');
    return true;
  }
  
  return false;
}

// Validate OAuth code format - Discord codes are alphanumeric with potential special chars
function isValidOAuthCode(code: string): boolean {
  // Discord OAuth codes are typically 30 characters, alphanumeric
  return /^[a-zA-Z0-9]{20,50}$/.test(code);
}

// Validate state parameter format - should be a UUID
function isValidState(state: string): boolean {
  return /^[a-f0-9-]{36}$/.test(state);
}

serve(async (req) => {
  // Get client IP for rate limiting (from headers set by edge runtime)
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Apply rate limiting
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

      console.log('Login flow initiated');
      return new Response(JSON.stringify({ url: discordAuthUrl.toString(), state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      // Validate code parameter
      if (!code) {
        console.error('Callback: missing authorization code');
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate code format to prevent malformed input
      if (!isValidOAuthCode(code)) {
        console.error('Callback: invalid code format');
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate state format if provided
      if (state && !isValidState(state)) {
        console.error('Callback: invalid state format');
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        console.error('Token exchange failed with status:', tokenResponse.status);
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens = await tokenResponse.json();
      console.log('Token exchange successful');

      // Get user info
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userResponse.ok) {
        console.error('User info fetch failed with status:', userResponse.status);
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const discordUser = await userResponse.json();
      console.log('User info retrieved successfully');

      // Get user guilds
      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let guilds = [];
      if (guildsResponse.ok) {
        guilds = await guildsResponse.json();
        console.log('Guilds fetched successfully');
      } else {
        console.error('Guild fetch failed with status:', guildsResponse.status);
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
        console.log('Existing user profile updated');
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
          console.error('User creation failed');
          return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        userId = authUser.user.id;
        console.log('New user created successfully');
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
        console.log('Admin servers synced');
      }

      // Generate session token for the user
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: `${discordUser.id}@discord.user`,
      });

      if (sessionError) {
        console.error('Session generation failed');
        return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Authentication completed successfully');
      return new Response(JSON.stringify({ 
        success: true,
        magicLink: sessionData.properties?.action_link,
        userId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('Invalid action requested');
    return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Unexpected error during authentication');
    return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
