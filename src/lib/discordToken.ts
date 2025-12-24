import { DiscordToken } from "../models/DiscordToken";
import { encrypt, decrypt } from "./crypto";

export async function saveDiscordTokens({
  userId,
  accessToken,
  refreshToken,
  expiresAt,
  scope,
  tokenType,
}: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
  tokenType?: string;
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
  ).exec();
}

export async function getDiscordTokens(userId: string) {
  const doc = await DiscordToken.findOne({ userId }).lean().exec();
  if (!doc) return null;

  return {
    accessToken: decrypt(doc.accessToken),
    refreshToken: decrypt(doc.refreshToken),
    expiresAt: doc.expiresAt,
    scope: doc.scope,
    tokenType: doc.tokenType,
  };
}
