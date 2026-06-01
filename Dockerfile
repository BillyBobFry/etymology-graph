# syntax=docker/dockerfile:1

FROM node:26-alpine AS build

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.19.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/graph/package.json packages/graph/package.json
RUN pnpm install --frozen-lockfile --filter @etymology-graph/api... --filter @etymology-graph/web...

COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/graph packages/graph
RUN pnpm --filter @etymology-graph/graph build \
  && pnpm --filter @etymology-graph/api build \
  && pnpm --filter @etymology-graph/web build

FROM node:26-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.19.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
COPY apps/api/package.json apps/api/package.json
COPY packages/graph/package.json packages/graph/package.json
RUN pnpm install --prod --frozen-lockfile --filter @etymology-graph/api...

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/packages/graph/dist packages/graph/dist

EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
