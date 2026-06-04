import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ANCESTOR_EDGE_TYPES,
  makeLexicalEntryId,
  makeNodeId,
  traverseAncestors,
  type GraphEdge,
  type LexicalEntry
} from "@etymology-graph/graph";

import {
  prioritizeStructuredDescendantTargets,
  structuredAncestryDiscoveredTargets
} from "./structured-ancestry-targets.js";
import {
  buildSeedTargetIndex,
  findMatchingSeedTargetIndex,
  previewEntry,
  previewStructuredEntry,
  seedTargetKey,
  type WiktextractEntry
} from "./wiktextract.js";

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "wiktextract");
const previewEdgeIds = (entry: WiktextractEntry): string[] => previewEntry(entry).edges.map((edge) => edge.id);
const previewStructuredEdgeIds = (entry: WiktextractEntry): string[] =>
  previewStructuredEntry(entry).edges.map((edge) => edge.id);
const previewMergedEdgeIds = (entries: WiktextractEntry[]): string[] => [
  ...new Set(entries.flatMap((entry) => previewEdgeIds(entry)))
];

type MergedNeighborhood = {
  edges: GraphEdge[];
  lexicalEntries: LexicalEntry[];
};

/** Merges per-entry previews into the combined node/edge/entry sets a real DB import would store. */
const mergeNeighborhood = (entries: WiktextractEntry[]): MergedNeighborhood => {
  const edgesById = new Map<string, GraphEdge>();
  const entriesById = new Map<string, LexicalEntry>();
  for (const entry of entries) {
    const preview = previewEntry(entry);
    for (const edge of preview.edges) {
      edgesById.set(edge.id, edge);
    }
    for (const lexicalEntry of preview.lexicalEntries) {
      entriesById.set(lexicalEntry.id, lexicalEntry);
    }
  }

  return {
    edges: [...edgesById.values()],
    lexicalEntries: [...entriesById.values()]
  };
};

/** Merges structured previews into the combined graph a structured DB import would store. */
const mergeStructuredNeighborhood = (entries: WiktextractEntry[]): MergedNeighborhood => {
  const edgesById = new Map<string, GraphEdge>();
  const entriesById = new Map<string, LexicalEntry>();
  for (const entry of entries) {
    const preview = previewStructuredEntry(entry);
    for (const edge of preview.edges) {
      edgesById.set(edge.id, edge);
    }
    for (const lexicalEntry of preview.lexicalEntries) {
      entriesById.set(lexicalEntry.id, lexicalEntry);
    }
  }

  return {
    edges: [...edgesById.values()],
    lexicalEntries: [...entriesById.values()]
  };
};

/** Resolves the lexical entry id for a (lang, word, pos, etymN) anchor used by ancestor traversals. */
const expectEntryId = (langCode: string, word: string, pos: string, etymN: number): string => {
  return makeLexicalEntryId(makeNodeId(langCode, word), pos, etymN);
};

/** Builds stable target keys for comparing seed-expansion output. */
const discoveredTargetKeys = (entry: WiktextractEntry): string[] =>
  structuredAncestryDiscoveredTargets(entry).map(({ target }) => seedTargetKey(target));

/** Provides the trimmed real neighborhood needed for canal/channel ancestry expansion. */
const canalNeighborhoodEntries = (): WiktextractEntry[] => [
  {
    word: "canal",
    lang: "English",
    lang_code: "en",
    pos: "noun",
    etymology_text:
      "Borrowed from Middle French canal, from Old French canal, from Latin canālis (“channel; canal”).",
    etymology_templates: [
      template("bor", "en", "frm", "canal", "Middle French canal"),
      template("der", "en", "fro", "canal", "Old French canal"),
      template("der", "en", "la", "canālis", "Latin canālis")
    ],
    descendants: [
      {
        lang: "Scottish Gaelic",
        lang_code: "gd",
        word: "canàl",
        raw_tags: ["borrowed"]
      }
    ]
  },
  {
    word: "canalis",
    lang: "Latin",
    lang_code: "la",
    pos: "noun",
    etymology_text: "For *cannālis, from canna (“reed, cane”), from Ancient Greek κάννα (kánna, “reed”).",
    etymology_templates: [
      template("der", "la", "grc", "κάννα", "Ancient Greek κάννα")
    ],
    descendants: [
      {
        lang: "Old French",
        lang_code: "fro",
        word: "canel",
        raw_tags: ["borrowed"]
      }
    ]
  },
  {
    word: "canel",
    lang: "Old French",
    lang_code: "fro",
    pos: "noun",
    etymology_text: "Borrowed from Latin canalis. Doublet of chanel.",
    etymology_templates: [
      template("bor", "fro", "la", "canalis", "Latin canalis")
    ],
    descendants: [
      {
        lang: "Middle English",
        lang_code: "enm",
        word: "canal",
        raw_tags: ["borrowed"],
        descendants: [
          {
            lang: "English",
            lang_code: "en",
            word: "canal"
          }
        ]
      }
    ]
  }
];

/** Loads trimmed real Wiktextract entries used to lock down broken graph reports. */
const loadFixtureEntry = (filename: string): WiktextractEntry => {
  const rawFixture = readFileSync(join(fixtureDirectory, filename), "utf8");

  return JSON.parse(rawFixture) as WiktextractEntry;
};

/** Loads trimmed real Wiktextract entry groups used to test merged importer output. */
const loadFixtureEntries = (filename: string): WiktextractEntry[] => {
  const rawFixture = readFileSync(join(fixtureDirectory, filename), "utf8");

  return JSON.parse(rawFixture) as WiktextractEntry[];
};

