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

// 🤖 BOT MODELS (READ-ONLY)
import { registerSongPlay } from "./src/bot-models/SongPlay.js";
import { registerVoiceSession } from "./src/bot-models/VoiceSession.js";
import { registerQueue } from "./src/bot-models/Queue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

/* ======================
   ENV
====================== */

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

await new Promise((resolve, reject) => {
  botDb.once("open", resolve);
  botDb.once("error", reject);
});


// Register bot models on BOT DB ONLY
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
    return (BigInt(permissions) & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
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

  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized internal request" });
  }

  next();
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

  if (!r.ok) throw new Error("Failed to refresh token");
  const data = await r.json();

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

  if (isExpired(tokens.expiresAt)) {
    const refreshed = await refreshDiscordToken(tokens.refreshToken);
    await saveDiscordTokens({ userId: user.sub, ...refreshed });
    tokens = refreshed;
  }

  const [userGuildsRes, botGuildsRes] = await Promise.all([
    fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    }),
    fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    }),
  ]);

  const userGuilds = await userGuildsRes.json();
  const botGuilds = await botGuildsRes.json();

  const botGuildIds = new Set(botGuilds.map(g => g.id));

  const servers = userGuilds.map(g => ({
    id: g.id,
    discord_server_id: g.id,
    server_name: g.name,
    server_icon: g.icon,
    bot_connected: botGuildIds.has(g.id),
    can_invite_bot: hasAdminPermissions(g.permissions),
  }));

  res.json({ servers });
});

app.get("/api/servers/:serverId/overview", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();

  const { serverId } = req.params;

  try {
    const songsPlayed = await SongPlay.countDocuments({ guildId: serverId });

    const sessions = await VoiceSession.find({
      guildId: serverId,
      joinedAt: { $exists: true, $ne: null },
    }).lean();

    let listeningTimeMinutes = 0;

    for (const s of sessions) {
      const joined = new Date(s.joinedAt);
      if (Number.isNaN(joined.getTime())) continue;

      const end = s.leftAt ? new Date(s.leftAt) : new Date();
      if (Number.isNaN(end.getTime())) continue;

      listeningTimeMinutes += Math.max(
        0,
        Math.floor((end - joined) / 60000)
      );
    }

    const activeListeners = await VoiceSession.countDocuments({
      guildId: serverId,
      $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
    });

    const queue = await Queue.findOne({ guildId: serverId }).lean();

    return res.json({
      songsPlayed,
      listeningTimeMinutes,
      activeListeners,
      queueLength: queue?.tracks?.length ?? 0,
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
    tracks: plays.map(p => ({
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

    totals.set(
      s.userId,
      (totals.get(s.userId) ?? 0) + Math.max(0, mins)
    );
  }

  const topRaw = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 🔥 Fetch usernames from Discord
  const listeners = await Promise.all(
    topRaw.map(async ([userId, minutes], index) => {
      let username = null;

      try {
        const r = await fetch(
          `https://discord.com/api/users/${userId}`,
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );

        if (r.ok) {
          const u = await r.json();
          username = u.username;
        }
      } catch {}

      return {
        userId,
        username,
        listenTimeMinutes: minutes,
        rank: index + 1,
      };
    })
  );

  res.json({ listeners });
});



app.post("/auth/logout", (_req, res) => {
  res.clearCookie("session", cookieOpts());
  res.status(204).end();
});

/* ======================
   FRONTEND (LAST)
====================== */

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) =>
  res.sendFile(path.join(distPath, "index.html"))
);

const server = app.listen(Number(PORT || 3000), "0.0.0.0", () =>
  console.log("Server running")
);

/* ======================
   WEBSOCKETS — LIVE STATS
====================== */

const wss = new WebSocketServer({ server });

function broadcastToGuild(guildId, payload) {
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.guildId === guildId) {
      client.send(JSON.stringify(payload));
    }
  }
}

wss.on("connection", async (ws, req) => {
  try {
    // Extract session cookie
    const cookies = req.headers.cookie ?? "";
    const session = cookies
  .split(";")
  .map(c => c.trim())
  .find(c => c.startsWith("session="))
  ?.slice("session=".length);


    if (!session) {
      ws.close();
      return;
    }

    // Verify JWT
    const { payload } = await jwtVerify(session, JWT_KEY);

    ws.userId = payload.sub;
    ws.guildId = null;

    ws.send(JSON.stringify({ type: "connected" }));
  } catch {
    ws.close();
  }

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "subscribe") {
        ws.guildId = data.guildId;
      }
    } catch {}
  });
});

/* ======================
   INTERNAL BOT EVENTS
====================== */

app.post("/api/internal/song-played", requireInternalKey, (req, res) => {
  const { guildId, title, artist } = req.body;

  broadcastToGuild(guildId, {
    type: "song_played",
    title,
    artist,
  });

  res.json({ ok: true });
});
app.post("/api/internal/queue-update", requireInternalKey, (req, res) => {
  const { guildId, queueLength } = req.body;

  broadcastToGuild(guildId, {
    type: "queue_update",
    queueLength,
  });

  res.json({ ok: true });
});


app.post("/api/internal/voice-update", requireInternalKey, (req, res) => {
  const { guildId, activeListeners } = req.body;

  broadcastToGuild(guildId, {
    type: "voice_update",
    activeListeners,
  });

  res.json({ ok: true });
});
