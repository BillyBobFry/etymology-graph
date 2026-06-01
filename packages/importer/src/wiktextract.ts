import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { finished } from "node:stream/promises";

import {
  canonicalGraphWord,
  makeGraphEdgeId,
  makeLexicalEntryId,
  makeNodeId,
  normalizeWord,
  type GraphEdge,
  type GraphNode,
  type LexicalEntry,
  type LexicalPronunciation,
  type LexicalSense
} from "@etymology-graph/graph";

type WiktextractTemplate = {
  name?: string;
  args?: Record<string, string>;
  expansion?: string;
};

type WiktextractSound = {
  ipa?: string;
  tags?: string[];
  note?: string;
  audio?: string;
  ogg_url?: string;
  mp3_url?: string;
};

type WiktextractSense = {
  glosses?: string[];
  raw_glosses?: string[];
  tags?: string[];
  raw_tags?: string[];
};

type WiktextractDescendant = {
  lang?: string;
  lang_code?: string;
  word?: string;
  tags?: string[];
  raw_tags?: string[];
  descendants?: WiktextractDescendant[];
};

export type WiktextractEntry = {
  word?: string;
  lang?: string;
  lang_code?: string;
  pos?: string;
  etymology_number?: number;
  etymology_text?: string;
  etymology_templates?: WiktextractTemplate[];
  descendants?: WiktextractDescendant[];
  senses?: WiktextractSense[];
  sounds?: WiktextractSound[];
};

export type ImportPreview = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lexicalEntries: LexicalEntry[];
};

export type ImportSourceMetadata = {
  lineNumber: number;
  byteOffset: number;
};

export type JsonlRecord = {
  entry: WiktextractEntry;
  lineNumber: number;
  byteOffset: number;
  nextByteOffset: number;
  rawLine: string;
};

export type SeedTarget = {
  word: string;
  langCode?: string;
};

export type ExtractSeedOptions = {
  inputPath: string;
  outputPath: string;
  targets: SeedTarget[];
  limitPerTarget?: number;
  append?: boolean;
};

export type ExtractSeedResult = {
  outputPath: string;
  scannedLines: number;
  writtenRecords: number;
  matchesByTarget: Record<string, number>;
};

export type JsonlBatch = {
  records: JsonlRecord[];
  startLineNumber: number;
  endLineNumber: number;
  startByteOffset: number;
  nextByteOffset: number;
};

export type ImportCheckpoint = {
  inputPath: string;
  inputFileSize: number;
  inputFileModifiedAtMs: number;
  batchSize: number;
  nextLineNumber: number;
  nextByteOffset: number;
  processedRecords: number;
  processedBatches: number;
  updatedAt: string;
};

export type ProcessJsonlBatchOptions = {
  inputPath: string;
  batchSize: number;
  checkpointPath?: string;
  startLineNumber?: number;
  startByteOffset?: number;
  limitRecords?: number;
  onBatch: (batch: JsonlBatch) => Promise<void> | void;
};

const etymologyKeywordEdgeTypes = {
  inherited: "inherited_from",
  inh: "inherited_from",
  derived: "derived_from",
  der: "derived_from",
  uder: "derived_from",
  from: "derived_from",
  borrowed: "borrowed_from",
  bor: "borrowed_from",
  lbor: "borrowed_from"
} as const;

const descendantTagEdgeTypes = [
  { tagIncludes: "borrow", edgeType: "borrowed_from" },
  { tagIncludes: "derived", edgeType: "derived_from" },
  { tagIncludes: "inherited", edgeType: "inherited_from" }
] as const;

const sourceDirectedAncestryEdgeTypes = new Set<GraphEdge["type"]>([
  "borrowed_from",
  "derived_from",
  "descendant_of",
  "inherited_from"
]);

const uncertaintyTags = ["uncertain", "possibly", "possible", "perhaps", "maybe"] as const;

const etymologyTreeLanguageCodesByName = new Map<string, string>([
  ["English", "en"],
  ["Middle English", "enm"],
  ["Old English", "ang"],
  ["Proto-Germanic", "gem-pro"],
  ["Proto-Indo-European", "ine-pro"],
  ["Proto-West Germanic", "gmw-pro"]
]);

type EtymologyTreeTerm = {
  langCode: string;
  term: string;
  edgeTypeToParent?: GraphEdge["type"];
  uncertain: boolean;
};

type EtymologyTreeMetadata = {
  terms: EtymologyTreeMetadataTerm[];
};

type EtymologyTreeMetadataRelation = {
  keyword?: string;
  isGroup?: boolean;
  terms: EtymologyTreeMetadataTerm[];
};

type EtymologyTreeMetadataTerm = {
  langCode?: string;
  term?: string;
  alt?: string;
  uncertain: boolean;
  children: EtymologyTreeMetadataRelation[];
};

type TemplateTextLocation = {
  sentenceIndex?: number;
  startIndex?: number;
  endIndex?: number;
  nextSearchIndex: number;
};

type TemplateChainTransition = "continue" | "resetToRoot" | "resetToBranchBase" | "resetToBranchBaseWithParallelSource";

type SeedTargetMatch = {
  index: number;
  target: SeedTarget;
};

export type SeedTargetIndex = {
  byLanguageAndWord: Map<string, Map<string, SeedTargetMatch[]>>;
  byWord: Map<string, SeedTargetMatch[]>;
};

export async function readJsonlSample(path: string, limit: number): Promise<WiktextractEntry[]> {
  const entries: WiktextractEntry[] = [];

  for await (const record of readJsonlRecords(path)) {
    if (entries.length >= limit) {
      break;
    }

    entries.push(record.entry);
  }

  return entries;
}

