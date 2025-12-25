import mongoose from "mongoose";

export const VoiceSessionSchema = new mongoose.Schema(
  {
    // Discord context
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    channelId: {
      type: String,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    // Voice lifecycle
    joinedAt: {
      type: Date,
      required: true,
      index: true,
    },

    leftAt: {
      type: Date,
      default: null, // null = still connected
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// ✅ Register on a specific connection (BOT DB)
export function registerVoiceSession(conn) {
  return (
    conn.models.VoiceSession ||
    conn.model("VoiceSession", VoiceSessionSchema)
  );
}
