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

export const languageDetailAncestorSchema = languageSchema.extend({
  shortDescription: z.string().optional()
});

export type LanguageDetailAncestor = z.infer<typeof languageDetailAncestorSchema>;

export const languagesResultSchema = z.object({
  languages: z.array(languageSchema)
});

export type LanguagesResult = z.infer<typeof languagesResultSchema>;

export const languageFamilySchema = z.object({
  code: z.string(),
  name: z.string().optional(),
  parentCode: z.string().optional()
});

export type LanguageFamily = z.infer<typeof languageFamilySchema>;

export const languageDetailSchema = languageSchema.extend({
  source: z.string(),
  wiktionaryUrl: z.string().optional(),
  wikidataId: z.string().optional(),
  family: languageFamilySchema.optional(),
  ancestors: z.array(languageDetailAncestorSchema),
  scriptCodes: z.array(z.string()),
  shortDescription: z.string().optional(),
  descriptionSourceUrls: z.array(z.string()),
  descriptionStatus: z.string(),
  descriptionModel: z.string().optional(),
  descriptionUpdatedAt: z.string().optional(),
  graphNodeCount: z.number().int().min(0)
});

export type LanguageDetail = z.infer<typeof languageDetailSchema>;

export const languageDetailResultSchema = z.object({
  language: languageDetailSchema
});

export type LanguageDetailResult = z.infer<typeof languageDetailResultSchema>;

export const languageTermsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  query: z.string().trim().default(""),
  limit: z.number().int().min(1).max(100),
  connectedOnly: z.boolean().default(false),
  cursor: z.string().trim().regex(/^\d+$/).optional()
});

export type LanguageTermsQuery = z.infer<typeof languageTermsQuerySchema>;

export const languageTermsResultSchema = z.object({
  language: languageSchema,
  query: z.string(),
  terms: z.array(graphNodeSchema),
  nextCursor: z.string().optional()
});

export type LanguageTermsResult = z.infer<typeof languageTermsResultSchema>;

export const graphEdgeSchema = z.object({
  id: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  type: edgeTypeSchema,
  source: z.literal("wiktextract"),
  etymologyNumber: z.number().int().optional(),
  templateName: z.string().optional(),
  uncertain: z.boolean().optional(),
  declaringEntryId: z.string()
});

export type GraphEdge = z.infer<typeof graphEdgeSchema>;

export const publicGraphEdgeSchema = graphEdgeSchema.omit({
  declaringEntryId: true
});

export type PublicGraphEdge = z.infer<typeof publicGraphEdgeSchema>;

export const graphTraversalNodeSchema = graphNodeSchema.extend({
  depth: z.number().int().min(0)
});

export type GraphTraversalNode = z.infer<typeof graphTraversalNodeSchema>;

export const etymologyGraphSchema = z.object({
  rootNodeId: z.string(),
  nodes: z.array(graphTraversalNodeSchema),
  edges: z.array(publicGraphEdgeSchema),
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

export const comparisonSetTermSchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1)
});

export type ComparisonSetTerm = z.infer<typeof comparisonSetTermSchema>;

export const comparisonSetItemSchema = comparisonSetTermSchema.extend({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
  ...entryAnchorShape
});

export type ComparisonSetItem = z.infer<typeof comparisonSetItemSchema>;

export const comparisonSetGroupSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  items: z.array(comparisonSetItemSchema).min(1).max(12)
});

export type ComparisonSetGroup = z.infer<typeof comparisonSetGroupSchema>;

export const comparisonSetQuerySchema = z.object({
  root: comparisonSetTermSchema,
  groups: z.array(comparisonSetGroupSchema).min(1).max(8),
  maxDepth: z.number().int().min(1).max(12).default(DEFAULT_ANCESTOR_MAX_DEPTH)
});

export type ComparisonSetQuery = z.infer<typeof comparisonSetQuerySchema>;

export const comparisonSetItemResultSchema = comparisonSetItemSchema;

export type ComparisonSetItemResult = z.infer<typeof comparisonSetItemResultSchema>;