export async function* readJsonlRecords(
  path: string,
  options: { startByteOffset?: number; startLineNumber?: number } = {}
): AsyncGenerator<JsonlRecord> {
  const stream = createReadStream(path, {
    encoding: "utf8",
    start: options.startByteOffset ?? 0
  });
  let buffer = "";
  let currentByteOffset = options.startByteOffset ?? 0;
  let lineNumber = options.startLineNumber ?? 1;

  for await (const chunk of stream) {
    buffer += chunk;

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = buffer.slice(0, newlineIndex);
      const consumed = buffer.slice(0, newlineIndex + 1);
      const byteOffset = currentByteOffset;

      currentByteOffset += Buffer.byteLength(consumed, "utf8");
      buffer = buffer.slice(newlineIndex + 1);

      if (rawLine.trim() !== "") {
        yield {
          entry: parseJsonlLine(rawLine, path, lineNumber, byteOffset),
          lineNumber,
          byteOffset,
          nextByteOffset: currentByteOffset,
          rawLine
        };
      }

      lineNumber += 1;
      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (buffer.trim() === "") {
    return;
  }

  const byteOffset = currentByteOffset;
  currentByteOffset += Buffer.byteLength(buffer, "utf8");
  yield {
    entry: parseJsonlLine(buffer, path, lineNumber, byteOffset),
    lineNumber,
    byteOffset,
    nextByteOffset: currentByteOffset,
    rawLine: buffer
  };
}

export async function extractSeedEntries(options: ExtractSeedOptions): Promise<ExtractSeedResult> {
  const limitPerTarget = options.limitPerTarget ?? 1;
  const targetKeys = options.targets.map(seedTargetKey);
  const matchesByTarget = Object.fromEntries(targetKeys.map((key) => [key, 0]));
  const targetKeyCount = Object.keys(matchesByTarget).length;
  const targetIndex = buildSeedTargetIndex(options.targets);
  const fulfilledTargetKeys = new Set<string>();
  let scannedLines = 0;
  let writtenRecords = 0;

  await mkdir(dirname(options.outputPath), { recursive: true });
  const output = createWriteStream(options.outputPath, {
    encoding: "utf8",
    flags: options.append ? "a" : "w"
  });

  try {
    for await (const record of readJsonlRecords(options.inputPath)) {
      scannedLines = record.lineNumber;
      const targetMatchIndex = findMatchingSeedTargetIndex(targetIndex, record.entry);

      if (targetMatchIndex === undefined) {
        continue;
      }

      const key = targetKeys[targetMatchIndex];
      if (matchesByTarget[key] >= limitPerTarget) {
        continue;
      }

      if (!output.write(`${record.rawLine}\n`)) {
        await new Promise<void>((resolve) => output.once("drain", resolve));
      }

      matchesByTarget[key] += 1;
      writtenRecords += 1;

      if (matchesByTarget[key] >= limitPerTarget) {
        fulfilledTargetKeys.add(key);
      }

      if (fulfilledTargetKeys.size === targetKeyCount) {
        break;
      }
    }
  } finally {
    output.end();
    await finished(output);
  }

  return {
    outputPath: options.outputPath,
    scannedLines,
    writtenRecords,
    matchesByTarget
  };
}

export async function processJsonlInBatches(options: ProcessJsonlBatchOptions): Promise<ImportCheckpoint> {
  const inputStats = await stat(options.inputPath);
  const existingCheckpoint = options.checkpointPath ? await readImportCheckpoint(options.checkpointPath) : undefined;
  if (existingCheckpoint && existingCheckpoint.inputPath !== options.inputPath) {
    throw new Error(`Checkpoint belongs to ${existingCheckpoint.inputPath}, not ${options.inputPath}`);
  }
  const checkpoint =
    existingCheckpoint && checkpointMatchesInput(existingCheckpoint, inputStats) ? existingCheckpoint : undefined;

  const startLineNumber = checkpoint?.nextLineNumber ?? options.startLineNumber ?? 1;
  const startByteOffset = checkpoint?.nextByteOffset ?? options.startByteOffset ?? 0;
  const baseProcessedRecords = checkpoint?.processedRecords ?? 0;
  const baseProcessedBatches = checkpoint?.processedBatches ?? 0;
  let processedRecords = baseProcessedRecords;
  let processedBatches = baseProcessedBatches;
  let batch: JsonlRecord[] = [];
  let recordsThisRun = 0;
  let nextLineNumber = startLineNumber;
  let nextByteOffset = startByteOffset;

  const flushBatch = async () => {
    if (batch.length === 0) {
      return;
    }

    const firstRecord = batch[0];
    const lastRecord = batch[batch.length - 1];
    const jsonlBatch: JsonlBatch = {
      records: batch,
      startLineNumber: firstRecord.lineNumber,
      endLineNumber: lastRecord.lineNumber,
      startByteOffset: firstRecord.byteOffset,
      nextByteOffset: lastRecord.nextByteOffset
    };

    await options.onBatch(jsonlBatch);

    processedRecords += batch.length;
    processedBatches += 1;
    nextLineNumber = lastRecord.lineNumber + 1;
    nextByteOffset = lastRecord.nextByteOffset;
    batch = [];

    if (options.checkpointPath) {
      await writeImportCheckpoint(options.checkpointPath, {
        inputPath: options.inputPath,
        inputFileSize: inputStats.size,
        inputFileModifiedAtMs: inputStats.mtimeMs,
        batchSize: options.batchSize,
        nextLineNumber,
        nextByteOffset,
        processedRecords,
        processedBatches,
        updatedAt: new Date().toISOString()
      });
    }
  };

  for await (const record of readJsonlRecords(options.inputPath, { startByteOffset, startLineNumber })) {
    if (options.limitRecords !== undefined && recordsThisRun >= options.limitRecords) {
      break;
    }

    batch.push(record);
    recordsThisRun += 1;

    if (batch.length >= options.batchSize) {
      await flushBatch();
    }
  }

  await flushBatch();

  return {
    inputPath: options.inputPath,
    inputFileSize: inputStats.size,
    inputFileModifiedAtMs: inputStats.mtimeMs,
    batchSize: options.batchSize,
    nextLineNumber,
    nextByteOffset,
    processedRecords,
    processedBatches,
    updatedAt: new Date().toISOString()
  };
}

/** Adds checkpoint context to JSONL parse failures so stale offsets are easier to diagnose. */
const parseJsonlLine = (rawLine: string, path: string, lineNumber: number, byteOffset: number): WiktextractEntry => {
  try {
    return JSON.parse(rawLine) as WiktextractEntry;
  } catch (cause) {
    const linePreview = rawLine.slice(0, 160);
    throw new Error(
      `Invalid JSONL in ${path} at line ${lineNumber}, byte offset ${byteOffset}. If this run resumed from a checkpoint, delete the checkpoint and retry. Line starts with: ${linePreview}`,
      { cause }
    );
  }
};

export function previewEntry(entry: WiktextractEntry, sourceMetadata?: ImportSourceMetadata): ImportPreview {
  if (!entry.lang_code || !entry.word) {
    return { nodes: [], edges: [], lexicalEntries: [] };
  }

  const currentNode = makeNode(entry.lang_code, entry.word);
  const originatingEntryId = makeLexicalEntryId(currentNode.id, entry.pos, entry.etymology_number);
  const nodesById = new Map<string, GraphNode>([[currentNode.id, currentNode]]);
  const treeEdges = extractTreeAncestryEdges(entry, currentNode, nodesById, originatingEntryId);
  const templateEdges = extractTemplateAncestryEdges(entry, currentNode, nodesById, originatingEntryId);
  const ancestryEdges =
    treeEdges.length > 0 ? supplementTreeEdgesWithMissingRootEdges(treeEdges, templateEdges) : templateEdges;
  const affixBaseEdges = hasOutgoingAncestryEdge(ancestryEdges, currentNode.id)
    ? []
    : extractAffixBaseEdges(entry, currentNode, nodesById, originatingEntryId);
  const compoundEdges =
    ancestryEdges.length === 0 && affixBaseEdges.length === 0
      ? extractCompoundEdges(entry, currentNode, nodesById, originatingEntryId)
      : [];
  const edges = [
    ...ancestryEdges,
    ...affixBaseEdges,
    ...compoundEdges,
    ...extractDescendantEdges(entry, currentNode, nodesById, originatingEntryId)
  ];
  const lexicalEntries = [makeLexicalEntry(entry, currentNode, originatingEntryId, sourceMetadata)];

  return {
    nodes: [...nodesById.values()],
    edges,
    lexicalEntries
  };
}

/** Checks whether tree or flat templates already connect the current entry to a source term. */
function hasOutgoingAncestryEdge(edges: GraphEdge[], nodeId: string): boolean {
  return edges.some((edge) => edge.fromNodeId === nodeId && sourceDirectedAncestryEdgeTypes.has(edge.type));
}

/** Recovers the lexical base from affix templates when tree metadata only emits component ancestry. */
function extractAffixBaseEdges(
  entry: WiktextractEntry,
  currentNode: GraphNode,
  nodesById: Map<string, GraphNode>,
  originatingEntryId: string
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const template of entry.etymology_templates ?? []) {
    if (template.name !== "af") {
      continue;
    }

    const componentLangCode = trimOptional(template.args?.["1"]) ?? currentNode.langCode;
    const baseComponent = affixTemplateBaseComponent(template.args ?? {}, componentLangCode);
    if (!baseComponent) {
      continue;
    }

    appendTemplateAncestryEdge(
      edges,
      nodesById,
      currentNode,
      makeNode(baseComponent.langCode, baseComponent.term),
      "derived_from",
      entry.etymology_number,
      template.name,
      templateIsUncertain(template),
      originatingEntryId
    );
  }

  return edges;
}

