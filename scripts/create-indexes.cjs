// scripts/create-indexes.cjs
const mongoose = require("mongoose");

function keyEquals(a, b) {
  // simple deep compare for index key objects (stable key ordering in Mongo)
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

async function ensureIndex(conn, collectionName, indexSpec, opts = {}) {
  const coll = conn.collection(collectionName);
  const existing = await coll.indexes();

  // find index with identical key
  const found = existing.find(i => keyEquals(i.key, indexSpec));

  if (found) {
    console.log(`Index for ${collectionName} with key ${JSON.stringify(indexSpec)} already exists:`, found.name);
    // If options differ, print a warning but do not try to recreate automatically
    const wantUnique = !!opts.unique;
    const isUnique = !!found.unique;
    if (wantUnique !== isUnique) {
      console.warn(
        `  -> Option mismatch for ${collectionName}.${found.name}: existing unique=${isUnique}, requested unique=${wantUnique}.` +
        ` Skipping creation to avoid conflict. If you want to change it, drop the existing index and re-run.`
      );
    }
    return;
  }

  // If no index with same key exists, create it
  try {
    console.log(`Creating index on ${collectionName}:`, indexSpec, opts);
    const name = await coll.createIndex(indexSpec, opts);
    console.log(`  -> Index created: ${name}`);
  } catch (err) {
    // handle IndexKeySpecsConflict gracefully
    if (err && err.codeName === "IndexKeySpecsConflict") {
      console.warn(`Index conflict for ${collectionName} ${JSON.stringify(indexSpec)}: ${err.errmsg}`);
    } else {
      console.error(`Failed to create index on ${collectionName}:`, err);
    }
  }
}

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

  // ensure indexes (background:true is safe)
  await ensureIndex(conn, "songplays", { guildId: 1, playedAt: -1 }, { background: true });
  await ensureIndex(conn, "voicesessions", { guildId: 1, joinedAt: 1, leftAt: 1 }, { background: true });
  await ensureIndex(conn, "queues", { guildId: 1 }, { background: true });

  await conn.close();
  console.log("Done");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
