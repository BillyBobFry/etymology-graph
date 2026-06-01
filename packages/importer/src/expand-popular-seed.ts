import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { pathToFileURL } from "node:url";

import type { GraphNode } from "@etymology-graph/graph";

import { loadPopularWordTargets } from "./popular-word-lists.js";
import {
  buildSeedTargetIndex,
  findMatchingSeedTargetIndex,
  parseSeedTargets,
  previewEntry,
  readJsonlRecords,
  seedTargetKey,
  type SeedTarget,
  type WiktextractEntry
} from "./wiktextract.js";

type FrontierStatus = "pending" | "matched" | "not_found";

type FrontierTarget = {
  target: SeedTarget;
  key: string;
  depth: number;
  status: FrontierStatus;
  discoveredBy?: string;
  reason: "initial_seed" | "hub_related_node" | "hub_root_neighbor" | "cognate_template";
};

type UiCoverageTarget = {
  langCode: string;
  word: string;
};

type StarterQuery = {
  term?: unknown;
};

type StarterQueryGroups = Record<string, unknown>;

type SoundChangeTermLike = {
  languageCode?: unknown;
  term?: unknown;
};

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
  rootOutwardExpansionEnabled: boolean;
  rootOutwardLanguageCodes: string[];
  cognateExpansionEnabled: boolean;
  cognateLanguageCodes: string[];
  maxExpansionDepth: number;
  maxHubExpansionDepth: number;
  maxEnqueuedTargets: number;
  maxDiscoveredTargetsPerMatch: number;
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
const outputPath = process.env.SEED_OUTPUT_PATH ?? "../../wikidata_downloads/seeds/prod-seed.jsonl";
const frontierPath =
  process.env.EXPANSION_FRONTIER_PATH ?? "../../wikidata_downloads/checkpoints/prod-expansion-frontier.json";
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
const rootOutwardExpansionEnabled =
  process.env.EXPANSION_ENQUEUE_RELATED_FROM_HUBS === undefined
    ? true
    : parseBoolean(process.env.EXPANSION_ENQUEUE_RELATED_FROM_HUBS);
const rootOutwardLanguageCodes = new Set(
  parseDelimitedList(process.env.EXPANSION_ROOT_OUTWARD_LANG_CODES) ?? [
    "en",
    "ang",
    "enm",
    "de",
    "nl",
    "is",
    "sv",
    "da",
    "no",
    "fo",
    "got",
    "la",
    "it",
    "es",
    "fr",
    "pt",
    "ro",
    "ca",
    "grc",
    "el",
    "sa",
    "hi",
    "ru",
    "pl",
    "cs",
    "cy",
    "ga",
    "fa",
    "ae",
    "ave",
    ...hubLanguageCodes
  ]
);
const cognateExpansionEnabled =
  process.env.EXPANSION_ENQUEUE_COGNATES === undefined ? true : parseBoolean(process.env.EXPANSION_ENQUEUE_COGNATES);
const cognateLanguageCodes = new Set(parseDelimitedList(process.env.EXPANSION_COGNATE_LANG_CODES) ?? rootOutwardLanguageCodes);
const maxExpansionDepth = Number(process.env.EXPANSION_MAX_DEPTH ?? 2);
const maxHubExpansionDepth = Number(process.env.EXPANSION_MAX_HUB_DEPTH ?? maxExpansionDepth + 2);
const maxEnqueuedTargets = Number(process.env.EXPANSION_MAX_TARGETS ?? 125_000);
const maxDiscoveredTargetsPerMatch = Number(process.env.EXPANSION_MAX_DISCOVERED_TARGETS_PER_MATCH ?? 75);
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
  for (let depth = 0; depth <= maxHubExpansionDepth; depth += 1) {
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
  uiCoverageModulePaths,
  hubLanguageCodes: [...hubLanguageCodes],
  rootOutwardExpansionEnabled,
  rootOutwardLanguageCodes: [...rootOutwardLanguageCodes],
  cognateExpansionEnabled,
  cognateLanguageCodes: [...cognateLanguageCodes],
  maxExpansionDepth,
  maxHubExpansionDepth,
  maxEnqueuedTargets,
  maxDiscoveredTargetsPerMatch,
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
  const uiCoverageTargets = await loadUiCoverageTargets(uiCoverageModulePaths);
  const targetSpecs = [...new Set([
    ...popularTargets.flatMap((result) => result.targetSpecs),
    ...uiCoverageTargets.map((target) => `${target.langCode}:${target.word}`)
  ])];

  return parseSeedTargets(targetSpecs.join(","));
}

