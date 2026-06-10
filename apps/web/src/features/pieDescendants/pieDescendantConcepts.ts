import type { DescendantsQuery } from "@etymology-graph/graph";

export type PieDescendantConcept = {
  slug: string;
  label: string;
  root: DescendantsQuery;
  gloss: string;
  note: string;
  featuredLanguages: string[];
};

export const defaultPieDescendantDepth = 8;
export const defaultPieDescendantLimit = 120;

export const pieDescendantTerminalLangCodes = [
  "af",
  "be",
  "bg",
  "bn",
  "ca",
  "cs",
  "cy",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fa",
  "fr",
  "ga",
  "gd",
  "hi",
  "is",
  "it",
  "lt",
  "lv",
  "mk",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sq",
  "sv",
  "uk"
] as const;

export const pieDescendantDepthOptions = [
  { value: "5", label: "5 steps", description: "A compact historical view." },
  { value: "8", label: "8 steps", description: "Default path toward modern words." },
  { value: "10", label: "10 steps", description: "Deep graph for longer branches." },
  { value: "12", label: "12 steps", description: "Maximum depth. Large roots may become crowded." }
] as const;

export const pieDescendantLimitOptions = [
  { value: "80", label: "80 words", description: "Small graph." },
  { value: "120", label: "120 words", description: "Default graph." },
  { value: "180", label: "180 words", description: "Large graph." },
  { value: "250", label: "250 words", description: "Very dense graph." }
] as const;

export const pieDescendantConcepts: PieDescendantConcept[] = [
  {
    slug: "father",
    label: "Father",
    root: { langCode: "ine-pro", word: "*ph₂tḗr", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "kinship term",
    note: "A stable family word with visible branches across Germanic, Italic, Greek, Indo-Iranian, and more.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "mother",
    label: "Mother",
    root: { langCode: "ine-pro", word: "*méh₂tēr", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "kinship term",
    note: "A close counterpart to father, useful for comparing inherited kinship patterns across branches.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "brother",
    label: "Brother",
    root: { langCode: "ine-pro", word: "*bʰréh₂tēr", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "kinship term",
    note: "Another stable family word with broad coverage across Germanic, Italic, Indo-Iranian, Celtic, and Slavic branches.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "daughter",
    label: "Daughter",
    root: { langCode: "ine-pro", word: "*dʰugh₂tḗr", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "kinship term",
    note: "A kinship word with recognizable inherited forms across older Indo-European languages.",
    featuredLanguages: ["English", "Ancient Greek", "Sanskrit", "Old Irish"]
  },
  {
    slug: "heart",
    label: "Heart",
    root: { langCode: "ine-pro", word: "*ḱḗr", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "body word",
    note: "A compact body-word root that can show inherited forms and learned medical vocabulary side by side.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Old Irish"]
  },
  {
    slug: "foot",
    label: "Foot",
    root: { langCode: "ine-pro", word: "*pṓds", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "body word",
    note: "A concrete body word that links everyday forms with older literary and classical branches.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "horse",
    label: "Horse",
    root: { langCode: "ine-pro", word: "*h₁éḱwos", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "animal name",
    note: "A culturally important animal word with especially recognizable reflexes in older Indo-European languages.",
    featuredLanguages: ["Latin", "Ancient Greek", "Sanskrit", "Old Irish"]
  },
  {
    slug: "cow",
    label: "Cow",
    root: { langCode: "ine-pro", word: "*gʷṓws", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "animal name",
    note: "A livestock word with wide descendant coverage and familiar reflexes in several old branches.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "moon",
    label: "Moon",
    root: { langCode: "ine-pro", word: "*mḗh₁n̥s", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "sky word",
    note: "A timekeeping and sky term where month and moon words often stay connected.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "night",
    label: "Night",
    root: { langCode: "ine-pro", word: "*nókʷts", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "sky word",
    note: "A high-coverage time word whose inherited forms stay recognizable across many branches.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "water",
    label: "Water",
    root: { langCode: "ine-pro", word: "*wódr̥", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "natural-world word",
    note: "A high-frequency natural word that often exposes very old inherited paths.",
    featuredLanguages: ["English", "Ancient Greek", "Hittite", "Sanskrit"]
  },
  {
    slug: "earth",
    label: "Earth",
    root: { langCode: "ine-pro", word: "*dʰéǵʰōm", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "natural-world word",
    note: "A deep natural-world word with branches into Indo-Iranian, Greek, Balto-Slavic, Italic, and Celtic forms.",
    featuredLanguages: ["Latin", "Ancient Greek", "Sanskrit", "Old Irish"]
  },
  {
    slug: "name",
    label: "Name",
    root: { langCode: "ine-pro", word: "*h₁nómn̥", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "common concept",
    note: "A small everyday word that can reach across many major Indo-European branches.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "three",
    label: "Three",
    root: { langCode: "ine-pro", word: "*tréyes", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "number word",
    note: "A number word with broad branch coverage, useful for comparing conservative inherited vocabulary.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "four",
    label: "Four",
    root: { langCode: "ine-pro", word: "*kʷetwóres", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "number word",
    note: "A widespread numeral that shows how one source can diversify across many daughter languages.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "five",
    label: "Five",
    root: { langCode: "ine-pro", word: "*pénkʷe", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "number word",
    note: "A familiar numeral with strong coverage across Germanic, Italic, Indo-Iranian, Balto-Slavic, and Celtic branches.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  },
  {
    slug: "sun",
    label: "Sun",
    root: { langCode: "ine-pro", word: "*sóh₂wl̥", maxDepth: defaultPieDescendantDepth, limit: defaultPieDescendantLimit },
    gloss: "sky word",
    note: "A strong example for comparing inherited sky vocabulary across old and modern forms.",
    featuredLanguages: ["English", "Latin", "Ancient Greek", "Sanskrit"]
  }
];

/** Finds a curated PIE descendant concept from a route-friendly slug. */
export const pieDescendantConceptForSlug = (slug: string | null | undefined): PieDescendantConcept =>
  pieDescendantConcepts.find((concept) => concept.slug === slug) ?? pieDescendantConcepts[0];
