// server.js (final updated)
import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord-auth";
import { SignJWT, jwtVerify } from "jose";
import mongoose from "mongoose";
import { WebSocketServer } from "ws";
import { encrypt, decrypt } from "./src/lib/crypto.js";
import { DiscordToken } from "./src/models/DiscordToken.js";

import { registerSongPlay } from "./src/bot-models/SongPlay.js";
import { registerVoiceSession } from "./src/bot-models/VoiceSession.js";
import { registerQueue } from "./src/bot-models/Queue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

// JSON limit (tune if needed)
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

/* log aborted requests minimally */
app.use((req, res, next) => {
  req.on("aborted", () => {
    console.warn("[HTTP] request aborted by client:", {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.socket.remoteAddress,
      ua: req.headers["user-agent"],
    });
  });
  next();
});

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

// Connect DBs
await mongoose.connect(MONGO_URL);
const botDb = mongoose.createConnection(BOT_MONGO_URL);
await new Promise((resolve, reject) => {
  botDb.once("open", resolve);
  botDb.once("error", reject);
});

const SongPlay = registerSongPlay(botDb);
const VoiceSession = registerVoiceSession(botDb);
const Queue = registerQueue(botDb);

const JWT_KEY = new TextEncoder().encode(JWT_SECRET);

function cookieOpts() {
  return {
    httpOnly: true,
    // Only require secure cookies in production (helps with local/dev).
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

const ADMINISTRATOR_PERMISSION = 1n << 3n;
function hasAdminPermissions(permissions) {
  try {
    return (
      (BigInt(permissions) & ADMINISTRATOR_PERMISSION) ===
      ADMINISTRATOR_PERMISSION
    );
  } catch {
    return false;
  }
}

function timeAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
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

function requireInternalKey(req, res, next) {
  const key = req.headers["x-internal-key"];
  if (!key || key !== process.env.INTERNAL_API_KEY)
    return res.status(401).json({ error: "Unauthorized internal request" });
  next();
}

// Discord token helpers
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
  if (!r.ok) throw new Error("Failed to refresh token");
  const data = await r.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

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

// Auth routes
app.get("/auth/discord", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { session: false, failureRedirect: "/" }),
  async (req, res) => {
    try {
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
    } catch (err) {
      console.error("[/auth/discord/callback] error:", err);
      res.redirect("/");
    }
  }
);

// API routes (overview / recent / top listeners)
app.get("/api/me", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user });
});

app.get("/api/servers", async (req, res) => {
  try {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ servers: [] });

    let tokens = await getDiscordTokens(user.sub);
    if (!tokens) return res.json({ servers: [] });

    if (isExpired(tokens.expiresAt)) {
      const refreshed = await refreshDiscordToken(tokens.refreshToken);
      await saveDiscordTokens({ userId: user.sub, ...refreshed });
      tokens = refreshed;
    }

    // issue both requests in parallel
    const [userGuildsRes, botGuildsRes] = await Promise.all([
      fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      }),
    ]);

    // Helper to safely parse guild arrays from responses
    const parseGuildsResponse = async (resp, label) => {
      let json;
      try {
        json = await resp.json();
      } catch (err) {
        console.warn(`[servers] ${label} response is not JSON`, err);
        return [];
      }

      // If API returned array directly, great
      if (Array.isArray(json)) return json;

      // Some services wrap results, try common shapes
      if (json && Array.isArray(json.guilds)) return json.guilds;
      if (json && Array.isArray(json.data)) return json.data;

      // Discord often returns an error object { message, code }, log it
      console.warn(`[servers] ${label} unexpected shape:`, json);
      return [];
    };

    const userGuilds = await parseGuildsResponse(userGuildsRes, "userGuilds");
    const botGuilds = await parseGuildsResponse(botGuildsRes, "botGuilds");

    // Build set of bot guild ids safely
    const botGuildIds = new Set();
    if (Array.isArray(botGuilds)) {
      for (const g of botGuilds) {
        const id = (g && (g.id ?? g.guildId ?? g.discord_server_id)) || null;
        if (id) botGuildIds.add(String(id));
      }
    }

    // Now map userGuilds into your server objects, defensively
    const servers = Array.isArray(userGuilds)
      ? userGuilds.map((g) => {
          const id = String(g?.id ?? g?.guildId ?? g?.discord_server_id ?? "");
          return {
            id,
            discord_server_id: id,
            server_name: g?.name ?? g?.server_name ?? "Unknown",
            server_icon: g?.icon ?? null,
            bot_connected: botGuildIds.has(id),
            can_invite_bot: hasAdminPermissions(g?.permissions),
          };
        })
      : [];

    return res.json({ servers });
  } catch (err) {
    console.error("[/api/servers] error:", err);
    // don't leak internals — return empty list with 500
    return res.status(500).json({ servers: [] });
  }
});