/** Picks the non-affix lexical base from an affix formation such as `base + -suffix`. */
function affixTemplateBaseComponent(
  args: Record<string, string>,
  fallbackLangCode: string
): { langCode: string; term: string } | undefined {
  const components = compoundTemplateComponents(args, fallbackLangCode);

  return (
    components.find((component) => !component.term.startsWith("-") && !component.term.endsWith("-")) ?? components[0]
  );
}

/** Captures entries whose etymology is first formed from same-language compound components. */
function extractCompoundEdges(
  entry: WiktextractEntry,
  currentNode: GraphNode,
  nodesById: Map<string, GraphNode>,
  originatingEntryId: string
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const template of entry.etymology_templates ?? []) {
    if (template.name !== "compound") {
      continue;
    }

    const componentLangCode = trimOptional(template.args?.["1"]) ?? currentNode.langCode;
    const components = compoundTemplateComponents(template.args ?? {}, componentLangCode);
    for (const component of components) {
      const componentNode = makeNode(component.langCode, component.term);
      if (componentNode.id === currentNode.id) {
        continue;
      }

      nodesById.set(componentNode.id, componentNode);
      edges.push({
        id: makeGraphEdgeId(currentNode.id, "compound_of", componentNode.id, originatingEntryId),
        fromNodeId: currentNode.id,
        toNodeId: componentNode.id,
        type: "compound_of",
        source: "wiktextract",
        etymologyNumber: entry.etymology_number,
        templateName: template.name,
        uncertain: false,
        originatingEntryId
      });
    }
  }

  return edges;
}

/** Reads numeric component arguments from Wiktionary compound templates while skipping gloss parameters. */
function compoundTemplateComponents(
  args: Record<string, string>,
  fallbackLangCode: string
): Array<{ langCode: string; term: string }> {
  return Object.entries(args)
    .map(([key, value]) => ({
      argumentIndex: Number.parseInt(key, 10),
      value
    }))
    .filter(({ argumentIndex }) => Number.isInteger(argumentIndex) && argumentIndex >= 2)
    .sort((left, right) => left.argumentIndex - right.argumentIndex)
    .flatMap(({ value }) => {
      const component = parseCompoundComponent(value, fallbackLangCode);
      return component ? [component] : [];
    });
}

/** Normalizes template component arguments such as `berry<id:fruit>` into graph term keys. */
function parseCompoundComponent(
  value: string,
  fallbackLangCode: string
): { langCode: string; term: string } | undefined {
  const cleanedValue = trimOptional(value.replace(/<[^>]*>/g, ""));
  if (!cleanedValue || cleanedValue === "-") {
    return undefined;
  }

  const languageSeparatorIndex = cleanedValue.indexOf(":");
  if (languageSeparatorIndex > 0) {
    const langCode = trimOptional(cleanedValue.slice(0, languageSeparatorIndex));
    const term = trimOptional(cleanedValue.slice(languageSeparatorIndex + 1));
    return langCode && term ? { langCode, term } : undefined;
  }

  return { langCode: fallbackLangCode, term: cleanedValue };
}

/** Extracts adjacent ancestry edges from sequential flat Wiktionary etymology templates. */
function extractTemplateAncestryEdges(
  entry: WiktextractEntry,
  currentNode: GraphNode,
  nodesById: Map<string, GraphNode>,
  originatingEntryId: string
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  let childNode = currentNode;
  let branchBaseNode = currentNode;
  let parallelSourceNode: GraphNode | undefined;
  let previousSentenceIndex: number | undefined;
  let previousLocation: TemplateTextLocation | undefined;
  let nextTemplateSearchIndex = 0;

  for (const template of entry.etymology_templates ?? []) {
    const edgeType = parseEtymologyKeywordEdgeType(template.name ?? "");
    const parentTerm = templateTerm(template);

    if (!edgeType || !parentTerm) {
      continue;
    }

    const location = locateTemplateInEtymologyText(entry.etymology_text, template, nextTemplateSearchIndex);
    nextTemplateSearchIndex = location.nextSearchIndex;
    if (
      templateIsOnlyCompared(entry.etymology_text, location) ||
      templateIsOnlyOrthographicInfluence(entry.etymology_text, location)
    ) {
      continue;
    }

    const textBetweenPreviousTemplate = textBetweenTemplateLocations(entry.etymology_text, previousLocation, location);
    const transition = templateChainTransition(entry.etymology_text, previousSentenceIndex, previousLocation, location);
    if (transition === "resetToRoot") {
      childNode = currentNode;
      branchBaseNode = currentNode;
      parallelSourceNode = undefined;
    } else if (transition === "resetToBranchBase") {
      childNode = branchBaseNode;
      parallelSourceNode = undefined;
    } else if (transition === "resetToBranchBaseWithParallelSource") {
      parallelSourceNode = childNode;
      childNode = branchBaseNode;
    } else if (templateStartsContinuingSourceSentence(entry.etymology_text, previousSentenceIndex, location)) {
      branchBaseNode = childNode;
    } else if (textStartsParallelSourceList(textBetweenPreviousTemplate)) {
      branchBaseNode = childNode;
    }
    const shouldAttachSharedParallelSource =
      parallelSourceNode !== undefined && textIntroducesSharedParallelSource(textBetweenPreviousTemplate);
    previousSentenceIndex = location.sentenceIndex ?? previousSentenceIndex;
    previousLocation = location.startIndex === undefined ? previousLocation : location;

    const parentNode = makeNode(parentTerm.langCode, parentTerm.term);
    appendTemplateAncestryEdge(
      edges,
      nodesById,
      childNode,
      parentNode,
      edgeType,
      entry.etymology_number,
      template.name,
      templateIsUncertain(template),
      originatingEntryId
    );
    if (parallelSourceNode && shouldAttachSharedParallelSource) {
      appendTemplateAncestryEdge(
        edges,
        nodesById,
        parallelSourceNode,
        parentNode,
        edgeType,
        entry.etymology_number,
        template.name,
        templateIsUncertain(template),
        originatingEntryId
      );
    }
    if (parallelSourceNode && transition !== "resetToBranchBaseWithParallelSource") {
      parallelSourceNode = undefined;
    }

    childNode = parentNode;
  }

  return edges;
}

/** Appends one flat-template ancestry edge while keeping node registration and self-edge guards together. */
function appendTemplateAncestryEdge(
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
  childNode: GraphNode,
  parentNode: GraphNode,
  edgeType: GraphEdge["type"],
  etymologyNumber: number | undefined,
  templateName: string | undefined,
  uncertain: boolean,
  originatingEntryId: string
): void {
  if (childNode.id === parentNode.id) {
    return;
  }

  nodesById.set(childNode.id, childNode);
  nodesById.set(parentNode.id, parentNode);
  edges.push({
    id: makeGraphEdgeId(childNode.id, edgeType, parentNode.id, originatingEntryId),
    fromNodeId: childNode.id,
    toNodeId: parentNode.id,
    type: edgeType,
    source: "wiktextract",
    etymologyNumber,
    templateName,
    uncertain,
    originatingEntryId
  });
}

/**
 * Preserves etymon-tree adjacency while recovering upstream roots that Wiktextract only exposes in
 * flat templates. Supplemental edges are limited to the tree's current topmost ancestor so independent
 * prose branches cannot become direct edges from the current entry again.
 */
