import mongoose from "mongoose";

const DiscordTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: String,
    tokenType: { type: String, default: "Bearer" },
  },
  { timestamps: true }
);

export const DiscordToken =
  mongoose.models.DiscordToken ||
  mongoose.model("DiscordToken", DiscordTokenSchema);
