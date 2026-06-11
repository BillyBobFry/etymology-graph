import cors from "@fastify/cors";
import compress from "@fastify/compress";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  comparisonSetQuerySchema,
  DEFAULT_ANCESTOR_MAX_DEPTH,
  descendantsQuerySchema,
  EDGE_TYPES,
  similarTermsQuerySchema,
  sourceLanguageLayersQuerySchema
} from "@etymology-graph/graph";

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

const languageParamsSchema = z.object({
  langCode: z.string().trim().min(1)
});

const languageTermsQuerySchema = z.object({
  query: z.string().trim().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  connectedOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  cursor: z.string().trim().regex(/^\d+$/).optional()
});

const childTermsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  ...entryAnchorShape
});

const terminalLangCodesHttpSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const terminalLangCodes = (Array.isArray(value) ? value : [value])
      .flatMap((rawValue) => rawValue.split(","))
      .map((langCode) => langCode.trim())
      .filter((langCode) => langCode.length > 0);

    return Array.from(new Set(terminalLangCodes));
  });

const descendantsHttpQuerySchema = descendantsQuerySchema.extend({
  maxDepth: z.coerce.number().int().min(1).max(12).default(8),
  limit: z.coerce.number().int().min(1).max(300).default(120),
  terminalLangCodes: terminalLangCodesHttpSchema,
  etymologyNumber: z.coerce.number().int().min(0).optional()
});

const doubletsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH),
  limit: z.coerce.number().int().min(1).max(50).default(18),
  ...entryAnchorShape
});

const cognatesQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  ...entryAnchorShape
});

const doubletGroupsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH),
  limit: z.coerce.number().int().min(1).max(5).default(5),
  entryLimit: z.coerce.number().int().min(2).max(25).default(12),
  cursor: z.string().trim().regex(/^\d+:.+$/).optional()
});

const searchLanguageCodesSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const rawValues = Array.isArray(value) ? value : [value];
    const languageCodes = rawValues
      .flatMap((rawValue) => rawValue.split(","))
      .map((languageCode) => languageCode.trim())
      .filter((languageCode) => languageCode.length > 0);

    return Array.from(new Set(languageCodes));
  });

const searchQuerySchema = z
  .object({
    q: z.string().trim().default(""),
    langCode: z.string().trim().min(1).optional(),
    langCodes: searchLanguageCodesSchema,
    hasAncestors: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    limit: z.coerce.number().int().min(1).max(50).default(12)
  })
  .superRefine((query, context) => {
    if (query.langCode && query.langCodes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["langCodes"],
        message: "Use either langCode or langCodes, not both"
      });
    }

    if (query.langCodes && query.langCodes.length > 50) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["langCodes"],
        message: "Search may include at most 50 language codes"
      });
    }
  });

const similarTermsHttpQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(24).default(6)
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

const sourceLanguageLayersHttpQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  maxDepth: z.coerce.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH)
});

const REFERENCE_DATA_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const INTERNAL_SERVER_ERROR_RESPONSE = {
  error: "Internal server error"
};

type HttpError = Error & {
  status?: number;
  statusCode?: number;
};

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

/** Normalizes thrown values so error responses never need to expose raw internals. */
function errorMessageForResponse(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

/** Preserves intentional HTTP failures while treating unknown errors as server faults. */
function statusCodeForError(error: unknown): number {
  if (!(error instanceof Error)) {
    return 500;
  }

  const httpError = error as HttpError;
  const statusCode = httpError.statusCode ?? httpError.status;

  if (typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }

  return 500;
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

  server.setErrorHandler((error, request, reply) => {
    const statusCode = statusCodeForError(error);

    request.log.error({ err: error }, "Request failed");

    if (statusCode >= 500) {
      return reply.code(statusCode).send(INTERNAL_SERVER_ERROR_RESPONSE);
    }

    return reply.code(statusCode).send({
      error: errorMessageForResponse(error)
    });
  });

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

  server.get("/api/languages/:langCode", async (request, reply) => {
    const parsedParams = languageParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        error: "Invalid language params",
        issues: parsedParams.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const language = await graphRepository.findLanguage(parsedParams.data.langCode);

    if (!language) {
      return reply.code(404).send({
        error: "Language not found"
      });
    }

    const payload = JSON.stringify(language);
    const etag = etagForPayload(payload);

    reply.header("Cache-Control", REFERENCE_DATA_CACHE_CONTROL).header("ETag", etag).type("application/json");

    if (ifNoneMatchIncludes(request.headers["if-none-match"], etag)) {
      return reply.code(304).send();
    }

    return reply.send(payload);
  });

  server.get("/api/languages/:langCode/terms", async (request, reply) => {
    const parsedParams = languageParamsSchema.safeParse(request.params);
    const parsedQuery = languageTermsQuerySchema.safeParse(request.query);

    if (!parsedParams.success || !parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid language terms request",
        issues: [
          ...(parsedParams.success
            ? []
            : parsedParams.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message
              }))),
          ...(parsedQuery.success
            ? []
            : parsedQuery.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message
              })))
        ]
      });
    }

    const result = await graphRepository.findLanguageTerms({
      langCode: parsedParams.data.langCode,
      ...parsedQuery.data
    });

    if (!result) {
      return reply.code(404).send({
        error: "Language not found"
      });
    }

    return result;
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
      langCodes: parsedQuery.data.langCodes,
      hasAncestors: parsedQuery.data.hasAncestors,
      limit: parsedQuery.data.limit
    });
  });

  server.get("/api/similar-terms", async (request, reply) => {
    const parsedQuery = similarTermsHttpQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid similar terms query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findSimilarTerms(similarTermsQuerySchema.parse(parsedQuery.data));
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

  server.get("/api/descendants", async (request, reply) => {
    const parsedQuery = descendantsHttpQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid descendants query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findDescendants(parsedQuery.data);
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

  server.get("/api/cognates", async (request, reply) => {
    const parsedQuery = cognatesQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid cognates query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.findCognates(parsedQuery.data);
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

  server.get("/api/source-language-layers", async (request, reply) => {
    const parsedQuery = sourceLanguageLayersHttpQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid source language layers query",
        issues: parsedQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return graphRepository.listSourceLanguageLayers(sourceLanguageLayersQuerySchema.parse(parsedQuery.data));
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
