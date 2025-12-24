import mongoose, { Schema, Model, Document } from "mongoose";

export interface IDiscordToken extends Document {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
  tokenType?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DiscordTokenSchema = new Schema<IDiscordToken>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: { type: String },
    tokenType: { type: String, default: "Bearer" },
  },
  { timestamps: true }
);

export const DiscordToken: Model<IDiscordToken> =
  mongoose.models.DiscordToken ??
  mongoose.model<IDiscordToken>("DiscordToken", DiscordTokenSchema);
