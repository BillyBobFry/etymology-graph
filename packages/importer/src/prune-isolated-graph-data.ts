import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool } from "pg";

import { pruneIsolatedGraphData } from "./postgres.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const databaseUrl = process.env.DATABASE_URL;
const limitRecords = process.env.IMPORT_LIMIT_RECORDS ? Number(process.env.IMPORT_LIMIT_RECORDS) : undefined;
const pruneOverride = process.env.IMPORT_PRUNE_ISOLATED_GRAPH?.trim().toLowerCase();
const shouldPrune = pruneOverride === undefined ? limitRecords === undefined : pruneOverride === "true";

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});

try {
  if (!shouldPrune) {
    console.log({
      skippedIsolatedGraphPrune: true,
      reason: "IMPORT_LIMIT_RECORDS is set; use IMPORT_PRUNE_ISOLATED_GRAPH=true to prune anyway"
    });
  } else {
    const client = await pool.connect();

    try {
      const result = await pruneIsolatedGraphData(client);

      console.log({
        prunedIsolatedGraphData: true,
        deletedTermEmbeddings: result.embeddingCount,
        deletedLexicalEntries: result.lexicalEntryCount,
        deletedGraphNodes: result.nodeCount,
        deletedSourceLanguageLayerMatches: result.sourceLanguageLayerMatchCount
      });
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
