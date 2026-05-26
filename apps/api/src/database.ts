import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool } from "pg";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

/** Creates the API database pool from environment so adapters do not own process config. */
export function createDatabasePool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set in .env or the environment");
  }

  return new Pool({
    connectionString: databaseUrl
  });
}
