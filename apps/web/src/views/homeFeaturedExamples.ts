import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorsQuery,
  type DoubletsQuery
} from "@etymology-graph/graph";

import type { GraphLayoutPreset } from "../features/graph/composables/useGraphLayout";

export type FeaturedGraphExample<TQuery> = {
  heading: string;
  concept: string;
  exampleTitle: string;
  exampleText: string;
  query: TQuery;
  ctaLabel: string;
  layoutPreset?: GraphLayoutPreset;
};

export type FeaturedDoubletExample = FeaturedGraphExample<DoubletsQuery> & {
  browseCtaLabel: string;
  expectedSameLanguageTerms: string[];
};

export type AncestorLanguageLink = {
  term: string;
  ancestor: string;
  note: string;
};

export type FeaturedAncestorLanguageExample = {
  heading: string;
  concept: string;
  exampleTitle: string;
  exampleText: string;
  descendantLangCode: string;
  descendantLanguage: string;
  ancestorLangCode: string;
  ancestorLanguage: string;
  ctaLabel: string;
  links: AncestorLanguageLink[];
};

export const featuredGraphLimit = 18;

export const featuredEtymologyExamples: Array<FeaturedGraphExample<AncestorsQuery>> = [
  {
    heading: "Etymology follows one word back through time.",
    concept:
      "An etymology traces a word through earlier spellings, source languages, and older roots. The graph shows each step as a relationship that points back toward a source.",
    exampleTitle: "wine passes through Latin",
    exampleText:
      "English wine is a compact example of borrowing. The word travels through Latin before the trail reaches a much older Indo-European form.",
    ctaLabel: "Explore etymologies",
    query: { langCode: "en", word: "wine", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Inherited words keep older family lines visible.",
    concept:
      "Some common words were not borrowed recently. They were inherited through generations of speech, leaving a deep trail of related forms.",
    exampleTitle: "father keeps an old kinship root",
    exampleText:
      "Kinship words are often stable. Father links English to Old English, Proto-Germanic, and an older Indo-European family term.",
    ctaLabel: "Explore etymologies",
    query: { langCode: "en", word: "father", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Learned words can preserve classroom routes.",
    concept:
      "A familiar modern word may have travelled through institutions, translation, and scholarly borrowing before it entered everyday use.",
    exampleTitle: "school keeps a Greek source visible",
    exampleText:
      "School reaches English through Latin, then back to Ancient Greek. The graph turns that chain into a readable source path.",
    ctaLabel: "Explore etymologies",
    query: { langCode: "en", word: "school", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Borrowed words can carry political history.",
    concept:
      "Etymology is often a record of contact between languages. A word can show who borrowed from whom, and which source shaped the modern form.",
    exampleTitle: "royal enters English through French",
    exampleText:
      "Royal points to Old French and then Latin. The route makes the Norman and Latin layers of English vocabulary visible.",
    ctaLabel: "Explore etymologies",
    query: { langCode: "en", word: "royal", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Trade words often travel across many languages.",
    concept:
      "Borrowing chains can be long. A material, food, or technology word may pass through several languages before it reaches the one you use now.",
    exampleTitle: "pepper records a trade route",
    exampleText:
      "Pepper is useful because the path is not a single jump. The word shows how goods and names can move together.",
    ctaLabel: "Explore etymologies",
    query: { langCode: "en", word: "pepper", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Everyday words can reach very old roots.",
    concept:
      "The most ordinary words can have the deepest trails. A graph helps separate the modern word from the older forms behind it.",
    exampleTitle: "night preserves an old sky-word",
    exampleText:
      "Night connects English to Old English, Proto-Germanic, and an Indo-European root shared across many related languages.",
    ctaLabel: "Explore etymologies",
    query: { langCode: "en", word: "night", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  }
];

export const featuredDoubletExamples: FeaturedDoubletExample[] = [
  {
    heading: "Doublets are two words from one source.",
    concept:
      "A doublet appears when related words enter the same language by different routes. The words look separate, but the graph reveals a shared ancestor.",
    exampleTitle: "father, faeder, and pater share a kinship source",
    exampleText:
      "These English entries reconnect through an older family word. The graph shows how learned and inherited forms can sit side by side.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["father", "faeder", "pater"],
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "father", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "A sound change can hide a family resemblance.",
    concept:
      "Doublets are useful because they show where spelling and sound have drifted apart. A shared root can survive behind very different surfaces.",
    exampleTitle: "language and langaj reconnect",
    exampleText:
      "Language and langaj show how a source can branch through different communities and conventions while staying connected in the graph.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["language", "langaj"],
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "language", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "Borrowing can duplicate an older word.",
    concept:
      "A language can inherit one form and later borrow a cousin. The result is a pair of words with separate lives and shared ancestry.",
    exampleTitle: "ward and guard show two routes",
    exampleText:
      "Ward and guard are connected through Germanic and French contact. The graph makes the double route visible.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["ward", "guard"],
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "ward", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "Everyday words can preserve older clusters.",
    concept:
      "Doublet search can reveal small groups rather than a single pair. The shared source explains why the modern forms still belong together.",
    exampleTitle: "an and one meet in Old English",
    exampleText:
      "Short common words often hide deep relationships. This graph follows a small English group back to an older numeral source.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["an", "one"],
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "an", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "Borrowed vocabulary can branch into new meanings.",
    concept:
      "When related forms arrive through different periods or languages, they can specialize into different meanings while keeping the same older source.",
    exampleTitle: "coffee and caffè share a modern route",
    exampleText:
      "Food and trade words often move across languages quickly. These forms keep their relationship visible in the graph.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["coffee", "caffè"],
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "coffee", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "One source can split into practical words.",
    concept:
      "Doublet paths can connect familiar words from different domains. A shared ancestor can sit behind both place names and everyday nouns.",
    exampleTitle: "ford and port share an older crossing word",
    exampleText:
      "Ford and port belong to different modern settings, but their older paths meet at a reconstructed source.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["ford", "port"],
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "ford", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  }
];

export const featuredAncestorLanguageExamples: FeaturedAncestorLanguageExample[] = [
  {
    heading: "Word lineages can explain a whole set of words.",
    concept:
      "Instead of starting from one word, choose a modern language and an older source language. The app finds entries whose lineage reaches that source.",
    exampleTitle: "English words with Latin ancestors",
    exampleText:
      "Latin sits behind many English learned, legal, religious, and political terms. The results page groups those paths into browsable matches.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "la",
    ancestorLanguage: "Latin",
    ctaLabel: "Browse English from Latin",
    links: [
      { term: "royal", ancestor: "rēx", note: "political vocabulary" },
      { term: "fragile", ancestor: "fragilis", note: "learned adjective" },
      { term: "channel", ancestor: "canālis", note: "route and passage words" }
    ]
  },
  {
    heading: "Older scholarly sources leave clusters in modern languages.",
    concept:
      "Word lineages show where one older language feeds many modern entries, even when each word has its own route.",
    exampleTitle: "English words with Ancient Greek ancestors",
    exampleText:
      "Ancient Greek appears in school, science, literature, and technical vocabulary. The result list lets you open each path.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "grc",
    ancestorLanguage: "Ancient Greek",
    ctaLabel: "Browse English from Greek",
    links: [
      { term: "school", ancestor: "σχολή", note: "education vocabulary" },
      { term: "cycle", ancestor: "κύκλος", note: "wheel and circle words" },
      { term: "character", ancestor: "χαρακτήρ", note: "writing and mark words" }
    ]
  },
  {
    heading: "Contact between cultures becomes visible across word lineages.",
    concept:
      "Word lineages are useful for contact history. They show which entries in one language trace back through another.",
    exampleTitle: "Spanish words with Arabic ancestors",
    exampleText:
      "Arabic influence on Spanish is visible across food, trade, science, and everyday vocabulary.",
    descendantLangCode: "es",
    descendantLanguage: "Spanish",
    ancestorLangCode: "ar",
    ancestorLanguage: "Arabic",
    ctaLabel: "Browse Spanish from Arabic",
    links: [
      { term: "azúcar", ancestor: "سُكَّر", note: "food and trade" },
      { term: "naranja", ancestor: "نارنج", note: "fruit names" },
      { term: "aceite", ancestor: "زيت", note: "household vocabulary" }
    ]
  },
  {
    heading: "Word lineages can reveal inherited everyday vocabulary.",
    concept:
      "The same query can find old inherited words, not only recent borrowings. It turns a language pair into a map of ancestry.",
    exampleTitle: "English words with Old Norse ancestors",
    exampleText:
      "Old Norse contact left common English words that still feel ordinary today.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "non",
    ancestorLanguage: "Old Norse",
    ctaLabel: "Browse English from Old Norse",
    links: [
      { term: "skirt", ancestor: "skyrta", note: "clothing vocabulary" },
      { term: "sky", ancestor: "ský", note: "weather and landscape" },
      { term: "egg", ancestor: "egg", note: "everyday nouns" }
    ]
  },
  {
    heading: "Deep ancestry connects basic words across families.",
    concept:
      "Choosing a reconstructed source language shows where basic vocabulary reaches far behind written records.",
    exampleTitle: "English words with Indo-European ancestors",
    exampleText:
      "Many English kinship, number, body, and nature words trace back to reconstructed Indo-European roots.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "ine-pro",
    ancestorLanguage: "Proto-Indo-European",
    ctaLabel: "Browse English from Indo-European",
    links: [
      { term: "father", ancestor: "*ph₂tḗr", note: "kinship terms" },
      { term: "night", ancestor: "*nókʷts", note: "time and sky words" },
      { term: "three", ancestor: "*tréyes", note: "number words" }
    ]
  }
];
