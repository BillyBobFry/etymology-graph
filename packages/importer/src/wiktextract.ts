import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { finished } from "node:stream/promises";

import {
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
  borrowed: "borrowed_from",
  bor: "borrowed_from"
} as const;

const descendantTagEdgeTypes = [
  { tagIncludes: "borrow", edgeType: "borrowed_from" },
  { tagIncludes: "derived", edgeType: "derived_from" },
  { tagIncludes: "inherited", edgeType: "inherited_from" }
] as const;

const uncertaintyTags = ["uncertain", "possibly", "possible", "perhaps", "maybe"] as const;

type EtymologyTreeTerm = {
  langCode: string;
  term: string;
  edgeTypeToParent?: GraphEdge["type"];
  uncertain: boolean;
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
      const targetIndex = options.targets.findIndex((target) => seedTargetMatches(target, record.entry));

      if (targetIndex === -1) {
        continue;
      }

      const key = targetKeys[targetIndex];
      if (matchesByTarget[key] >= limitPerTarget) {
        continue;
      }

      if (!output.write(`${record.rawLine}\n`)) {
        await new Promise<void>((resolve) => output.once("drain", resolve));
      }

      matchesByTarget[key] += 1;
      writtenRecords += 1;

      if (Object.values(matchesByTarget).every((count) => count >= limitPerTarget)) {
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
  const nodesById = new Map<string, GraphNode>([[currentNode.id, currentNode]]);
  const edges = [
    ...extractTemplateAncestryEdges(entry, currentNode, nodesById),
    ...extractTreeAncestryEdges(entry, currentNode, nodesById),
    ...extractDescendantEdges(entry, currentNode, nodesById)
  ];
  const lexicalEntries = [makeLexicalEntry(entry, currentNode, sourceMetadata)];

  return {
    nodes: [...nodesById.values()],
    edges,
    lexicalEntries
  };
}

/** Extracts adjacent ancestry edges from sequential Wiktionary etymology templates. */
function extractTemplateAncestryEdges(
  entry: WiktextractEntry,
  currentNode: GraphNode,
  nodesById: Map<string, GraphNode>
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  let childNode = currentNode;

  for (const template of entry.etymology_templates ?? []) {
    const edgeType = parseEtymologyKeywordEdgeType(template.name ?? "");
    const parentTerm = templateTerm(template);

    if (!edgeType || !parentTerm) {
      continue;
    }

    const parentNode = makeNode(parentTerm.langCode, parentTerm.term);
    nodesById.set(childNode.id, childNode);
    nodesById.set(parentNode.id, parentNode);
    edges.push({
      id: `${childNode.id}:${edgeType}:${parentNode.id}`,
      fromNodeId: childNode.id,
      toNodeId: parentNode.id,
      type: edgeType,
      source: "wiktextract",
      etymologyNumber: entry.etymology_number,
      templateName: template.name,
      uncertain: templateIsUncertain(template)
    });

    childNode = parentNode;
  }

  return edges;
}

/** Extracts adjacent ancestry edges from Wiktextract's rendered etymology tree metadata. */
function extractTreeAncestryEdges(
  entry: WiktextractEntry,
  currentNode: GraphNode,
  nodesById: Map<string, GraphNode>
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const template of entry.etymology_templates ?? []) {
    if (template.name !== "etymon" || template.args?.tree !== "1" || !template.expansion) {
      continue;
    }

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
        id: `${childNode.id}:${edgeType}:${parentNode.id}`,
        fromNodeId: childNode.id,
        toNodeId: parentNode.id,
        type: edgeType,
        source: "wiktextract",
        etymologyNumber: entry.etymology_number,
        templateName: template.name,
        uncertain: parentTerm.uncertain
      });
    }
  }

  if (!nodesById.has(currentNode.id)) {
    nodesById.set(currentNode.id, currentNode);
  }

  return edges;
}