describe("previewEntry", () => {
  it("canonicalizes reconstructed proto entries to a leading-star node", () => {
    const entry: WiktextractEntry = {
      word: "hundaz",
      lang: "Proto-Germanic",
      lang_code: "gem-pro",
      pos: "noun",
      etymology_text: "From Proto-Indo-European *ḱwṓ (“dog”).",
      etymology_templates: [template("der", "gem-pro", "ine-pro", "*ḱwṓ", "Proto-Indo-European *ḱwṓ")]
    };
    const preview = previewEntry(entry);

    expect(preview.lexicalEntries.map((lexicalEntry) => lexicalEntry.id)).toEqual(["gem-pro:*hundaz:entry:noun:0"]);
    expect(previewEdgeIds(entry)).toEqual([
      "gem-pro:*hundaz:derived_from:ine-pro:*ḱwṓ:from:gem-pro:*hundaz:entry:noun:0"
    ]);
  });

  it("does not add reconstruction stars to attested-language entries", () => {
    const entry: WiktextractEntry = {
      word: "hound",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text: "From Middle English hound.",
      etymology_templates: [template("inh", "en", "enm", "hound", "Middle English hound")]
    };
    const preview = previewEntry(entry);

    expect(preview.lexicalEntries.map((lexicalEntry) => lexicalEntry.id)).toEqual(["en:hound:entry:noun:0"]);
    expect(previewEdgeIds(entry)).toEqual(["en:hound:inherited_from:enm:hound:from:en:hound:entry:noun:0"]);
  });

  it("keeps a simple same-sentence ancestry chain", () => {
    const entry: WiktextractEntry = {
      word: "sample",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text: "From Middle English sample, from Old French sample, from Latin exemplum.",
      etymology_templates: [
        template("der", "en", "enm", "sample", "Middle English sample"),
        template("der", "en", "fro", "sample", "Old French sample"),
        template("der", "en", "la", "exemplum", "Latin exemplum")
      ]
    };

    expect(previewEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "en:sample:derived_from:enm:sample:from:en:sample:entry:noun:0",
        "enm:sample:derived_from:fro:sample:from:en:sample:entry:noun:0",
        "fro:sample:derived_from:la:exemplum:from:en:sample:entry:noun:0",
      ]
    `);
  });

  it("uses only the immediate source from opening source prose plus a flat ancestry chain", () => {
    const entry: WiktextractEntry = {
      word: "sample",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text: "From Middle English sample, from Old French sample, from Latin exemplum.",
      etymology_templates: [
        template("der", "en", "enm", "sample", "Middle English sample"),
        template("der", "en", "fro", "sample", "Old French sample"),
        template("der", "en", "la", "exemplum", "Latin exemplum")
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toEqual(["en:sample:derived_from:enm:sample:from:en:sample:entry:noun:0"]);
    expect(edgeIds).not.toContain("enm:sample:derived_from:fro:sample:from:en:sample:entry:noun:0");
  });

  it("uses a single flat ancestry template when no structured source edge exists", () => {
    const entry: WiktextractEntry = {
      word: "roial",
      lang: "Old French",
      lang_code: "fro",
      pos: "adj",
      etymology_text: "From Latin rēgālem.",
      etymology_templates: [
        template("inh", "fro", "la", "regalis", "Latin rēgālem")
      ]
    };

    expect(previewStructuredEdgeIds(entry)).toEqual([
      "fro:roial:inherited_from:la:regalis:from:fro:roial:entry:adj:0"
    ]);
  });

  it("uses only the immediate source from a PIE header plus flat ancestry chain", () => {
    const entry: WiktextractEntry = {
      word: "salt",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_text:
        "PIE word\n *sḗh₂l\nFrom Middle English salt, from Old English sealt, from Proto-West Germanic *salt.",
      etymology_templates: [
        template("PIE word", "en", "sḗh₂l", undefined, "PIE word\n *sḗh₂l"),
        template("inh", "en", "enm", "salt", "Middle English salt"),
        template("inh", "en", "ang", "sealt", "Old English sealt"),
        template("inh", "en", "gmw-pro", "*salt", "Proto-West Germanic *salt")
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toEqual([
      "en:salt:inherited_from:enm:salt:from:en:salt:entry:noun:1"
    ]);
    expect(edgeIds).not.toContain("enm:salt:inherited_from:ang:sealt:from:en:salt:entry:noun:1");
  });

  it("uses only the immediate source from a root hint plus flat ancestry chain", () => {
    const entry: WiktextractEntry = {
      word: "flower",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_text:
        "From Middle English flour, from Anglo-Norman flur, from Latin flōrem, from Proto-Italic *flōs.",
      etymology_templates: [
        template("root", "en", "ine-pro", "*bʰleh₃-", ""),
        template("inh", "en", "enm", "flour", "Middle English flour"),
        template("der", "en", "xno", "flur", "Anglo-Norman flur"),
        template("der", "en", "la", "flōrem", "Latin flōrem"),
        template("der", "en", "itc-pro", "*flōs", "Proto-Italic *flōs")
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toEqual([
      "en:flower:inherited_from:enm:flour:from:en:flower:entry:noun:1"
    ]);
    expect(edgeIds).not.toContain("enm:flour:derived_from:xno:flur:from:en:flower:entry:noun:1");
  });

  it("uses only the immediate source from inherited opening prose plus a flat ancestry chain", () => {
    const entry: WiktextractEntry = {
      word: "tre",
      lang: "Italian",
      lang_code: "it",
      pos: "num",
      etymology_text: "Inherited from Latin trēs, from Proto-Italic *trēs, from Proto-Indo-European *tréyes.",
      etymology_templates: [
        template("inh", "it", "la", "trēs", "Latin trēs"),
        template("inh+", "it", "la", "trēs", "Inherited from Latin trēs"),
        template("inh", "it", "itc-pro", "*trēs", "Proto-Italic *trēs"),
        template("inh", "it", "ine-pro", "*tréyes", "Proto-Indo-European *tréyes")
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toEqual(["it:tre:inherited_from:la:trēs:from:it:tre:entry:num:0"]);
    expect(edgeIds).not.toContain("la:trēs:inherited_from:itc-pro:*trēs:from:it:tre:entry:num:0");
  });

  it("does not use source prose fallback when the source phrase is not at the start", () => {
    const entry: WiktextractEntry = {
      word: "wait",
      lang: "English",
      lang_code: "en",
      pos: "verb",
      etymology_text:
        "In some senses, merged or influenced by Middle English waiten, from Old Norse veita.",
      etymology_templates: [
        template("der", "en", "enm", "waiten", "Middle English waiten"),
        template("der", "en", "non", "veita", "Old Norse veita")
      ]
    };

    expect(previewStructuredEdgeIds(entry)).toEqual([]);
  });

  it("uses rendered etymon trees when Wiktextract omits the root terms payload", () => {
    const entry: WiktextractEntry = {
      word: "trois",
      lang: "Old French",
      lang_code: "fro",
      pos: "num",
      etymology_templates: [
        template(
          "etymon",
          "fro",
          ":inh",
          "la:trēs<id:three>",
          'Etymology tree\nProto-Indo-European *tréyes\nProto-Italic *trēs\nLatin trēs\nOld French trois\n[Appendix:Glossary#inherited|Inherited]] from", "keyword" : "inherited" } ], "status" : "ok", "lang_name" : "Proto-Italic", "term" : "*trēs", "lang" : "itc-pro" } ], "keyword_label" : "Inherited from", "keyword" : "inherited" } ], "status" : "ok", "lang_name" : "Latin", "term" : "trēs", "lang" : "la" } ], "keyword_label" : "Inherited from", "keyword" : "inherited" } ], "status" : "ok", "lang_name" : "Old French", "term" : "trois", "lang" : "fro" }" data-id="three"',
          { tree: "1" }
        )
      ]
    };

    expect(previewStructuredEdgeIds(entry)).toEqual([
      "la:trēs:inherited_from:itc-pro:*trēs:from:fro:trois:entry:num:0",
      "fro:trois:inherited_from:la:trēs:from:fro:trois:entry:num:0"
    ]);
  });

  it("uses embedded etymon metadata even when Wiktextract omits the tree flag", () => {
    const entry: WiktextractEntry = {
      word: "cycle",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_templates: [
        {
          name: "etymon",
          args: {
            "1": "en",
            "2": ":inh",
            "3": "enm:cicle"
          },
          expansion:
            '"terms" : [ { "children" : [ { "keyword" : "inherited", "terms" : [ { "children" : [ { "keyword" : "der", "terms" : [ { "children" : [ { "keyword" : "der", "terms" : [ { "children" : [ ], "term" : "κύκλος", "lang" : "grc" } ] } ], "term" : "cyclus", "lang" : "la-lat" } ] } ], "term" : "cicle", "lang" : "enm" } ] } ], "term" : "cycle", "lang" : "en" } ]'
        }
      ]
    };

    expect(previewStructuredEdgeIds(entry)).toEqual([
      "en:cycle:inherited_from:enm:cicle:from:en:cycle:entry:noun:1",
      "enm:cicle:derived_from:la-lat:cyclus:from:en:cycle:entry:noun:1",
      "la-lat:cyclus:derived_from:grc:κύκλος:from:en:cycle:entry:noun:1"
    ]);
  });

  it("uses visible etymon rows when embedded metadata starts inside an affix group", () => {
    const entry: WiktextractEntry = {
      word: "sweet",
      lang: "English",
      lang_code: "en",
      pos: "adj",
      etymology_templates: [
        template(
          "etymon",
          "en",
          ":inh",
          "enm:swete<id:sweet>",
          'Etymology tree\nProto-Indo-European *sweh₂d-\nProto-Indo-European *-us\nProto-Indo-European *swéh₂dus\nProto-Germanic *swōtuz\nProto-Germanic *-jaz\nProto-West Germanic *-ī\nProto-West Germanic *swōtī\nOld English swēte\nMiddle English swete\nEnglish sweet\n[Appendix:Glossary#inherited|Inherited]] from", "keyword" : "inherited" } ], "lang_name" : "Proto-Germanic", "term" : "*swōtuz", "status" : "ok", "lang" : "gem-pro" }, { "id" : "adjective", "children" : [ { "terms" : [ { "id" : "-ed", "children" : [ ], "status" : "ok", "lang_name" : "Proto-Germanic", "term" : "*-jaz", "lang" : "gem-pro" } ], "keyword_label" : "Inherited from", "keyword" : "inherited" } ], "status" : "ok", "lang_name" : "Proto-West Germanic", "term" : "*-ī", "lang" : "gmw-pro" } ], "keyword_label" : "From", "is_group" : true, "keyword" : "affix" } ], "lang_name" : "Proto-West Germanic", "term" : "*swōtī", "status" : "ok", "lang" : "gmw-pro" } ], "keyword_label" : "Inherited from", "keyword" : "inherited" } ], "lang_name" : "Old English", "term" : "swēte", "status" : "ok", "lang" : "ang" } ], "keyword_label" : "Inherited from", "keyword" : "inherited" } ], "status" : "ok", "lang_name" : "Middle English", "term" : "swete", "lang" : "enm" } ], "keyword_label" : "Inherited from", "keyword" : "inherited" } ], "lang_name" : "English", "term" : "sweet", "status" : "ok", "lang" : "en" }" data-lang="en" data-title="sweet">',
          { tree: "1" }
        )
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toEqual([
      "gem-pro:*swōtuz:inherited_from:ine-pro:*swéh₂dus:from:en:sweet:entry:adj:0",
      "gmw-pro:*swōtī:inherited_from:gem-pro:*swōtuz:from:en:sweet:entry:adj:0",
      "ang:swēte:inherited_from:gmw-pro:*swōtī:from:en:sweet:entry:adj:0",
      "enm:swete:inherited_from:ang:swēte:from:en:sweet:entry:adj:0",
      "en:sweet:inherited_from:enm:swete:from:en:sweet:entry:adj:0"
    ]);
    expect(edgeIds).not.toContain("gem-pro:*-jaz:inherited_from:gem-pro:*swōtuz:from:en:sweet:entry:adj:0");
    expect(edgeIds).not.toContain("gmw-pro:*-ī:inherited_from:gem-pro:*-jaz:from:en:sweet:entry:adj:0");
  });

  it("uses embedded etymology metadata from ety templates", () => {
    const entry: WiktextractEntry = {
      word: "truth",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_templates: [
        {
          name: "ety",
          args: {
            "1": "en",
            "2": ":inh",
            "3": "enm:trouthe",
            tree: "1"
          },
          expansion:
            '"terms" : [ { "children" : [ { "keyword" : "inh", "terms" : [ { "children" : [ { "keyword" : "inh", "terms" : [ { "children" : [ ], "term" : "trēowþ", "lang" : "ang" } ] } ], "term" : "trouthe", "lang" : "enm" } ] } ], "term" : "truth", "lang" : "en" } ]'
        }
      ]
    };

    expect(previewStructuredEdgeIds(entry)).toEqual([
      "en:truth:inherited_from:enm:trouthe:from:en:truth:entry:noun:0",
      "enm:trouthe:inherited_from:ang:trēowþ:from:en:truth:entry:noun:0"
    ]);
  });

  it("can preview derived arrays as structured child-to-source edges", () => {
    const entry: WiktextractEntry = {
      word: "sample",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      derived: [
        {
          lang: "English",
          lang_code: "en",
          word: "sampled"
        },
        {
          lang: "English",
          lang_code: "en",
          word: "resample",
          raw_tags: ["borrowed"]
        }
      ]
    };

    expect(previewStructuredEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "en:sampled:derived_from:en:sample:from:en:sample:entry:noun:0",
      ]
    `);
  });

  it("connects suffix-derived entries to their lexical base", () => {
    const entry: WiktextractEntry = {
      word: "regalis",
      lang: "Latin",
      lang_code: "la",
      pos: "adj",
      etymology_text: "Derived from the oblique stem reg- of rēx (“king”) + -ālis.",
      etymology_templates: [
        {
          name: "suffix",
          args: {
            "1": "la",
            "2": "rēx",
            "3": "ālis"
          },
          expansion: "rēx (“king”) + -ālis"
        }
      ]
    };

    expect(previewStructuredEdgeIds(entry)).toEqual([
      "la:regalis:derived_from:la:rēx:from:la:regalis:entry:adj:0"
    ]);
  });

  it("keeps only the first descendant per language at each level", () => {
    const entry: WiktextractEntry = {
      word: "brēad",
      lang: "Old English",
      lang_code: "ang",
      pos: "noun",
      descendants: [
        {
          lang: "Middle English",
          lang_code: "enm",
          word: "bred",
          descendants: [
            {
              lang: "English",
              lang_code: "en",
              word: "bread"
            }
          ]
        },
        {
          lang: "Middle English",
          lang_code: "enm",
          word: "bread",
          descendants: [
            {
              lang: "English",
              lang_code: "en",
              word: "bread"
            }
          ]
        },
        {
          lang: "Middle English",
          lang_code: "enm",
          word: "bræd",
          descendants: [
            {
              lang: "English",
              lang_code: "en",
              word: "bread"
            }
          ]
        }
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toContain("en:bread:inherited_from:enm:bred:from:ang:brēad:entry:noun:0");
    expect(edgeIds).not.toContain("en:bread:inherited_from:enm:bread:from:ang:brēad:entry:noun:0");
    expect(edgeIds).not.toContain("en:bread:inherited_from:enm:bræd:from:ang:brēad:entry:noun:0");
  });

  it("collapses repeated same-language descendant layers before importing modern children", () => {
    const entry: WiktextractEntry = {
      word: "kuningaz",
      lang: "Proto-Germanic",
      lang_code: "gem-pro",
      pos: "noun",
      descendants: [
        {
          lang: "Old English",
          lang_code: "ang",
          word: "cyning",
          descendants: [
            {
              lang: "Middle English",
              lang_code: "enm",
              word: "king",
              descendants: [
                {
                  lang: "English",
                  lang_code: "en",
                  word: "king"
                }
              ]
            },
            {
              lang: "Middle English",
              lang_code: "enm",
              word: "kenin",
              descendants: [
                {
                  lang: "English",
                  lang_code: "en",
                  word: "king"
                }
              ]
            }
          ]
        },
        {
          lang: "Old English",
          lang_code: "ang",
          word: "cing",
          descendants: [
            {
              lang: "Middle English",
              lang_code: "enm",
              word: "cing",
              descendants: [
                {
                  lang: "English",
                  lang_code: "en",
                  word: "king"
                }
              ]
            }
          ]
        }
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toContain("en:king:inherited_from:enm:king:from:gem-pro:*kuningaz:entry:noun:0");
    expect(edgeIds).not.toContain("en:king:inherited_from:enm:kenin:from:gem-pro:*kuningaz:entry:noun:0");
    expect(edgeIds).not.toContain("en:king:inherited_from:enm:cing:from:gem-pro:*kuningaz:entry:noun:0");
    expect(edgeIds).not.toContain("enm:cing:inherited_from:ang:cing:from:gem-pro:*kuningaz:entry:noun:0");
  });

  it("keeps a borrowed same-sentence ancestry chain", () => {
    const entry: WiktextractEntry = {
      word: "substance",
      lang: "French",
      lang_code: "fr",
      pos: "noun",
      etymology_text: "Borrowed from Latin substantia, from substāns.",
      etymology_templates: [
        template("bor", "fr", "la", "substantia", "Latin substantia"),
        template("der", "fr", "la", "substāns", "substāns")
      ]
    };

    expect(previewEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "fr:substance:borrowed_from:la:substantia:from:fr:substance:entry:noun:0",
        "la:substantia:derived_from:la:substāns:from:fr:substance:entry:noun:0",
      ]
    `);
  });

  it("treats learned borrowing templates as borrowed edges", () => {
    const entry: WiktextractEntry = {
      word: "oryctérope",
      lang: "French",
      lang_code: "fr",
      pos: "noun",
      etymology_text:
        "Learned borrowing from New Latin oryctēropūs, from Ancient Greek ὀρυκτήρ (oruktḗr, “miner”).",
      etymology_templates: [
        template("lbor", "fr", "la-new", "oryctēropūs", "Learned borrowing from New Latin oryctēropūs"),
        template("der", "fr", "grc", "ὀρυκτήρ", "Ancient Greek ὀρυκτήρ (oruktḗr, “miner”)")
      ]
    };

    expect(previewEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "fr:oryctérope:borrowed_from:la-new:oryctēropūs:from:fr:oryctérope:entry:noun:0",
        "la-new:oryctēropūs:derived_from:grc:ὀρυκτήρ:from:fr:oryctérope:entry:noun:0",
      ]
    `);
  });

  it("treats ultimately derived templates as derived edges", () => {
    const entry: WiktextractEntry = {
      word: "multiply",
      lang: "English",
      lang_code: "en",
      pos: "verb",
      etymology_text: "From Old French multiplier, from Latin multiplicō, from multi (“many”) + plicō (“to fold”).",
      etymology_templates: [
        template("uder", "en", "fro", "multiplier", "Old French multiplier"),
        template("uder", "en", "la", "multiplicō", "Latin multiplicō")
      ]
    };

    expect(previewEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "en:multiply:derived_from:fro:multiplier:from:en:multiply:entry:verb:0",
        "fro:multiplier:derived_from:la:multiplicō:from:en:multiply:entry:verb:0",
      ]
    `);
  });

  it("attaches unrendered root templates to the terminal source term", () => {
    const entry: WiktextractEntry = {
      word: "hacer",
      lang: "Spanish",
      lang_code: "es",
      pos: "verb",
      etymology_text:
        "From Old Spanish fazer, from Latin facere. The first-person indicative and present subjunctive may have been influenced by Latin agō (compare English gesture), but more likely present voicing of the Latin -c- between vowels, after dropping the -i-; for example: *facō; *facam; et cetera.",
      etymology_templates: [
        template("inh", "es", "osp", "fazer", "Old Spanish fazer"),
        template("inh", "es", "la", "faciō", "Latin facere", { "4": "facere" }),
        template("noncog", "la", "agō", undefined, "Latin agō"),
        template("root", "es", "ine-pro", "*dʰeh₁-", "")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "es:hacer:inherited_from:osp:fazer:from:es:hacer:entry:verb:0",
        "osp:fazer:inherited_from:la:faciō:from:es:hacer:entry:verb:0",
        "la:faciō:derived_from:ine-pro:*dʰeh₁-:from:es:hacer:entry:verb:0",
      ]
    `);
    expect(edgeIds).not.toContain("la:faciō:derived_from:la:agō:from:es:hacer:entry:verb:0");
  });

  it("uses a diacritic-bearing displayed source form when the link target is plain ASCII", () => {
    const entry: WiktextractEntry = {
      word: "hombre",
      lang: "Spanish",
      lang_code: "es",
      pos: "noun",
      etymology_text:
        "Inherited from Old Spanish omne, from Latin hominem, homō, from Old Latin hemō, from Proto-Indo-European *ǵʰmṓ (“earthling”).",
      etymology_templates: [
        template("inh", "es", "osp", "omne", "Old Spanish omne"),
        template("inh", "es", "la", "homo", "Latin hominem, homō", { "4": "hominem, homō" }),
        template("inh", "es", "itc-ola", "hemō", "Old Latin hemō"),
        template("inh", "es", "ine-pro", "*ǵʰmṓ", "Proto-Indo-European *ǵʰmṓ (“earthling”)")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "es:hombre:inherited_from:osp:omne:from:es:hombre:entry:noun:0",
        "osp:omne:inherited_from:la:homō:from:es:hombre:entry:noun:0",
        "la:homō:inherited_from:itc-ola:hemō:from:es:hombre:entry:noun:0",
        "itc-ola:hemō:inherited_from:ine-pro:*ǵʰmṓ:from:es:hombre:entry:noun:0",
      ]
    `);
    expect(edgeIds).not.toContain("osp:omne:inherited_from:la:homo:from:es:hombre:entry:noun:0");
  });

  it("does not split an ancestry chain for or inside a parenthetical gloss", () => {
    const entry: WiktextractEntry = {
      word: "wait",
      lang: "English",
      lang_code: "en",
      pos: "verb",
      etymology_text:
        "In some senses, merged or influenced by Middle English waiten, weiten (“to do good to, lie in wait for, to contrive good or harm on, catch, snare”), from Old Norse veita (“to give help to”).",
      etymology_templates: [
        template("der", "en", "enm", "waiten", "Middle English waiten"),
        template("der", "en", "non", "veita", "Old Norse veita (“to give help to”)")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:wait:derived_from:enm:waiten:from:en:wait:entry:verb:0",
        "enm:waiten:derived_from:non:veita:from:en:wait:entry:verb:0",
      ]
    `);
    expect(edgeIds).not.toContain("en:wait:derived_from:non:veita:from:en:wait:entry:verb:0");
  });

  it("keeps either-from source notes attached to the previous ancestor", () => {
    const entry: WiktextractEntry = {
      word: "balk",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_text:
        "From Middle English balke, from Old English balca, either from or influenced by Old Norse bálkr (“partition, ridge of land”), from Proto-Germanic *balkô.",
      etymology_templates: [
        template("inh", "en", "enm", "balke", "Middle English balke"),
        template("inh", "en", "ang", "balca", "Old English balca"),
        template("der", "en", "non", "bálkr", "Old Norse bálkr (“partition, ridge of land”)"),
        template("inh", "en", "gem-pro", "*balkô", "Proto-Germanic *balkô")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:balk:inherited_from:enm:balke:from:en:balk:entry:noun:1",
        "enm:balke:inherited_from:ang:balca:from:en:balk:entry:noun:1",
        "ang:balca:derived_from:non:bálkr:from:en:balk:entry:noun:1",
        "non:bálkr:inherited_from:gem-pro:*balkô:from:en:balk:entry:noun:1",
      ]
    `);
    expect(edgeIds).not.toContain("en:balk:derived_from:non:bálkr:from:en:balk:entry:noun:1");
  });

  it("keeps same-sentence alternative sources attached to the branch base", () => {
    const entry: WiktextractEntry = {
      word: "sample",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text: "From Old French sample or Latin exemplum.",
      etymology_templates: [
        template("der", "en", "fro", "sample", "Old French sample"),
        template("der", "en", "la", "exemplum", "Latin exemplum")
      ]
    };

    expect(previewEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "en:sample:derived_from:fro:sample:from:en:sample:entry:noun:0",
        "en:sample:derived_from:la:exemplum:from:en:sample:entry:noun:0",
      ]
    `);
  });

  it("skips ancestry edges introduced only as comparison prose", () => {
    const entry: WiktextractEntry = {
      word: "bat",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_text:
        "Dialectal variant of Middle English bakke, of North Germanic origin. Perhaps compare Old Norse (leðr)blaka (literally “(leather) flapper”).",
      etymology_templates: [
        template("inh", "en", "enm", "bakke", "Middle English bakke"),
        template("der", "en", "non", "leðrblaka", "Old Norse (leðr)blaka (literally “(leather) flapper”)")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:bat:inherited_from:enm:bakke:from:en:bat:entry:noun:1",
      ]
    `);
    expect(edgeIds).not.toContain("en:bat:derived_from:non:leðrblaka:from:en:bat:entry:noun:1");
  });

  it("keeps later sentences when they explicitly continue the source ancestry", () => {
    const entry: WiktextractEntry = {
      word: "sample",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text: "From Old French sample. Believed to be derived from Latin exemplum.",
      etymology_templates: [
        template("der", "en", "fro", "sample", "Old French sample"),
        template("der", "en", "la", "exemplum", "Latin exemplum")
      ]
    };

    expect(previewEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "en:sample:derived_from:fro:sample:from:en:sample:entry:noun:0",
        "fro:sample:derived_from:la:exemplum:from:en:sample:entry:noun:0",
      ]
    `);
  });

  it("keeps attributed follow-up sources attached to the previous source term", () => {
    const entry: WiktextractEntry = {
      word: "rise",
      lang: "English",
      lang_code: "en",
      pos: "verb",
      etymology_number: 1,
      etymology_text:
        "From Middle English risen, from Old English rīsan, from Proto-West Germanic *rīsan, from Proto-Germanic *rīsaną (“to rise”), from Proto-Indo-European *h₁rey- (“to arise, rise”). According to Kroonen (2013), from Proto-Indo-European *h₃er- (“to rise, spring”).",
      etymology_templates: [
        template("der", "en", "enm", "risen", "Middle English risen"),
        template("der", "en", "ang", "rīsan", "Old English rīsan"),
        template("der", "en", "gmw-pro", "*rīsan", "Proto-West Germanic *rīsan"),
        template("der", "en", "gem-pro", "*rīsaną", "Proto-Germanic *rīsaną (“to rise”)"),
        template("der", "en", "ine-pro", "*h₁rey-", "Proto-Indo-European *h₁rey- (“to arise, rise”)"),
        template("der", "en", "ine-pro", "*h₃er-", "Proto-Indo-European *h₃er- (“to rise, spring”)")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:rise:derived_from:enm:risen:from:en:rise:entry:verb:1",
        "enm:risen:derived_from:ang:rīsan:from:en:rise:entry:verb:1",
        "ang:rīsan:derived_from:gmw-pro:*rīsan:from:en:rise:entry:verb:1",
        "gmw-pro:*rīsan:derived_from:gem-pro:*rīsaną:from:en:rise:entry:verb:1",
        "gem-pro:*rīsaną:derived_from:ine-pro:*h₁rey-:from:en:rise:entry:verb:1",
        "ine-pro:*h₁rey-:derived_from:ine-pro:*h₃er-:from:en:rise:entry:verb:1",
      ]
    `);
    expect(edgeIds).not.toContain("en:rise:derived_from:ine-pro:*h₃er-:from:en:rise:entry:verb:1");
  });

  it("keeps conflated sources parallel when both share the same ancestor", () => {
    const entry: WiktextractEntry = {
      word: "bull",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_text:
        "From Middle English bole, from a conflation of Old English bula (“bull, steer”) and Old Norse boli, both from Proto-Germanic *bulô (“bull”), from Proto-Indo-European *bʰl̥no-.",
      etymology_templates: [
        template("inh", "en", "enm", "bole", "Middle English bole"),
        template("der", "en", "ang", "bula", "Old English bula (“bull, steer”)"),
        template("der", "en", "non", "boli", "Old Norse boli"),
        template("inh", "en", "gem-pro", "*bulô", "Proto-Germanic *bulô (“bull”)"),
        template("der", "en", "ine-pro", "*bʰl̥no-", "Proto-Indo-European *bʰl̥no-")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:bull:inherited_from:enm:bole:from:en:bull:entry:noun:1",
        "enm:bole:derived_from:ang:bula:from:en:bull:entry:noun:1",
        "enm:bole:derived_from:non:boli:from:en:bull:entry:noun:1",
        "non:boli:inherited_from:gem-pro:*bulô:from:en:bull:entry:noun:1",
        "ang:bula:inherited_from:gem-pro:*bulô:from:en:bull:entry:noun:1",
        "gem-pro:*bulô:derived_from:ine-pro:*bʰl̥no-:from:en:bull:entry:noun:1",
      ]
    `);
    expect(edgeIds).not.toContain("ang:bula:derived_from:non:boli:from:en:bull:entry:noun:1");
  });

  it("does not chain independent flat etymology sentences together", () => {
    const entry = loadFixtureEntry("en-element.json");
    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:element:derived_from:enm:element:from:en:element:entry:noun:0",
        "enm:element:derived_from:fro:element:from:en:element:entry:noun:0",
        "fro:element:derived_from:la:elementum:from:en:element:entry:noun:0",
        "en:element:inherited_from:enm:elementen:from:en:element:entry:noun:0",
      ]
    `);
    expect(edgeIds).not.toContain("la:elementum:inherited_from:enm:elementen");
  });

  it("keeps travel connected through Middle Scots to Old French", () => {
    const entry: WiktextractEntry = {
      word: "travel",
      lang: "English",
      lang_code: "en",
      pos: "verb",
      etymology_number: 1,
      etymology_text:
        "From Middle English travelen (“to make a laborious journey, travel”) from Middle Scots travailen (“to toil, work, travel”), alteration of Middle English travaillen (“to toil, work”), from Old French travailler (“to trouble, suffer, be worn out”).",
      etymology_templates: [
        template("inh", "en", "enm", "travelen", "Middle English travelen (“to make a laborious journey, travel”)"),
        template("der", "en", "gmw-msc", "travailen", "Middle Scots travailen (“to toil, work, travel”)"),
        template("cog", "enm", "enm", "travaillen", "Middle English travaillen (“to toil, work”)"),
        template("der", "en", "fro", "travailler", "Old French travailler (“to trouble, suffer, be worn out”)")
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:travel:inherited_from:enm:travelen:from:en:travel:entry:verb:1",
        "enm:travelen:derived_from:gmw-msc:travailen:from:en:travel:entry:verb:1",
        "gmw-msc:travailen:derived_from:fro:travailler:from:en:travel:entry:verb:1",
      ]
    `);
    expect(edgeIds).toContain(
      "gmw-msc:travailen:derived_from:fro:travailler:from:en:travel:entry:verb:1"
    );
  });

  it("skips modern spelling notes that cite orthographic influence instead of ancestry", () => {
    const entry: WiktextractEntry = {
      word: "hair",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text:
        "From Middle English her, heer, hær, from Old English hǣr, from Proto-West Germanic *hār, from Proto-Germanic *hērą (“hair”), from Proto-Indo-European *kes- (“to scrape, comb”). The modern spelling with ai is not a regular representation of the vowel developed from Middle English. Rather, it is from Middle English here (haircloth) influenced by Old French haire.",
      etymology_templates: [
        template("inh", "en", "enm", "her", "Middle English her"),
        template("inh", "en", "ang", "hǣr", "Old English hǣr"),
        template("inh", "en", "gmw-pro", "*hār", "Proto-West Germanic *hār"),
        template("inh", "en", "gem-pro", "*hērą", "Proto-Germanic *hērą (“hair”)"),
        template("der", "en", "ine-pro", "*kes-", "Proto-Indo-European *kes- (“to scrape, comb”)"),
        template("inh", "en", "enm", "here", "Middle English here"),
        template("noncog", "fro", "fro", "haire", "Old French haire")
      ]
    };
    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:hair:inherited_from:enm:her:from:en:hair:entry:noun:0",
        "enm:her:inherited_from:ang:hǣr:from:en:hair:entry:noun:0",
        "ang:hǣr:inherited_from:gmw-pro:*hār:from:en:hair:entry:noun:0",
        "gmw-pro:*hār:inherited_from:gem-pro:*hērą:from:en:hair:entry:noun:0",
        "gem-pro:*hērą:derived_from:ine-pro:*kes-:from:en:hair:entry:noun:0",
      ]
    `);
    expect(edgeIds).not.toContain("en:hair:inherited_from:enm:here:from:en:hair:entry:noun:0");
  });

  it("keeps elephant source candidates attached to the Greek etymon", () => {
    const entry = loadFixtureEntry("en-elephant.json");
    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:elephant:inherited_from:enm:elefant:from:en:elephant:entry:noun:0",
        "enm:elefant:derived_from:fro:elefant:from:en:elephant:entry:noun:0",
        "fro:elefant:derived_from:la:elephantus:from:en:elephant:entry:noun:0",
        "la:elephantus:derived_from:grc:ἐλέφᾱς:from:en:elephant:entry:noun:0",
        "grc:ἐλέφᾱς:derived_from:ber-pro:*eḷu:from:en:elephant:entry:noun:0",
        "grc:ἐλέφᾱς:derived_from:egy:ꜣbw:from:en:elephant:entry:noun:0",
      ]
    `);
    expect(edgeIds).not.toContain("ber-pro:*eḷu:derived_from:egy:ꜣbw");
    expect(edgeIds).not.toContain("en:elephant:derived_from:ber-pro:*eḷu");
    expect(edgeIds).not.toContain("en:elephant:derived_from:egy:ꜣbw");
  });

  it("walks recursive descendant lists through immediate parents", () => {
    const entry: WiktextractEntry = {
      word: "root",
      lang: "Latin",
      lang_code: "la",
      pos: "noun",
      descendants: [
        {
          lang_code: "fro",
          word: "root",
          descendants: [
            {
              lang_code: "en",
              word: "root"
            }
          ]
        }
      ]
    };

    expect(previewEdgeIds(entry)).toMatchInlineSnapshot(`
      [
        "fro:root:inherited_from:la:root:from:la:root:entry:noun:0",
        "en:root:inherited_from:fro:root:from:la:root:entry:noun:0",
      ]
    `);
  });

  it("keeps top-of-tree PIE ancestors when etymon metadata starts below them", () => {
    const edgeIds = previewEdgeIds(loadFixtureEntry("en-father-tree-header.json"));

    expect(edgeIds).toContain("gem-pro:*fadēr:inherited_from:ine-pro:*ph₂tḗr:from:en:father:entry:noun:0");
  });

  it("keeps multi-hop flat-template roots above an etymon tree", () => {
    const entry: WiktextractEntry = {
      word: "blood",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text:
        "From Middle English blood, from Old English blōd, from Proto-West Germanic *blōd, from Proto-Germanic *blōþą, possibly from Proto-Indo-European *bʰel-.",
      etymology_templates: [
        {
          name: "etymon",
          args: {
            "1": "en",
            "2": ":inh",
            "3": "enm:blood",
            tree: "1"
          },
          expansion:
            'Etymology tree\nProto-West Germanic *blōd\nOld English blōd\nMiddle English blood\nEnglish blood\n"terms" : [ { "children" : [ { "keyword" : "inherited", "terms" : [ { "children" : [ { "keyword" : "inherited", "terms" : [ { "children" : [ { "keyword" : "inherited", "terms" : [ { "children" : [ ], "term" : "*blōd", "lang" : "gmw-pro" } ] } ], "term" : "blōd", "lang" : "ang" } ] } ], "term" : "blood", "lang" : "enm" } ] } ], "term" : "blood", "lang" : "en" } ]'
        },
        template("inh", "en", "enm", "blood", "Middle English blood"),
        template("inh", "en", "ang", "blōd", "Old English blōd"),
        template("inh", "en", "gmw-pro", "*blōd", "Proto-West Germanic *blōd"),
        template("inh", "en", "gem-pro", "*blōþą", "Proto-Germanic *blōþą"),
        template("inh", "en", "ine-pro", "*bʰel-", "Proto-Indo-European *bʰel-")
      ]
    };
    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toContain("gmw-pro:*blōd:inherited_from:gem-pro:*blōþą:from:en:blood:entry:noun:0");
    expect(edgeIds).toContain("gem-pro:*blōþą:inherited_from:ine-pro:*bʰel-:from:en:blood:entry:noun:0");
  });

  it("strips Wiktionary etymology anchors from linked source terms", () => {
    const entry: WiktextractEntry = {
      word: "wrong",
      lang: "English",
      lang_code: "en",
      pos: "adj",
      etymology_text:
        "From Middle English wrong, from Old English wrang, from Old Norse rangr, from Proto-Germanic *wrangaz, from Proto-Indo-European *werḱ-.",
      etymology_templates: [
        template("inh", "en", "enm", "wrong", "Middle English wrong"),
        template("inh", "en", "ang", "wrang#Etymology_2_2", "Old English wrang"),
        template("der", "en", "non", "rangr", "Old Norse rangr"),
        template("der", "en", "gem-pro", "*wrangaz", "Proto-Germanic *wrangaz"),
        template("der", "en", "ine-pro", "*werḱ-", "Proto-Indo-European *werḱ-")
      ]
    };

    const preview = previewEntry(entry);
    const nodeIds = preview.nodes.map((node) => node.id);
    const edgeIds = preview.edges.map((edge) => edge.id);

    expect(nodeIds).toContain("ang:wrang");
    expect(nodeIds).not.toContain("ang:wrang#etymology_2_2");
    expect(edgeIds).toContain("enm:wrong:inherited_from:ang:wrang:from:en:wrong:entry:adj:0");
    expect(edgeIds).not.toContain("enm:wrong:inherited_from:ang:wrang#etymology_2_2:from:en:wrong:entry:adj:0");
  });

  it("does not treat hidden compound components in etymon trees as inherited ancestry", () => {
    const edgeIds = previewEdgeIds(loadFixtureEntry("en-wineberry.json"));

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "en:wineberry:inherited_from:enm:winberie:from:en:wineberry:entry:noun:0",
        "enm:winberie:inherited_from:ang:wīnberġe:from:en:wineberry:entry:noun:0",
        "ang:wīnberġe:inherited_from:gmw-pro:*wīnabaʀi:from:en:wineberry:entry:noun:0",
        "gmw-pro:*wīnabaʀi:inherited_from:gem-pro:*wīnabasją:from:en:wineberry:entry:noun:0"
      ])
    );
    expect(edgeIds).not.toContain("en:wine:inherited_from:enm:wyn:from:en:wineberry:entry:noun:0");
    expect(edgeIds).not.toContain("enm:wyn:inherited_from:enm:winberie:from:en:wineberry:entry:noun:0");
    expect(edgeIds).not.toContain("ang:wīn:inherited_from:ang:wīnberġe:from:en:wineberry:entry:noun:0");
  });

  it("keeps the character etymon tree on its main lexical chain", () => {
    const edgeIds = previewEdgeIds(loadFixtureEntry("en-character.json"));

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "en:character:inherited_from:enm:caracter:from:en:character:entry:noun:0",
        "enm:caracter:borrowed_from:fro:caractere:from:en:character:entry:noun:0",
        "fro:caractere:derived_from:la:charactēr:from:en:character:entry:noun:0",
        "la:charactēr:derived_from:grc:χαρακτήρ:from:en:character:entry:noun:0"
      ])
    );
    expect(edgeIds).not.toContain("enm:caracter:inherited_from:ine-pro:*-tḗr:from:en:character:entry:noun:0");
  });

  it("keeps lexical ancestry inside etymon affix groups without flattening the components", () => {
    const entry: WiktextractEntry = {
      word: "face",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text:
        "From Middle English face, from Old French face, from Late Latin facia, from Latin faciēs (“form, appearance”).",
      etymology_templates: [
        {
          name: "etymon",
          args: {
            "1": "en",
            "2": ":inh",
            "3": "enm:face",
            tree: "1"
          },
          expansion:
            'Etymology tree\nLate Latin faciō\nProto-Italic *fakjō\nLate Latin faciēs\nLate Latin facia\nOld French face\nMiddle English face\nEnglish face\n"terms" : [ { "children" : [ { "keyword" : "inherited", "terms" : [ { "children" : [ { "keyword" : "bor", "terms" : [ { "children" : [ { "keyword" : "inherited", "terms" : [ { "children" : [ { "keyword" : "from", "terms" : [ { "children" : [ { "is_group" : true, "keyword" : "affix", "terms" : [ { "children" : [ { "keyword" : "inherited", "terms" : [ { "children" : [ ], "term" : "*fakjō", "lang" : "itc-pro" } ] } ], "term" : "faciō", "lang" : "la-lat" }, { "children" : [ ], "term" : "-iēs", "lang" : "la-lat" } ] } ], "term" : "faciēs", "lang" : "la-lat" } ] } ], "term" : "facia", "lang" : "la-lat" } ] } ], "term" : "face", "lang" : "fro" } ] } ], "term" : "face", "lang" : "enm" } ] } ], "term" : "face", "lang" : "en" } ]'
        }
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "en:face:inherited_from:enm:face:from:en:face:entry:noun:0",
        "enm:face:borrowed_from:fro:face:from:en:face:entry:noun:0",
        "fro:face:inherited_from:la-lat:facia:from:en:face:entry:noun:0",
        "la-lat:facia:derived_from:la-lat:faciēs:from:en:face:entry:noun:0",
        "la-lat:faciēs:derived_from:la-lat:faciō:from:en:face:entry:noun:0",
        "la-lat:faciō:inherited_from:itc-pro:*fakjō:from:en:face:entry:noun:0"
      ])
    );
    expect(edgeIds).not.toContain("la-lat:faciō:derived_from:la-lat:-iēs:from:en:face:entry:noun:0");
  });

  it("keeps etymon influence branches out of the main ancestry chain", () => {
    const entry: WiktextractEntry = {
      word: "ginger",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_text:
        "Inherited from Middle English gingere, alteration of gingivere, from Old English gingifer (influenced by Old French gingembre).",
      etymology_templates: [
        {
          name: "etymon",
          args: {
            "1": "en",
            "2": ":inh",
            "3": "enm:gingere",
            tree: "1"
          },
          expansion:
            'Etymology tree\nOld English gingifer\n▲\nOld French gingembreinflu.\nMiddle English gingivere\nMiddle English gingere\nEnglish ginger\n"term" : "gingifer", "lang" : "ang", "keyword" : "inherited", { "keyword" : "influence", "terms" : [ { "term" : "gingembre", "lang" : "fro" } ] }, "term" : "gingivere", "lang" : "enm", "keyword" : "from", "term" : "gingere", "lang" : "enm", "keyword" : "inherited", "term" : "ginger", "lang" : "en"'
        }
      ]
    };

    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "en:ginger:inherited_from:enm:gingere:from:en:ginger:entry:noun:1",
        "enm:gingere:derived_from:enm:gingivere:from:en:ginger:entry:noun:1",
        "enm:gingivere:inherited_from:ang:gingifer:from:en:ginger:entry:noun:1"
      ])
    );
    expect(edgeIds).not.toContain("fro:gingembre:inherited_from:ang:gingifer:from:en:ginger:entry:noun:1");
  });

  it("captures first-formation compound components as compound edges", () => {
    const edgeIds = previewEdgeIds(loadFixtureEntry("non-gronland.json"));

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "non:grǿnland:compound_of:non:grǿnn:from:non:grǿnland:entry:name:0",
        "non:grǿnland:compound_of:non:land:from:non:grǿnland:entry:name:0"
      ])
    );
  });

  it("captures explicit doublet template links as entry-owned side edges", () => {
    const entry: WiktextractEntry = {
      word: "character",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_number: 1,
      etymology_text: "Borrowed from Latin character. Doublet of charakter.",
      etymology_templates: [
        template("bor", "en", "la", "character", "Latin character"),
        {
          name: "doublet",
          args: {
            "1": "en",
            "2": "charakter"
          },
          expansion: "Doublet of charakter"
        }
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toContain("en:character:doublet_of:en:charakter:from:en:character:entry:noun:1");
  });

  it("captures explicit cognate template links as entry-owned side edges", () => {
    const entry: WiktextractEntry = {
      word: "is",
      lang: "English",
      lang_code: "en",
      pos: "verb",
      etymology_number: 1,
      etymology_text: "Cognate with Dutch is and German ist.",
      etymology_templates: [
        {
          name: "cog",
          args: {
            "1": "nl",
            "2": "is"
          },
          expansion: "Dutch is"
        },
        {
          name: "cog",
          args: {
            "1": "de",
            "2": "ist"
          },
          expansion: "German ist"
        }
      ]
    };

    const edgeIds = previewStructuredEdgeIds(entry);

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "en:is:cognate_with:nl:is:from:en:is:entry:verb:1",
        "en:is:cognate_with:de:ist:from:en:is:entry:verb:1"
      ])
    );
  });

  it("connects affixed entries to their lexical base when tree metadata omits the current form", () => {
    const entry: WiktextractEntry = {
      word: "armadillo",
      lang: "Spanish",
      lang_code: "es",
      pos: "noun",
      etymology_text: "From armado (“armored”) + -illo (diminutive suffix).",
      etymology_templates: [
        {
          name: "etymon",
          args: {
            "1": "es",
            "2": ":af",
            "3": "armado<id:armed>",
            "4": "-illo<id:diminutive>",
            tree: "1"
          },
          expansion:
            '"term" : "armado", "lang" : "osp", "keyword" : "inherited", "term" : "armado", "lang" : "es"'
        },
        {
          name: "af",
          args: {
            "1": "es",
            "2": "armado<t:armored>",
            "3": "-illo<pos:diminutive suffix>"
          },
          expansion: "armado (“armored”) + -illo (diminutive suffix)"
        }
      ]
    };
    const edgeIds = previewEdgeIds(entry);

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "es:armadillo:derived_from:es:armado:from:es:armadillo:entry:noun:0",
        "es:armado:inherited_from:osp:armado:from:es:armadillo:entry:noun:0"
      ])
    );
    expect(edgeIds).not.toContain("es:armadillo:derived_from:es:-illo:from:es:armadillo:entry:noun:0");
  });
});

