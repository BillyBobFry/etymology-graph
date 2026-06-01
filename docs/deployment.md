# Deployment

The first production shape is one app container plus managed Postgres:

- a Postgres 16 database
- the Fastify API in `apps/api`, serving `/api/*`
- the static Vue app built from `apps/web`, served by the same Fastify process

Keep Wiktextract extraction and graph imports out of app startup. Treat them as release or admin jobs that populate the deployed database before the API serves traffic.

## Environment

Required for the API:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/etymology_graph
PORT=3000
HOST=0.0.0.0
```

Optional for split frontend/API hosting:

```bash
CORS_ORIGIN=https://etymology.example.com
VITE_API_BASE_URL=https://api.etymology.example.com
STATIC_ASSETS_DIR=/absolute/path/to/apps/web/dist
```

Leave `VITE_API_BASE_URL` blank when the web app and API share an origin. The Dockerfile builds that default shape, so browser requests use same-origin `/api` and no CORS setting is needed. Set `CORS_ORIGIN` only when browsers will call the API from another origin. Multiple origins can be comma-separated.

`STATIC_ASSETS_DIR` is optional. In production, the API automatically serves `apps/web/dist` when that directory exists beside the built API output. Set it only when running the API against a custom static asset path.

## Railway

Use Railway as one web service plus one Railway Postgres service:

1. Create a Railway project from the GitHub repo.
2. Add a Postgres service.
3. Add an app service that builds from the root `Dockerfile`.
4. Set `DATABASE_URL` on the app service from the Railway Postgres connection string.
5. Leave `VITE_API_BASE_URL` and `CORS_ORIGIN` unset for the first deploy.

Railway provides `PORT`; the image sets `HOST=0.0.0.0`. The container builds the graph package, API, and web app, then runs `node apps/api/dist/server.js`. Fastify serves API routes under `/api` and falls back to `apps/web/dist/index.html` for Vue router routes.

Run migrations and imports as an explicit admin step after the database exists. Do not make the web service import data on every boot.

## Database Bootstrap

Apply every numbered migration in order against the production database:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_graph.sql
psql "$DATABASE_URL" -f db/migrations/002_languages.sql
psql "$DATABASE_URL" -f db/migrations/003_lexical_entries.sql
psql "$DATABASE_URL" -f db/migrations/004_edge_entry_attribution.sql
psql "$DATABASE_URL" -f db/migrations/005_traversal_query_indexes.sql
```

Then load language names and the selected seed graph:

```bash
pnpm seed:languages
pnpm seed:extract:popular
pnpm import:batch-preview:popular
pnpm import:db:popular
```

For a more connected graph, replace the last three commands with:

```bash
pnpm seed:extract:prod
pnpm import:batch-preview:prod
pnpm import:db:prod
```

Record the chosen seed command and checkpoint path for each deploy. The raw Wiktextract dump remains local/generated input and should not be copied into app images or static bundles.

## Build Commands

For local production verification without Docker, build the shared graph package before the API or web app:

```bash
pnpm --filter @etymology-graph/graph build
pnpm --filter @etymology-graph/api build
pnpm --filter @etymology-graph/web build
```

Start the API after building:

```bash
NODE_ENV=production pnpm --filter @etymology-graph/api start
```

When `NODE_ENV=production`, the API serves `apps/web/dist` if the directory exists.

## App Container

The root Dockerfile builds and serves the API and web app from one container:

```bash
docker build -t etymology-graph .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  etymology-graph
```

For managed platforms, set `HOST=0.0.0.0`, `PORT` to the platform-provided port when required, and `DATABASE_URL` to the managed Postgres connection string.

## VPS Later

The same image can run on a VPS. Use managed Postgres if possible, or run Postgres as a separate service in Docker Compose. Keep database storage outside the app container and keep migrations/imports as explicit commands or one-off jobs.

## Smoke Checks

After deploy, verify:

```bash
curl "$API_ORIGIN/api/health"
curl "$API_ORIGIN/api/languages"
curl "$API_ORIGIN/api/search?q=bread&langCode=en"
curl "$API_ORIGIN/api/ancestors?langCode=en&word=bread&maxDepth=3"
```

Also open the web app and check one search, one ancestor graph, one child-term panel, and one doublet search against the deployed API.
