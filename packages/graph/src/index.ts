import { z } from "zod";

export const EDGE_TYPES = [
  "inherited_from",
  "derived_from",
  "borrowed_from",
  "compound_of",
  "cognate_with",
  "doublet_of",
  "descendant_of",
  "related_to",
  "see_also"
] as const;

export const edgeTypeSchema = z.enum(EDGE_TYPES);

export type EdgeType = z.infer<typeof edgeTypeSchema>;

export const lexicalPronunciationSchema = z.object({
  ipa: z.string(),
  tags: z.array(z.string()).optional(),
  label: z.string().optional(),
  note: z.string().optional(),
  audio: z.string().optional(),
  oggUrl: z.string().optional(),
  mp3Url: z.string().optional()
});

export type LexicalPronunciation = z.infer<typeof lexicalPronunciationSchema>;

export const lexicalSenseSchema = z.object({
  gloss: z.string(),
  tags: z.array(z.string()).optional(),
  rawTags: z.array(z.string()).optional()
});

export type LexicalSense = z.infer<typeof lexicalSenseSchema>;

export const lexicalSummarySchema = z.object({
  ipa: z.string().optional(),
  ipaLabel: z.string().optional(),
  definition: z.string().optional(),
  pos: z.string().optional(),
  entryCount: z.number().int().min(0).optional()
});

export type LexicalSummary = z.infer<typeof lexicalSummarySchema>;

export const graphNodeSchema = z.object({
  id: z.string(),
  langCode: z.string(),
  langName: z.string().optional(),
  word: z.string(),
  normalizedWord: z.string(),
  lexicalSummary: lexicalSummarySchema.optional()
});

export type GraphNode = z.infer<typeof graphNodeSchema>;

export const lexicalEntrySchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  langCode: z.string(),
  word: z.string(),
  normalizedWord: z.string(),
  pos: z.string().optional(),
  etymologyNumber: z.number().int().optional(),
  primaryIpa: z.string().optional(),
  primaryIpaLabel: z.string().optional(),
  primaryGloss: z.string().optional(),
  pronunciations: z.array(lexicalPronunciationSchema),
  senses: z.array(lexicalSenseSchema),
  etymologyText: z.string().optional(),
  sourceLineNumber: z.number().int().min(1).optional(),
  sourceByteOffset: z.number().int().min(0).optional()
});

export type LexicalEntry = z.infer<typeof lexicalEntrySchema>;

export const languageSchema = z.object({
  code: z.string(),
  canonicalName: z.string()
});

export type Language = z.infer<typeof languageSchema>;

export const languagesResultSchema = z.object({
  languages: z.array(languageSchema)
});

export type LanguagesResult = z.infer<typeof languagesResultSchema>;

export const graphEdgeSchema = z.object({
  id: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  type: edgeTypeSchema,
  source: z.literal("wiktextract"),
  etymologyNumber: z.number().int().optional(),
  templateName: z.string().optional(),
  uncertain: z.boolean().optional(),
  originatingEntryId: z.string()
});

export type GraphEdge = z.infer<typeof graphEdgeSchema>;

export const graphTraversalNodeSchema = graphNodeSchema.extend({
  depth: z.number().int().min(0)
});

export type GraphTraversalNode = z.infer<typeof graphTraversalNodeSchema>;

export const etymologyGraphSchema = z.object({
  rootNodeId: z.string(),
  nodes: z.array(graphTraversalNodeSchema),
  edges: z.array(graphEdgeSchema),
  maxDepth: z.number().int().min(1)
});

export type EtymologyGraph = z.infer<typeof etymologyGraphSchema>;

/** Keeps default ancestry walks deep enough for longer attested source chains. */
export const DEFAULT_ANCESTOR_MAX_DEPTH = 10;

/** Optional entry anchor that scopes graph traversal to a single lexical entry's chain. */
const entryAnchorShape = {
  pos: z.string().trim().min(1).optional(),
  etymologyNumber: z.number().int().min(0).optional()
};

export const ancestorsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.number().int().min(1).max(12),
  ...entryAnchorShape
});

export type AncestorsQuery = z.infer<typeof ancestorsQuerySchema>;