function supplementTreeEdgesWithMissingRootEdges(treeEdges: GraphEdge[], templateEdges: GraphEdge[]): GraphEdge[] {
  const treeEdgeIds = new Set(treeEdges.map((edge) => edge.id));
  const treeFromNodeIds = new Set(treeEdges.map((edge) => edge.fromNodeId));
  const treeToNodeIds = new Set(treeEdges.map((edge) => edge.toNodeId));
  const topmostTreeNodeIds = new Set([...treeToNodeIds].filter((nodeId) => !treeFromNodeIds.has(nodeId)));
  const supplementalEdges = templateEdges.filter(
    (edge) => topmostTreeNodeIds.has(edge.fromNodeId) && !treeEdgeIds.has(edge.id)
  );

  return [...treeEdges, ...supplementalEdges];
}

/** Finds rendered template text so independent prose sentences do not become one false ancestry chain. */
function locateTemplateInEtymologyText(
  etymologyText: string | undefined,
  template: WiktextractTemplate,
  nextSearchIndex: number
): TemplateTextLocation {
  const expansion = trimOptional(template.expansion);

  if (!etymologyText || !expansion) {
    return { nextSearchIndex };
  }

  const localIndex = etymologyText.indexOf(expansion, nextSearchIndex);
  const fallbackIndex = localIndex === -1 ? etymologyText.indexOf(expansion) : localIndex;

  if (fallbackIndex === -1) {
    return { nextSearchIndex };
  }

  return {
    sentenceIndex: sentenceIndexAt(etymologyText, fallbackIndex),
    startIndex: fallbackIndex,
    endIndex: fallbackIndex + expansion.length,
    nextSearchIndex: fallbackIndex + expansion.length
  };
}

/** Classifies how the next flat template should attach to the current ancestry chain. */
function templateChainTransition(
  etymologyText: string | undefined,
  previousSentenceIndex: number | undefined,
  previousLocation: TemplateTextLocation | undefined,
  location: TemplateTextLocation
): TemplateChainTransition {
  if (previousSentenceIndex === undefined || location.sentenceIndex === undefined) {
    return "continue";
  }

  if (location.sentenceIndex !== previousSentenceIndex) {
    return sentenceContinuesPreviousSource(etymologyText, location) ? "continue" : "resetToRoot";
  }

  if (
    !etymologyText ||
    previousLocation?.endIndex === undefined ||
    location.startIndex === undefined ||
    location.startIndex < previousLocation.endIndex
  ) {
    return "continue";
  }

  const textBetweenTemplates = etymologyText.slice(previousLocation.endIndex, location.startIndex);
  if (hasParallelSourceBoundary(textBetweenTemplates)) {
    return "resetToBranchBaseWithParallelSource";
  }

  return hasAlternativeBoundary(textBetweenTemplates) ? "resetToBranchBase" : "continue";
}

/** Reads prose between two located templates so branch rules can classify local conjunctions. */
function textBetweenTemplateLocations(
  etymologyText: string | undefined,
  previousLocation: TemplateTextLocation | undefined,
  location: TemplateTextLocation
): string {
  if (!etymologyText || previousLocation?.endIndex === undefined || location.startIndex === undefined) {
    return "";
  }

  return etymologyText.slice(previousLocation.endIndex, location.startIndex);
}

/** Detects a new sentence that keeps explaining the previous source term. */
function templateStartsContinuingSourceSentence(
  etymologyText: string | undefined,
  previousSentenceIndex: number | undefined,
  location: TemplateTextLocation
): boolean {
  return (
    previousSentenceIndex !== undefined &&
    location.sentenceIndex !== undefined &&
    location.sentenceIndex !== previousSentenceIndex &&
    sentenceContinuesPreviousSource(etymologyText, location)
  );
}

/** Allows follow-up prose like "Believed to be derived from..." to continue the current etymon chain. */
function sentenceContinuesPreviousSource(etymologyText: string | undefined, location: TemplateTextLocation): boolean {
  if (!etymologyText || location.startIndex === undefined) {
    return false;
  }

  return /^believed to be (?:derived|borrowed|inherited) from\b/i.test(
    sentencePrefixBeforeLocation(etymologyText, location.startIndex).trim()
  );
}

/** Filters comparison-only mentions out of ancestry while keeping explicit derived-from follow-up prose. */
function templateIsOnlyCompared(etymologyText: string | undefined, location: TemplateTextLocation): boolean {
  if (!etymologyText || location.startIndex === undefined) {
    return false;
  }

  return /^(?:(?:perhaps|possibly|maybe)\s+)?compare\b/i.test(
    sentencePrefixBeforeLocation(etymologyText, location.startIndex).trim()
  );
}

/** Filters spelling-history notes that cite form influence rather than lexical ancestry. */
function templateIsOnlyOrthographicInfluence(
  etymologyText: string | undefined,
  location: TemplateTextLocation
): boolean {
  if (!etymologyText || location.startIndex === undefined) {
    return false;
  }

  const prefix = sentencePrefixBeforeLocation(etymologyText, location.startIndex).trim();
  if (!/^(?:rather,\s*)?it (?:is|was) from\b/i.test(prefix)) {
    return false;
  }

  const recentContext = etymologyText.slice(Math.max(0, location.startIndex - 240), location.startIndex);

  return /\b(?:spelling|orthograph|regular representation|vowel)\b/i.test(recentContext);
}

/** Reads the current sentence prefix before a template expansion. */
function sentencePrefixBeforeLocation(text: string, locationStartIndex: number): string {
  for (let index = locationStartIndex - 1; index >= 0; index -= 1) {
    const char = text[index];

    if ((char === "." || char === "!" || char === "?") && isSentenceBoundary(text, index)) {
      return text.slice(index + 1, locationStartIndex);
    }
  }

  return text.slice(0, locationStartIndex);
}

/** Detects prose that presents candidate sources as alternatives instead of ancestry steps. */
function hasAlternativeBoundary(textBetweenTemplates: string): boolean {
  return /\b(?:or|alternatively)\b/i.test(removeParentheticalText(textBetweenTemplates));
}

/** Detects "from X and Y" source pairs that should share the current branch base. */
function hasParallelSourceBoundary(textBetweenTemplates: string): boolean {
  return /^\s*(?:,?\s*)?and\s*$/i.test(removeParentheticalText(textBetweenTemplates));
}

/** Detects prose that introduces multiple same-level sources, such as "from a conflation of X and Y". */
function textStartsParallelSourceList(textBetweenTemplates: string): boolean {
  return /\bconflation of\s*$/i.test(removeParentheticalText(textBetweenTemplates));
}

/** Detects the shared ancestor phrase in "X and Y, both from Z" constructions. */
function textIntroducesSharedParallelSource(textBetweenTemplates: string): boolean {
  return /^\s*,?\s*both from\b/i.test(removeParentheticalText(textBetweenTemplates));
}

/** Prevents gloss prose like "(to do good or harm)" from being mistaken for source structure. */
function removeParentheticalText(text: string): string {
  let depth = 0;
  let unwrappedText = "";

  for (const char of text) {
    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      unwrappedText += char;
    }
  }

  return unwrappedText;
}

/** Counts coarse prose sentence boundaries before a template expansion in Wiktextract etymology text. */
function sentenceIndexAt(text: string, offset: number): number {
  let sentenceIndex = 0;

  for (let index = 0; index < offset; index += 1) {
    const char = text[index];

    if ((char === "." || char === "!" || char === "?") && isSentenceBoundary(text, index)) {
      sentenceIndex += 1;
    }
  }

  return sentenceIndex;
}

