export type LinguisticGlossaryTermId =
  | "affricate"
  | "aspirated-voiced-stop"
  | "cognate"
  | "descendant"
  | "doublet"
  | "front-vowel"
  | "fricative"
  | "lineage"
  | "palatal"
  | "palatalization"
  | "reflex"
  | "reconstructed"
  | "sibilant"
  | "stop-consonant"
  | "stress"
  | "voiced-stop"
  | "voiceless-stop";

export type LinguisticGlossaryTerm = {
  id: LinguisticGlossaryTermId;
  label: string;
  aliases: string[];
  shortDefinition: string;
  example?: string;
};

export type GlossaryTermSegment = {
  text: string;
  termId: LinguisticGlossaryTermId;
};

export type GlossaryTextSegment = string | GlossaryTermSegment;

export const linguisticGlossaryTerms: Record<LinguisticGlossaryTermId, LinguisticGlossaryTerm> = {
  affricate: {
    id: "affricate",
    label: "Affricate",
    aliases: ["affricates"],
    shortDefinition:
      "A consonant that starts with a full stop in airflow and releases into a fricative.",
    example: "The sounds written ts, ch, and pf are common affricates."
  },
  "aspirated-voiced-stop": {
    id: "aspirated-voiced-stop",
    label: "Aspirated voiced stop",
    aliases: ["aspirated voiced stops"],
    shortDefinition:
      "A stop consonant made with vocal-cord vibration and a small burst of breath after the release.",
    example: "Many reconstructed Indo-European sounds written bh, dh, and gh are aspirated voiced stops."
  },
  cognate: {
    id: "cognate",
    label: "Cognate",
    aliases: ["cognates"],
    shortDefinition: "A word related to another word because both descend from the same older source.",
    example: "English father and Latin pater are cognates."
  },
  descendant: {
    id: "descendant",
    label: "Descendant",
    aliases: ["descendants"],
    shortDefinition: "A later word or form that developed from an older source.",
    example: "Italian uomo and French homme are Romance descendants of Latin homō."
  },
  doublet: {
    id: "doublet",
    label: "Doublet",
    aliases: ["doublets"],
    shortDefinition: "Two words in the same language that descend from the same older source by different paths.",
    example: "English warranty and guarantee are doublets."
  },
  "front-vowel": {
    id: "front-vowel",
    label: "Front vowel",
    aliases: ["front vowels"],
    shortDefinition: "A vowel pronounced with the tongue toward the front of the mouth.",
    example: "The sounds written e and i are common front vowels."
  },
  fricative: {
    id: "fricative",
    label: "Fricative",
    aliases: ["fricatives"],
    shortDefinition: "A consonant made by forcing air through a narrow gap, creating audible friction.",
    example: "The sounds f, v, s, z, and h are fricatives."
  },
  lineage: {
    id: "lineage",
    label: "Lineage",
    aliases: ["lineages"],
    shortDefinition: "The chain of historical forms that connects a word to an older source.",
    example: "A word lineage can pass through Latin, Old French, and Middle English."
  },
  palatal: {
    id: "palatal",
    label: "Palatal",
    aliases: ["palatal stops", "palatal sound", "palatal sounds", "palatal consonants", "palatalizing"],
    shortDefinition: "Pronounced with the tongue raised toward the hard palate, near the roof of the mouth.",
    example: "Palatal sounds often develop toward y-like or sh-like pronunciations."
  },
  palatalization: {
    id: "palatalization",
    label: "Palatalization",
    aliases: ["palatalized"],
    shortDefinition: "A sound change where a consonant moves toward a y-like or sh-like pronunciation.",
    example: "Latin c before e or i was palatalized in many Romance languages."
  },
  reflex: {
    id: "reflex",
    label: "Reflex",
    aliases: ["reflexes"],
    shortDefinition: "A later form that descends from an older sound, word, or reconstructed source.",
    example: "English father is a Germanic reflex of an older Indo-European kinship word."
  },
  reconstructed: {
    id: "reconstructed",
    label: "Reconstructed",
    aliases: ["reconstructed form", "reconstructed forms"],
    shortDefinition: "Inferred from related evidence rather than directly written in a surviving source.",
    example: "A leading asterisk usually marks a reconstructed form."
  },
  sibilant: {
    id: "sibilant",
    label: "Sibilant",
    aliases: ["sibilants", "sibilant-like sounds"],
    shortDefinition: "A hissing or hushing consonant made by directing air through a narrow channel.",
    example: "The sounds s, z, sh, and zh are sibilants."
  },
  "stop-consonant": {
    id: "stop-consonant",
    label: "Stop consonant",
    aliases: ["stop", "stops", "stop consonants"],
    shortDefinition: "A consonant made by fully blocking airflow, then releasing it.",
    example: "The sounds p, t, k, b, d, and g are stop consonants."
  },
  stress: {
    id: "stress",
    label: "Stress",
    aliases: ["stressed", "unstressed"],
    shortDefinition: "Extra emphasis placed on one syllable of a word.",
    example: "In many languages, stress can affect how nearby consonants change."
  },
  "voiced-stop": {
    id: "voiced-stop",
    label: "Voiced stop",
    aliases: ["voiced stops"],
    shortDefinition: "A stop consonant made while the vocal cords vibrate.",
    example: "The sounds b, d, and g are voiced stops in English."
  },
  "voiceless-stop": {
    id: "voiceless-stop",
    label: "Voiceless stop",
    aliases: ["voiceless stops"],
    shortDefinition: "A stop consonant made without vocal-cord vibration.",
    example: "The sounds p, t, and k are voiceless stops in English."
  }
};

/** Converts annotated glossary text back into plain prose for compact summaries and metadata. */
export const plainTextFromGlossarySegments = (segments: GlossaryTextSegment[]): string =>
  segments.map((segment) => (typeof segment === "string" ? segment : segment.text)).join("");
