// scripts/check-queue-tracks.cjs
// Usage:
//   BOT_MONGO_URL="mongodb+srv://USER:PASS@cluster/mydb" node scripts/check-queue-tracks.cjs <guildId>

const { MongoClient } = require("mongodb");

async function main() {
  const uri = process.env.BOT_MONGO_URL;
  const guildId = process.argv[2];
  if (!uri) {
    console.error("ERROR: BOT_MONGO_URL environment variable is required.");
    process.exit(1);
  }
  if (!guildId) {
    console.error("Usage: node scripts/check-queue-tracks.cjs <guildId>");
    process.exit(1);
  }

  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await client.connect();
    const db = client.db(); // uses DB from connection string
    const q = await db.collection("queues").findOne({ guildId });

    console.log("=== queue doc ===");
    console.log(JSON.stringify(q, null, 2));

    if (q && Array.isArray(q.tracks) && q.tracks.length > 0) {
      console.log("\n=== track list ===");
      q.tracks.forEach((t, i) => {
        const title = t.title ?? (t.info && t.info.title) ?? "(no title)";
        const artist = t.artist ?? (t.info && t.info.author) ?? "";
        const url = t.url ?? (t.info && t.info.uri) ?? "";
        console.log(`${i + 1}. ${title} — ${artist}${url ? " | " + url : ""}`);
      });
    } else {
      console.log(
        "\nNo tracks array found for this guild (or tracks is empty)."
      );
    }
  } catch (err) {
    console.error("Fatal error:", err);
    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch {}
  }
}

main();