export const comparisonSetGroupResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  items: z.array(comparisonSetItemResultSchema)
});

export type ComparisonSetGroupResult = z.infer<typeof comparisonSetGroupResultSchema>;

export const comparisonSetResultSchema = z.object({
  root: graphNodeSchema.nullable(),
  graph: etymologyGraphSchema.nullable(),
  groups: z.array(comparisonSetGroupResultSchema)
});

export type ComparisonSetResult = z.infer<typeof comparisonSetResultSchema>;

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

export type CuratedSourceLanguageLayer = {
  ancestorLangCode: string;
  description: string;
};

export type CuratedSourceLanguageAtlasLanguage = {
  langCode: string;
  description: string;
  sourceLayers: CuratedSourceLanguageLayer[];
};

export const sourceLanguageLayerStatusSchema = z.enum(["available", "empty", "unrefreshed"]);

export type SourceLanguageLayerStatus = z.infer<typeof sourceLanguageLayerStatusSchema>;

export const sourceLanguageLayerSchema = z.object({
  ancestorLangCode: z.string(),
  ancestorName: z.string(),
  description: z.string(),
  status: sourceLanguageLayerStatusSchema,
  matchCount: z.number().int().min(0).optional(),
  sampleMatches: z.array(termsWithAncestorLanguageMatchSchema)
});

export type SourceLanguageLayer = z.infer<typeof sourceLanguageLayerSchema>;

export const sourceLanguageLayersQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  maxDepth: z.number().int().min(1).max(12)
});

export type SourceLanguageLayersQuery = z.infer<typeof sourceLanguageLayersQuerySchema>;

export const sourceLanguageLayersResultSchema = z.object({
  langCode: z.string(),
  maxDepth: z.number().int().min(1),
  layers: z.array(sourceLanguageLayerSchema)
});

export type SourceLanguageLayersResult = z.infer<typeof sourceLanguageLayersResultSchema>;

