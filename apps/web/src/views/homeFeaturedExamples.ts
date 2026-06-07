import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorsQuery,
  type ComparisonSetQuery,
  type ComparisonSetTerm
} from "@etymology-graph/graph";

export type FeaturedGraphExample<TQuery> = {
  heading: string;
  concept: string;
  exampleTitle: string;
  exampleText: string;
  query: TQuery;
  ctaLabel: string;
};

export type FeaturedDoubletExample = FeaturedGraphExample<ComparisonSetQuery> & {
  browseCtaLabel: string;
  expectedSameLanguageTerms: string[];
  primaryTerm: ComparisonSetTerm;
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

export const featuredEtymologyExamples: Array<FeaturedGraphExample<AncestorsQuery>> = [
  {
    heading: "Etymology shows earlier forms and source languages.",
    concept:
      "Open a word to see earlier spellings, source languages, and older roots as connected steps.",
    exampleTitle: "wine passes through Latin",
    exampleText:
      "English wine is a compact example of borrowing. The path goes through Latin before reaching an older Indo-European form.",
    ctaLabel: "Search etymology",
    query: { langCode: "en", word: "wine", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Inherited words keep older forms in use.",
    concept:
      "Some common words were inherited through generations of speech rather than borrowed recently.",
    exampleTitle: "father keeps an old kinship root",
    exampleText:
      "Kinship words are often stable. Father links English to Old English, Proto-Germanic, and an older Indo-European family term.",
    ctaLabel: "Search etymology",
    query: { langCode: "en", word: "father", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Learned words often come through Latin and Greek.",
    concept:
      "A familiar modern word may pass through translation, schooling, and scholarly borrowing before everyday use.",
    exampleTitle: "school comes from a Greek source",
    exampleText:
      "School reaches English through Latin, then back to Ancient Greek.",
    ctaLabel: "Search etymology",
    query: { langCode: "en", word: "school", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Borrowed words show language contact.",
    concept:
      "A word can show who borrowed from whom, and which source shaped the modern form.",
    exampleTitle: "royal enters English through French",
    exampleText:
      "Royal points to Old French and then Latin, showing French and Latin layers in English vocabulary.",
    ctaLabel: "Search etymology",
    query: { langCode: "en", word: "royal", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Trade words often travel across many languages.",
    concept:
      "Borrowing chains can be long. A material, food, or technology word may pass through several languages before it reaches the one you use now.",
    exampleTitle: "pepper records a trade route",
    exampleText:
      "Pepper is useful because the path is not a single jump. The word shows how goods and names moved together.",
    ctaLabel: "Search etymology",
    query: { langCode: "en", word: "pepper", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Everyday words can have old roots.",
    concept:
      "Common words can point to much older forms. The graph separates the modern word from its earlier ancestors.",
    exampleTitle: "night has Old English and Proto-Germanic ancestors",
    exampleText:
      "Night connects English to Old English, Proto-Germanic, and an Indo-European root shared across many related languages.",
    ctaLabel: "Search etymology",
    query: { langCode: "en", word: "night", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  }
];

export const featuredDoubletExamples: FeaturedDoubletExample[] = [
  {
    heading: "Doublets are separate words from one source.",
    concept:
      "Doublets are related words in the same language that reached the present by different routes. Compare their paths to see where they meet.",
    exampleTitle: "father, faeder, pater, and ayr share a kinship source",
    exampleText:
      "These English entries return to the same old family word. The graph keeps the inherited and learned paths separate until they meet.",
    ctaLabel: "Open this doublet set",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["ayr", "faeder", "father", "pater"],
    primaryTerm: { langCode: "en", word: "father" },
    query: {
      root: { langCode: "ine-pro", word: "*ph₂tḗr" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "ine-pro:*ph₂tḗr",
          label: "Doublet group",
          items: [
            { id: "en:ayr:entry:noun:1", langCode: "en", word: "ayr", pos: "noun", etymologyNumber: 1 },
            { id: "en:faeder:entry:noun:0", langCode: "en", word: "faeder", pos: "noun" },
            { id: "en:father:entry:noun:0", langCode: "en", word: "father", pos: "noun" },
            { id: "en:pater:entry:noun:0", langCode: "en", word: "pater", pos: "noun" }
          ]
        }
      ]
    }
  },
  {
    heading: "One source can produce common and specialist words.",
    concept:
      "Some doublets stay close in meaning. Others move into narrower settings while keeping the same source.",
    exampleTitle: "language and langaj reconnect",
    exampleText:
      "Both entries trace back to Old French. One became a general word for speech, while the other records a more specific cultural use.",
    ctaLabel: "Open this doublet set",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["language", "langaj"],
    primaryTerm: { langCode: "en", word: "language" },
    query: {
      root: { langCode: "fro", word: "language" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "fro:language",
          label: "Doublet group",
          items: [
            { id: "en:langaj:entry:noun:0", langCode: "en", word: "langaj", pos: "noun" },
            { id: "en:language:entry:noun:1", langCode: "en", word: "language", pos: "noun", etymologyNumber: 1 }
          ]
        }
      ]
    }
  },
  {
    heading: "Inherited and borrowed paths can meet again.",
    concept:
      "A language can inherit one form and borrow another relative later. The result is a small set of words with separate histories and one source.",
    exampleTitle: "head, chief, chef, and caput meet at an old head word",
    exampleText:
      "The everyday word head sits beside French and Latin arrivals. Their paths show how a body-part word became titles, roles, and learned vocabulary.",
    ctaLabel: "Open this doublet set",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["caput", "chef", "chief", "head"],
    primaryTerm: { langCode: "en", word: "head" },
    query: {
      root: { langCode: "ine-pro", word: "*káput" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "ine-pro:*káput",
          label: "Doublet group",
          items: [
            { id: "en:caput:entry:noun:0", langCode: "en", word: "caput", pos: "noun" },
            { id: "en:chef:entry:noun:0", langCode: "en", word: "chef", pos: "noun" },
            { id: "en:chief:entry:noun:0", langCode: "en", word: "chief", pos: "noun" },
            { id: "en:head:entry:noun:1", langCode: "en", word: "head", pos: "noun", etymologyNumber: 1 }
          ]
        }
      ]
    }
  },
  {
    heading: "Borrowed vocabulary can split into different uses.",
    concept:
      "When related forms arrive through different routes, each entry can settle into its own use while keeping the same source.",
    exampleTitle: "coffee and caffè share a modern route",
    exampleText:
      "One entry names the drink. The other keeps the Italian cafe form visible inside English.",
    ctaLabel: "Open this doublet set",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["coffee", "caffè"],
    primaryTerm: { langCode: "en", word: "coffee" },
    query: {
      root: { langCode: "it", word: "caffè" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "it:caffè",
          label: "Doublet group",
          items: [
            { id: "en:caffè:entry:noun:0", langCode: "en", word: "caffè", pos: "noun" },
            { id: "en:coffee:entry:noun:0", langCode: "en", word: "coffee", pos: "noun" }
          ]
        }
      ]
    }
  },
  {
    heading: "One source can produce several related meanings.",
    concept:
      "Doublet groups can connect landscape, travel, and place names when the older source described a practical action.",
    exampleTitle: "fjord, ford, port, and Portus share a crossing word",
    exampleText:
      "These entries moved through different languages and settings, but each path returns to a source tied to crossing.",
    browseCtaLabel: "See more English doublets",
    ctaLabel: "Open this doublet set",
    expectedSameLanguageTerms: ["fjord", "ford", "port", "Portus"],
    primaryTerm: { langCode: "en", word: "ford" },
    query: {
      root: { langCode: "ine-pro", word: "*pértus" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "ine-pro:*pértus",
          label: "Doublet group",
          items: [
            { id: "en:fjord:entry:noun:0", langCode: "en", word: "fjord", pos: "noun" },
            { id: "en:ford:entry:noun:0", langCode: "en", word: "ford", pos: "noun" },
            { id: "en:port:entry:noun:1", langCode: "en", word: "port", pos: "noun", etymologyNumber: 1 },
            { id: "en:portus:entry:name:0", langCode: "en", word: "Portus", pos: "name" }
          ]
        }
      ]
    }
  },
  {
    heading: "Titles can share the same older source.",
    concept:
      "A shared source can feed plain English, scholarly vocabulary, and borrowed prestige forms.",
    exampleTitle: "master, maestro, and magister share a Latin source",
    exampleText:
      "These entries carry the idea of authority through different routes. The graph shows the shared Latin source behind familiar and learned forms.",
    ctaLabel: "Open this doublet set",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["maestro", "magister", "master"],
    primaryTerm: { langCode: "en", word: "master" },
    query: {
      root: { langCode: "la", word: "magister" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "la:magister",
          label: "Doublet group",
          items: [
            { id: "en:maestro:entry:noun:0", langCode: "en", word: "maestro", pos: "noun" },
            { id: "en:magister:entry:noun:0", langCode: "en", word: "magister", pos: "noun" },
            { id: "en:master:entry:noun:1", langCode: "en", word: "master", pos: "noun", etymologyNumber: 1 }
          ]
        }
      ]
    }
  },
  {
    heading: "Material words can become object names.",
    concept:
      "Doublets often show how one older noun branches into tools, documents, and containers.",
    exampleTitle: "card, carte, and carton share a paper word",
    exampleText:
      "The modern entries point to different objects, but their paths meet at a Latin word for paper.",
    ctaLabel: "Open this doublet set",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["card", "carte", "carton"],
    primaryTerm: { langCode: "en", word: "card" },
    query: {
      root: { langCode: "la", word: "charta" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "la:charta",
          label: "Doublet group",
          items: [
            { id: "en:card:entry:noun:1", langCode: "en", word: "card", pos: "noun", etymologyNumber: 1 },
            { id: "en:carte:entry:noun:1", langCode: "en", word: "carte", pos: "noun", etymologyNumber: 1 },
            { id: "en:carton:entry:noun:0", langCode: "en", word: "carton", pos: "noun" }
          ]
        }
      ]
    }
  },
  {
    heading: "Learned terms can share a concrete source.",
    concept:
      "A source word can survive in ordinary food names and specialized scientific terms at the same time.",
    exampleTitle: "almond, amygdala, and amygdale share an almond word",
    exampleText:
      "The graph links a food word, a brain term, and a geological term through the same Ancient Greek source.",
    ctaLabel: "Open this doublet set",
    browseCtaLabel: "See more English doublets",
    expectedSameLanguageTerms: ["almond", "amygdala", "amygdale"],
    primaryTerm: { langCode: "en", word: "almond" },
    query: {
      root: { langCode: "grc", word: "ἀμυγδάλη" },
      maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
      groups: [
        {
          id: "grc:ἀμυγδάλη",
          label: "Doublet group",
          items: [
            { id: "en:almond:entry:noun:0", langCode: "en", word: "almond", pos: "noun" },
            { id: "en:amygdala:entry:noun:0", langCode: "en", word: "amygdala", pos: "noun" },
            { id: "en:amygdale:entry:noun:1", langCode: "en", word: "amygdale", pos: "noun", etymologyNumber: 1 }
          ]
        }
      ]
    }
  }
];

export const featuredAncestorLanguageExamples: FeaturedAncestorLanguageExample[] = [
  {
    heading: "Browse words by source language.",
    concept:
      "Choose a modern language and an older source language to list matching word paths.",
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
    heading: "Find words from older scholarly languages.",
    concept:
      "List entries in one language that trace back to an older scholarly source.",
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
    heading: "See borrowings from another language in one list.",
    concept:
      "Source-language browsing shows which entries in one language trace back through another.",
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
    heading: "Find inherited everyday vocabulary.",
    concept:
      "The same query can find old inherited words, not only recent borrowings.",
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
