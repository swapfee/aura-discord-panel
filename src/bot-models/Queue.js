import mongoose from "mongoose";

const QueueTrackSchema = new mongoose.Schema(
  {
    title: String,
    artist: String,
    url: String,
    durationMs: Number,
    coverUrl: String,
    requestedBy: String, // userId
    source: String, // youtube / spotify / etc
  },
  { _id: false }
);

export const QueueSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    channelId: {
      type: String,
    },

    // Current track (optional)
    nowPlaying: {
      title: String,
      artist: String,
      url: String,
      durationMs: Number,
      coverUrl: String,
      startedAt: Date,
    },

    // Upcoming tracks
    tracks: {
      type: [QueueTrackSchema],
      default: [],
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// ✅ Register on BOT DB connection
export function registerQueue(conn) {
  return (
    conn.models.Queue ||
    conn.model("Queue", QueueSchema)
  );
}
