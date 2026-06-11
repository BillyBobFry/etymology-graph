import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool, type PoolConfig } from "pg";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

/** Keeps empty env-file values from winning over node-postgres defaults. */
const optionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();

  return value && value.length > 0 ? value : undefined;
};

/** Parses the optional PGPORT value once so connection failures are not mysterious. */
const resolveDatabasePort = (): number | undefined => {
  const rawPort = optionalEnv("PGPORT");

  if (!rawPort) {
    return undefined;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PGPORT must be a positive integer");
  }

  return port;
};

/** Builds a pool config from discrete PG env vars so passwords do not need URL encoding. */
const createDiscreteDatabaseConfig = (): PoolConfig | undefined => {
  const host = optionalEnv("PGHOST");
  const database = optionalEnv("PGDATABASE") ?? optionalEnv("POSTGRES_DB");
  const user = optionalEnv("PGUSER") ?? optionalEnv("POSTGRES_USER");
  const password = optionalEnv("PGPASSWORD") ?? optionalEnv("POSTGRES_PASSWORD");

  if (!host && !database && !user && !password) {
    return undefined;
  }

  return {
    host,
    port: resolveDatabasePort(),
    database,
    user,
    password
  };
};

/** Creates the API database pool from environment so adapters do not own process config. */
export function createDatabasePool(): Pool {
  const databaseUrl = optionalEnv("DATABASE_URL");

  if (databaseUrl) {
    return new Pool({
      connectionString: databaseUrl
    });
  }

  const discreteConfig = createDiscreteDatabaseConfig();

  if (!discreteConfig) {
    throw new Error("DATABASE_URL must be set in .env or the environment");
  }

  return new Pool(discreteConfig);
}