describe("previewEntry merged neighborhoods", () => {
  it("keeps PIE ancestors from flat templates when etymon tree metadata starts too low", () => {
    const entries = loadFixtureEntries("en-kinship-pie-gaps.json");
    const edgeIds = previewMergedEdgeIds(entries);

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "gem-pro:*fadēr:inherited_from:ine-pro:*ph₂tḗr:from:en:father:entry:noun:0",
        "gem-pro:*brōþēr:inherited_from:ine-pro:*bʰréh₂tēr:from:en:brother:entry:noun:0",
        "gem-pro:*watōr:inherited_from:ine-pro:*wódr̥:from:en:water:entry:noun:1"
      ])
    );
  });

  it("keeps nation neighborhood edges tied to their source entries", () => {
    const entries = loadFixtureEntries("en-nation-neighborhood.json");
    const edgeIds = previewMergedEdgeIds(entries);

    expect(edgeIds).toMatchInlineSnapshot(`
      [
        "en:nation:inherited_from:enm:nacioun:from:en:nation:entry:noun:1",
        "enm:nacioun:derived_from:fro:nacion:from:en:nation:entry:noun:1",
        "fro:nacion:derived_from:la:nātiōnem:from:en:nation:entry:noun:1",
        "la:nātiōnem:derived_from:ine-pro:*ǵenh₁-:from:en:nation:entry:noun:1",
        "fr:nation:inherited_from:frm:nation:from:fr:nation:entry:noun:0",
        "frm:nation:inherited_from:fro:nacion:from:fr:nation:entry:noun:0",
        "fro:nacion:borrowed_from:la:natio:from:fr:nation:entry:noun:0",
        "ht:nasyon:inherited_from:fr:nation:from:fr:nation:entry:noun:0",
        "pms:nassion:borrowed_from:fr:nation:from:fr:nation:entry:noun:0",
        "de:nation:borrowed_from:la:nātiō:from:de:nation:entry:noun:0",
        "it:nazione:borrowed_from:la:natio:from:it:nazione:entry:noun:0",
        "la:natio:derived_from:itc-pro:*gnātiō:from:la:natio:entry:noun:0",
        "itc-pro:*gnātiō:derived_from:ine-pro:*ǵenh₁-:from:la:natio:entry:noun:0",
        "de:nation:borrowed_from:la:natio:from:la:natio:entry:noun:0",
        "it:nazione:borrowed_from:la:natio:from:la:natio:entry:noun:0",
        "fro:nacion:borrowed_from:la:natio:from:la:natio:entry:noun:0",
        "frm:nation:inherited_from:fro:nacion:from:la:natio:entry:noun:0",
        "fr:nation:inherited_from:frm:nation:from:la:natio:entry:noun:0",
        "enm:nacioun:borrowed_from:fro:nacion:from:la:natio:entry:noun:0",
        "en:nation:inherited_from:enm:nacioun:from:la:natio:entry:noun:0",
      ]
    `);
    expect(edgeIds).not.toContain("de:nation:borrowed_from:it:nazione");
    expect(edgeIds).not.toContain("fr:nation:borrowed_from:de:nation");
    expect(edgeIds).not.toContain("la:nātiō:borrowed_from:fr:nation");
  });

  it("keeps the chief and cap doublet bridge connected through cap's real etymology tree", () => {
    const entries = loadFixtureEntries("en-chief-cap-neighborhood.json");
    const edgeIds = previewMergedEdgeIds(entries);

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "en:cap:inherited_from:enm:cappe:from:en:cap:entry:noun:1",
        "enm:cappe:inherited_from:ang:cæppe:from:en:cap:entry:noun:1",
        "ang:cæppe:inherited_from:gmw-pro:*kappijā:from:en:cap:entry:noun:1",
        "gmw-pro:*kappijā:derived_from:gmw-pro:*kappā:from:en:cap:entry:noun:1",
        "gmw-pro:*kappā:borrowed_from:la-lat:cappa:from:en:cap:entry:noun:1",
        "la-lat:cappa:derived_from:la:caput:from:en:cap:entry:noun:1",
        "en:chief:inherited_from:enm:cheef:from:en:chief:entry:noun:0",
        "la-vul:capus:derived_from:la:caput:from:en:chief:entry:noun:0"
      ])
    );
  });
});

