// server.js (ESM) — Express + Discord OAuth + Postgres token storage + JOSE JWT sessions
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord-auth";
import { SignJWT, jwtVerify } from "jose";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cookieParser());

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  JWT_SECRET,
  DATABASE_URL,
  TOKEN_ENC_KEY, // REQUIRED: 32-byte key, base64 (recommended) or 64 hex chars
  PORT,
} = process.env;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI || !JWT_SECRET) {
  console.error("Missing required env vars: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("Missing required env var: DATABASE_URL (Railway Postgres connection string)");
  process.exit(1);
}
if (!TOKEN_ENC_KEY) {
  console.error("Missing required env var: TOKEN_ENC_KEY (32-byte key, base64 recommended)");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const JWT_KEY = new TextEncoder().encode(JWT_SECRET);

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  };
}

function encKeyBytes() {
  const s = TOKEN_ENC_KEY.trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  return Buffer.from(s, "base64");
}
const ENC_KEY = encKeyBytes();
if (ENC_KEY.length !== 32) {
  console.error("TOKEN_ENC_KEY must decode to 32 bytes (AES-256-GCM key).");
  process.exit(1);
}

// AES-256-GCM encrypt/decrypt for storing tokens in DB
function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}
function decryptText(enc) {
  const [ivB64, tagB64, dataB64] = String(enc).split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Bad encrypted payload format");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

async function requireUser(req) {
  const token = req.cookies.session;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_KEY);
    return payload;
  } catch {
    return null;
  }
}

async function upsertDiscordTokens({ userId, accessToken, refreshToken, expiresAtISO, scope, tokenType }) {
  const accessEnc = encryptText(accessToken);
  const refreshEnc = encryptText(refreshToken);

  await pool.query(
    `
    INSERT INTO discord_oauth_tokens
      (user_id, access_token_enc, refresh_token_enc, expires_at, scope, token_type, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, NOW()::text)
    ON CONFLICT (user_id)
    DO UPDATE SET
      access_token_enc = EXCLUDED.access_token_enc,
      refresh_token_enc = EXCLUDED.refresh_token_enc,
      expires_at        = EXCLUDED.expires_at,
      scope             = EXCLUDED.scope,
      token_type        = EXCLUDED.token_type,
      updated_at        = NOW()::text
    `,
    [userId, accessEnc, refreshEnc, expiresAtISO ?? null, scope ?? null, tokenType ?? null]
  );
}

async function getDiscordTokens(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, access_token_enc, refresh_token_enc, expires_at, scope, token_type
     FROM discord_oauth_tokens
     WHERE user_id = $1`,
    [userId]
  );
  if (!rows.length) return null;

  const row = rows[0];
  return {
    userId: row.user_id,
    accessToken: decryptText(row.access_token_enc),
    refreshToken: decryptText(row.refresh_token_enc),
    expiresAtISO: row.expires_at ?? null,
    scope: row.scope ?? null,
    tokenType: row.token_type ?? null,
  };
}

async function refreshDiscordAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: DISCORD_REDIRECT_URI,
  });

  const r = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error_description || data?.error || `Refresh failed (${r.status})`;
    throw new Error(msg);
  }

  const expiresInSec = Number(data.expires_in ?? 0);
  const expiresAtISO = expiresInSec
    ? new Date(Date.now() + expiresInSec * 1000).toISOString()
    : null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAtISO,
    scope: data.scope ?? null,
    tokenType: data.token_type ?? null,
  };
}

/* ======================
   HEALTH
====================== */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ======================
   DISCORD AUTH (Passport)
====================== */
passport.use(
  new DiscordStrategy(
    {
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackUrl: DISCORD_REDIRECT_URI,
      scope: ["identify", "email", "guilds"],
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const user = {
          id: profile.id,
          username: profile.username,
          email: profile.email ?? null,
          avatar: profile.avatar ?? null,
        };

        // pass tokens via authInfo; store in callback
        return cb(null, user, { accessToken, refreshToken });
      } catch (e) {
        return cb(e);
      }
    }
  )
);

app.use(passport.initialize());

app.get("/auth/discord", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { session: false, failureRedirect: "/" }),
  async (req, res) => {
    try {
      const user = req.user;
      const info = req.authInfo || {};

      // Store tokens (expiresAt unknown here; we refresh on 401 anyway)
      if (info.accessToken && info.refreshToken) {
        await upsertDiscordTokens({
          userId: user.id,
          accessToken: info.accessToken,
          refreshToken: info.refreshToken,
          expiresAtISO: null,
          scope: "identify email guilds",
          tokenType: "Bearer",
        });
      }

      const sessionJwt = await new SignJWT({
        username: user.username,
        email: user.email ?? null,
        avatar: user.avatar ?? null,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(JWT_KEY);

      res.cookie("session", sessionJwt, { ...cookieOpts(), maxAge: 2 * 60 * 60 * 1000 });
      res.redirect("/dashboard");
    } catch (e) {
      console.error("OAuth callback error:", e);
      res.redirect("/");
    }
  }
);

/* ======================
   ACCOUNT
====================== */
app.get("/api/me", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie("session", cookieOpts());
  res.status(204).end();
});

app.post("/api/account/delete", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: "Not authenticated" });

  try {
    await pool.query(`DELETE FROM discord_oauth_tokens WHERE user_id = $1`, [user.sub]);
  } catch (e) {
    console.error("Delete tokens failed:", e);
  }

  res.clearCookie("session", cookieOpts());
  res.json({ ok: true });
});

/* ======================
   SERVERS (Guilds list)
====================== */
async function fetchGuildsWithToken(accessToken) {
  const r = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

app.get("/api/servers", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ servers: [] });

  try {
    let tokens = await getDiscordTokens(user.sub);
    if (!tokens) return res.json({ servers: [] });

    // Try once with current token
    let guildsRes = await fetchGuildsWithToken(tokens.accessToken);

    // If unauthorized, refresh and retry once
    if (guildsRes.status === 401) {
      const refreshed = await refreshDiscordAccessToken(tokens.refreshToken);

      await upsertDiscordTokens({
        userId: user.sub,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAtISO: refreshed.expiresAtISO,
        scope: refreshed.scope,
        tokenType: refreshed.tokenType,
      });

      tokens = { ...tokens, ...refreshed };
      guildsRes = await fetchGuildsWithToken(tokens.accessToken);
    }

    if (!guildsRes.ok || !Array.isArray(guildsRes.data)) {
      console.error("Discord guilds fetch failed:", guildsRes.status, guildsRes.data);
      return res.json({ servers: [] });
    }

    const servers = guildsRes.data.map((g) => ({
      id: String(g.id),
      discord_server_id: String(g.id),
      server_name: g.name,
      server_icon: g.icon ?? null,
      member_count: null,      // not available from this endpoint
      bot_connected: null,     // compute later using bot
    }));

    return res.json({ servers });
  } catch (e) {
    console.error("/api/servers error:", e);
    return res.status(500).json({ servers: [] });
  }
});

/* ======================
   BOT COMMANDS (stub)
====================== */
app.post("/api/bot/command", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: "Not authenticated" });

  const { command, serverId, payload } = req.body || {};
  if (!command || !serverId) {
    return res.status(400).json({ ok: false, error: "Missing command or serverId" });
  }

  console.log("[bot-command]", {
    userId: user.sub,
    serverId,
    command,
    payload: payload ?? {},
  });

  return res.json({ ok: true });
});

/* ======================
   FRONTEND SERVING
====================== */
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const listenPort = Number(PORT || 3000);
app.listen(listenPort, "0.0.0.0", () => {
  console.log(`App running on ${listenPort}`);
});
