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

import { previewEntry, type WiktextractEntry } from "./wiktextract.js";

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "wiktextract");
const previewEdgeIds = (entry: WiktextractEntry): string[] => previewEntry(entry).edges.map((edge) => edge.id);
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

/** Resolves the lexical entry id for a (lang, word, pos, etymN) anchor used by ancestor traversals. */
const expectEntryId = (langCode: string, word: string, pos: string, etymN: number): string => {
  return makeLexicalEntryId(makeNodeId(langCode, word), pos, etymN);
};

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

  it("captures first-formation compound components as compound edges", () => {
    const edgeIds = previewEdgeIds(loadFixtureEntry("non-gronland.json"));

    expect(edgeIds).toEqual(
      expect.arrayContaining([
        "non:grǿnland:compound_of:non:grǿnn:from:non:grǿnland:entry:name:0",
        "non:grǿnland:compound_of:non:land:from:non:grǿnland:entry:name:0"
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
        "fr:nation:inherited_from:frm:nation:from:fr:nation:entry:noun:0",
        "frm:nation:inherited_from:fro:nacion:from:fr:nation:entry:noun:0",
        "fro:nacion:borrowed_from:la:natio:from:fr:nation:entry:noun:0",
        "ht:nasyon:inherited_from:fr:nation:from:fr:nation:entry:noun:0",
        "pms:nassion:borrowed_from:fr:nation:from:fr:nation:entry:noun:0",
        "de:nation:borrowed_from:la:nātiō:from:de:nation:entry:noun:0",
        "it:nazione:borrowed_from:la:natio:from:it:nazione:entry:noun:0",
        "la:natio:derived_from:itc-pro:*gnātiō:from:la:natio:entry:noun:0",
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
