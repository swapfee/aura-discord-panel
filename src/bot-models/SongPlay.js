import mongoose from "mongoose";

export const SongPlaySchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  title: String,
  artist: String,
  coverUrl: String,
  playedAt: Date,
});

export function registerSongPlay(conn) {
  return (
    conn.models.SongPlay ||
    conn.model("SongPlay", SongPlaySchema)
  );
}
