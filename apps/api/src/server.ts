import { createDatabasePool } from "./database.js";
import { buildServer } from "./app.js";
import { PostgresGraphRepository } from "./postgres-graph-repository.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const pool = createDatabasePool();
const graphRepository = new PostgresGraphRepository(pool);
const server = buildServer({ graphRepository });

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
