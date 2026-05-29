import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { finished } from "node:stream/promises";

import type { GraphNode } from "@etymology-graph/graph";

import { loadPopularWordTargets } from "./popular-word-lists.js";
import {
  buildSeedTargetIndex,
  findMatchingSeedTargetIndex,
  parseSeedTargets,
  previewEntry,
  readJsonlRecords,
  seedTargetKey,
  type SeedTarget
} from "./wiktextract.js";

type FrontierStatus = "pending" | "matched" | "not_found";

type FrontierTarget = {
  target: SeedTarget;
  key: string;
  depth: number;
  status: FrontierStatus;
  discoveredBy?: string;
  reason: "initial_seed" | "hub_related_node";
};

type ExpansionPassSummary = {
  pass: number;
  depth: number;
  targetCount: number;
  scannedLines: number;
  matchedTargets: number;
  writtenRecords: number;
  discoveredTargets: number;
};

type ExpansionState = {
  inputPath: string;
  outputPath: string;
  frontierPath: string;
  popularWordsDirs: string[];
  hubLanguageCodes: string[];
  maxExpansionDepth: number;
  maxEnqueuedTargets: number;
  limitRecords?: number;
  targetCount: number;
  statusCounts: Record<FrontierStatus, number>;
  passes: ExpansionPassSummary[];
  targets: FrontierTarget[];
  updatedAt: string;
};

const inputPath = process.env.WIKTEXTRACT_PATH ?? "../../wikidata_downloads/raw-wiktextract-data.jsonl";
const defaultPopularWordsDirs = [
  "../../data/seed-words/thousand-most-common-words",
  "../../data/seed-words/corpora"
];
const popularWordsDirs = parseDelimitedList(process.env.POPULAR_WORDS_DIRS) ?? [
  ...defaultPopularWordsDirs
];
const outputPath = process.env.SEED_OUTPUT_PATH ?? "../../wikidata_downloads/seeds/popular-expanded-seed.jsonl";
const frontierPath =
  process.env.EXPANSION_FRONTIER_PATH ?? "../../wikidata_downloads/checkpoints/popular-expansion-frontier.json";
const hubLanguageCodes = new Set(
  parseDelimitedList(process.env.EXPANSION_HUB_LANG_CODES) ?? [
    "la",
    "grc",
    "sa",
    "ae",
    "ave",
    "ine-pro",
    "iir-pro",
    "ira-pro",
    "gem-pro",
    "gmw-pro",
    "itc-pro",
    "cel-pro",
    "sla-pro"
  ]
);
const maxExpansionDepth = Number(process.env.EXPANSION_MAX_DEPTH ?? 2);
const maxEnqueuedTargets = Number(process.env.EXPANSION_MAX_TARGETS ?? 125_000);
const limitRecords = process.env.EXPANSION_LIMIT_RECORDS ? Number(process.env.EXPANSION_LIMIT_RECORDS) : undefined;

const initialTargets = await loadInitialTargets(popularWordsDirs);
const frontier = new Map<string, FrontierTarget>();
const passes: ExpansionPassSummary[] = [];

for (const target of initialTargets) {
  enqueueTarget(frontier, target, {
    depth: 0,
    reason: "initial_seed"
  });
}

await mkdir(dirname(outputPath), { recursive: true });
const output = createWriteStream(outputPath, { encoding: "utf8", flags: "w" });

try {
  for (let depth = 0; depth <= maxExpansionDepth; depth += 1) {
    const passTargets = [...frontier.values()].filter((frontierTarget) => {
      return frontierTarget.depth === depth && frontierTarget.status === "pending";
    });

    if (passTargets.length === 0) {
      continue;
    }

    const passSummary = await runExpansionPass({
      pass: passes.length,
      depth,
      passTargets,
      frontier,
      output
    });
    passes.push(passSummary);
    await writeExpansionState(frontier, passes);
  }
} finally {
  output.end();
  await finished(output);
}

await writeExpansionState(frontier, passes);

console.log({
  inputPath,
  outputPath,
  frontierPath,
  popularWordsDirs,
  hubLanguageCodes: [...hubLanguageCodes],
  maxExpansionDepth,
  maxEnqueuedTargets,
  limitRecords,
  targetCount: frontier.size,
  statusCounts: countStatuses(frontier),
  passes
});

type EnqueueTargetOptions = {
  depth: number;
  reason: FrontierTarget["reason"];
  discoveredBy?: string;
};

type ExpansionPassOptions = {
  pass: number;
  depth: number;
  passTargets: FrontierTarget[];
  frontier: Map<string, FrontierTarget>;
  output: NodeJS.WritableStream;
};

/** Loads committed seed-word directories into the initial frontier. */
async function loadInitialTargets(directoryPaths: string[]): Promise<SeedTarget[]> {
  const popularTargets = await Promise.all(directoryPaths.map((directoryPath) => loadPopularWordTargets(directoryPath)));
  const targetSpecs = [...new Set(popularTargets.flatMap((result) => result.targetSpecs))];

  return parseSeedTargets(targetSpecs.join(","));
}