describe("traverseAncestors against merged neighborhoods", () => {
  it("reaches canal ancestry through ancestor-page descendant records", () => {
    const neighborhood = mergeStructuredNeighborhood(canalNeighborhoodEntries());
    const reached = traverseAncestors({
      ...neighborhood,
      rootEntryId: expectEntryId("en", "canal", "noun", 0),
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 8
    });

    const reachedNodeIds = [...reached.nodeDepthsById.keys()].sort();
    expect(reachedNodeIds).toEqual([
      "en:canal",
      "enm:canal",
      "frm:canal",
      "fro:canel",
      "grc:κάννα",
      "la:canalis"
    ]);
    expect(neighborhood.edges.map((edge) => edge.id)).toContain(
      "fro:canel:borrowed_from:la:canalis:from:la:canalis:entry:noun:0"
    );
    expect([...reached.reachedEdgeIds].sort()).toEqual([
      "en:canal:borrowed_from:frm:canal:from:en:canal:entry:noun:0",
      "en:canal:inherited_from:enm:canal:from:fro:canel:entry:noun:0",
      "enm:canal:borrowed_from:fro:canel:from:fro:canel:entry:noun:0",
      "fro:canel:borrowed_from:la:canalis:from:fro:canel:entry:noun:0",
      "la:canalis:derived_from:grc:κάννα:from:la:canalis:entry:noun:0"
    ]);
  });

  it("reaches tooth ancestry through a queued Middle English descendant variant", () => {
    const englishTooth: WiktextractEntry = {
      word: "tooth",
      lang: "English",
      lang_code: "en",
      pos: "noun",
      etymology_text:
        "From Middle English tothe, toth, tooth, from Old English tōþ, from Proto-West Germanic *tanþ, from Proto-Germanic *tanþs, from Proto-Indo-European *h₃dónts.",
      etymology_templates: [
        template("inh", "en", "enm", "tothe", "Middle English tothe"),
        template("inh", "en", "ang", "tōþ", "Old English tōþ"),
        template("inh", "en", "gmw-pro", "*tanþ", "Proto-West Germanic *tanþ"),
        template("inh", "en", "gem-pro", "*tanþs", "Proto-Germanic *tanþs"),
        template("inh", "en", "ine-pro", "*h₃dónts", "Proto-Indo-European *h₃dónts")
      ]
    };
    const oldEnglishTooth = prioritizeStructuredDescendantTargets(
      {
        word: "toþ",
        lang: "Old English",
        lang_code: "ang",
        pos: "noun",
        etymology_text: "From Proto-West Germanic *tanþ.",
        etymology_templates: [template("inh", "ang", "gmw-pro", "*tanþ", "Proto-West Germanic *tanþ")],
        descendants: [
          {
            lang: "Middle English",
            lang_code: "enm",
            word: "toth",
            descendants: [{ lang: "English", lang_code: "en", word: "tooth" }]
          },
          {
            lang: "Middle English",
            lang_code: "enm",
            word: "tothe",
            descendants: [{ lang: "English", lang_code: "en", word: "tooth" }]
          }
        ]
      },
      [{ langCode: "enm", word: "tothe" }]
    );
    const neighborhood = mergeStructuredNeighborhood([
      englishTooth,
      oldEnglishTooth,
      { word: "tothe", lang: "Middle English", lang_code: "enm", pos: "noun" },
      {
        word: "tanþ",
        lang: "Proto-West Germanic",
        lang_code: "gmw-pro",
        pos: "noun",
        etymology_templates: [template("inh", "gmw-pro", "gem-pro", "*tanþs", "Proto-Germanic *tanþs")]
      },
      {
        word: "tanþs",
        lang: "Proto-Germanic",
        lang_code: "gem-pro",
        pos: "noun",
        etymology_templates: [
          template("inh", "gem-pro", "ine-pro", "*h₃dónts", "Proto-Indo-European *h₃dónts")
        ]
      }
    ]);
    const reached = traverseAncestors({
      ...neighborhood,
      rootEntryId: expectEntryId("en", "tooth", "noun", 0),
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 8
    });

    expect(neighborhood.edges.map((edge) => edge.id)).toContain(
      "enm:tothe:inherited_from:ang:toþ:from:ang:toþ:entry:noun:0"
    );
    expect([...reached.nodeDepthsById.keys()].sort()).toEqual([
      "ang:toþ",
      "en:tooth",
      "enm:tothe",
      "gem-pro:*tanþs",
      "gmw-pro:*tanþ",
      "ine-pro:*h₃dónts"
    ]);
  });

  it("continues from an English descendant through an unstarred proto page entry", () => {
    const entries: WiktextractEntry[] = [
      {
        word: "hound",
        lang: "English",
        lang_code: "en",
        pos: "noun",
        etymology_number: 1,
        etymology_text:
          "From Middle English hound, from Old English hund, from Proto-West Germanic *hund, from Proto-Germanic *hundaz.",
        etymology_templates: [
          template("inh", "en", "enm", "hound", "Middle English hound"),
          template("inh", "en", "ang", "hund", "Old English hund"),
          template("inh", "en", "gmw-pro", "*hund", "Proto-West Germanic *hund"),
          template("inh", "en", "gem-pro", "*hundaz", "Proto-Germanic *hundaz")
        ]
      },
      {
        word: "hundaz",
        lang: "Proto-Germanic",
        lang_code: "gem-pro",
        pos: "noun",
        etymology_text: "From Proto-Indo-European *ḱwṓ (“dog”).",
        etymology_templates: [template("der", "gem-pro", "ine-pro", "*ḱwṓ", "Proto-Indo-European *ḱwṓ")]
      }
    ];
    const neighborhood = mergeNeighborhood(entries);
    const reached = traverseAncestors({
      ...neighborhood,
      rootEntryId: expectEntryId("en", "hound", "noun", 1),
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 10
    });

    expect([...reached.reachedEdgeIds]).toContain(
      "gem-pro:*hundaz:derived_from:ine-pro:*ḱwṓ:from:gem-pro:*hundaz:entry:noun:0"
    );
    expect(reached.nodeDepthsById.get("ine-pro:*ḱwṓ")).toBe(5);
  });

  it("uses descendant-owned ancestry when the current term has a single lexical entry", () => {
    const entries: WiktextractEntry[] = [
      {
        word: "loan",
        lang: "English",
        lang_code: "en",
        pos: "noun",
        etymology_number: 1
      },
      {
        word: "source",
        lang: "Latin",
        lang_code: "la",
        pos: "noun",
        descendants: [
          {
            lang: "French",
            lang_code: "fr",
            word: "source-child",
            raw_tags: ["borrowed"],
            descendants: [
              {
                lang: "English",
                lang_code: "en",
                word: "loan",
                raw_tags: ["borrowed"]
              }
            ]
          }
        ]
      }
    ];
    const neighborhood = mergeNeighborhood(entries);
    const reached = traverseAncestors({
      ...neighborhood,
      rootEntryId: expectEntryId("en", "loan", "noun", 1),
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 10
    });

    expect([...reached.reachedEdgeIds]).toEqual(
      expect.arrayContaining([
        "en:loan:borrowed_from:fr:source-child:from:la:source:entry:noun:0",
        "fr:source-child:borrowed_from:la:source:from:la:source:entry:noun:0"
      ])
    );
    expect(reached.nodeDepthsById.get("la:source")).toBe(2);
  });

  it("does not add descendant spelling variants when the entry has its own ancestry", () => {
    const entries: WiktextractEntry[] = [
      {
        word: "wine",
        lang: "English",
        lang_code: "en",
        pos: "noun",
        etymology_number: 1,
        etymology_text: "From Middle English wyn, from Old English wīn.",
        etymology_templates: [
          template("inh", "en", "enm", "wyn", "Middle English wyn"),
          template("inh", "en", "ang", "wīn", "Old English wīn")
        ]
      },
      {
        word: "wīn",
        lang: "Old English",
        lang_code: "ang",
        pos: "noun",
        descendants: [
          {
            lang: "Middle English",
            lang_code: "enm",
            word: "wyn",
            descendants: [
              {
                lang: "English",
                lang_code: "en",
                word: "wine"
              }
            ]
          },
          {
            lang: "Middle English",
            lang_code: "enm",
            word: "win",
            descendants: [
              {
                lang: "English",
                lang_code: "en",
                word: "wine"
              }
            ]
          }
        ]
      }
    ];
    const neighborhood = mergeNeighborhood(entries);
    const reached = traverseAncestors({
      ...neighborhood,
      rootEntryId: expectEntryId("en", "wine", "noun", 1),
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 10
    });

    expect([...reached.reachedEdgeIds]).toEqual(
      expect.arrayContaining([
        "en:wine:inherited_from:enm:wyn:from:en:wine:entry:noun:1",
        "enm:wyn:inherited_from:ang:wīn:from:en:wine:entry:noun:1"
      ])
    );
    expect([...reached.reachedEdgeIds]).not.toContain(
      "en:wine:inherited_from:enm:win:from:ang:wīn:entry:noun:0"
    );
    expect(reached.nodeDepthsById.has("enm:win")).toBe(false);
  });

  it("continues through descendant-owned source branches in a different language", () => {
    const entries: WiktextractEntry[] = [
      {
        word: "orange",
        lang: "English",
        lang_code: "en",
        pos: "noun",
        etymology_text:
          "Inherited from Middle English orenge, from Middle French orange, from Old French orenge, from Old French pomme d'orenge.",
        etymology_templates: [
          template("inh", "en", "enm", "orenge", "Middle English orenge"),
          template("bor", "en", "frm", "orange", "Middle French orange"),
          template("inh", "en", "fro", "orenge", "Old French orenge"),
          template("der", "en", "fro", "pomme d'orenge", "Old French pomme d'orenge")
        ]
      },
      {
        word: "arancia",
        lang: "Italian",
        lang_code: "it",
        pos: "noun",
        etymology_text:
          "From Arabic نَارَنْج (nāranj), from Persian نارنگ (nârang), from Sanskrit नारङ्ग (nāraṅga).",
        etymology_templates: [
          template("bor", "it", "ar", "نَارَنْج", "Arabic نَارَنْج (nāranj)"),
          template("der", "it", "fa", "نارنگ", "Persian نارنگ (nârang)"),
          template("der", "it", "sa", "नारङ्ग", "Sanskrit नारङ्ग (nāraṅga)")
        ],
        descendants: [
          {
            lang: "Old Occitan",
            lang_code: "pro",
            word: "auranja",
            descendants: [
              {
                lang: "Old French",
                lang_code: "fro",
                word: "orenge",
                raw_tags: ["borrowed"]
              }
            ]
          }
        ]
      }
    ];
    const neighborhood = mergeNeighborhood(entries);
    const reached = traverseAncestors({
      ...neighborhood,
      rootEntryId: expectEntryId("en", "orange", "noun", 0),
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 10
    });

    expect([...reached.reachedEdgeIds]).toEqual(
      expect.arrayContaining([
        "fro:orenge:borrowed_from:pro:auranja:from:it:arancia:entry:noun:0",
        "pro:auranja:inherited_from:it:arancia:from:it:arancia:entry:noun:0",
        "it:arancia:borrowed_from:ar:نَارَنْج:from:it:arancia:entry:noun:0",
        "ar:نَارَنْج:derived_from:fa:نارنگ:from:it:arancia:entry:noun:0",
        "fa:نارنگ:derived_from:sa:नारङ्ग:from:it:arancia:entry:noun:0"
      ])
    );
    expect(reached.nodeDepthsById.has("sa:नारङ्ग")).toBe(true);
  });

  it("does not use descendant-owned ancestry across a homograph node", () => {
    const entries: WiktextractEntry[] = [
      {
        word: "bank",
        lang: "English",
        lang_code: "en",
        pos: "noun",
        etymology_number: 1
      },
      {
        word: "bank",
        lang: "English",
        lang_code: "en",
        pos: "verb",
        etymology_number: 2
      },
      {
        word: "source",
        lang: "Latin",
        lang_code: "la",
        pos: "noun",
        descendants: [
          {
            lang: "English",
            lang_code: "en",
            word: "bank",
            raw_tags: ["borrowed"]
          }
        ]
      }
    ];
    const neighborhood = mergeNeighborhood(entries);
    const reached = traverseAncestors({
      ...neighborhood,
      rootEntryId: expectEntryId("en", "bank", "noun", 1),
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 10
    });

    expect([...reached.reachedEdgeIds]).not.toContain(
      "en:bank:borrowed_from:la:source:from:la:source:entry:noun:0"
    );
    expect(reached.nodeDepthsById.has("la:source")).toBe(false);
  });

  it("keeps ice ancestry inside the ice chain when en:is verb-be shares enm:is", () => {
    const neighborhood = mergeNeighborhood(loadFixtureEntries("en-ice-neighborhood.json"));
    const rootEntryId = expectEntryId("en", "ice", "noun", 0);

    const reached = traverseAncestors({
      edges: neighborhood.edges,
      lexicalEntries: neighborhood.lexicalEntries,
      rootEntryId,
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 8
    });

    const reachedNodeIds = [...reached.nodeDepthsById.keys()].sort();
    expect(reachedNodeIds).toMatchInlineSnapshot(`
      [
        "ang:īs",
        "en:ice",
        "enm:is",
        "gem-pro:*īsą",
        "gmw-pro:*īs",
        "ine-pro:*h₁eyh-",
      ]
    `);

    expect(reachedNodeIds).not.toContain("ang:is");
    expect(reachedNodeIds).not.toContain("gem-pro:*isti");
    expect(reachedNodeIds).not.toContain("gmw-pro:*ist");
    expect(reachedNodeIds).not.toContain("ine-pro:*h₁ésti");
  });

  it("keeps en:is verb-be ancestry inside the be chain when en:ice shares enm:is", () => {
    const neighborhood = mergeNeighborhood(loadFixtureEntries("en-ice-neighborhood.json"));
    const rootEntryId = expectEntryId("en", "is", "verb", 1);

    const reached = traverseAncestors({
      edges: neighborhood.edges,
      lexicalEntries: neighborhood.lexicalEntries,
      rootEntryId,
      edgeTypes: ANCESTOR_EDGE_TYPES,
      maxDepth: 8
    });

    const reachedNodeIds = [...reached.nodeDepthsById.keys()].sort();
    expect(reachedNodeIds).toMatchInlineSnapshot(`
      [
        "ang:is",
        "en:is",
        "enm:is",
        "gem-pro:*isti",
        "gmw-pro:*ist",
        "ine-pro:*h₁ésti",
      ]
    `);

    expect(reachedNodeIds).not.toContain("ang:īs");
    expect(reachedNodeIds).not.toContain("gem-pro:*īsą");
    expect(reachedNodeIds).not.toContain("gmw-pro:*īs");
    expect(reachedNodeIds).not.toContain("ine-pro:*h₁eyh-");
  });
});

