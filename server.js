// server.js — Express + Discord OAuth + Postgres + JOSE JWT (Railway-safe)

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

/* 🔑 REQUIRED FOR RAILWAY (SECURE COOKIES BEHIND PROXY) */
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  JWT_SECRET,
  DATABASE_URL,
  TOKEN_ENC_KEY,
  PORT,
} = process.env;

if (
  !DISCORD_CLIENT_ID ||
  !DISCORD_CLIENT_SECRET ||
  !DISCORD_REDIRECT_URI ||
  !JWT_SECRET ||
  !DATABASE_URL ||
  !TOKEN_ENC_KEY
) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const JWT_KEY = new TextEncoder().encode(JWT_SECRET);

/* ======================
   COOKIE
====================== */
function cookieOpts() {
  return {
    httpOnly: true,
    secure: true, // ✅ REQUIRED for Railway
    sameSite: "lax",
    path: "/",
  };
}

/* ======================
   ENCRYPTION (AES-256-GCM)
====================== */
function encKeyBytes() {
  const s = TOKEN_ENC_KEY.trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  return Buffer.from(s, "base64");
}
const ENC_KEY = encKeyBytes();
if (ENC_KEY.length !== 32) {
  console.error("TOKEN_ENC_KEY must be 32 bytes");
  process.exit(1);
}

function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptText(enc) {
  const [ivB64, tagB64, dataB64] = enc.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/* ======================
   AUTH HELPERS
====================== */
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

/* ======================
   DISCORD TOKEN STORAGE
====================== */
async function upsertDiscordTokens({
  userId,
  accessToken,
  refreshToken,
  expiresAtISO,
  scope,
  tokenType,
}) {
  await pool.query(
    `
    INSERT INTO discord_oauth_tokens
      (user_id, access_token_enc, refresh_token_enc, expires_at, scope, token_type, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW()::text)
    ON CONFLICT (user_id)
    DO UPDATE SET
      access_token_enc = EXCLUDED.access_token_enc,
      refresh_token_enc = EXCLUDED.refresh_token_enc,
      expires_at = EXCLUDED.expires_at,
      scope = EXCLUDED.scope,
      token_type = EXCLUDED.token_type,
      updated_at = NOW()::text
    `,
    [
      userId,
      encryptText(accessToken),
      encryptText(refreshToken),
      expiresAtISO,
      scope,
      tokenType,
    ]
  );
}

async function getDiscordTokens(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM discord_oauth_tokens WHERE user_id = $1`,
    [userId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    accessToken: decryptText(r.access_token_enc),
    refreshToken: decryptText(r.refresh_token_enc),
    expiresAtISO: r.expires_at,
  };
}

function isExpired(expiresAtISO) {
  return Date.now() >= Date.parse(expiresAtISO) - 60_000;
}

async function refreshDiscordToken(refreshToken) {
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

  const data = await r.json();
  if (!r.ok) throw new Error("Failed to refresh token");

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAtISO: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

/* ======================
   PASSPORT DISCORD
====================== */
passport.use(
  new DiscordStrategy(
    {
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackUrl: DISCORD_REDIRECT_URI,
      scope: ["identify", "email", "guilds"],
    },
    async (accessToken, refreshToken, profile, done) => {
      done(null, {
        id: profile.id,
        username: profile.username,
        email: profile.email ?? null,
        avatar: profile.avatar ?? null,
        accessToken,
        refreshToken,
      });
    }
  )
);

app.use(passport.initialize());

app.get("/auth/discord", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { session: false, failureRedirect: "/" }),
  async (req, res) => {
    const u = req.user;

    await upsertDiscordTokens({
      userId: u.id,
      accessToken: u.accessToken,
      refreshToken: u.refreshToken,
      expiresAtISO: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      scope: "identify email guilds",
      tokenType: "Bearer",
    });

    const jwt = await new SignJWT({
      username: u.username,
      email: u.email,
      avatar: u.avatar,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(u.id)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(JWT_KEY);

    res.cookie("session", jwt, { ...cookieOpts(), maxAge: 2 * 60 * 60 * 1000 });
    res.redirect("/dashboard");
  }
);

/* ======================
   API
====================== */
app.get("/api/me", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user });
});

app.get("/api/servers", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ servers: [] });

  let tokens = await getDiscordTokens(user.sub);
  if (!tokens) return res.json({ servers: [] });

  if (isExpired(tokens.expiresAtISO)) {
    const refreshed = await refreshDiscordToken(tokens.refreshToken);
    await upsertDiscordTokens({ userId: user.sub, ...refreshed });
    tokens = refreshed;
  }

  const r = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  const guilds = await r.json();
  const servers = Array.isArray(guilds)
    ? guilds.map((g) => ({
        id: g.id,
        discord_server_id: g.id,
        server_name: g.name,
        server_icon: g.icon,
        member_count: null,
        bot_connected: null,
      }))
    : [];

  res.json({ servers });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie("session", cookieOpts());
  res.status(204).end();
});

/* ======================
   STATIC FRONTEND
====================== */
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(Number(PORT || 3000), "0.0.0.0", () =>
  console.log("Server running")
);