/** Streams Wiktextract once for one frontier depth and discovers hub-language targets for the next pass. */
async function runExpansionPass(options: ExpansionPassOptions): Promise<ExpansionPassSummary> {
  const targets = options.passTargets.map((frontierTarget) => frontierTarget.target);
  const targetKeys = options.passTargets.map((frontierTarget) => frontierTarget.key);
  const targetIndex = buildSeedTargetIndex(targets);
  const matchedTargetKeys = new Set<string>();
  let scannedLines = 0;
  let writtenRecords = 0;
  let discoveredTargets = 0;
  let recordsThisPass = 0;
  let reachedRecordLimit = false;

  for await (const record of readJsonlRecords(inputPath)) {
    if (limitRecords !== undefined && recordsThisPass >= limitRecords) {
      reachedRecordLimit = true;
      break;
    }

    scannedLines = record.lineNumber;
    recordsThisPass += 1;

    const targetIndexMatch = findMatchingSeedTargetIndex(targetIndex, record.entry);
    if (targetIndexMatch === undefined) {
      continue;
    }

    const matchedKey = targetKeys[targetIndexMatch];
    if (!matchedKey || matchedTargetKeys.has(matchedKey)) {
      continue;
    }

    const frontierTarget = options.frontier.get(matchedKey);
    if (!frontierTarget) {
      continue;
    }

    await writeJsonlLine(options.output, record.rawLine);
    frontierTarget.status = "matched";
    matchedTargetKeys.add(matchedKey);
    writtenRecords += 1;

    if (options.depth < maxExpansionDepth) {
      const preview = previewEntry(record.entry, {
        lineNumber: record.lineNumber,
        byteOffset: record.byteOffset
      });
      discoveredTargets += enqueueHubTargets(options.frontier, preview.nodes, frontierTarget);
    }
  }

  for (const frontierTarget of options.passTargets) {
    if (frontierTarget.status === "pending" && !reachedRecordLimit) {
      frontierTarget.status = "not_found";
    }
  }

  return {
    pass: options.pass,
    depth: options.depth,
    targetCount: options.passTargets.length,
    scannedLines,
    matchedTargets: matchedTargetKeys.size,
    writtenRecords,
    discoveredTargets
  };
}

/** Adds hub-language nodes discovered from structured graph extraction to the frontier. */
function enqueueHubTargets(
  frontier: Map<string, FrontierTarget>,
  nodes: GraphNode[],
  discoveredBy: FrontierTarget
): number {
  let enqueuedCount = 0;

  for (const node of nodes) {
    if (!hubLanguageCodes.has(node.langCode)) {
      continue;
    }

    const enqueued = enqueueTarget(frontier, { langCode: node.langCode, word: node.word }, {
      depth: discoveredBy.depth + 1,
      reason: "hub_related_node",
      discoveredBy: discoveredBy.key
    });

    if (enqueued) {
      enqueuedCount += 1;
    }
  }

  return enqueuedCount;
}

/** Adds a target once, respecting the global cap for expansion runs. */
function enqueueTarget(
  frontier: Map<string, FrontierTarget>,
  target: SeedTarget,
  options: EnqueueTargetOptions
): boolean {
  const key = seedTargetKey(target);

  if (frontier.has(key) || frontier.size >= maxEnqueuedTargets) {
    return false;
  }

  frontier.set(key, {
    target,
    key,
    depth: options.depth,
    status: "pending",
    reason: options.reason,
    discoveredBy: options.discoveredBy
  });

  return true;
}

/** Writes one JSONL record while respecting stream backpressure. */
async function writeJsonlLine(output: NodeJS.WritableStream, rawLine: string): Promise<void> {
  if (!output.write(`${rawLine}\n`)) {
    await new Promise<void>((resolve) => output.once("drain", resolve));
  }
}

/** Persists the frontier after each pass so expansion runs are inspectable. */
async function writeExpansionState(frontier: Map<string, FrontierTarget>, passes: ExpansionPassSummary[]): Promise<void> {
  await mkdir(dirname(frontierPath), { recursive: true });
  await writeFile(`${frontierPath}`, `${JSON.stringify(makeExpansionState(frontier, passes), null, 2)}\n`);
}

/** Creates a serializable snapshot of the current expansion frontier. */
function makeExpansionState(frontier: Map<string, FrontierTarget>, passes: ExpansionPassSummary[]): ExpansionState {
  return {
    inputPath,
    outputPath,
    frontierPath,
    popularWordsDirs,
    hubLanguageCodes: [...hubLanguageCodes].sort(),
    maxExpansionDepth,
    maxEnqueuedTargets,
    limitRecords,
    targetCount: frontier.size,
    statusCounts: countStatuses(frontier),
    passes,
    targets: [...frontier.values()].sort((left, right) => {
      return left.depth - right.depth || left.key.localeCompare(right.key);
    }),
    updatedAt: new Date().toISOString()
  };
}

/** Counts target statuses for concise command output and frontier reports. */
function countStatuses(frontier: Map<string, FrontierTarget>): Record<FrontierStatus, number> {
  const counts: Record<FrontierStatus, number> = {
    pending: 0,
    matched: 0,
    not_found: 0
  };

  for (const frontierTarget of frontier.values()) {
    counts[frontierTarget.status] += 1;
  }

  return counts;
}

/** Parses comma-separated environment lists used by expansion scripts. */
function parseDelimitedList(value: string | undefined): string[] | undefined {
  const values = value
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return values && values.length > 0 ? values : undefined;
}