/** Reads the source term arguments shared by inheritance, borrowing, and derivation templates. */
function templateTerm(template: WiktextractTemplate): { langCode: string; term: string } | undefined {
  const langCode = trimOptional(template.args?.["2"]);
  const term = trimOptional(template.args?.["3"]);

  if (!langCode || !term) {
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
  nodesById: Map<string, GraphNode>
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  appendDescendantEdges(entry.descendants ?? [], currentNode, entry.etymology_number, nodesById, edges);

  return edges;
}

/** Walks nested descendants while preserving the immediate parent-child relationship at each level. */
function appendDescendantEdges(
  descendants: WiktextractDescendant[],
  parentNode: GraphNode,
  etymologyNumber: number | undefined,
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
      id: `${descendantNode.id}:${edgeType}:${parentNode.id}`,
      fromNodeId: descendantNode.id,
      toNodeId: parentNode.id,
      type: edgeType,
      source: "wiktextract",
      etymologyNumber,
      templateName: "descendants",
      uncertain: descendantIsUncertain(descendant)
    });

    appendDescendantEdges(descendant.descendants ?? [], descendantNode, etymologyNumber, nodesById, edges);
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
    /"is_uncertain"\s*:\s*true|"term"\s*:\s*"([^"]+)"|"lang"\s*:\s*"([^"]+)"|"keyword"\s*:\s*"([^"]+)"/g;
  let pendingTerm: Partial<EtymologyTreeTerm> = {};
  let termIsUncertain = false;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(expansion)) !== null) {
    const [token, term, langCode, keyword] = match;

    if (token.startsWith('"is_uncertain"')) {
      termIsUncertain = true;
      continue;
    }

    if (term) {
      pendingTerm = {
        ...pendingTerm,
        term,
        uncertain: termIsUncertain
      };
      termIsUncertain = false;
      continue;
    }

    if (langCode) {
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

  return terms;
}

/** Converts Wiktextract tree relationship keywords into the shared edge type model. */
function parseEtymologyKeywordEdgeType(keyword: string): GraphEdge["type"] | undefined {
  return etymologyKeywordEdgeTypes[keyword as keyof typeof etymologyKeywordEdgeTypes];
}

/** Creates the canonical graph node representation used by previews and imports. */
function makeNode(langCode: string, word: string): GraphNode {
  return {
    id: makeNodeId(langCode, word),
    langCode,
    word,
    normalizedWord: normalizeWord(word)
  };
}

/** Creates the lexical entry payload that preserves dictionary metadata outside graph identity. */
function makeLexicalEntry(
  entry: WiktextractEntry,
  node: GraphNode,
  sourceMetadata: ImportSourceMetadata | undefined
): LexicalEntry {
  const pronunciations = extractPronunciations(entry.sounds ?? []);
  const senses = extractSenses(entry.senses ?? []);
  const primaryPronunciation = pronunciations[0];
  const primarySense = senses[0];

  return {
    id: makeLexicalEntryId(node.id, entry.pos, entry.etymology_number),
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

/** Builds stable lexical entry IDs without changing the coarser graph node ID shape. */
function makeLexicalEntryId(nodeId: string, pos: string | undefined, etymologyNumber: number | undefined): string {
  return `${nodeId}:entry:${normalizeWord(pos ?? "unknown")}:${etymologyNumber ?? 0}`;
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

  return normalizeWord(entry.word) === normalizeWord(target.word);
}

/** Builds stable reporting keys for seed extraction counts. */
function seedTargetKey(target: SeedTarget): string {
  return `${target.langCode ?? "*"}:${normalizeWord(target.word)}`;
}

/** Treats checkpoints as reusable only while their source JSONL file is unchanged. */
function checkpointMatchesInput(
  checkpoint: ImportCheckpoint,
  inputStats: { size: number; mtimeMs: number }
): boolean {
  return checkpoint.inputFileSize === inputStats.size && checkpoint.inputFileModifiedAtMs === inputStats.mtimeMs;
}
