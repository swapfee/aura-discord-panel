// scripts/create-indexes.js
// Usage:
//   BOT_MONGO_URL="mongodb://..." node scripts/create-indexes.js
// or (Railway):
//   railway run node scripts/create-indexes.js
// (If using railway run and the project has BOT_MONGO_URL env set, it's picked up automatically)

const mongoose = require("mongoose");

async function main() {
  const mongoUrl = process.env.BOT_MONGO_URL;
  if (!mongoUrl) {
    console.error("ERROR: BOT_MONGO_URL environment variable is required.");
    process.exit(1);
  }

  console.log("Connecting to", mongoUrl);
  const conn = await mongoose.createConnection(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  async function createIndex(collectionName, indexSpec, opts = {}) {
    try {
      const coll = conn.collection(collectionName);
      console.log(`Creating index on ${collectionName}:`, indexSpec, opts);
      const name = await coll.createIndex(indexSpec, opts);
      console.log(`  -> Index created: ${name}`);
      const indexes = await coll.indexes();
      console.log(`  -> Current indexes for ${collectionName}:`, indexes);
    } catch (err) {
      console.error(`Failed to create index on ${collectionName}:`, err);
    }
  }

  await createIndex("songplays", { guildId: 1, playedAt: -1 }, { background: true });
  await createIndex("voicesessions", { guildId: 1, joinedAt: 1, leftAt: 1 }, { background: true });
  await createIndex("queues", { guildId: 1 }, { background: true });

  // Close
  await conn.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