describe("structured ancestry seed expansion", () => {
  it("queues canal ancestor pages whose descendants provide the real ancestry chain", () => {
    const [englishCanal, latinCanalis, oldFrenchCanel] = canalNeighborhoodEntries();

    expect(discoveredTargetKeys(englishCanal)).toEqual(expect.arrayContaining([
      "frm:canal",
      "fro:canal",
      "la:canālis"
    ]));
    expect(discoveredTargetKeys(latinCanalis)).toEqual(expect.arrayContaining([
      "fro:canel"
    ]));
    expect(discoveredTargetKeys(oldFrenchCanel)).toEqual(expect.arrayContaining([
      "la:canalis",
      "enm:canal",
      "en:canal"
    ]));
  });
});

describe("seed target matching", () => {
  it("matches reconstructed targets against raw Wiktextract proto entries without a leading star", () => {
    const targetIndex = buildSeedTargetIndex([{ langCode: "gem-pro", word: "*hundaz" }]);
    const entry: WiktextractEntry = {
      word: "hundaz",
      lang: "Proto-Germanic",
      lang_code: "gem-pro",
      pos: "noun"
    };

    expect(findMatchingSeedTargetIndex(targetIndex, entry)).toBe(0);
  });

  it("matches diacritic-bearing targets against plain Wiktextract entry titles", () => {
    const targetIndex = buildSeedTargetIndex([{ langCode: "la", word: "trēs" }]);
    const entry: WiktextractEntry = {
      word: "tres",
      lang: "Latin",
      lang_code: "la",
      pos: "num"
    };

    expect(findMatchingSeedTargetIndex(targetIndex, entry)).toBe(0);
  });
});

/** Creates the Wiktextract template shape used by graph conversion regression fixtures. */
function template(
  name: string,
  sourceLangCode: string,
  targetLangCode: string,
  targetTerm: string | undefined,
  expansion: string,
  extraArgs: Record<string, string> = {}
): NonNullable<WiktextractEntry["etymology_templates"]>[number] {
  return {
    name,
    args: {
      "1": sourceLangCode,
      "2": targetLangCode,
      ...(targetTerm === undefined ? {} : { "3": targetTerm }),
      ...extraArgs
    },
    expansion
  };
}
