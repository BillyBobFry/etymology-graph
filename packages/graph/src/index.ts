import { z } from "zod";

export const EDGE_TYPES = [
  "inherited_from",
  "derived_from",
  "borrowed_from",
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
  uncertain: z.boolean().optional()
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

export const ancestorsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  maxDepth: z.number().int().min(1).max(12)
});

export type AncestorsQuery = z.infer<typeof ancestorsQuerySchema>;

export const ancestorsResultSchema = z.object({
  graph: etymologyGraphSchema.nullable()
});

export type AncestorsResult = z.infer<typeof ancestorsResultSchema>;

export const childTermsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.number().int().min(1).max(100)
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
  limit: z.number().int().min(1).max(50)
});

export type DoubletsQuery = z.infer<typeof doubletsQuerySchema>;

export const doubletsResultSchema = z.object({
  graph: etymologyGraphSchema.nullable()
});

export type DoubletsResult = z.infer<typeof doubletsResultSchema>;

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
