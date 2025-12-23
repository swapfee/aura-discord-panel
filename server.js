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
  PORT
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
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ user: null });

  try {
    const { payload } = await jwtVerify(token, JWT_KEY);
    res.json({ user: payload });
  } catch {
    res.status(401).json({ user: null });
  }
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie("session", cookieOpts());
  res.status(204).end();
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
