import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createDatabasePool } from "./database.js";
import { buildServer } from "./app.js";
import { PostgresGraphRepository } from "./postgres-graph-repository.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const defaultStaticAssetsDir = fileURLToPath(new URL("../../web/dist", import.meta.url));

/** Enables built web asset serving only when production assets are available. */
function resolveStaticAssetsDir(): string | undefined {
  if (process.env.STATIC_ASSETS_DIR) {
    return process.env.STATIC_ASSETS_DIR;
  }

  if (process.env.NODE_ENV === "production" && existsSync(defaultStaticAssetsDir)) {
    return defaultStaticAssetsDir;
  }

  return undefined;
}

const pool = createDatabasePool();
const graphRepository = new PostgresGraphRepository(pool);
const server = buildServer({
  graphRepository,
  staticAssetsDir: resolveStaticAssetsDir()
});

/** Stops HTTP and database resources together during local development restarts. */
async function shutdown(): Promise<void> {
  await server.close();
  await pool.end();
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

try {
  await server.listen({ host, port });
} catch (error) {
  server.log.error(error);
  await pool.end();
  process.exit(1);
}