/** Treats terminal punctuation followed by whitespace and an uppercase/digit as a new etymology sentence. */
function isSentenceBoundary(text: string, punctuationIndex: number): boolean {
  const afterPunctuation = text.slice(punctuationIndex + 1);
  const boundaryMatch = /^\s+(\S)/.exec(afterPunctuation);

  return boundaryMatch ? /^[\p{Lu}\p{N}]/u.test(boundaryMatch[1]) : false;
}

/** Extracts adjacent ancestry edges from Wiktextract's rendered etymology tree metadata. */
function extractTreeAncestryEdges(
  entry: WiktextractEntry,
  currentNode: GraphNode,
  nodesById: Map<string, GraphNode>,
  originatingEntryId: string
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const template of entry.etymology_templates ?? []) {
    if (template.name !== "etymon" || template.args?.tree !== "1" || !template.expansion) {
      continue;
    }

    const metadataEdges = extractStructuredTreeAncestryEdges(
      template.expansion,
      nodesById,
      entry.etymology_number,
      template.name,
      originatingEntryId
    );
    edges.push(...metadataEdges);

    const treeTerms = parseEtymologyTreeTerms(template.expansion);
    if (treeTerms.length < 2) {
      continue;
    }

    for (const term of treeTerms) {
      const node = makeNode(term.langCode, term.term);
      nodesById.set(node.id, node);
    }

    for (let termIndex = 1; termIndex < treeTerms.length; termIndex += 1) {
      const childTerm = treeTerms[termIndex];
      const parentTerm = treeTerms[termIndex - 1];
      const edgeType = parentTerm.edgeTypeToParent;

      if (!edgeType) {
        continue;
      }

      const childNode = makeNode(childTerm.langCode, childTerm.term);
      const parentNode = makeNode(parentTerm.langCode, parentTerm.term);

      edges.push({
        id: makeGraphEdgeId(childNode.id, edgeType, parentNode.id, originatingEntryId),
        fromNodeId: childNode.id,
        toNodeId: parentNode.id,
        type: edgeType,
        source: "wiktextract",
        etymologyNumber: entry.etymology_number,
        templateName: template.name,
        uncertain: parentTerm.uncertain,
        originatingEntryId
      });
    }
  }

  if (!nodesById.has(currentNode.id)) {
    nodesById.set(currentNode.id, currentNode);
  }

  return uniqueGraphEdges(edges);
}

/** Removes duplicate edges that can appear when flat and structured etymon extraction agree. */
function uniqueGraphEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...new Map(edges.map((edge) => [edge.id, edge])).values()];
}

/** Extracts tree edges from Wiktextract's nested term metadata so affix branches do not flatten. */
function extractStructuredTreeAncestryEdges(
  expansion: string,
  nodesById: Map<string, GraphNode>,
  etymologyNumber: number | undefined,
  templateName: string | undefined,
  originatingEntryId: string
): GraphEdge[] {
  const metadata = parseEtymologyTreeMetadata(expansion);
  if (!metadata) {
    return [];
  }

  const edges: GraphEdge[] = [];
  for (const term of metadata.terms) {
    appendStructuredTreeTermEdges(term, nodesById, etymologyNumber, templateName, originatingEntryId, edges);
  }

  return edges;
}

/** Recursively appends source-directed edges for each parent relation under a tree term. */
function appendStructuredTreeTermEdges(
  childTerm: EtymologyTreeMetadataTerm,
  nodesById: Map<string, GraphNode>,
  etymologyNumber: number | undefined,
  templateName: string | undefined,
  originatingEntryId: string,
  edges: GraphEdge[]
): void {
  const childNode = treeMetadataNode(childTerm);
  if (!childNode) {
    for (const relation of childTerm.children) {
      for (const parentTerm of relation.terms) {
        appendStructuredTreeTermEdges(parentTerm, nodesById, etymologyNumber, templateName, originatingEntryId, edges);
      }
    }
    return;
  }

  nodesById.set(childNode.id, childNode);
  for (const relation of childTerm.children) {
    if (relation.isGroup && relation.keyword === "afeq") {
      continue;
    }

    const edgeType =
      relation.isGroup && relation.keyword === "affix"
        ? "derived_from"
        : parseEtymologyKeywordEdgeType(relation.keyword ?? "");
    for (const parentTerm of relation.terms) {
      const parentNode = treeMetadataNode(parentTerm);
      if (!parentNode) {
        continue;
      }

      nodesById.set(parentNode.id, parentNode);
      if (edgeType && childNode.id !== parentNode.id) {
        edges.push({
          id: makeGraphEdgeId(childNode.id, edgeType, parentNode.id, originatingEntryId),
          fromNodeId: childNode.id,
          toNodeId: parentNode.id,
          type: edgeType,
          source: "wiktextract",
          etymologyNumber,
          templateName,
          uncertain: parentTerm.uncertain,
          originatingEntryId
        });
      }

      appendStructuredTreeTermEdges(parentTerm, nodesById, etymologyNumber, templateName, originatingEntryId, edges);
    }
  }
}

/** Converts a parsed tree term into a graph node, using `alt` when Wiktextract omits `term`. */
function treeMetadataNode(term: EtymologyTreeMetadataTerm): GraphNode | undefined {
  const word = term.term ?? term.alt;

  return term.langCode && word ? makeNode(term.langCode, word) : undefined;
}

/** Parses the embedded JSON-like `terms` payload from a rendered etymon tree expansion. */
function parseEtymologyTreeMetadata(expansion: string): EtymologyTreeMetadata | undefined {
  const termsKey = '"terms"';
  const termsKeyIndex = expansion.indexOf(termsKey);
  if (termsKeyIndex === -1) {
    return undefined;
  }

  const termsOpenBracketIndex = expansion.indexOf("[", termsKeyIndex);
  if (termsOpenBracketIndex === -1) {
    return undefined;
  }

  const termsCloseBracketIndex = matchingCloseBracket(expansion, termsOpenBracketIndex);
  if (termsCloseBracketIndex === undefined) {
    return undefined;
  }

  const metadataSource = `{${expansion.slice(termsKeyIndex, termsCloseBracketIndex + 1)}}`;
  try {
    const metadata = JSON.parse(metadataSource) as unknown;

    return parseTreeMetadataObject(metadata);
  } catch {
    return undefined;
  }
}

/** Validates the root metadata payload without leaking unknown JSON into importer logic. */
function parseTreeMetadataObject(value: unknown): EtymologyTreeMetadata | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    terms: parseTreeMetadataTerms(value.terms)
  };
}

/** Validates a tree term list from the rendered metadata payload. */
function parseTreeMetadataTerms(value: unknown): EtymologyTreeMetadataTerm[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((term) => {
    const parsedTerm = parseTreeMetadataTerm(term);

    return parsedTerm ? [parsedTerm] : [];
  });
}

/** Validates a single tree term and keeps only graph-relevant fields. */
function parseTreeMetadataTerm(value: unknown): EtymologyTreeMetadataTerm | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    langCode: stringValue(value.lang),
    term: stringValue(value.term),
    alt: stringValue(value.alt),
    uncertain: value.is_uncertain === true,
    children: parseTreeMetadataRelations(value.children)
  };
}

/** Validates child relation objects that connect one tree term to its source terms. */
function parseTreeMetadataRelations(value: unknown): EtymologyTreeMetadataRelation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((relation) => {
    if (!isRecord(relation)) {
      return [];
    }

    return [
      {
        keyword: stringValue(relation.keyword),
        isGroup: relation.is_group === true,
        terms: parseTreeMetadataTerms(relation.terms)
      }
    ];
  });
}

