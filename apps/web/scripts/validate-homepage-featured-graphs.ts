import {
  ancestorsResultSchema,
  doubletsResultSchema,
  type AncestorsResult,
  type DoubletsResult,
  type EtymologyGraph
} from "@etymology-graph/graph";

import {
  featuredDoubletExamples,
  featuredEtymologyExamples
} from "../src/views/homeFeaturedExamples.ts";

type ValidationFailure = {
  label: string;
  message: string;
};

type TimedPayload = {
  elapsedMs: number;
  payload: unknown;
};

const maximumFetchAttempts = 20;
const retryDelayMs = 500;
const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const maximumResponseMs = readPositiveIntegerEnv("HOMEPAGE_FEATURED_MAX_MS", 2_000);
const maximumGraphNodes = readPositiveIntegerEnv("HOMEPAGE_FEATURED_MAX_NODES", 40);
const maximumGraphEdges = readPositiveIntegerEnv("HOMEPAGE_FEATURED_MAX_EDGES", 50);

const failures: ValidationFailure[] = [];

for (const example of featuredEtymologyExamples) {
  const label = `ancestor ${example.query.langCode}:${example.query.word}`;
  const result = await validateAncestorExample(label, example.query);
  failures.push(...result);
}

for (const example of featuredDoubletExamples) {
  const label = `doublet ${example.query.langCode}:${example.query.word}`;
  const result = await validateDoubletExample(label, example.query, example.expectedSameLanguageTerms);
  failures.push(...result);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`${failure.label}: ${failure.message}`);
  }

  process.exitCode = 1;
} else {
  console.log("All homepage featured graph examples validated.");
}

/** Reads bounded validator thresholds from environment variables so local datasets can tune strictness. */
function readPositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

/** Validates that a homepage ancestor example resolves quickly to a compact graph. */
async function validateAncestorExample(
  label: string,
  query: { langCode: string; word: string; maxDepth: number }
): Promise<ValidationFailure[]> {
  const url = buildGraphUrl("/api/ancestors", {
    langCode: query.langCode,
    word: query.word,
    maxDepth: String(query.maxDepth)
  });
  const { elapsedMs, payload } = await fetchTimedPayload(url);
  const parsedPayload = ancestorsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return [{ label, message: "response did not match the ancestor graph schema" }];
  }

  return validateGraphShape(label, elapsedMs, parsedPayload.data);
}

/** Validates that a homepage doublet example resolves to its advertised same-language terms. */
async function validateDoubletExample(
  label: string,
  query: { langCode: string; word: string; maxDepth: number; limit: number },
  expectedSameLanguageTerms: readonly string[]
): Promise<ValidationFailure[]> {
  const url = buildGraphUrl("/api/doublets", {
    langCode: query.langCode,
    word: query.word,
    maxDepth: String(query.maxDepth),
    limit: String(query.limit)
  });
  const { elapsedMs, payload } = await fetchTimedPayload(url);
  const parsedPayload = doubletsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return [{ label, message: "response did not match the doublet graph schema" }];
  }

  const graphFailures = validateGraphShape(label, elapsedMs, parsedPayload.data);
  const graph = parsedPayload.data.graph;

  if (!graph) {
    return graphFailures;
  }

  const sameLanguageTerms = new Set(
    graph.nodes.filter((node) => node.langCode === query.langCode).map((node) => node.word)
  );
  const missingTerms = expectedSameLanguageTerms.filter((term) => !sameLanguageTerms.has(term));

  if (missingTerms.length > 0) {
    graphFailures.push({
      label,
      message: `missing expected same-language terms: ${missingTerms.join(", ")}`
    });
  }

  return graphFailures;
}

/** Builds an API URL with stable query parameter serialization. */
function buildGraphUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(path, apiBaseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

/** Fetches a JSON payload while recording wall-clock latency. */
async function fetchTimedPayload(url: URL): Promise<TimedPayload> {
  let lastFailureMessage = "request did not complete";

  for (let attempt = 1; attempt <= maximumFetchAttempts; attempt += 1) {
    try {
      const startedAt = performance.now();
      const response = await fetch(url);
      const elapsedMs = performance.now() - startedAt;

      if (!response.ok) {
        lastFailureMessage = `${url.toString()} failed with status ${response.status}`;
      } else {
        const payload: unknown = await response.json();

        return { elapsedMs, payload };
      }
    } catch (error) {
      lastFailureMessage = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maximumFetchAttempts) {
      await sleep(retryDelayMs);
    }
  }

  throw new Error(lastFailureMessage);
}

/** Waits briefly between retries when a dev server is restarting. */
async function sleep(durationMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

/** Applies homepage-specific graph existence, speed, and payload-size checks. */
function validateGraphShape(
  label: string,
  elapsedMs: number,
  result: AncestorsResult | DoubletsResult
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const graph = result.graph;

  if (!graph) {
    return [{ label, message: "API returned no graph" }];
  }

  failures.push(...validateGraphSize(label, graph));

  if (elapsedMs > maximumResponseMs) {
    failures.push({
      label,
      message: `response took ${Math.round(elapsedMs)}ms, above ${maximumResponseMs}ms`
    });
  }

  console.log(
    `${label}: ${Math.round(elapsedMs)}ms, ${graph.nodes.length} nodes, ${graph.edges.length} edges`
  );

  return failures;
}

/** Keeps featured homepage graphs small enough to render comfortably in a marketing section. */
function validateGraphSize(label: string, graph: EtymologyGraph): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (graph.nodes.length === 0 || graph.edges.length === 0) {
    failures.push({ label, message: "graph must include at least one node and edge" });
  }

  if (graph.nodes.length > maximumGraphNodes) {
    failures.push({
      label,
      message: `graph has ${graph.nodes.length} nodes, above ${maximumGraphNodes}`
    });
  }

  if (graph.edges.length > maximumGraphEdges) {
    failures.push({
      label,
      message: `graph has ${graph.edges.length} edges, above ${maximumGraphEdges}`
    });
  }

  return failures;
}
