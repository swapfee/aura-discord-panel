const { MongoClient } = require("mongodb");

async function main() {
  const uri = process.env.BOT_MONGO_URL;
  const guildId = process.argv[2];
  if (!uri) throw new Error("BOT_MONGO_URL missing");
  if (!guildId)
    throw new Error("usage: node scripts/check-queue-tracks.js <guildId>");

  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db(); // default database in connection string
  const q = await db.collection("queues").findOne({ guildId });
  console.log("queue doc:\n", JSON.stringify(q, null, 2));
  if (q && Array.isArray(q.tracks)) {
    console.log("\ntrack titles:");
    q.tracks.forEach((t, i) => {
      console.log(
        i + 1,
        "-",
        t.title ?? t.name ?? "(no title)",
        "|",
        t.artist ?? t.author ?? ""
      );
    });
  } else {
    console.log("\nNo tracks array found for this guild");
  }
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
