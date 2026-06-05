import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { pathToFileURL } from "node:url";

import { canonicalGraphWord } from "@etymology-graph/graph";

import { loadPopularWordTargets } from "./popular-word-lists.js";
import {
  buildStructuredDescendantTargetRanks,
  prioritizeStructuredDescendantTargetsWithRanks,
  structuredAncestryDiscoveredTargets
} from "./structured-ancestry-targets.js";
import {
  buildSeedTargetIndex,
  findMatchingSeedTargetIndex,
  parseSeedTarget,
  readJsonlRecords,
  seedTargetKey,
  type SeedTarget,
  type WiktextractEntry
} from "./wiktextract.js";

type FrontierStatus = "pending" | "matched" | "not_found";

type FrontierReason =
  | "initial_seed"
  | "ancestor_template"
  | "structured_descendant"
  | "structured_derived";

type FrontierTarget = {
  target: SeedTarget;
  key: string;
  depth: number;
  status: FrontierStatus;
  reason: FrontierReason;
  discoveredBy?: string;
};

type UiCoverageTarget = {
  langCode: string;
  word: string;
};

type StarterQuery = {
  term?: unknown;
};

type StarterQueryGroups = Record<string, unknown>;

type SoundChangeLineageLike = {
  from?: unknown;
  to?: unknown;
};

type SoundChangeAnnotationLike = {
  target?: unknown;
  fallbackTargets?: unknown;
};

type SoundChangeExampleLike = {
  shifted?: unknown;
  comparisons?: unknown;
  annotations?: unknown;
};

type SoundChangeArticleLike = {
  examples?: unknown;
};

type ExtractionPassSummary = {
  pass: number;
  depth: number;
  targetCount: number;
  scannedLines: number;
  matchedTargets: number;
  writtenRecords: number;
  discoveredTargets: number;
};

type ExtractionState = {
  inputPath: string;
  outputPath: string;
  frontierPath: string;
  popularWordsDirs: string[];
  uiCoverageModulePaths: string[];
  maxDepth: number;
  maxEnqueuedTargets: number;
  maxDiscoveredTargetsPerMatch: number;
  limitRecords?: number;
  targetCount: number;
  statusCounts: Record<FrontierStatus, number>;
  passes: ExtractionPassSummary[];
  targets: FrontierTarget[];
  updatedAt: string;
};

type EnqueueTargetOptions = {
  depth: number;
  reason: FrontierReason;
  discoveredBy?: string;
};

type ExtractionPassOptions = {
  pass: number;
  depth: number;
  passTargets: FrontierTarget[];
  frontier: Map<string, FrontierTarget>;
  output: NodeJS.WritableStream;
};

const inputPath = process.env.WIKTEXTRACT_PATH ?? "../../wikidata_downloads/raw-wiktextract-data.jsonl";
const defaultPopularWordsDirs = [
  "../../data/seed-words/thousand-most-common-words",
  "../../data/seed-words/corpora"
];
const defaultUiCoverageModulePaths = [
  "../../apps/web/src/features/terms/starterQueries.ts",
  "../../apps/web/src/features/soundChanges/soundChanges.ts"
];
const popularWordsDirs = parseDelimitedList(process.env.POPULAR_WORDS_DIRS) ?? [
  ...defaultPopularWordsDirs
];
const uiCoverageModulePaths = parseDelimitedList(process.env.UI_SEED_COVERAGE_MODULES) ?? [
  ...defaultUiCoverageModulePaths
];
const outputPath = process.env.SEED_OUTPUT_PATH ?? "../../wikidata_downloads/seeds/structured-ancestry-seed.jsonl";
const frontierPath =
  process.env.STRUCTURED_ANCESTRY_FRONTIER_PATH ??
  "../../wikidata_downloads/checkpoints/structured-ancestry-frontier.json";
const maxDepth = Number(process.env.STRUCTURED_ANCESTRY_MAX_DEPTH ?? 8);
const maxEnqueuedTargets = Number(process.env.STRUCTURED_ANCESTRY_MAX_TARGETS ?? 500_000);
const maxDiscoveredTargetsPerMatch = Number(
  process.env.STRUCTURED_ANCESTRY_MAX_DISCOVERED_TARGETS_PER_MATCH ?? 200
);
const limitRecords = process.env.STRUCTURED_ANCESTRY_LIMIT_RECORDS
  ? Number(process.env.STRUCTURED_ANCESTRY_LIMIT_RECORDS)
  : undefined;

const initialTargets = await loadInitialTargets(popularWordsDirs);
const frontier = new Map<string, FrontierTarget>();
const passes: ExtractionPassSummary[] = [];

