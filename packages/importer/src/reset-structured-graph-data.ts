import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool } from "pg";

import { refreshGraphEdgeWalkMaterializedView } from "./postgres.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});

type RowCount = {
  table_name: string;
  row_count: string;
};

/** Clears graph import data while preserving durable language metadata and embedding cache rows. */
async function resetStructuredGraphData(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE graph_edges");
    await client.query("TRUNCATE source_language_layer_matches");
    await client.query("DELETE FROM source_language_layer_refreshes");
    await client.query("DELETE FROM lexical_entries");
    await client.query("DELETE FROM graph_nodes");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Prints the tables this script intentionally clears so import resets are easy to verify. */
async function printClearedTableCounts(): Promise<void> {
  const result = await pool.query<RowCount>(`
    SELECT 'graph_edges' AS table_name, count(*) AS row_count FROM graph_edges
    UNION ALL
    SELECT 'source_language_layer_matches', count(*) FROM source_language_layer_matches
    UNION ALL
    SELECT 'source_language_layer_refreshes', count(*) FROM source_language_layer_refreshes
    UNION ALL
    SELECT 'lexical_entries', count(*) FROM lexical_entries
    UNION ALL
    SELECT 'graph_nodes', count(*) FROM graph_nodes
    ORDER BY table_name
  `);

  console.log({
    resetTables: result.rows.map((row) => ({
      tableName: row.table_name,
      rowCount: Number(row.row_count)
    }))
  });
}

try {
  await resetStructuredGraphData();
  await refreshGraphEdgeWalkMaterializedView(pool);
  await printClearedTableCounts();
} finally {
  await pool.end();
}
