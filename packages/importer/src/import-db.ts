import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool } from "pg";

import type { GraphEdge, GraphNode, LexicalEntry } from "@etymology-graph/graph";

import { upsertGraphBatch } from "./postgres.js";
import { previewEntry, processJsonlInBatches } from "./wiktextract.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const inputPath = process.env.IMPORT_INPUT_PATH ?? "../../wikidata_downloads/seeds/core-seed.jsonl";
const checkpointPath = process.env.IMPORT_CHECKPOINT_PATH ?? "../../wikidata_downloads/checkpoints/import-db.json";
const batchSize = Number(process.env.IMPORT_BATCH_SIZE ?? 100);
const limitRecords = process.env.IMPORT_LIMIT_RECORDS ? Number(process.env.IMPORT_LIMIT_RECORDS) : undefined;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});

let importedRecords = 0;
let importedNodes = 0;
let importedEdges = 0;
let importedLexicalEntries = 0;

try {
  const checkpoint = await processJsonlInBatches({
    inputPath,
    checkpointPath,
    batchSize,
    limitRecords,
    async onBatch(batch) {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const lexicalEntries: LexicalEntry[] = [];

      for (const record of batch.records) {
        const preview = previewEntry(record.entry, {
          lineNumber: record.lineNumber,
          byteOffset: record.byteOffset
        });
        nodes.push(...preview.nodes);
        edges.push(...preview.edges);
        lexicalEntries.push(...preview.lexicalEntries);
      }

      const client = await pool.connect();
      try {
        const result = await upsertGraphBatch(client, { nodes, edges, lexicalEntries });
        importedRecords += batch.records.length;
        importedNodes += result.nodeCount;
        importedEdges += result.edgeCount;
        importedLexicalEntries += result.lexicalEntryCount;
      } finally {
        client.release();
      }

      console.log({
        batchStartLine: batch.startLineNumber,
        batchEndLine: batch.endLineNumber,
        batchRecords: batch.records.length,
        importedNodes,
        importedEdges,
        importedLexicalEntries,
        nextByteOffset: batch.nextByteOffset
      });
    }
  });

  console.log({
    inputPath,
    checkpointPath,
    importedRecords,
    importedNodes,
    importedEdges,
    importedLexicalEntries,
    checkpoint
  });
} finally {
  await pool.end();
}
