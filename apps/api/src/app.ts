import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import { EDGE_TYPES } from "@etymology-graph/graph";

import type { GraphRepository } from "./graph-repository.js";

const ancestorsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(6)
});

const childTermsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const doubletsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(6),
  limit: z.coerce.number().int().min(1).max(50).default(18)
});

const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
  langCode: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

export type BuildServerOptions = {
  graphRepository: GraphRepository;
};

/** Builds the HTTP API around graph use cases so handlers stay database-agnostic. */
export function buildServer({ graphRepository }: BuildServerOptions): FastifyInstance {
  const server = Fastify({
    logger: true
  });

  server.get("/api/health", async () => ({
    ok: true,
    service: "etymology-graph-api"
  }));

  server.get("/api/edge-types", async () => ({
    edgeTypes: EDGE_TYPES
  }));

  server.get("/api/languages", async () => graphRepository.listLanguages());

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

  return server;
}