/** Reads the source term arguments shared by inheritance, borrowing, and derivation templates. */
function templateTerm(template: WiktextractTemplate): { langCode: string; term: string } | undefined {
  const langCode = trimOptional(template.args?.["2"]);
  const term = trimOptional(template.args?.["3"]);

  if (!langCode || !term || term === "-") {
    return undefined;
  }

  return { langCode, term };
}

/** Preserves uncertainty when Wiktionary template parameters mark a relationship as qualified. */
function templateIsUncertain(template: WiktextractTemplate): boolean {
  const values = Object.values(template.args ?? {}).map((value) => value.toLocaleLowerCase());

  return uncertaintyTags.some((uncertaintyTag) => values.some((value) => value.includes(uncertaintyTag)));
}

/** Extracts recursive descendant links that Wiktextract provides outside rendered etymology trees. */
function extractDescendantEdges(
  entry: WiktextractEntry,
  currentNode: GraphNode,
  nodesById: Map<string, GraphNode>,
  originatingEntryId: string
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  appendDescendantEdges(
    entry.descendants ?? [],
    currentNode,
    entry.etymology_number,
    originatingEntryId,
    nodesById,
    edges
  );

  return edges;
}

/** Walks nested descendants while preserving the immediate parent-child relationship at each level. */
function appendDescendantEdges(
  descendants: WiktextractDescendant[],
  parentNode: GraphNode,
  etymologyNumber: number | undefined,
  originatingEntryId: string,
  nodesById: Map<string, GraphNode>,
  edges: GraphEdge[]
): void {
  for (const descendant of descendants) {
    if (!descendant.lang_code || !descendant.word) {
      continue;
    }

    const descendantNode = makeNode(descendant.lang_code, descendant.word);
    const edgeType = inferDescendantEdgeType(descendant);
    nodesById.set(descendantNode.id, descendantNode);
    edges.push({
      id: makeGraphEdgeId(descendantNode.id, edgeType, parentNode.id, originatingEntryId),
      fromNodeId: descendantNode.id,
      toNodeId: parentNode.id,
      type: edgeType,
      source: "wiktextract",
      etymologyNumber,
      templateName: "descendants",
      uncertain: descendantIsUncertain(descendant),
      originatingEntryId
    });

    appendDescendantEdges(
      descendant.descendants ?? [],
      descendantNode,
      etymologyNumber,
      originatingEntryId,
      nodesById,
      edges
    );
  }
}

/** Infers the most specific relationship available from descendant tags, defaulting to inheritance. */
function inferDescendantEdgeType(descendant: WiktextractDescendant): GraphEdge["type"] {
  const normalizedTags = descendantTags(descendant);
  const matchedEdgeType = descendantTagEdgeTypes.find(({ tagIncludes }) =>
    normalizedTags.some((tag) => tag.includes(tagIncludes))
  )?.edgeType;

  return matchedEdgeType ?? "inherited_from";
}

/** Marks uncertainty when Wiktextract tags explicitly qualify the descendant relationship. */
function descendantIsUncertain(descendant: WiktextractDescendant): boolean {
  const normalizedTags = descendantTags(descendant);

  return uncertaintyTags.some((uncertaintyTag) => normalizedTags.some((tag) => tag.includes(uncertaintyTag)));
}

/** Normalizes descendant tags across raw and canonical Wiktextract tag fields. */
function descendantTags(descendant: WiktextractDescendant): string[] {
  return normalizeStringList([...(descendant.raw_tags ?? []), ...(descendant.tags ?? [])]).map((tag) =>
    tag.toLocaleLowerCase()
  );
}

/** Parses Wiktextract tree expansions because they preserve adjacency missing from flat templates. */
function parseEtymologyTreeTerms(expansion: string): EtymologyTreeTerm[] {
  const terms: EtymologyTreeTerm[] = [];
  const tokenPattern =
    /"term"\s*:\s*"([^"]+)"|"lang"\s*:\s*"([^"]+)"|"keyword"\s*:\s*"([^"]+)"/g;
  let pendingTerm: Partial<EtymologyTreeTerm> = {};
  let skipPendingTerm = false;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(expansion)) !== null) {
    const [, term, langCode, keyword] = match;

    if (term) {
      skipPendingTerm =
        treeMetadataTokenIsInStructuralGroup(expansion, match.index) ||
        treeMetadataTokenIsInNonAncestryRelation(expansion, match.index);
      pendingTerm = {
        ...pendingTerm,
        term,
        uncertain: termObjectIsUncertain(expansion, match.index)
      };
      continue;
    }

    if (langCode) {
      if (skipPendingTerm) {
        pendingTerm = {};
        skipPendingTerm = false;
        continue;
      }

      pendingTerm = {
        ...pendingTerm,
        langCode
      };

      if (pendingTerm.term && pendingTerm.langCode) {
        terms.push({
          langCode: pendingTerm.langCode,
          term: pendingTerm.term,
          edgeTypeToParent: pendingTerm.edgeTypeToParent,
          uncertain: pendingTerm.uncertain ?? false
        });
        pendingTerm = {};
      }
      continue;
    }

    if (keyword) {
      if (treeMetadataTokenIsInStructuralGroup(expansion, match.index)) {
        continue;
      }

      const edgeType = parseEtymologyKeywordEdgeType(keyword);
      if (terms.length > 0 && edgeType) {
        terms[terms.length - 1].edgeTypeToParent = edgeType;
      } else if (edgeType) {
        pendingTerm = {
          ...pendingTerm,
          edgeTypeToParent: edgeType
        };
      }
    }
  }

  return prependMissingTreeHeaderParent(expansion, terms);
}

/**
 * Wiktextract sometimes prints the top PIE row in the visible "Etymology tree" header but omits it
 * from the embedded term metadata. Only adopt the immediate missing parent above the first metadata
 * term, avoiding component rows such as roots/suffixes that are not a simple linear ancestry chain.
 */
function prependMissingTreeHeaderParent(expansion: string, metadataTerms: EtymologyTreeTerm[]): EtymologyTreeTerm[] {
  if (metadataTerms.length === 0) {
    return metadataTerms;
  }

  const headerTerms = parseEtymologyTreeHeaderTerms(expansion);
  const metadataRootIndex = headerTerms.findIndex(
    (headerTerm) =>
      headerTerm.langCode === metadataTerms[0].langCode && headerTerm.term === metadataTerms[0].term
  );

  if (metadataRootIndex <= 0) {
    return metadataTerms;
  }

  const missingParent = {
    ...headerTerms[metadataRootIndex - 1],
    edgeTypeToParent: metadataTerms[0].edgeTypeToParent
  };

  return [missingParent, ...metadataTerms];
}

/** Reads the visible Etymology tree rows before Wiktextract's embedded template metadata starts. */
function parseEtymologyTreeHeaderTerms(expansion: string): EtymologyTreeTerm[] {
  const terms: EtymologyTreeTerm[] = [];
  if (!expansion.startsWith("Etymology tree\n")) {
    return terms;
  }

  for (const line of expansion.split("\n").slice(1)) {
    if (!line || line.includes("[Appendix:") || line.includes('"')) {
      break;
    }

    const term = parseEtymologyTreeHeaderTerm(line);
    if (term) {
      terms.push(term);
    }
  }

  return terms;
}

/** Parses one visible tree row using the small set of language labels present in tree headers. */
function parseEtymologyTreeHeaderTerm(line: string): EtymologyTreeTerm | undefined {
  for (const [languageName, langCode] of etymologyTreeLanguageCodesByName) {
    const prefix = `${languageName} `;
    if (!line.startsWith(prefix)) {
      continue;
    }

    const term = line.slice(prefix.length).trim().replace(/\.$/, "");
    if (!term) {
      return undefined;
    }

    return {
      langCode,
      term: term.replace(/\?$/, ""),
      uncertain: term.endsWith("?")
    };
  }

  return undefined;
}