export const ancestorsResultSchema = z.object({
  graph: etymologyGraphSchema.nullable()
});

export type AncestorsResult = z.infer<typeof ancestorsResultSchema>;

export const ancestorPathQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  ancestorLangCode: z.string().trim().min(1),
  ancestorWord: z.string().trim().min(1),
  maxDepth: z.number().int().min(1).max(12),
  ...entryAnchorShape
});

export type AncestorPathQuery = z.infer<typeof ancestorPathQuerySchema>;

export const ancestorPathResultSchema = z.object({
  graph: etymologyGraphSchema.nullable()
});

export type AncestorPathResult = z.infer<typeof ancestorPathResultSchema>;

export const childTermsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.number().int().min(1).max(100),
  ...entryAnchorShape
});

export type ChildTermsQuery = z.infer<typeof childTermsQuerySchema>;

export const childTermsResultSchema = z.object({
  graph: etymologyGraphSchema.nullable()
});

export type ChildTermsResult = z.infer<typeof childTermsResultSchema>;

export const doubletsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.number().int().min(1).max(12),
  limit: z.number().int().min(1).max(50),
  ...entryAnchorShape
});

export type DoubletsQuery = z.infer<typeof doubletsQuerySchema>;

export const doubletsResultSchema = z.object({
  graph: etymologyGraphSchema.nullable()
});

export type DoubletsResult = z.infer<typeof doubletsResultSchema>;

export const doubletGroupsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  maxDepth: z.number().int().min(1).max(12),
  limit: z.number().int().min(1).max(100),
  entryLimit: z.number().int().min(2).max(25),
  cursor: z.string().trim().regex(/^\d+:.+$/).optional()
});

export type DoubletGroupsQuery = z.infer<typeof doubletGroupsQuerySchema>;

export const termEntrySummarySchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  langCode: z.string(),
  word: z.string(),
  normalizedWord: z.string(),
  pos: z.string().optional(),
  etymologyNumber: z.number().int().optional(),
  primaryIpa: z.string().optional(),
  primaryIpaLabel: z.string().optional(),
  primaryGloss: z.string().optional()
});

export type TermEntrySummary = z.infer<typeof termEntrySummarySchema>;

export const doubletGroupSchema = z.object({
  sharedAncestor: graphNodeSchema,
  entries: z.array(termEntrySummarySchema),
  entryCount: z.number().int().min(2),
  minDepth: z.number().int().min(1)
});

export type DoubletGroup = z.infer<typeof doubletGroupSchema>;

export const doubletGroupsResultSchema = z.object({
  groups: z.array(doubletGroupSchema),
  nextCursor: z.string().optional()
});

export type DoubletGroupsResult = z.infer<typeof doubletGroupsResultSchema>;

export const termEntriesQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1)
});

export type TermEntriesQuery = z.infer<typeof termEntriesQuerySchema>;

export const termEntriesResultSchema = z.object({
  entries: z.array(termEntrySummarySchema)
});

export type TermEntriesResult = z.infer<typeof termEntriesResultSchema>;

export const termsWithAncestorLanguageQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  ancestorLangCode: z.string().trim().min(1),
  maxDepth: z.number().int().min(1).max(12),
  limit: z.number().int().min(1).max(100),
  cursor: z.string().trim().min(1).optional()
});

export type TermsWithAncestorLanguageQuery = z.infer<typeof termsWithAncestorLanguageQuerySchema>;

export const termsWithAncestorLanguageMatchSchema = z.object({
  entry: termEntrySummarySchema,
  node: graphNodeSchema,
  matchedAncestor: graphNodeSchema,
  depth: z.number().int().min(1),
  pathEdgeIds: z.array(z.string())
});

export type TermsWithAncestorLanguageMatch = z.infer<typeof termsWithAncestorLanguageMatchSchema>;

export const termsWithAncestorLanguageResultSchema = z.object({
  matches: z.array(termsWithAncestorLanguageMatchSchema),
  nextCursor: z.string().optional()
});

export type TermsWithAncestorLanguageResult = z.infer<typeof termsWithAncestorLanguageResultSchema>;

export const searchTermsQuerySchema = z.object({
  query: z.string(),
  langCode: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50)
});