app.get("/api/servers/:serverId/overview", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();
  const { serverId } = req.params;
  try {
    const songsPlayedPromise = SongPlay.countDocuments({ guildId: serverId });
    const sessionsAgg = await VoiceSession.aggregate([
      { $match: { guildId: serverId, joinedAt: { $exists: true } } },
      {
        $project: {
          joinedAt: 1,
          leftAt: 1,
          durationMs: {
            $subtract: [{ $ifNull: ["$leftAt", "$$NOW"] }, "$joinedAt"],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalListeningMs: { $sum: { $max: ["$durationMs", 0] } },
          activeSessions: {
            $sum: { $cond: [{ $eq: ["$leftAt", null] }, 1, 0] },
          },
        },
      },
    ]);
    const queueAgg = await Queue.aggregate([
      { $match: { guildId: serverId } },
      { $project: { queueLength: { $size: { $ifNull: ["$tracks", []] } } } },
    ]);
    const songsPlayed = await songsPlayedPromise;
    const totalListeningMs = sessionsAgg[0]?.totalListeningMs ?? 0;
    const listeningTimeMinutes = Math.floor(totalListeningMs / 60000);
    const activeListeners = sessionsAgg[0]?.activeSessions ?? 0;
    const queueLength = queueAgg[0]?.queueLength ?? 0;
    return res.json({
      songsPlayed,
      listeningTimeMinutes,
      activeListeners,
      queueLength,
    });
  } catch (err) {
    console.error("[OVERVIEW ERROR]", err);
    return res.status(500).json({
      songsPlayed: 0,
      listeningTimeMinutes: 0,
      activeListeners: 0,
      queueLength: 0,
    });
  }
});

app.get("/api/servers/:serverId/recent-activity", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();
  const plays = await SongPlay.find({ guildId: req.params.serverId })
    .sort({ playedAt: -1 })
    .limit(7)
    .lean();
  res.json({
    tracks: plays.map((p) => ({
      title: p.title,
      artist: p.artist,
      cover: p.coverUrl ?? null,
      playedAt: timeAgo(p.playedAt),
    })),
  });
});

app.get("/api/servers/:serverId/top-listeners", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();
  const sessions = await VoiceSession.find({
    guildId: req.params.serverId,
  }).lean();
  const totals = new Map();
  for (const s of sessions) {
    if (!s.userId || !s.joinedAt) continue;
    const end = s.leftAt ? new Date(s.leftAt) : new Date();
    const mins = Math.floor((end - new Date(s.joinedAt)) / 60000);
    totals.set(s.userId, (totals.get(s.userId) ?? 0) + Math.max(0, mins));
  }
  const topRaw = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const listeners = await Promise.all(
    topRaw.map(async ([userId, minutes], index) => {
      let username = null;
      try {
        const r = await fetch(`https://discord.com/api/users/${userId}`, {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        });
        if (r.ok) {
          const u = await r.json();
          username = u.username;
        }
      } catch {}
      return { userId, username, listenTimeMinutes: minutes, rank: index + 1 };
    })
  );
  res.json({ listeners });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie("session", cookieOpts());
  res.status(204).end();
});

// internal bot events — broadcast-only
let wss; // declared early so broadcastToGuild can reference it
function broadcastToGuild(guildId, payload) {
  if (!wss) return;
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.guildId === guildId)
      client.send(JSON.stringify(payload));
  }
}

app.post("/api/internal/song-played", requireInternalKey, (req, res) => {
  const { guildId, title, artist } = req.body;
  broadcastToGuild(guildId, { type: "song_played", title, artist });
  res.json({ ok: true });
});

app.post("/api/internal/queue-update", requireInternalKey, (req, res) => {
  const { guildId, queueLength } = req.body;
  // broadcast-only — DO NOT mutate DB here
  broadcastToGuild(guildId, { type: "queue_update", queueLength });
  res.json({ ok: true });
});