export const CURATED_SOURCE_LANGUAGE_ATLAS: CuratedSourceLanguageAtlasLanguage[] = [
  {
    langCode: "en",
    description: "English source layers from Germanic, Romance, trade, and learned vocabulary.",
    sourceLayers: [
      { ancestorLangCode: "ang", description: "The inherited Germanic core behind most everyday words." },
      { ancestorLangCode: "non", description: "Viking-age contact reshaped basic vocabulary and pronouns." },
      { ancestorLangCode: "la", description: "Centuries of learned, legal, and church vocabulary entered through Latin." },
      { ancestorLangCode: "fr", description: "Norman rule layered thousands of French words onto English." },
      { ancestorLangCode: "grc", description: "Greek supplied scientific, medical, political, and literary vocabulary." },
      { ancestorLangCode: "fa", description: "Persian words reached English through trade, empire, food, and literary exchange." },
      { ancestorLangCode: "sa", description: "Sanskrit terms entered through scholarship, religion, yoga, and South Asian contact." },
      { ancestorLangCode: "ar", description: "Arabic loan paths carry science, trade, astronomy, and Mediterranean vocabulary." },
      { ancestorLangCode: "gem-pro", description: "The reconstructed root shared with German and Norse." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "es",
    description: "Spanish lineages shaped by Latin, Arabic, Greek, and older Indo-European roots.",
    sourceLayers: [
      { ancestorLangCode: "la", description: "Spanish inherits its core directly from spoken Latin." },
      { ancestorLangCode: "ar", description: "Centuries of Al-Andalus contact left a large borrowed layer." },
      { ancestorLangCode: "grc", description: "A source of scientific and learned terms." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "pt",
    description: "Portuguese source layers across Romance inheritance, Iberian contact, and seafaring exchange.",
    sourceLayers: [
      { ancestorLangCode: "la", description: "Portuguese inherits its core from spoken Latin." },
      { ancestorLangCode: "ar", description: "Iberian contact left an Arabic-derived layer." },
      { ancestorLangCode: "grc", description: "Greek supplied learned, religious, and scientific vocabulary." },
      { ancestorLangCode: "he", description: "Biblical and religious vocabulary preserves Hebrew source paths." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "fr",
    description: "French layers from Latin, medieval French, Frankish contact, and deeper roots.",
    sourceLayers: [
      { ancestorLangCode: "la", description: "French is a direct descendant of spoken Latin." },
      { ancestorLangCode: "fro", description: "Trace medieval forms before modern spelling settled." },
      { ancestorLangCode: "frk", description: "Germanic rule left an early borrowed layer." },
      { ancestorLangCode: "grc", description: "Greek shaped learned, medical, and philosophical vocabulary." },
      { ancestorLangCode: "ar", description: "Arabic reached French through science, trade, Iberia, and the Mediterranean." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "it",
    description: "Italian entries that stay close to Latin while preserving Greek and older layers.",
    sourceLayers: [
      { ancestorLangCode: "la", description: "Italian stays close to Latin in its inherited core." },
      { ancestorLangCode: "grc", description: "Greek supplied learned and coastal-trade vocabulary." },
      { ancestorLangCode: "ar", description: "Mediterranean trade and science left Arabic-derived vocabulary." },
      { ancestorLangCode: "he", description: "Religious and biblical terms preserve Hebrew source paths." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "ro",
    description: "Romanian source layers from Latin, Slavic contact, Greek, and Balkan exchange.",
    sourceLayers: [
      { ancestorLangCode: "la", description: "Romanian inherits its core from spoken Latin." },
      { ancestorLangCode: "sla-pro", description: "Slavic neighbours contributed a major borrowed layer." },
      { ancestorLangCode: "grc", description: "Byzantine contact added Greek vocabulary." },
      { ancestorLangCode: "tr", description: "Ottoman and Balkan contact added Turkish vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "de",
    description: "German layers from old Germanic stages plus learned Latin and Greek vocabulary.",
    sourceLayers: [
      { ancestorLangCode: "goh", description: "The earliest attested stage of German vocabulary." },
      { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root." },
      { ancestorLangCode: "la", description: "Learned and ecclesiastical borrowings entered through Latin." },
      { ancestorLangCode: "grc", description: "Greek shaped scientific, philosophical, and scholarly vocabulary." },
      { ancestorLangCode: "fr", description: "French contact influenced courtly, cultural, and modern vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "nl",
    description: "Dutch lineages through medieval Dutch, Germanic roots, and maritime contact.",
    sourceLayers: [
      { ancestorLangCode: "dum", description: "The medieval stage behind modern Dutch words." },
      { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root." },
      { ancestorLangCode: "la", description: "Learned, church, and administrative vocabulary entered through Latin." },
      { ancestorLangCode: "fr", description: "French shaped cultural, political, and courtly vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "sv",
    description: "Swedish source layers from Norse, Germanic, Latin, and Hanseatic contact.",
    sourceLayers: [
      { ancestorLangCode: "non", description: "Old Norse is the early northern layer behind Swedish vocabulary." },
      { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root shared across northern Europe." },
      { ancestorLangCode: "la", description: "Latin supplied church, scientific, and learned vocabulary." },
      { ancestorLangCode: "dum", description: "Low Countries trade helped carry mercantile and urban vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "da",
    description: "Danish layers from Old Norse, Germanic roots, Latin, and Low German contact.",
    sourceLayers: [
      { ancestorLangCode: "non", description: "Old Norse is the early source layer behind Danish vocabulary." },
      { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root shared with German and English." },
      { ancestorLangCode: "la", description: "Latin supplied church, science, and learned vocabulary." },
      { ancestorLangCode: "dum", description: "Low German and Dutch trade layers shaped urban vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "no",
    description: "Norwegian source layers from Old Norse, Germanic roots, and European loanwords.",
    sourceLayers: [
      { ancestorLangCode: "non", description: "Old Norse is the central historical layer for Norwegian words." },
      { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root links Norwegian to its sister languages." },
      { ancestorLangCode: "la", description: "Latin supplied church, learned, and scientific vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "is",
    description: "Icelandic lineages with unusually visible Old Norse and Germanic continuity.",
    sourceLayers: [
      { ancestorLangCode: "non", description: "Old Norse remains unusually visible behind Icelandic vocabulary." },
      { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root beneath Norse lineages." },
      { ancestorLangCode: "la", description: "Latin supplied church and learned vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "ru",
    description: "Russian layers from Proto-Slavic, Greek, Turkic, and learned European vocabulary.",
    sourceLayers: [
      { ancestorLangCode: "sla-pro", description: "The reconstructed Slavic root behind inherited Russian vocabulary." },
      { ancestorLangCode: "grc", description: "Greek shaped religious, scholarly, and Byzantine vocabulary." },
      { ancestorLangCode: "tr", description: "Turkic contact left vocabulary from steppe, trade, and empire." },
      { ancestorLangCode: "la", description: "Latin supplied learned, scientific, and European terms." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "pl",
    description: "Polish lineages through Slavic inheritance, Latin learning, German contact, and Greek loans.",
    sourceLayers: [
      { ancestorLangCode: "sla-pro", description: "The reconstructed Slavic source behind inherited Polish vocabulary." },
      { ancestorLangCode: "la", description: "Latin shaped church, legal, academic, and scientific vocabulary." },
      { ancestorLangCode: "de", description: "German contact influenced urban, trade, and technical vocabulary." },
      { ancestorLangCode: "grc", description: "Greek supplied religious, medical, and scholarly terms." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "uk",
    description: "Ukrainian source layers across Slavic inheritance, Greek learning, and regional contact.",
    sourceLayers: [
      { ancestorLangCode: "sla-pro", description: "The reconstructed Slavic source behind inherited Ukrainian vocabulary." },
      { ancestorLangCode: "grc", description: "Greek shaped religious and learned vocabulary through Byzantine contact." },
      { ancestorLangCode: "tr", description: "Turkic contact left steppe, trade, and regional vocabulary." },
      { ancestorLangCode: "la", description: "Latin supplied church, academic, and European vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "cs",
    description: "Czech lineages through Slavic roots, German contact, Latin learning, and Greek loans.",
    sourceLayers: [
      { ancestorLangCode: "sla-pro", description: "The reconstructed Slavic source behind inherited Czech vocabulary." },
      { ancestorLangCode: "de", description: "German contact shaped urban, craft, and political vocabulary." },
      { ancestorLangCode: "la", description: "Latin supplied church, academic, and scientific vocabulary." },
      { ancestorLangCode: "grc", description: "Greek contributed scholarly, religious, and medical vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "bg",
    description: "Bulgarian layers from Slavic roots, Greek contact, Turkish loans, and deeper ancestry.",
    sourceLayers: [
      { ancestorLangCode: "sla-pro", description: "The reconstructed Slavic layer behind inherited Bulgarian vocabulary." },
      { ancestorLangCode: "grc", description: "Greek contact shaped church, cultural, and Balkan vocabulary." },
      { ancestorLangCode: "tr", description: "Ottoman contact added Turkish source layers." },
      { ancestorLangCode: "la", description: "Latin supplied learned and international vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "el",
    description: "Modern Greek entries that connect to Ancient Greek, Latin, Turkish, and older roots.",
    sourceLayers: [
      { ancestorLangCode: "grc", description: "Ancient Greek is the central historical source for Greek vocabulary." },
      { ancestorLangCode: "la", description: "Roman and church contact added Latin-derived vocabulary." },
      { ancestorLangCode: "tr", description: "Ottoman contact left Turkish loan layers." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "hi",
    description: "Hindi source layers from Sanskrit, Persian, Arabic, Turkic, and English contact.",
    sourceLayers: [
      { ancestorLangCode: "sa", description: "Sanskrit is the major learned and inherited source for Hindi vocabulary." },
      { ancestorLangCode: "fa", description: "Persian shaped courtly, literary, administrative, and everyday vocabulary." },
      { ancestorLangCode: "ar", description: "Arabic vocabulary arrived through Persian, religion, scholarship, and trade." },
      { ancestorLangCode: "trk-pro", description: "Turkic contact contributed words through medieval political history." },
      { ancestorLangCode: "iir-pro", description: "The reconstructed Indo-Iranian layer behind inherited vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "ur",
    description: "Urdu lineages shaped by Sanskrit, Persian, Arabic, Turkic, and English contact.",
    sourceLayers: [
      { ancestorLangCode: "fa", description: "Persian is a central literary, courtly, and administrative source layer." },
      { ancestorLangCode: "ar", description: "Arabic shaped religious, scholarly, and legal vocabulary." },
      { ancestorLangCode: "sa", description: "Sanskrit and Indo-Aryan layers underlie inherited and regional vocabulary." },
      { ancestorLangCode: "trk-pro", description: "Turkic contact contributed political and military vocabulary." },
      { ancestorLangCode: "iir-pro", description: "The reconstructed Indo-Iranian layer behind older forms." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "fa",
    description: "Persian layers from Middle Persian, Arabic, Turkic, Sanskrit, and deeper Iranian roots.",
    sourceLayers: [
      { ancestorLangCode: "pal", description: "Middle Persian traces the historical layer before modern Persian." },
      { ancestorLangCode: "ar", description: "Arabic shaped religious, scholarly, administrative, and literary vocabulary." },
      { ancestorLangCode: "trk-pro", description: "Turkic contact added military, political, and regional vocabulary." },
      { ancestorLangCode: "sa", description: "Sanskrit contact appears in older cultural and regional exchange." },
      { ancestorLangCode: "ira-pro", description: "The reconstructed Iranian source behind inherited Persian vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "ar",
    description: "Arabic entries connected to Semitic, Greek, Persian, Egyptian, and trade layers.",
    sourceLayers: [
      { ancestorLangCode: "akk", description: "Akkadian reveals older Semitic and Near Eastern source paths." },
      { ancestorLangCode: "he", description: "Hebrew and related Semitic paths help explain shared religious vocabulary." },
      { ancestorLangCode: "grc", description: "Greek supplied philosophical, scientific, and late antique vocabulary." },
      { ancestorLangCode: "fa", description: "Persian contact shaped administration, culture, and trade vocabulary." },
      { ancestorLangCode: "egy", description: "Egyptian source paths reflect older regional words and place-based layers." }
    ]
  },
  {
    langCode: "tr",
    description: "Turkish source layers from Turkic roots, Arabic, Persian, Greek, and Ottoman vocabulary.",
    sourceLayers: [
      { ancestorLangCode: "trk-pro", description: "The reconstructed Turkic root behind inherited Turkish vocabulary." },
      { ancestorLangCode: "ar", description: "Arabic shaped religious, legal, scholarly, and Ottoman vocabulary." },
      { ancestorLangCode: "fa", description: "Persian shaped courtly, literary, and administrative vocabulary." },
      { ancestorLangCode: "grc", description: "Greek contact contributed Anatolian, maritime, and urban vocabulary." },
      { ancestorLangCode: "ota", description: "Ottoman Turkish traces inherited and borrowed layers before modern reforms." }
    ]
  },
  {
    langCode: "he",
    description: "Hebrew layers from Semitic inheritance plus Aramaic, Greek, Latin, and Arabic contact.",
    sourceLayers: [
      { ancestorLangCode: "ar", description: "Arabic contact shaped medieval, regional, and modern vocabulary." },
      { ancestorLangCode: "grc", description: "Greek contact appears in religious, scholarly, and late antique words." },
      { ancestorLangCode: "la", description: "Latin supplied church, learned, and European vocabulary paths." },
      { ancestorLangCode: "akk", description: "Akkadian reveals older Semitic and Near Eastern source paths." }
    ]
  },
  {
    langCode: "zh",
    description: "Chinese lineages with Sino-Xenic, Sanskrit, Persian, and modern loanword layers.",
    sourceLayers: [
      { ancestorLangCode: "sa", description: "Sanskrit entered through Buddhist translation and learned vocabulary." },
      { ancestorLangCode: "fa", description: "Persian contact arrived through Silk Road trade and cultural exchange." },
      { ancestorLangCode: "ar", description: "Arabic trade and science added source paths through contact networks." },
      { ancestorLangCode: "ja", description: "Modern and scholarly loans can move through Japanese before Chinese usage." },
      { ancestorLangCode: "la", description: "Latin anchors scientific names, Christian vocabulary, and modern learned terms." }
    ]
  },
  {
    langCode: "ja",
    description: "Japanese entries shaped by Chinese, Sanskrit Buddhism, Portuguese, Dutch, and English contact.",
    sourceLayers: [
      { ancestorLangCode: "zh", description: "Chinese is the major source for Sino-Japanese vocabulary." },
      { ancestorLangCode: "sa", description: "Sanskrit terms entered through Buddhist transmission." },
      { ancestorLangCode: "pt", description: "Portuguese contact left early modern trade and Christian vocabulary." },
      { ancestorLangCode: "nl", description: "Dutch contact shaped medical, technical, and Rangaku vocabulary." },
      { ancestorLangCode: "en", description: "English supplies many modern technology and global culture terms." }
    ]
  },
  {
    langCode: "ko",
    description: "Korean source layers from Chinese, Japanese, Sanskrit, and modern global loans.",
    sourceLayers: [
      { ancestorLangCode: "zh", description: "Chinese is the major source for Sino-Korean vocabulary." },
      { ancestorLangCode: "ja", description: "Japanese contact shaped modern, technical, and colonial-era vocabulary." },
      { ancestorLangCode: "sa", description: "Sanskrit terms arrived through Buddhist Chinese and scholarly exchange." },
      { ancestorLangCode: "en", description: "English supplies modern technical, cultural, and global vocabulary." }
    ]
  },
  {
    langCode: "vi",
    description: "Vietnamese layers from Chinese, French, Sanskrit, and wider regional contact.",
    sourceLayers: [
      { ancestorLangCode: "zh", description: "Chinese is the major source for Sino-Vietnamese vocabulary." },
      { ancestorLangCode: "fr", description: "French contact shaped administrative, culinary, and modern vocabulary." },
      { ancestorLangCode: "sa", description: "Sanskrit terms arrived through Buddhism and regional exchange." },
      { ancestorLangCode: "en", description: "English supplies many modern technical and global terms." }
    ]
  },
  {
    langCode: "id",
    description: "Indonesian source layers from Sanskrit, Arabic, Dutch, Portuguese, and Malay roots.",
    sourceLayers: [
      { ancestorLangCode: "ms", description: "Malay is the immediate regional source behind much Indonesian vocabulary." },
      { ancestorLangCode: "sa", description: "Sanskrit shaped religious, literary, and royal vocabulary." },
      { ancestorLangCode: "ar", description: "Arabic entered through Islam, scholarship, and trade." },
      { ancestorLangCode: "nl", description: "Dutch colonial contact supplied legal, technical, and administrative terms." },
      { ancestorLangCode: "pt", description: "Portuguese seafaring contact added early trade vocabulary." }
    ]
  },
  {
    langCode: "ms",
    description: "Malay entries shaped by Sanskrit, Arabic, Persian, Portuguese, Dutch, and English contact.",
    sourceLayers: [
      { ancestorLangCode: "sa", description: "Sanskrit shaped royal, literary, and religious vocabulary." },
      { ancestorLangCode: "ar", description: "Arabic entered through Islam, trade, and scholarship." },
      { ancestorLangCode: "fa", description: "Persian contact contributed trade, courtly, and literary vocabulary." },
      { ancestorLangCode: "pt", description: "Portuguese contact added maritime, trade, and everyday words." },
      { ancestorLangCode: "nl", description: "Dutch contact shaped colonial and technical vocabulary." },
      { ancestorLangCode: "en", description: "English supplies modern global and technical vocabulary." }
    ]
  },
  {
    langCode: "th",
    description: "Thai layers from Sanskrit, Pali, Khmer, Chinese, and modern European loans.",
    sourceLayers: [
      { ancestorLangCode: "sa", description: "Sanskrit and Pali shaped royal, religious, and learned vocabulary." },
      { ancestorLangCode: "zh", description: "Chinese contact added trade, food, and community vocabulary." },
      { ancestorLangCode: "en", description: "English supplies modern technical and global vocabulary." },
      { ancestorLangCode: "pt", description: "Portuguese contact left early modern trade vocabulary." }
    ]
  },
  {
    langCode: "ta",
    description: "Tamil lineages through Dravidian roots, Sanskrit contact, Arabic trade, and English.",
    sourceLayers: [
      { ancestorLangCode: "sa", description: "Sanskrit contact shaped religious, learned, and literary vocabulary." },
      { ancestorLangCode: "ar", description: "Arabic trade added maritime, commercial, and religious vocabulary." },
      { ancestorLangCode: "pt", description: "Portuguese contact supplied early modern coastal vocabulary." },
      { ancestorLangCode: "en", description: "English supplies administrative, technical, and global vocabulary." }
    ]
  },
  {
    langCode: "bn",
    description: "Bengali source layers from Sanskrit, Persian, Arabic, English, and Indo-Iranian roots.",
    sourceLayers: [
      { ancestorLangCode: "sa", description: "Sanskrit is the major learned and inherited source for Bengali vocabulary." },
      { ancestorLangCode: "fa", description: "Persian shaped courtly, administrative, and literary vocabulary." },
      { ancestorLangCode: "ar", description: "Arabic arrived through Persian, Islam, scholarship, and trade." },
      { ancestorLangCode: "en", description: "English supplies colonial, technical, and modern vocabulary." },
      { ancestorLangCode: "iir-pro", description: "The reconstructed Indo-Iranian layer behind inherited vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "sw",
    description: "Swahili entries shaped by Bantu roots, Arabic trade, Persian, Portuguese, and English.",
    sourceLayers: [
      { ancestorLangCode: "ar", description: "Arabic trade and Islam shaped a major Swahili source layer." },
      { ancestorLangCode: "fa", description: "Persian Indian Ocean contact contributed cultural and trade vocabulary." },
      { ancestorLangCode: "pt", description: "Portuguese contact left coastal and maritime vocabulary." },
      { ancestorLangCode: "en", description: "English supplies modern administrative, technical, and global vocabulary." }
    ]
  },
  {
    langCode: "la",
    description: "Latin source layers through Italic ancestry, Greek contact, and deeper Indo-European roots.",
    sourceLayers: [
      { ancestorLangCode: "itc-pro", description: "The branch root linking Latin to its Italic siblings." },
      { ancestorLangCode: "grc", description: "Greek shaped Roman learned and literary vocabulary." },
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  },
  {
    langCode: "grc",
    description: "Ancient Greek source layers anchored in deeper Indo-European roots.",
    sourceLayers: [
      { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
    ]
  }
];

/** Finds the curated source-language atlas entry for one result language. */
export function findCuratedSourceLanguageAtlasLanguage(
  langCode: string | undefined
): CuratedSourceLanguageAtlasLanguage | undefined {
  return CURATED_SOURCE_LANGUAGE_ATLAS.find((language) => language.langCode === langCode);
}

/** Checks whether a result language is part of the curated source-language atlas. */
export function isCuratedSourceLanguageAtlasLanguage(langCode: string | undefined): boolean {
  return findCuratedSourceLanguageAtlasLanguage(langCode) !== undefined;
}

/** Checks whether a source-layer pair is part of the curated source-language atlas. */
export function isCuratedSourceLanguageAtlasPair(
  langCode: string | undefined,
  ancestorLangCode: string | undefined
): boolean {
  return Boolean(
    findCuratedSourceLanguageAtlasLanguage(langCode)?.sourceLayers.some(
      (sourceLayer) => sourceLayer.ancestorLangCode === ancestorLangCode
    )
  );
}

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

export const similarTermsQuerySchema = z.object({
  langCode: z.string().trim().min(1),
  word: z.string().trim().min(1),
  limit: z.number().int().min(1).max(24)
});

export type SimilarTermsQuery = z.infer<typeof similarTermsQuerySchema>;

export const similarTermSchema = z.object({
  node: graphNodeSchema,
  similarity: z.number().min(0).max(1)
});

export type SimilarTerm = z.infer<typeof similarTermSchema>;

export const similarTermsResultSchema = z.object({
  anchor: graphNodeSchema.nullable(),
  terms: z.array(similarTermSchema)
});

export type SimilarTermsResult = z.infer<typeof similarTermsResultSchema>;

/** Normalizes terms so graph lookups use the same key shape as imports. */
export function normalizeWord(word: string): string {
  return word.trim().normalize("NFC").toLocaleLowerCase();
}

/** Keeps reconstructed proto-language forms keyed with the Wiktionary leading star. */
export function canonicalGraphWord(langCode: string, word: string): string {
  const canonicalWord = word.trim().normalize("NFC");
  if (!canonicalWord || canonicalWord.startsWith("*") || !isProtoLanguageCode(langCode)) {
    return canonicalWord;
  }

  return `*${canonicalWord}`;
}

/** Identifies reconstructed proto-language codes such as `ine-pro`, `gem-pro`, and `gmw-pro`. */
export const isProtoLanguageCode = (langCode: string): boolean => langCode.endsWith("-pro");

/** Creates stable term IDs shared by import, API, and frontend graph code. */
export function makeNodeId(langCode: string, word: string): string {
  return `${langCode}:${normalizeWord(canonicalGraphWord(langCode, word))}`;
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
  declaringEntryId: string
): string {
  return `${fromNodeId}:${edgeType}:${toNodeId}:from:${declaringEntryId}`;
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
 * homograph histories. Edges are followed only when their declaring entry is already in the allowed set,
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
      if (
        !allowedEntryIds.has(edge.declaringEntryId) &&
        !canFollowDescendantOwnedEdge(edge, current.nodeId, entriesByNode, candidateEdges, allowedEntryIds)
      ) {
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

/** Allows descendant-tree evidence to bridge single-entry nodes without adopting the source page entry. */
function canFollowDescendantOwnedEdge(
  edge: GraphEdge,
  fromNodeId: string,
  entriesByNode: Map<string, readonly AncestorTraversalEntry[]>,
  candidateEdges: readonly GraphEdge[],
  allowedEntryIds: ReadonlySet<string>
): boolean {
  if (edge.templateName !== "descendants" || edge.fromNodeId !== fromNodeId) {
    return false;
  }

  const edgeTargetLanguage = nodeIdLanguage(edge.toNodeId);
  const hasOwnAncestryEvidenceInTargetLanguage = candidateEdges.some(
    (candidateEdge) =>
      allowedEntryIds.has(candidateEdge.declaringEntryId) &&
      nodeIdLanguage(candidateEdge.toNodeId) === edgeTargetLanguage
  );

  return !hasOwnAncestryEvidenceInTargetLanguage && (entriesByNode.get(fromNodeId) ?? []).length <= 1;
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
    if (args.allowedEntryIds.has(edge.declaringEntryId)) {
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

/** Extracts the language prefix from stable node ids so traversal can compare same-stage source branches. */
function nodeIdLanguage(nodeId: string): string {
  return nodeId.slice(0, nodeId.indexOf(":"));
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
    const fromMap = byEntry.get(edge.declaringEntryId) ?? new Map<string, Set<string>>();
    const targetSet = fromMap.get(edge.fromNodeId) ?? new Set<string>();
    targetSet.add(edge.toNodeId);
    fromMap.set(edge.fromNodeId, targetSet);
    byEntry.set(edge.declaringEntryId, fromMap);
  }

  return byEntry;
}