export type SearchTermsQuery = z.infer<typeof searchTermsQuerySchema>;

export const searchTermsResultSchema = z.object({
  query: z.string(),
  results: z.array(graphNodeSchema)
});

export type SearchTermsResult = z.infer<typeof searchTermsResultSchema>;

/** Normalizes terms so graph lookups use the same key shape as imports. */
export function normalizeWord(word: string): string {
  return word.trim().normalize("NFC").toLocaleLowerCase();
}

/** Creates stable term IDs shared by import, API, and frontend graph code. */
export function makeNodeId(langCode: string, word: string): string {
  return `${langCode}:${normalizeWord(word)}`;
}

/** Builds stable lexical entry IDs that disambiguate homograph entries by part of speech and etymology section. */
export function makeLexicalEntryId(
  nodeId: string,
  pos: string | undefined,
  etymologyNumber: number | undefined
): string {
  return `${nodeId}:entry:${normalizeWord(pos ?? "unknown")}:${etymologyNumber ?? 0}`;
}

/** Pins each graph edge to the entry that declared it so traversal cannot cross unrelated homograph histories. */
export function makeGraphEdgeId(
  fromNodeId: string,
  edgeType: EdgeType,
  toNodeId: string,
  originatingEntryId: string
): string {
  return `${fromNodeId}:${edgeType}:${toNodeId}:from:${originatingEntryId}`;
}

export const ANCESTOR_EDGE_TYPES = [
  "inherited_from",
  "derived_from",
  "borrowed_from",
  "descendant_of"
] as const satisfies readonly EdgeType[];

export type AncestorEdgeType = (typeof ANCESTOR_EDGE_TYPES)[number];

export type AncestorTraversalEntry = Pick<LexicalEntry, "id" | "nodeId" | "pos" | "etymologyNumber">;

export type AncestorTraversalInput = {
  edges: readonly GraphEdge[];
  lexicalEntries: readonly AncestorTraversalEntry[];
  rootEntryId: string;
  edgeTypes: readonly AncestorEdgeType[];
  maxDepth: number;
};

export type AncestorTraversalResult = {
  rootNodeId: string;
  nodeDepthsById: Map<string, number>;
  reachedEdgeIds: Set<string>;
  allowedEntryIds: Set<string>;
};

/**
 * Walks ancestor edges away from a seed entry while preventing traversal from crossing into unrelated
 * homograph histories. Edges are followed only when their originating entry is already in the allowed set,
 * and additional entries are admitted at a visited node only when they agree with the seed's own chain
 * (case b) or when they are the only entry homed at that node (case a). This is the reference behavior
 * the Postgres traversal mirrors in SQL.
 */
export function traverseAncestors(input: AncestorTraversalInput): AncestorTraversalResult {
  const entriesByNode = indexEntriesByNode(input.lexicalEntries);
  const edgesByFromNode = indexEdgesByFromNode(input.edges, input.edgeTypes);
  const edgesByEntryFromNode = indexEdgesByEntryFromNode(input.edges, input.edgeTypes);
  const rootEntry = input.lexicalEntries.find((entry) => entry.id === input.rootEntryId);

  if (!rootEntry) {
    throw new Error(`Ancestor traversal could not find lexical entry ${input.rootEntryId}`);
  }

  const allowedEntryIds = new Set<string>([rootEntry.id]);
  const nodeDepthsById = new Map<string, number>([[rootEntry.nodeId, 0]]);
  const reachedEdgeIds = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number; path: ReadonlySet<string> }> = [
    { nodeId: rootEntry.nodeId, depth: 0, path: new Set([rootEntry.nodeId]) }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= input.maxDepth) {
      continue;
    }

    const candidateEdges = edgesByFromNode.get(current.nodeId) ?? [];
    expandAllowedEntries({
      fromNodeId: current.nodeId,
      candidateEdges,
      allowedEntryIds,
      entriesByNode,
      edgesByEntryFromNode
    });

    for (const edge of candidateEdges) {
      if (!allowedEntryIds.has(edge.originatingEntryId)) {
        continue;
      }

      if (current.path.has(edge.toNodeId)) {
        continue;
      }

      reachedEdgeIds.add(edge.id);
      const nextDepth = current.depth + 1;
      const previousDepth = nodeDepthsById.get(edge.toNodeId);
      if (previousDepth === undefined || nextDepth < previousDepth) {
        nodeDepthsById.set(edge.toNodeId, nextDepth);
      }
      const nextPath = new Set(current.path);
      nextPath.add(edge.toNodeId);
      queue.push({ nodeId: edge.toNodeId, depth: nextDepth, path: nextPath });
    }
  }

  return {
    rootNodeId: rootEntry.nodeId,
    nodeDepthsById,
    reachedEdgeIds,
    allowedEntryIds
  };
}