app.post("/api/internal/voice-update", requireInternalKey, (req, res) => {
  const { guildId, activeListeners } = req.body;
  broadcastToGuild(guildId, { type: "voice_update", activeListeners });
  res.json({ ok: true });
});

// Robust /queue route — put this among your other API routes
app.get("/api/servers/:serverId/queue", requireUser, async (req, res) => {
  try {
    // requireUser returns 401 if not logged in
    const { serverId } = req.params;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)));

    // Read the queue document using the Queue model (registered against botDb)
    const qdoc = await Queue.findOne({ guildId: serverId }).lean();

    const tracksRaw = Array.isArray(qdoc?.tracks) ? qdoc.tracks : [];
    const queueLength = tracksRaw.length;
    const totalPages = Math.max(1, Math.ceil(queueLength / limit));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * limit;
    const pageTracks = tracksRaw.slice(start, start + limit);

    const mapTrack = (t, idx) => {
      let duration;
      if (typeof t.durationMs === "number") {
        const s = Math.floor(t.durationMs / 1000);
        duration = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      } else if (typeof t.duration === "string") {
        duration = t.duration;
      }
      return {
        id: String(t.id ?? t.url ?? `pos-${start + idx}`),
        title: t.title ?? t.info?.title ?? null,
        artist: t.artist ?? t.info?.author ?? null,
        duration,
        durationMs: typeof t.durationMs === "number" ? t.durationMs : undefined,
        requestedBy: t.requestedBy ?? t.requester ?? null,
        cover: t.coverUrl ?? t.cover ?? null,
        position: start + idx + 1,
      };
    };

    const tracks = pageTracks.map((t, i) => mapTrack(t, i));

    let nowPlaying = null;
    if (qdoc?.nowPlaying) {
      const np = qdoc.nowPlaying;
      let duration;
      if (typeof np.durationMs === "number") {
        const s = Math.floor(np.durationMs / 1000);
        duration = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      }
      nowPlaying = {
        title: np.title ?? null,
        artist: np.artist ?? null,
        duration,
        durationMs:
          typeof np.durationMs === "number" ? np.durationMs : undefined,
        cover: np.coverUrl ?? np.cover ?? null,
      };
    }

    return res.json({
      nowPlaying,
      tracks,
      queueLength,
      page: safePage,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("[/api/servers/:serverId/queue] error", err);
    return res.status(500).json({
      nowPlaying: null,
      tracks: [],
      queueLength: 0,
      page: 1,
      limit: Number(req.query.limit) || 50,
      totalPages: 1,
      error: "internal_server_error",
    });
  }
});

// final express error handler
app.use((err, req, res, next) => {
  console.error(
    "[Express] error handler:",
    err && (err.stack || err.message || err)
  );
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: "Internal server error" });
});

// serve frontend (must be after API routes and error handler)
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));
} else {
  console.warn(
    "[server] dist directory not found at",
    distPath,
    "— frontend won't be served."
  );
}

const server = app.listen(Number(PORT || 3000), "0.0.0.0", () =>
  console.log("Server running")
);

// handle malformed sockets/requests cleanly
server.on("clientError", (err, socket) => {
  try {
    console.warn("[server] clientError:", err && err.message);
    if (socket && socket.writable)
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    else socket.destroy();
  } catch {
    try {
      socket.destroy();
    } catch {}
  }
});

// WebSocket server
wss = new WebSocketServer({ server });

wss.on("connection", async (ws, req) => {
  try {
    const cookies = req.headers.cookie ?? "";
    const session = cookies
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("session="))
      ?.slice("session=".length);
    if (!session) {
      ws.close();
      return;
    }
    const { payload } = await jwtVerify(session, JWT_KEY);
    ws.userId = payload.sub;
    ws.guildId = null;
    ws.send(JSON.stringify({ type: "connected" }));
  } catch {
    ws.close();
  }
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "subscribe") ws.guildId = data.guildId;
    } catch {}
  });
});

/* internal bot events — broadcast-only
   note: broadcastToGuild referenced earlier uses the wss variable declared above */
process.on("unhandledRejection", (reason) =>
  console.error("[process] unhandledRejection:", reason)
);
process.on("uncaughtException", (err) =>
  console.error(
    "[process] uncaughtException:",
    err && (err.stack || err.message || err)
  )
);

export default app;