/** Loads route starter and article terms so public UI examples are always present in production seeds. */
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

/** Extracts language-scoped starter query terms from the search and doublet starter metadata. */
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

/** Narrows dynamic module data to objects before reading frontend metadata properties. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Streams Wiktextract once for one frontier depth and discovers targets for the next pass. */
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

    if (options.depth < maxHubExpansionDepth) {
      const preview = previewEntry(record.entry, {
        lineNumber: record.lineNumber,
        byteOffset: record.byteOffset
      });
      discoveredTargets += enqueueDiscoveredTargets(options.frontier, preview.nodes, record.entry, frontierTarget, options.depth);
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

/** Adds structured graph neighbors to the frontier, fanning out from influential roots under caps. */
function enqueueDiscoveredTargets(
  frontier: Map<string, FrontierTarget>,
  nodes: GraphNode[],
  entry: WiktextractEntry,
  discoveredBy: FrontierTarget,
  currentDepth: number
): number {
  let enqueuedCount = 0;
  const shouldExpandOutward = shouldExpandOutwardFromHub(discoveredBy);
  const shouldExpandBroadly = currentDepth < maxExpansionDepth;
  const targetLanguageCodes = shouldExpandOutward && shouldExpandBroadly ? rootOutwardLanguageCodes : hubLanguageCodes;

  if (shouldExpandBroadly) {
    for (const target of cognateTargets(entry)) {
      if (!cognateLanguageCodes.has(target.langCode ?? "")) {
        continue;
      }

      if (enqueuedCount >= maxDiscoveredTargetsPerMatch) {
        return enqueuedCount;
      }

      const enqueued = enqueueTarget(frontier, target, {
        depth: discoveredBy.depth + 1,
        reason: "cognate_template",
        discoveredBy: discoveredBy.key
      });

      if (enqueued) {
        enqueuedCount += 1;
      }
    }
  }

  for (const node of nodes) {
    if (!targetLanguageCodes.has(node.langCode)) {
      continue;
    }

    if (enqueuedCount >= maxDiscoveredTargetsPerMatch) {
      break;
    }

    const enqueued = enqueueTarget(frontier, { langCode: node.langCode, word: node.word }, {
      depth: discoveredBy.depth + 1,
      reason: shouldExpandOutward && !hubLanguageCodes.has(node.langCode) ? "hub_root_neighbor" : "hub_related_node",
      discoveredBy: discoveredBy.key
    });

    if (enqueued) {
      enqueuedCount += 1;
    }
  }

  return enqueuedCount;
}

/** Reads explicit cognate templates as high-signal seed hints without turning them into ancestry edges. */
function cognateTargets(entry: WiktextractEntry): SeedTarget[] {
  if (!cognateExpansionEnabled) {
    return [];
  }

  return (entry.etymology_templates ?? []).flatMap((template) => {
    if (!isCognateTemplate(template.name)) {
      return [];
    }

    const term = template.args?.["2"]?.trim();
    if (!term) {
      return [];
    }

    return parseDelimitedList(template.args?.["1"])?.map((langCode) => ({ langCode, word: term })) ?? [];
  });
}

/** Keeps cognate expansion limited to explicit positive cognate templates, not non-cognate notes. */
function isCognateTemplate(templateName: string | undefined): boolean {
  return templateName === "cog" || templateName === "cognate";
}

/** Identifies influential-language matches where sibling branches should make the production graph fuller. */
function shouldExpandOutwardFromHub(frontierTarget: FrontierTarget): boolean {
  return rootOutwardExpansionEnabled && frontierTarget.target.langCode !== undefined && hubLanguageCodes.has(frontierTarget.target.langCode);
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
    rootOutwardExpansionEnabled,
    rootOutwardLanguageCodes: [...rootOutwardLanguageCodes].sort(),
    cognateExpansionEnabled,
    cognateLanguageCodes: [...cognateLanguageCodes].sort(),
    maxExpansionDepth,
    maxHubExpansionDepth,
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

/** Parses comma-separated environment lists used by expansion scripts. */
function parseDelimitedList(value: string | undefined): string[] | undefined {
  const values = value
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return values && values.length > 0 ? values : undefined;
}

/** Parses feature flags from environment variables without making truthiness depend on arbitrary strings. */
function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}