/**
 * Admits homed-at-N entries into the allowed set when their own outgoing chain agrees with the seed's
 * (case b) or when they are the only lexical entry at N (case a).
 */
function expandAllowedEntries(args: {
  fromNodeId: string;
  candidateEdges: readonly GraphEdge[];
  allowedEntryIds: Set<string>;
  entriesByNode: Map<string, readonly AncestorTraversalEntry[]>;
  edgesByEntryFromNode: Map<string, Map<string, Set<string>>>;
}): void {
  const homedEntries = args.entriesByNode.get(args.fromNodeId) ?? [];
  if (homedEntries.length === 0) {
    return;
  }

  const allowedTargets = new Set<string>();
  for (const edge of args.candidateEdges) {
    if (args.allowedEntryIds.has(edge.originatingEntryId)) {
      allowedTargets.add(edge.toNodeId);
    }
  }

  for (const entry of homedEntries) {
    if (args.allowedEntryIds.has(entry.id)) {
      continue;
    }

    if (homedEntries.length === 1) {
      args.allowedEntryIds.add(entry.id);
      continue;
    }

    const entryTargets = args.edgesByEntryFromNode.get(entry.id)?.get(args.fromNodeId);
    if (!entryTargets) {
      continue;
    }

    for (const target of entryTargets) {
      if (allowedTargets.has(target)) {
        args.allowedEntryIds.add(entry.id);
        break;
      }
    }
  }
}

/** Indexes lexical entries by the term node they live at so the traversal can look up homographs cheaply. */
function indexEntriesByNode(
  entries: readonly AncestorTraversalEntry[]
): Map<string, readonly AncestorTraversalEntry[]> {
  const byNode = new Map<string, AncestorTraversalEntry[]>();
  for (const entry of entries) {
    const bucket = byNode.get(entry.nodeId);
    if (bucket) {
      bucket.push(entry);
    } else {
      byNode.set(entry.nodeId, [entry]);
    }
  }

  return byNode;
}

/** Indexes ancestor-typed edges by their from-node for fast outgoing-edge lookup during traversal. */
function indexEdgesByFromNode(
  edges: readonly GraphEdge[],
  edgeTypes: readonly AncestorEdgeType[]
): Map<string, GraphEdge[]> {
  const allowedTypes = new Set<string>(edgeTypes);
  const byFromNode = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    if (!allowedTypes.has(edge.type)) {
      continue;
    }
    const bucket = byFromNode.get(edge.fromNodeId);
    if (bucket) {
      bucket.push(edge);
    } else {
      byFromNode.set(edge.fromNodeId, [edge]);
    }
  }

  return byFromNode;
}

/** Indexes ancestor edges by (entry, from-node) so adoption can compare candidate entries' own targets. */
function indexEdgesByEntryFromNode(
  edges: readonly GraphEdge[],
  edgeTypes: readonly AncestorEdgeType[]
): Map<string, Map<string, Set<string>>> {
  const allowedTypes = new Set<string>(edgeTypes);
  const byEntry = new Map<string, Map<string, Set<string>>>();
  for (const edge of edges) {
    if (!allowedTypes.has(edge.type)) {
      continue;
    }
    const fromMap = byEntry.get(edge.originatingEntryId) ?? new Map<string, Set<string>>();
    const targetSet = fromMap.get(edge.fromNodeId) ?? new Set<string>();
    targetSet.add(edge.toNodeId);
    fromMap.set(edge.fromNodeId, targetSet);
    byEntry.set(edge.originatingEntryId, fromMap);
  }

  return byEntry;
}