/** Reads uncertainty from the same rendered Wiktextract term object as the current term token. */
function termObjectIsUncertain(expansion: string, tokenIndex: number): boolean {
  const objectBounds = containingObjectBounds(expansion, tokenIndex);

  if (!objectBounds) {
    return false;
  }

  return /"is_uncertain"\s*:\s*true/.test(expansion.slice(objectBounds.start, objectBounds.end + 1));
}

/** Skips hidden affix/equivalent component groups so compound pieces do not become ancestry terms. */
function treeMetadataTokenIsInStructuralGroup(expansion: string, tokenIndex: number): boolean {
  let objectBounds = containingObjectBounds(expansion, tokenIndex);

  while (objectBounds) {
    const objectSource = expansion.slice(objectBounds.start, objectBounds.end + 1);
    if (
      topLevelObjectBooleanFieldIs(objectSource, "is_group", true) &&
      /^(?:afeq|affix)$/.test(topLevelObjectStringField(objectSource, "keyword") ?? "")
    ) {
      return true;
    }

    if (objectBounds.start === 0) {
      return false;
    }
    objectBounds = containingObjectBounds(expansion, objectBounds.start - 1);
  }

  return false;
}

/** Skips terms under side-note relations such as `influence` that are not source ancestry. */
function treeMetadataTokenIsInNonAncestryRelation(expansion: string, tokenIndex: number): boolean {
  let objectBounds = containingObjectBounds(expansion, tokenIndex);

  while (objectBounds) {
    const objectSource = expansion.slice(objectBounds.start, objectBounds.end + 1);
    const keyword = topLevelObjectStringField(objectSource, "keyword");
    if (
      keyword &&
      !parseEtymologyKeywordEdgeType(keyword) &&
      topLevelObjectFieldValue(objectSource, "terms") !== undefined
    ) {
      return true;
    }

    if (objectBounds.start === 0) {
      return false;
    }
    objectBounds = containingObjectBounds(expansion, objectBounds.start - 1);
  }

  return false;
}

/** Checks a boolean field directly on a rendered metadata object, ignoring nested child objects. */
function topLevelObjectBooleanFieldIs(objectSource: string, fieldName: string, expectedValue: boolean): boolean {
  return topLevelObjectFieldValue(objectSource, fieldName) === String(expectedValue);
}

/** Reads a string field directly on a rendered metadata object, ignoring nested child objects. */
function topLevelObjectStringField(objectSource: string, fieldName: string): string | undefined {
  const value = topLevelObjectFieldValue(objectSource, fieldName);
  const match = value ? /^"([^"]*)"$/.exec(value) : undefined;

  return match?.[1];
}

/** Splits a rendered metadata object into top-level fields without looking inside child arrays. */
function topLevelObjectFieldValue(objectSource: string, fieldName: string): string | undefined {
  for (const field of topLevelObjectFields(objectSource)) {
    const match = /^\s*"([^"]+)"\s*:\s*(.*?)\s*$/s.exec(field);
    if (match?.[1] === fieldName) {
      return match[2];
    }
  }

  return undefined;
}

/** Tokenizes object fields while preserving nested arrays and objects as field values. */
function topLevelObjectFields(objectSource: string): string[] {
  const fields: string[] = [];
  let depth = 1;
  let fieldStartIndex = 1;
  let inString = false;
  let escaped = false;

  for (let index = 1; index < objectSource.length - 1; index += 1) {
    const char = objectSource[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      continue;
    }

    if (char === "," && depth === 1) {
      fields.push(objectSource.slice(fieldStartIndex, index));
      fieldStartIndex = index + 1;
    }
  }

  fields.push(objectSource.slice(fieldStartIndex, -1));

  return fields;
}

/** Locates the nearest brace-delimited object that contains a token in Wiktextract's rendered metadata. */
function containingObjectBounds(source: string, tokenIndex: number): { start: number; end: number } | undefined {
  let depth = 0;
  let containingStart: number | undefined;

  for (let index = tokenIndex; index >= 0; index -= 1) {
    const char = source[index];

    if (char === "}") {
      depth += 1;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        containingStart = index;
        break;
      }

      depth -= 1;
    }
  }

  if (containingStart === undefined) {
    return undefined;
  }

  const containingEnd = matchingCloseBrace(source, containingStart);
  if (containingEnd === undefined) {
    return undefined;
  }

  return { start: containingStart, end: containingEnd };
}

/** Finds the closing bracket for a rendered metadata array without being confused by quoted brackets. */
function matchingCloseBracket(source: string, openBracketIndex: number): number | undefined {
  return matchingCloseDelimiter(source, openBracketIndex, "[", "]");
}

/** Finds the closing brace for a rendered metadata object without being confused by quoted braces. */
function matchingCloseBrace(source: string, openBraceIndex: number): number | undefined {
  return matchingCloseDelimiter(source, openBraceIndex, "{", "}");
}

/** Matches balanced metadata delimiters while respecting string literals. */
function matchingCloseDelimiter(
  source: string,
  openDelimiterIndex: number,
  openDelimiter: string,
  closeDelimiter: string
): number | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = openDelimiterIndex; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openDelimiter) {
      depth += 1;
      continue;
    }

    if (char === closeDelimiter) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

/** Narrows unknown JSON objects before reading optional tree metadata fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads an optional string field from parsed Wiktextract metadata. */
function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Converts Wiktextract tree relationship keywords into the shared edge type model. */
function parseEtymologyKeywordEdgeType(keyword: string): GraphEdge["type"] | undefined {
  const normalizedKeyword = keyword.replace(/\+$/, "");

  return etymologyKeywordEdgeTypes[normalizedKeyword as keyof typeof etymologyKeywordEdgeTypes];
}

/** Creates the canonical graph node representation used by previews and imports. */
function makeNode(langCode: string, word: string): GraphNode {
  const graphWord = canonicalGraphWord(langCode, graphNodeWord(word));

  return {
    id: makeNodeId(langCode, graphWord),
    langCode,
    word: graphWord,
    normalizedWord: normalizeWord(graphWord)
  };
}

/** Removes Wiktionary link fragments so section anchors do not become part of term identity. */
function graphNodeWord(word: string): string {
  return trimOptional(word.split("#")[0]) ?? word;
}

/** Creates the lexical entry payload that preserves dictionary metadata outside graph identity. */
function makeLexicalEntry(
  entry: WiktextractEntry,
  node: GraphNode,
  originatingEntryId: string,
  sourceMetadata: ImportSourceMetadata | undefined
): LexicalEntry {
  const pronunciations = extractPronunciations(entry.sounds ?? []);
  const senses = extractSenses(entry.senses ?? []);
  const primaryPronunciation = pronunciations[0];
  const primarySense = senses[0];

  return {
    id: originatingEntryId,
    nodeId: node.id,
    langCode: node.langCode,
    word: node.word,
    normalizedWord: node.normalizedWord,
    pos: entry.pos,
    etymologyNumber: entry.etymology_number,
    primaryIpa: primaryPronunciation?.ipa,
    primaryIpaLabel: primaryPronunciation?.label,
    primaryGloss: primarySense?.gloss,
    pronunciations,
    senses,
    etymologyText: entry.etymology_text,
    sourceLineNumber: sourceMetadata?.lineNumber,
    sourceByteOffset: sourceMetadata?.byteOffset
  };
}

