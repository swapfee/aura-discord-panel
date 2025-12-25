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
  PORT,
} = process.env;

if (
  !DISCORD_CLIENT_ID ||
  !DISCORD_CLIENT_SECRET ||
  !DISCORD_REDIRECT_URI ||
  !DISCORD_BOT_TOKEN ||
  !JWT_SECRET ||
  !MONGO_URL
) {
  console.error("Missing required environment variables");
  process.exit(1);
}

await mongoose.connect(MONGO_URL);

const JWT_KEY = new TextEncoder().encode(JWT_SECRET);

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  };
}

const ADMINISTRATOR_PERMISSION = 1n << 3n;

function hasAdminPermissions(permissions){
  try{
    const perms = BigInt(permissions);
    return (perms & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
  } catch{
    return false;
  }
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  const mins = Math.floor(seconds / 60);
  if (mins < 1) return "Now Playing";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
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

  if (!Array.isArray(userGuilds) || !Array.isArray(botGuilds)) {
    console.error("Discord API error", { userGuilds, botGuilds });
    return res.json({ servers: [] });
  }

  const botGuildIds = new Set(botGuilds.map((g) => g.id));

  const servers = [];

  for (const g of userGuilds) {
    let memberCount = null;

    const botConnected = botGuildIds.has(g.id);
    const canInviteBot = hasAdminPermissions(g.permissions);

    if (botConnected) {
      try {
        const guildRes = await fetch(
          `https://discord.com/api/guilds/${g.id}?with_counts=true`,
          {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
          }
        );

        if (guildRes.ok) {
          const guildData = await guildRes.json();
          memberCount =
            guildData.approximate_member_count ??
            guildData.member_count ??
            null;
        }
      } catch (err) {
        console.error("Guild fetch failed", g.id, err);
      }
    }

    servers.push({
      id: g.id,
      discord_server_id: g.id,
      server_name: g.name,
      server_icon: g.icon,
      member_count: memberCount,
      bot_connected: botConnected,
      can_invite_bot: canInviteBot,
    });
  }

  res.json({ servers });
});


app.post("/api/servers/sync", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false });

  return res.json({ ok: true });
});

app.get("/api/servers/:serverId/overview", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();

  const { serverId } = req.params;

  try {
    // These models come from the BOT database
    const SongPlay = mongoose.model("SongPlay");
    const VoiceSession = mongoose.model("VoiceSession");
    const Queue = mongoose.model("Queue");

    // Songs played (all-time)
    const songsPlayed = await SongPlay.countDocuments({
      guildId: serverId,
    });

    // Listening time (sum voice sessions)
    const sessions = await VoiceSession.find({
      guildId: serverId,
    });

    const listeningTimeMinutes = sessions.reduce((sum, s) => {
      if (!s.joinedAt) return sum;
      const end = s.leftAt ? new Date(s.leftAt) : new Date();
      return sum + Math.floor((end - s.joinedAt) / 60000);
    }, 0);

    // Active listeners (currently in voice)
    const activeListeners = await VoiceSession.countDocuments({
      guildId: serverId,
      leftAt: { $exists: false },
    });

    // Queue length
    const queue = await Queue.findOne({ guildId: serverId });
    const queueLength = queue?.tracks?.length ?? 0;

    res.json({
      songsPlayed,
      listeningTimeMinutes,
      activeListeners,
      queueLength,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load overview data" });
  }
});

app.get("/api/servers/:serverId/recent-activity", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();

  const { serverId } = req.params;

  try {
    const SongPlay = mongoose.model("SongPlay");

    const plays = await SongPlay.find({ guildId: serverId })
      .sort({ playedAt: -1 })
      .limit(10)
      .lean();

    const tracks = plays.map((p) => ({
      title: p.title,
      artist: p.artist,
      cover: p.coverUrl ?? null,
      playedAt: timeAgo(p.playedAt),
    }));

    res.json({ tracks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load recent activity" });
  }
});

app.get("/api/servers/:serverId/top-listeners", async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).end();

  const { serverId } = req.params;

  try {
    const VoiceSession = mongoose.model("VoiceSession");

    const sessions = await VoiceSession.find({
      guildId: serverId,
    }).lean();

    const totals = new Map();

    for (const s of sessions) {
      if (!s.userId || !s.joinedAt) continue;

      const end = s.leftAt ? new Date(s.leftAt) : new Date();
      const minutes = Math.floor((end - new Date(s.joinedAt)) / 60000);

      totals.set(
        s.userId,
        (totals.get(s.userId) ?? 0) + Math.max(0, minutes)
      );
    }

    const top = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, minutes], index) => ({
        userId,
        listenTimeMinutes: minutes,
        rank: index + 1,
      }));

    res.json({ listeners: top });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load top listeners" });
  }
});




app.post("/auth/logout", (_req, res) => {
  res.clearCookie("session", cookieOpts());
  res.status(204).end();
});

/* ======================
   FRONTEND
====================== */
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(Number(PORT || 3000), "0.0.0.0", () =>
  console.log("Server running")
);
