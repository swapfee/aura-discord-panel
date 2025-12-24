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
  JWT_SECRET,
  MONGO_URL,
  PORT,
} = process.env;

if (
  !DISCORD_CLIENT_ID ||
  !DISCORD_CLIENT_SECRET ||
  !DISCORD_REDIRECT_URI ||
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
    { upsert: true, new: true }
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
    scope: data.scope,
    tokenType: data.token_type,
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

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(Number(PORT || 3000), "0.0.0.0", () =>
  console.log("Server running")
);