/** Keeps only IPA pronunciation records while preserving accent, region, note, and audio context. */
function extractPronunciations(sounds: WiktextractSound[]): LexicalPronunciation[] {
  return sounds.flatMap((sound) => {
    const ipa = sound.ipa?.trim();

    if (!ipa) {
      return [];
    }

    const tags = normalizeStringList(sound.tags);
    const label = tags.length > 0 ? tags.map(formatWiktextractTag).join(", ") : undefined;

    return [
      {
        ipa,
        tags: tags.length > 0 ? tags : undefined,
        label,
        note: trimOptional(sound.note),
        audio: trimOptional(sound.audio),
        oggUrl: trimOptional(sound.ogg_url),
        mp3Url: trimOptional(sound.mp3_url)
      }
    ];
  });
}

/** Extracts displayable glosses while retaining normalized and raw Wiktionary tags. */
function extractSenses(senses: WiktextractSense[]): LexicalSense[] {
  return senses.flatMap((sense) => {
    const glosses = normalizeStringList(sense.glosses);

    return glosses.map((gloss) => ({
      gloss,
      tags: normalizeStringList(sense.tags),
      rawTags: normalizeStringList(sense.raw_tags)
    }));
  });
}

/** Normalizes optional Wiktextract arrays into compact string lists for JSON storage. */
function normalizeStringList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}

/** Trims optional strings so empty source values do not leak into API payloads. */
function trimOptional(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

/** Turns Wiktextract tags such as General-American into readable labels for compact UI. */
function formatWiktextractTag(tag: string): string {
  return tag
    .split("-")
    .map((part) => (part.length <= 2 ? part.toLocaleUpperCase() : `${part[0]?.toLocaleUpperCase() ?? ""}${part.slice(1)}`))
    .join(" ");
}

/** Parses CLI seed specs into match targets while keeping language codes optional. */
export function parseSeedTargets(value: string): SeedTarget[] {
  return value
    .split(",")
    .map((target) => target.trim())
    .filter((target) => target.length > 0)
    .map((target) => {
      const separatorIndex = target.indexOf(":");
      if (separatorIndex === -1) {
        return { word: target };
      }

      return {
        langCode: target.slice(0, separatorIndex),
        word: target.slice(separatorIndex + 1)
      };
    });
}

/** Builds a lookup that keeps large popular-word target lists cheap during a full dump scan. */
export function buildSeedTargetIndex(targets: SeedTarget[]): SeedTargetIndex {
  const byLanguageAndWord = new Map<string, Map<string, SeedTargetMatch[]>>();
  const byWord = new Map<string, SeedTargetMatch[]>();

  targets.forEach((target, index) => {
    const match = { index, target };
    const normalizedWords = seedTargetNormalizedWords(target.word, target.langCode);

    if (!target.langCode) {
      for (const normalizedWord of normalizedWords) {
        appendSeedTargetMatch(byWord, normalizedWord, match);
      }
      return;
    }

    const languageTargets = byLanguageAndWord.get(target.langCode) ?? new Map<string, SeedTargetMatch[]>();
    for (const normalizedWord of normalizedWords) {
      appendSeedTargetMatch(languageTargets, normalizedWord, match);
    }
    byLanguageAndWord.set(target.langCode, languageTargets);
  });

  return { byLanguageAndWord, byWord };
}

/** Returns the earliest configured target that matches a Wiktextract record. */
export function findMatchingSeedTargetIndex(index: SeedTargetIndex, entry: WiktextractEntry): number | undefined {
  if (!entry.word) {
    return undefined;
  }

  const entryLangCode = entry.lang_code;
  const normalizedWords = entrySeedNormalizedWords(entry);
  const languageTargetMap = entryLangCode ? index.byLanguageAndWord.get(entryLangCode) : undefined;
  const languageMatches = languageTargetMap
    ? normalizedWords.flatMap((normalizedWord) => languageTargetMap.get(normalizedWord) ?? [])
    : [];
  const wildcardMatches = normalizedWords.flatMap((normalizedWord) => index.byWord.get(normalizedWord) ?? []);
  const matches = [...languageMatches, ...wildcardMatches]
    .filter((match) => seedTargetMatches(match.target, entry))
    .sort((left, right) => left.index - right.index);

  return matches[0]?.index;
}

/** Appends an indexed target match while keeping insertion logic in one place. */
function appendSeedTargetMatch(
  targetMap: Map<string, SeedTargetMatch[]>,
  normalizedWord: string,
  match: SeedTargetMatch
): void {
  const matches = targetMap.get(normalizedWord) ?? [];
  matches.push(match);
  targetMap.set(normalizedWord, matches);
}

/** Reads the optional resumable import checkpoint from disk. */
async function readImportCheckpoint(path: string): Promise<ImportCheckpoint | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ImportCheckpoint;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

/** Persists progress so interrupted JSONL imports can resume from a line boundary. */
async function writeImportCheckpoint(path: string, checkpoint: ImportCheckpoint): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

/** Checks whether a Wiktextract entry is one of the configured seed targets. */
function seedTargetMatches(target: SeedTarget, entry: WiktextractEntry): boolean {
  if (!entry.word) {
    return false;
  }

  if (target.langCode && entry.lang_code !== target.langCode) {
    return false;
  }

  if (isCaseOnlyProperNameHomograph(target, entry.word, entry.pos)) {
    return false;
  }

  const targetWords = seedTargetNormalizedWords(target.word, target.langCode);
  return entrySeedNormalizedWords(entry).some((normalizedWord) => targetWords.includes(normalizedWord));
}

/** Matches reconstructed graph targets against Wiktextract entries that may omit the leading star. */
function seedTargetNormalizedWords(word: string, langCode: string | undefined): string[] {
  const canonicalWord = langCode ? canonicalGraphWord(langCode, word) : word;
  const normalizedWord = normalizeWord(canonicalWord);
  const unstarredWord = canonicalWord.startsWith("*") ? normalizeWord(canonicalWord.slice(1)) : undefined;

  return [...new Set([normalizedWord, ...(unstarredWord ? [unstarredWord] : [])])];
}

/** Looks up raw and canonical spellings because Wiktextract is inconsistent about proto stars. */
function entrySeedNormalizedWords(entry: WiktextractEntry): string[] {
  if (!entry.word) {
    return [];
  }

  const rawEntryWord = entry.word;
  const rawWord = normalizeWord(rawEntryWord);
  const canonicalWord = entry.lang_code ? normalizeWord(canonicalGraphWord(entry.lang_code, rawEntryWord)) : rawWord;

  return [...new Set([canonicalWord, rawWord])];
}

/** Keeps lowercase seed targets from being satisfied by earlier proper-name homographs. */
function isCaseOnlyProperNameHomograph(
  target: SeedTarget,
  entryWord: string,
  entryPos: string | undefined
): boolean {
  return entryPos === "name" && entryWord !== target.word && normalizeWord(entryWord) === normalizeWord(target.word);
}

/** Builds stable reporting keys for seed extraction counts. */
export function seedTargetKey(target: SeedTarget): string {
  return `${target.langCode ?? "*"}:${normalizeWord(
    target.langCode ? canonicalGraphWord(target.langCode, target.word) : target.word
  )}`;
}

/** Treats checkpoints as reusable only while their source JSONL file is unchanged. */
function checkpointMatchesInput(
  checkpoint: ImportCheckpoint,
  inputStats: { size: number; mtimeMs: number }
): boolean {
  return checkpoint.inputFileSize === inputStats.size && checkpoint.inputFileModifiedAtMs === inputStats.mtimeMs;
}
