import { config } from "dotenv";
import { Pool } from "pg";

import { languageSeedCsvPath, readLanguageSeedCsv, upsertLanguageSeedRows } from "./language-seed.js";

config({ path: new URL("../../../.env", import.meta.url) });

const databaseUrl = process.env.DATABASE_URL;
const inputPath = process.env.LANGUAGE_SEED_CSV_PATH ?? languageSeedCsvPath;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});

try {
  const result = await readLanguageSeedCsv(inputPath);

  if (result.errors.length > 0) {
    throw new Error(`Language seed CSV is invalid:\n${result.errors.join("\n")}`);
  }

  const client = await pool.connect();

  try {
    const importedCount = await upsertLanguageSeedRows(client, result.rows);
    console.log({
      inputPath,
      importedCount,
      rowsWithDescriptions: result.rows.filter((row) => row.shortDescription).length
    });
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
