import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord-auth";
import { SignJWT, jwtVerify } from "jose";
import mongoose from "mongoose";

import { encrypt, decrypt } from "./src/lib/crypto.js";
import { DiscordToken } from "./src/models/DiscordToken.js";

// ✅ BOT MODELS (READ-ONLY)
import { registerSongPlay } from "./src/bot-models/SongPlay.js";
import { registerVoiceSession } from "./src/bot-models/VoiceSession.js";
import { registerQueue } from "./src/bot-models/Queue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_BOT_TOKEN,
  JWT_SECRET,
  MONGO_URL,
  BOT_MONGO_URL,
  PORT,
} = process.env;

if (
  !DISCORD_CLIENT_ID ||
  !DISCORD_CLIENT_SECRET ||
  !DISCORD_REDIRECT_URI ||
  !DISCORD_BOT_TOKEN ||
  !JWT_SECRET ||
  !MONGO_URL ||
  !BOT_MONGO_URL
) {
  console.error("Missing required environment variables");
  process.exit(1);
}

/* ======================
   DATABASES
====================== */

// 🌐 Website DB (auth, tokens)
await mongoose.connect(MONGO_URL);

// 🤖 Bot DB (analytics)
const botDb = mongoose.createConnection(BOT_MONGO_URL);

// Register bot models ON BOT DB
const SongPlay = registerSongPlay(botDb);
const VoiceSession = registerVoiceSession(botDb);
const Queue = registerQueue(botDb);

const JWT_KEY = new TextEncoder().encode(JWT_SECRET);

/* ======================
   HELPERS
====================== */

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  };
}

const ADMINISTRATOR_PERMISSION = 1n << 3n;

function hasAdminPermissions(permissions) {
  try {
    const perms = BigInt(permissions);
    return (perms & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
  } catch {
    return false;
  }
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  const mins = Math.floor(seconds / 60);
  if (mins < 1) return "Now Playing";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
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

/* ======================
   DISCORD TOKEN STORAGE
====================== */

async function saveDiscordTokens({
  userId,
  accessToken,
  refreshToken,
  expiresAt,
  scope,
  tokenType,
}) {
  await DiscordToken.findOneAndUpdate(
    { userId },
    {
      userId,
      accessToken: encrypt(accessToken),
      refreshToken: encrypt(refreshToken),
      expiresAt,
      scope,
      tokenType,
    },
    { upsert: true }
  );
}

async function getDiscordTokens(userId) {
  const doc = await DiscordToken.findOne({ userId }).lean();
  if (!doc) return null;

  return {
    accessToken: decrypt(doc.accessToken),
    refreshToken: decrypt(doc.refreshToken),
    expiresAt: doc.expiresAt,
  };
}

function isExpired(date) {
  return Date.now() >= new Date(date).getTime() - 60_000;
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
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/* ======================
   PASSPORT
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

/* ======================
   AUTH
====================== */

app.get("/auth/discord", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { session: false, failureRedirect: "/" }),
  async (req, res) => {
    const u = req.user;

    await saveDiscordTokens({
      userId: u.id,
      accessToken: u.accessToken,
      refreshToken: u.refreshToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
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

    res.cookie("session", jwt, {
      ...cookieOpts(),
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.redirect("/dashboard");
  }
);

/* ======================
   API — OVERVIEW
====================== */

app.get("/api/servers/:serverId/overview", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();

  const { serverId } = req.params;

  try {
    const songsPlayed = await SongPlay.countDocuments({ guildId: serverId });

    const sessions = await VoiceSession.find({ guildId: serverId }).lean();

    const listeningTimeMinutes = sessions.reduce((sum, s) => {
      if (!s.joinedAt) return sum;
      const end = s.leftAt ? new Date(s.leftAt) : new Date();
      return sum + Math.floor((end - new Date(s.joinedAt)) / 60000);
    }, 0);

    const activeListeners = await VoiceSession.countDocuments({
      guildId: serverId,
      leftAt: null,
    });

    const queue = await Queue.findOne({ guildId: serverId }).lean();

    res.json({
      songsPlayed,
      listeningTimeMinutes,
      activeListeners,
      queueLength: queue?.tracks?.length ?? 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load overview data" });
  }
});

/* ======================
   FRONTEND
====================== */

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) =>
  res.sendFile(path.join(distPath, "index.html"))
);

app.listen(Number(PORT || 3000), "0.0.0.0", () =>
  console.log("Server running")
);