for (const target of initialTargets) {
  enqueueTarget(frontier, target, {
    depth: 0,
    reason: "initial_seed"
  });
}

await mkdir(dirname(outputPath), { recursive: true });
const output = createWriteStream(outputPath, { encoding: "utf8", flags: "w" });

try {
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const passTargets = [...frontier.values()].filter((frontierTarget) => {
      return frontierTarget.depth === depth && frontierTarget.status === "pending";
    });

    if (passTargets.length === 0) {
      continue;
    }

    const passSummary = await runExtractionPass({
      pass: passes.length,
      depth,
      passTargets,
      frontier,
      output
    });
    passes.push(passSummary);
    await writeExtractionState(frontier, passes);
  }
} finally {
  output.end();
  await finished(output);
}

await writeExtractionState(frontier, passes);

console.log({
  inputPath,
  outputPath,
  frontierPath,
  popularWordsDirs,
  uiCoverageModulePaths,
  maxDepth,
  maxEnqueuedTargets,
  maxDiscoveredTargetsPerMatch,
  limitRecords,
  targetCount: frontier.size,
  statusCounts: countStatuses(frontier),
  passes
});

/** Loads committed seed words plus public UI coverage terms into the initial frontier. */
async function loadInitialTargets(directoryPaths: string[]): Promise<SeedTarget[]> {
  const popularTargets = await Promise.all(directoryPaths.map((directoryPath) => loadPopularWordTargets(directoryPath)));
  const uiCoverageTargets = await loadUiCoverageTargets(uiCoverageModulePaths);
  const targetSpecs = [...new Set([
    ...popularTargets.flatMap((result) => result.targetSpecs),
    ...uiCoverageTargets.map((target) => `${target.langCode}:${target.word}`)
  ])];

  return targetSpecs.map((targetSpec) => parseSeedTarget(targetSpec));
}

/** Loads frontend term metadata so structured seeds still cover public examples. */
async function loadUiCoverageTargets(modulePaths: string[]): Promise<UiCoverageTarget[]> {
  const targets = new Map<string, UiCoverageTarget>();

  for (const modulePath of modulePaths) {
    const moduleExports = await import(pathToFileURL(resolve(modulePath)).href) as Record<string, unknown>;
    for (const target of uiCoverageTargetsFromModule(moduleExports)) {
      targets.set(`${target.langCode}:${target.word}`, target);
    }
  }

  return [...targets.values()];
}

/** Extracts every supported UI term shape from a dynamically loaded frontend metadata module. */
function uiCoverageTargetsFromModule(moduleExports: Record<string, unknown>): UiCoverageTarget[] {
  return [
    ...starterCoverageTargets(moduleExports.starterQueriesByLanguage),
    ...soundChangeCoverageTargets(moduleExports.soundChangeArticles)
  ];
}

/** Extracts language-scoped starter query terms from search and doublet starter metadata. */
function starterCoverageTargets(value: unknown): UiCoverageTarget[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([langCode, groups]) => {
    if (!isRecord(groups)) {
      return [];
    }

    return Object.values(groups as StarterQueryGroups).flatMap((queries) => {
      if (!Array.isArray(queries)) {
        return [];
      }

      return queries.flatMap((query: StarterQuery) =>
        typeof query.term === "string" ? [{ langCode, word: query.term }] : []
      );
    });
  });
}

/** Extracts source, target, annotation, and fallback terms from editorial sound-change examples. */
function soundChangeCoverageTargets(value: unknown): UiCoverageTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((article: SoundChangeArticleLike) => {
    if (!Array.isArray(article.examples)) {
      return [];
    }

    return article.examples.flatMap((example: SoundChangeExampleLike) => [
      ...lineageCoverageTargets(example.shifted),
      ...lineageCoverageTargets(example.comparisons),
      ...annotationCoverageTargets(example.annotations)
    ]);
  });
}

/** Extracts both ends of curated sound-change lineages. */
function lineageCoverageTargets(value: unknown): UiCoverageTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((lineage: SoundChangeLineageLike) => [
    ...soundChangeTermCoverageTarget(lineage.from),
    ...soundChangeTermCoverageTarget(lineage.to)
  ]);
}

/** Extracts annotation targets and fallbacks used by graph callouts. */
function annotationCoverageTargets(value: unknown): UiCoverageTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((annotation: SoundChangeAnnotationLike) => [
    ...graphAnnotationTargetCoverageTarget(annotation.target),
    ...(Array.isArray(annotation.fallbackTargets)
      ? annotation.fallbackTargets.flatMap((target) => graphAnnotationTargetCoverageTarget(target))
      : [])
  ]);
}

