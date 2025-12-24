import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord-auth";
import { SignJWT, jwtVerify } from "jose";

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
  PORT,
  // Optional: if you later want to forward commands to a bot service
  BOT_API_URL,
  BOT_API_KEY,
} = process.env;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI || !JWT_SECRET) {
  console.error("Missing required env vars");
  process.exit(1);
}

const JWT_KEY = new TextEncoder().encode(JWT_SECRET);

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  };
}

async function requireUser(req, res) {
  const token = req.cookies.session;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_KEY);
    return payload; // includes sub, username, email, avatar, etc
  } catch {
    return null;
  }
}

/* ======================
   HEALTH
====================== */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ======================
   DISCORD AUTH
====================== */
passport.use(
  new DiscordStrategy(
    {
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_REDIRECT_URI,
      scope: ["identify", "email"],
    },
    (_accessToken, _refreshToken, profile, done) => done(null, profile)
  )
);

app.use(passport.initialize());

app.get("/auth/discord", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { session: false, failureRedirect: "/" }),
  async (req, res) => {
    const user = req.user;

    const jwt = await new SignJWT({
      username: user.username,
      email: user.email ?? null,
      avatar: user.avatar ?? null,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(JWT_KEY);

    res.cookie("session", jwt, { ...cookieOpts(), maxAge: 2 * 60 * 60 * 1000 });
    res.redirect("/dashboard");
  }
);

app.get("/api/me", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie("session", cookieOpts());
  res.status(204).end();
});

/* ======================
   ACCOUNT
====================== */
/**
 * Since we currently don't have a DB, "delete account" = clear auth cookie.
 * Later: delete user data from DB, revoke tokens, etc.
 */
app.post("/api/account/delete", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return res.status(401).json({ ok: false, error: "Not authenticated" });

  // TODO (later): delete user data from your DB here
  // For now, just log out.
  res.clearCookie("session", cookieOpts());
  res.json({ ok: true });
});

/* ======================
   BOT COMMANDS (NO SUPABASE)
====================== */
/**
 * Frontend calls this from BotContext:
 * POST /api/bot/command
 * body: { command, serverId, data }
 *
 * For now this endpoint just returns ok:true so your UI can function.
 * Later you can wire it to your actual Discord bot process.
 */
app.post("/api/bot/command", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return res.status(401).json({ ok: false, error: "Not authenticated" });

  const { command, serverId, data } = req.body || {};
  if (!command || !serverId) {
    return res.status(400).json({ ok: false, error: "Missing command or serverId" });
  }

  // If you have a separate bot service, forward it:
  // (optional) set BOT_API_URL and BOT_API_KEY in Railway
  if (BOT_API_URL) {
    try {
      const r = await fetch(`${BOT_API_URL}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BOT_API_KEY ? { Authorization: `Bearer ${BOT_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          userId: user.sub,
          serverId,
          command,
          data: data ?? {},
        }),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => "");
        return res.status(502).json({ ok: false, error: `Bot API error (${r.status})`, details: text });
      }

      const json = await r.json().catch(() => ({}));
      return res.json({ ok: true, result: json });
    } catch (e) {
      return res.status(502).json({ ok: false, error: "Bot API request failed" });
    }
  }

  // Default stub behavior (no bot wired yet)
  console.log("[bot-command]", {
    userId: user.sub,
    serverId,
    command,
    data: data ?? {},
  });

  return res.json({ ok: true });
});

/* ======================
   FRONTEND SERVING
====================== */
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// React Router fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const listenPort = Number(PORT || 3000);
app.listen(listenPort, "0.0.0.0", () => {
  console.log(`App running on ${listenPort}`);
});
