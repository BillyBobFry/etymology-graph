import cors from "@fastify/cors";
import compress from "@fastify/compress";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";

import { comparisonSetQuerySchema, DEFAULT_ANCESTOR_MAX_DEPTH, EDGE_TYPES } from "@etymology-graph/graph";

import type { GraphRepository } from "./graph-repository.js";

const entryAnchorShape = {
  pos: z.string().trim().min(1).optional(),
  etymologyNumber: z.coerce.number().int().min(0).optional()
};

const ancestorsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH),
  ...entryAnchorShape
});

const ancestorPathQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  ancestorLangCode: z.string().trim().min(1),
  ancestorWord: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH),
  ...entryAnchorShape
});

const childTermsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  ...entryAnchorShape
});

const doubletsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH),
  limit: z.coerce.number().int().min(1).max(50).default(18),
  ...entryAnchorShape
});

const doubletGroupsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  entryLimit: z.coerce.number().int().min(2).max(25).default(12),
  cursor: z.string().trim().regex(/^\d+:.+$/).optional()
});

const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
  langCode: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

const termEntriesQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1)
});

const termsWithAncestorLanguageQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  ancestorLangCode: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).optional()
});

const REFERENCE_DATA_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

/** Builds a strong validator for reference payloads that change only after imports. */
function etagForPayload(payload: string): string {
  return `"${createHash("sha256").update(payload).digest("base64url")}"`;
}

/** Checks browser validators so unchanged reference data can return a tiny 304. */
function ifNoneMatchIncludes(
  header: string | string[] | undefined,
  etag: string
): boolean {
  const candidates = Array.isArray(header)
    ? header.flatMap((value) => value.split(","))
    : header?.split(",") ?? [];

  return candidates.some((candidate) => {
    const normalizedCandidate = candidate.trim();

    return normalizedCandidate === etag || normalizedCandidate === "*";
  });
}

/** Reads optional browser origins for split frontend/API deployments. */
function resolveCorsOrigins(): string[] | undefined {
  const rawOriginList = process.env.CORS_ORIGIN?.trim();

  if (!rawOriginList) {
    return undefined;
  }

  const origins = rawOriginList
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : undefined;
}

export type BuildServerOptions = {
  graphRepository: GraphRepository;
  staticAssetsDir?: string;
};

/** Builds the HTTP API around graph use cases so handlers stay database-agnostic. */
export function buildServer({ graphRepository, staticAssetsDir }: BuildServerOptions): FastifyInstance {
  const server = Fastify({
    logger: true
  });
  const corsOrigins = resolveCorsOrigins();

  server.register(compress);

  if (corsOrigins !== undefined) {
    server.register(cors, {
      origin: corsOrigins
    });
  }

  if (staticAssetsDir !== undefined) {
    server.register(staticFiles, {
      root: staticAssetsDir,
      prefix: "/",
      wildcard: false
    });
  }

  server.get("/api/health", async () => ({
    ok: true,
    service: "etymology-graph-api"
  }));

  server.get("/api/edge-types", async () => ({
    edgeTypes: EDGE_TYPES
  }));

  server.get("/api/languages", async (request, reply) => {
    const payload = JSON.stringify(await graphRepository.listLanguages());
    const etag = etagForPayload(payload);

    reply.header("Cache-Control", REFERENCE_DATA_CACHE_CONTROL).header("ETag", etag).type("application/json");

    if (ifNoneMatchIncludes(request.headers["if-none-match"], etag)) {
      return reply.code(304).send();
    }

    return reply.send(payload);
  });

  server.get("/api/search", async (request, reply) => {
    const parsedQuery = searchQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid search query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.searchTerms({
      query: parsedQuery.data.q,
      langCode: parsedQuery.data.langCode,
      limit: parsedQuery.data.limit
    });
  });

  server.get("/api/ancestors", async (request, reply) => {
    const parsedQuery = ancestorsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid ancestors query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findAncestors(parsedQuery.data);
  });

  server.get("/api/ancestor-path", async (request, reply) => {
    const parsedQuery = ancestorPathQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid ancestor path query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findAncestorPath(parsedQuery.data);
  });

  server.post("/api/comparison-set", async (request, reply) => {
    const parsedBody = comparisonSetQuerySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "Invalid comparison set query",
        issues: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findComparisonSet(parsedBody.data);
  });

  server.get("/api/children", async (request, reply) => {
    const parsedQuery = childTermsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid child terms query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findChildTerms(parsedQuery.data);
  });

  server.get("/api/doublets", async (request, reply) => {
    const parsedQuery = doubletsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid doublets query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findDoublets(parsedQuery.data);
  });

  server.get("/api/doublet-groups", async (request, reply) => {
    const parsedQuery = doubletGroupsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid doublet groups query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findDoubletGroups(parsedQuery.data);
  });

  server.get("/api/term-entries", async (request, reply) => {
    const parsedQuery = termEntriesQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid term entries query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.listTermEntries(parsedQuery.data);
  });

  server.get("/api/terms-with-ancestor-language", async (request, reply) => {
    const parsedQuery = termsWithAncestorLanguageQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid terms with ancestor language query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findTermsWithAncestorLanguage(parsedQuery.data);
  });

  if (staticAssetsDir !== undefined) {
    server.setNotFoundHandler((request, reply) => {
      if (request.url === "/api" || request.url.startsWith("/api/")) {
        return reply.code(404).send({
          error: "API route not found"
        });
      }

      return reply.sendFile("index.html");
    });
  }

  return server;
}