/** Converts sound-change term objects to seed targets when they have the expected fields. */
function soundChangeTermCoverageTarget(value: unknown): UiCoverageTarget[] {
  if (!isRecord(value) || typeof value.languageCode !== "string" || typeof value.term !== "string") {
    return [];
  }

  return [{ langCode: value.languageCode, word: value.term }];
}

/** Converts graph annotation target objects to seed targets when they have the expected fields. */
function graphAnnotationTargetCoverageTarget(value: unknown): UiCoverageTarget[] {
  if (!isRecord(value) || typeof value.langCode !== "string" || typeof value.word !== "string") {
    return [];
  }

  return [{ langCode: value.langCode, word: value.word }];
}

/** Streams Wiktextract once for a frontier depth and discovers the next wave of records. */
async function runExtractionPass(options: ExtractionPassOptions): Promise<ExtractionPassSummary> {
  const targets = options.passTargets.map((frontierTarget) => frontierTarget.target);
  const targetKeys = options.passTargets.map((frontierTarget) => frontierTarget.key);
  const targetIndex = buildSeedTargetIndex(targets);
  const targetRanks = buildStructuredDescendantTargetRanks(targets);
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

    const outputEntry = prioritizeStructuredDescendantTargetsWithRanks(record.entry, targetRanks);
    await writeJsonlLine(options.output, outputEntry === record.entry ? record.rawLine : JSON.stringify(outputEntry));
    frontierTarget.status = "matched";
    matchedTargetKeys.add(matchedKey);
    writtenRecords += 1;

    if (options.depth < maxDepth) {
      discoveredTargets += enqueueDiscoveredTargets(options.frontier, outputEntry, frontierTarget);
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

/** Adds ancestor templates and structured child records to the frontier for later passes. */
function enqueueDiscoveredTargets(
  frontier: Map<string, FrontierTarget>,
  entry: WiktextractEntry,
  discoveredBy: FrontierTarget
): number {
  let enqueuedCount = 0;

  for (const discoveredTarget of structuredAncestryDiscoveredTargets(entry)) {
    if (enqueuedCount >= maxDiscoveredTargetsPerMatch) {
      return enqueuedCount;
    }

    if (enqueueTarget(frontier, discoveredTarget.target, {
      depth: discoveredBy.depth + 1,
      reason: discoveredTarget.reason,
      discoveredBy: discoveredBy.key
    })) {
      enqueuedCount += 1;
    }
  }

  return enqueuedCount;
}

/** Adds a target once, respecting the global cap for extraction runs. */
function enqueueTarget(
  frontier: Map<string, FrontierTarget>,
  target: SeedTarget,
  options: EnqueueTargetOptions
): boolean {
  const canonicalTarget = canonicalSeedTarget(target);
  const key = seedTargetKey(canonicalTarget);

  if (frontier.has(key) || frontier.size >= maxEnqueuedTargets) {
    return false;
  }

  frontier.set(key, {
    target: canonicalTarget,
    key,
    depth: options.depth,
    status: "pending",
    reason: options.reason,
    discoveredBy: options.discoveredBy
  });

  return true;
}

/** Canonicalizes proto-form stars before frontier matching and reporting. */
function canonicalSeedTarget(target: SeedTarget): SeedTarget {
  return {
    langCode: target.langCode,
    word: target.langCode ? canonicalGraphWord(target.langCode, target.word) : target.word
  };
}

/** Writes one JSONL record while respecting stream backpressure. */
async function writeJsonlLine(output: NodeJS.WritableStream, rawLine: string): Promise<void> {
  if (!output.write(`${rawLine}\n`)) {
    await new Promise<void>((resolve) => output.once("drain", resolve));
  }
}

/** Persists the frontier after each pass so extraction runs are inspectable. */
async function writeExtractionState(frontier: Map<string, FrontierTarget>, passes: ExtractionPassSummary[]): Promise<void> {
  await mkdir(dirname(frontierPath), { recursive: true });
  await writeFile(`${frontierPath}`, `${JSON.stringify(makeExtractionState(frontier, passes), null, 2)}\n`);
}

/** Creates a serializable snapshot of the structured ancestry extraction frontier. */
function makeExtractionState(frontier: Map<string, FrontierTarget>, passes: ExtractionPassSummary[]): ExtractionState {
  return {
    inputPath,
    outputPath,
    frontierPath,
    popularWordsDirs,
    uiCoverageModulePaths,
    maxDepth,
    maxEnqueuedTargets,
    maxDiscoveredTargetsPerMatch,
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

/** Narrows dynamic module data to objects before reading optional metadata properties. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parses comma-separated environment lists used by extraction scripts. */
function parseDelimitedList(value: string | undefined): string[] | undefined {
  const values = value
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return values && values.length > 0 ? values : undefined;
}

