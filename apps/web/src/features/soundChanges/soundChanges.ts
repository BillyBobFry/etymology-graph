import type { ComparisonSetQuery } from "@etymology-graph/graph";

import type { GlossaryTextSegment } from "../glossary/linguisticGlossary";
import type { GraphNodeAnnotation } from "../graph/graphAnnotations";

export type SoundChangeGraphAnnotation = GraphNodeAnnotation & {
  targetGroupId?: "shifted" | "comparisons";
};

export type SoundChangeTerm = {
  languageCode: string;
  languageName: string;
  term: string;
};

export type SoundChangeLineage = {
  id: string;
  label: string;
  from: SoundChangeTerm;
  to: SoundChangeTerm;
};

export type SoundChangeExampleSet = {
  id: string;
  title: string;
  pattern: string;
  explanation: string;
  shiftedLabel: string;
  comparisonLabel: string;
  shifted: SoundChangeLineage[];
  comparisons: SoundChangeLineage[];
  annotations: SoundChangeGraphAnnotation[];
};

export type SoundChangeArticle = {
  slug: string;
  title: string;
  subtitle: string;
  overview: GlossaryTextSegment[];
  affectedLanguages: string[];
  families: string[];
  sections: Array<{
    heading: string;
    body: GlossaryTextSegment[];
  }>;
  examples: SoundChangeExampleSet[];
};

export const soundChangeArticles: SoundChangeArticle[] = [
  {
    slug: "grimms-law",
    title: "Grimm's Law",
    subtitle: "How older Indo-European stops became the Germanic sounds behind English, German, Dutch, and Norse words.",
    overview: [
      "Grimm's Law describes a regular shift that separates the Germanic branch from many other Indo-European languages. It helps explain why Latin, Greek, Sanskrit, and Germanic ",
      { text: "cognates", termId: "cognate" },
      " often begin with different consonants even when they descend from the same older word."
    ],
    affectedLanguages: ["Proto-Germanic", "English", "German", "Dutch", "Old Norse", "Gothic"],
    families: ["Indo-European", "Germanic"],
    sections: [
      {
        heading: "The change",
        body: [
          "In the Germanic branch, several Proto-Indo-European ",
          { text: "stop consonants", termId: "stop-consonant" },
          " shifted in a regular chain. ",
          { text: "Voiceless stops", termId: "voiceless-stop" },
          " such as p, t, and k became ",
          { text: "fricatives", termId: "fricative" },
          " such as f, th, and h. ",
          { text: "Voiced stops", termId: "voiced-stop" },
          " such as b, d, and g moved toward ",
          { text: "voiceless stops", termId: "voiceless-stop" },
          ". ",
          { text: "Aspirated voiced stops", termId: "aspirated-voiced-stop" },
          " became plain voiced stops in many environments."
        ]
      },
      {
        heading: "Why it matters",
        body: [
          "The pattern turns apparent mismatches into evidence. English father and Latin pater are not accidental lookalikes. Their first sounds differ because Germanic changed the older p sound into f while Latin kept the older ",
          { text: "stop", termId: "stop-consonant" },
          "."
        ]
      },
      {
        heading: "How to read the examples",
        body: [
          "Each example compares Germanic ",
          { text: "reflexes", termId: "reflex" },
          " that carry the shift with ",
          { text: "cognates", termId: "cognate" },
          " from other Indo-European branches. The graphs show the ",
          { text: "lineage", termId: "lineage" },
          " paths covered in the atlas for each word."
        ]
      }
    ],
    examples: [
      {
        id: "p-to-f",
        title: "p becomes f",
        pattern: "Proto-Indo-European p → Germanic f",
        explanation:
          "Germanic words in this kinship set show f where modern Romance cognates preserve an older p-like stop.",
        shiftedLabel: "Germanic reflexes with f",
        comparisonLabel: "Modern cognates without the shift",
        annotations: [
          {
            id: "p-to-f-shifted-germanic",
            targetGroupId: "shifted",
            target: {
              langCode: "gem-pro",
              word: "*fadēr"
            },
            tone: "shifted",
            title: "Branch with f",
            body:
              "This branch shows p changing to f. English father and Dutch vader carry the shifted sound in their later lineages.",
            placement: "above-right"
          },
          {
            id: "p-to-f-unchanged-italic",
            targetGroupId: "comparisons",
            target: {
              langCode: "itc-pro",
              word: "*patēr"
            },
            fallbackTargets: [
              {
                langCode: "la",
                word: "pater"
              }
            ],
            tone: "unchanged",
            title: "Branch with p",
            body:
              "This branch did not undergo the Germanic p to f shift. Spanish padre and Sanskrit pitṛ́ preserve the older p-lineage contrast.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "father",
            label: "English father",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "father"
            }
          },
          {
            id: "vader",
            label: "Dutch vader",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "nl",
              languageName: "Dutch",
              term: "vader"
            }
          }
        ],
        comparisons: [
          {
            id: "padre-es",
            label: "Spanish padre",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "es",
              languageName: "Spanish",
              term: "padre"
            }
          },
          {
            id: "pitr-sa",
            label: "Sanskrit pitṛ́",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "sa",
              languageName: "Sanskrit",
              term: "पितृ"
            }
          }
        ]
      },
      {
        id: "t-to-th",
        title: "t becomes th",
        pattern: "Proto-Indo-European t → Germanic th",
        explanation:
          "The word for three is a compact comparison: English has the Germanic fricative, while several sister branches keep a t-like consonant.",
        shiftedLabel: "Germanic reflexes with th",
        comparisonLabel: "Modern cognates without the shift",
        annotations: [
          {
            id: "t-to-th-shifted-english",
            targetGroupId: "shifted",
            target: {
              langCode: "en",
              word: "three"
            },
            tone: "shifted",
            title: "Branch with th",
            body:
              "This branch shows t changing to th. English three and Icelandic þrír carry the shifted dental sound.",
            placement: "above-right"
          },
          {
            id: "t-to-th-unchanged-latin",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "trēs"
            },
            tone: "unchanged",
            title: "Branch with t",
            body:
              "This branch did not take the Germanic t to th shift. Latin trēs and French trois keep the comparison with t visible.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "three",
            label: "English three",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*tréyes"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "three"
            }
          },
          {
            id: "thrir-is",
            label: "Icelandic þrír",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*tréyes"
            },
            to: {
              languageCode: "is",
              languageName: "Icelandic",
              term: "þrír"
            }
          }
        ],
        comparisons: [
          {
            id: "tres-la",
            label: "Latin trēs",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*tréyes"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "trēs"
            }
          },
          {
            id: "trois-fr",
            label: "French trois",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*tréyes"
            },
            to: {
              languageCode: "fr",
              languageName: "French",
              term: "trois"
            }
          }
        ]
      },
      {
        id: "k-to-h",
        title: "k becomes h",
        pattern: "Proto-Indo-European k → Germanic h",
        explanation:
          "English hound shows the Germanic h outcome beside cognates that keep a k-like consonant or develop along a different non-Germanic path.",
        shiftedLabel: "Germanic reflexes with h",
        comparisonLabel: "Modern cognates without the shift",
        annotations: [
          {
            id: "k-to-h-shifted-english",
            targetGroupId: "shifted",
            target: {
              langCode: "en",
              word: "hound"
            },
            tone: "shifted",
            title: "Branch with h",
            body:
              "This branch shows a Germanic h outcome. English hound and German Hund carry that shifted sound.",
            placement: "above-right"
          },
          {
            id: "k-to-h-unchanged-latin",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "canis"
            },
            tone: "unchanged",
            title: "Branch without h",
            body:
              "This comparison branch did not take the Germanic h shift. Portuguese cão and Welsh ci show non-Germanic outcomes.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "hound",
            label: "English hound",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱwṓ"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "hound"
            }
          },
          {
            id: "hund",
            label: "German Hund",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱwṓ"
            },
            to: {
              languageCode: "de",
              languageName: "German",
              term: "Hund"
            }
          }
        ],
        comparisons: [
          {
            id: "cao-pt",
            label: "Portuguese cão",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱwṓ"
            },
            to: {
              languageCode: "pt",
              languageName: "Portuguese",
              term: "cão"
            }
          },
          {
            id: "ci-cy",
            label: "Welsh ci",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱwṓ"
            },
            to: {
              languageCode: "cy",
              languageName: "Welsh",
              term: "ci"
            }
          }
        ]
      }
    ]
  },
  {
    slug: "verners-law",
    title: "Verner's Law",
    subtitle:
      "How accent placement explains voiced Germanic consonants that Grimm's Law alone leaves unexplained.",
    overview: [
      "Verner's Law describes a second Germanic sound change that affected the ",
      { text: "fricatives", termId: "fricative" },
      " created by Grimm's Law. When the older Indo-European ",
      { text: "stress", termId: "stress" },
      " did not fall on the syllable before the consonant, those fricatives became voiced."
    ],
    affectedLanguages: ["Proto-Germanic", "Gothic", "Old English", "Old Norse", "English", "Dutch"],
    families: ["Indo-European", "Germanic"],
    sections: [
      {
        heading: "The change",
        body: [
          "After Grimm's Law turned older p, t, k, and s into Germanic f, th, h, and s, Verner's Law voiced some of those new sounds. The result can be seen in Germanic d, b, g, and z or later r where a plain Grimm's Law outcome would predict a voiceless ",
          { text: "fricative", termId: "fricative" },
          "."
        ]
      },
      {
        heading: "Why stress matters",
        body: [
          "The key condition was inherited accent. A consonant after an ",
          { text: "unstressed", termId: "stress" },
          " syllable was vulnerable to voicing. A consonant after a stressed syllable usually kept the voiceless outcome."
        ]
      },
      {
        heading: "How to read the examples",
        body: [
          "Each example starts with an older Indo-European source and compares Germanic ",
          { text: "reflexes", termId: "reflex" },
          " that show Verner's voicing with branches that preserve a clearer non-Germanic stop or sibilant comparison."
        ]
      }
    ],
    examples: [
      {
        id: "t-to-d-after-unstressed-syllable",
        title: "t becomes d after earlier unstressed syllables",
        pattern: "Proto-Indo-European t → Germanic d after Verner's Law",
        explanation:
          "Father words in Germanic show a voiced d-like outcome where Latin and Sanskrit keep the older t comparison visible.",
        shiftedLabel: "Germanic reflexes with Verner voicing",
        comparisonLabel: "Cognates without the Germanic voicing",
        annotations: [
          {
            id: "verner-father-shifted-germanic",
            targetGroupId: "shifted",
            target: {
              langCode: "gem-pro",
              word: "*fadēr"
            },
            fallbackTargets: [
              {
                langCode: "en",
                word: "father"
              },
              {
                langCode: "nl",
                word: "vader"
              }
            ],
            tone: "shifted",
            title: "Branch with d",
            body:
              "This Germanic branch shows Verner's voicing. The older t became a voiced consonant after Grimm's Law first changed it to th.",
            placement: "above-right"
          },
          {
            id: "verner-father-unchanged-latin",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "pater"
            },
            fallbackTargets: [
              {
                langCode: "sa",
                word: "पितृ"
              }
            ],
            tone: "unchanged",
            title: "Branch with t",
            body:
              "This comparison branch did not pass through Verner's Germanic voicing. Latin pater keeps the t contrast readable.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "father-en-verner",
            label: "English father",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "father"
            }
          },
          {
            id: "vader-nl-verner",
            label: "Dutch vader",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "nl",
              languageName: "Dutch",
              term: "vader"
            }
          }
        ],
        comparisons: [
          {
            id: "pater-la-verner",
            label: "Latin pater",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "pater"
            }
          },
          {
            id: "pitr-sa-verner",
            label: "Sanskrit pitṛ́",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "sa",
              languageName: "Sanskrit",
              term: "पितृ"
            }
          }
        ]
      },
      {
        id: "s-to-r-after-verner",
        title: "s becomes r after Verner's Law",
        pattern: "Proto-Indo-European s → Germanic z → North and West Germanic r",
        explanation:
          "The Germanic was and were alternation shows the famous s to r outcome, while comparison forms keep an s-like consonant visible.",
        shiftedLabel: "Germanic reflexes with r",
        comparisonLabel: "Cognates with s-like comparison forms",
        annotations: [
          {
            id: "verner-be-shifted-english",
            targetGroupId: "shifted",
            target: {
              langCode: "en",
              word: "were"
            },
            fallbackTargets: [
              {
                langCode: "ang",
                word: "wǣron"
              }
            ],
            tone: "shifted",
            title: "Branch with r",
            body:
              "This branch shows the later r outcome from a Verner's Law z. English were preserves the alternation beside was.",
            placement: "above-right"
          },
          {
            id: "verner-wes-unchanged-was",
            targetGroupId: "comparisons",
            target: {
              langCode: "en",
              word: "was"
            },
            fallbackTargets: [
              {
                langCode: "sa",
                word: "वसति"
              }
            ],
            tone: "unchanged",
            title: "Branch with s",
            body:
              "This comparison form did not develop the r outcome. English was and Gothic 𐍅𐌰𐍃 keep the s comparison visible beside were.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "were-en-verner",
            label: "English were",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*h₂wes-"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "were"
            }
          }
        ],
        comparisons: [
          {
            id: "was-en-verner",
            label: "English was",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*h₂wes-"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "was"
            }
          },
          {
            id: "was-got-verner",
            label: "Gothic 𐍅𐌰𐍃",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*h₂wes-"
            },
            to: {
              languageCode: "got",
              languageName: "Gothic",
              term: "𐍅𐌰𐍃"
            }
          }
        ]
      }
    ]
  },
  {
    slug: "latin-romance-palatalization",
    title: "Latin to Romance Palatalization",
    subtitle:
      "How Latin hard consonants softened before front vowels in Italian, French, Spanish, and other Romance branches.",
    overview: [
      "Latin to Romance ",
      { text: "palatalization", termId: "palatalization" },
      " explains why many words that began with a hard k-like c in Latin now begin with ch, s, ts, or th-like sounds in Romance languages. The change was strongest before ",
      { text: "front vowels", termId: "front-vowel" },
      " such as e and i."
    ],
    affectedLanguages: ["Italian", "French", "Spanish", "Portuguese", "Romanian"],
    families: ["Indo-European", "Romance"],
    sections: [
      {
        heading: "The change",
        body: [
          "In Classical Latin, c was normally a k-like ",
          { text: "stop", termId: "stop-consonant" },
          ". In many Romance branches, c before e or i moved forward in the mouth and became a softer sound, often written today as c, ch, s, z, or ci depending on the language."
        ]
      },
      {
        heading: "Where it happened",
        body: [
          "The change was conditioned by the following vowel. A consonant before e or i often softened, while the same consonant before a, o, or u often stayed hard or changed by a different route."
        ]
      },
      {
        heading: "How to read the examples",
        body: [
          "Each example starts from a Latin source word and compares Romance ",
          { text: "reflexes", termId: "reflex" },
          " that show palatalization with conservative comparison branches that keep a harder k-like spelling or pronunciation."
        ]
      }
    ],
    examples: [
      {
        id: "centum-c-before-e",
        title: "c before e softens",
        pattern: "Latin c before e → Romance palatal consonants",
        explanation:
          "Centum words show a hard Latin c splitting into Romance outcomes, while Latin and Greek keep harder comparison branches visible.",
        shiftedLabel: "Romance reflexes with softened c",
        comparisonLabel: "Forms with harder c or k-like outcomes",
        annotations: [
          {
            id: "centum-shifted-french",
            targetGroupId: "shifted",
            target: {
              langCode: "fr",
              word: "cent"
            },
            fallbackTargets: [
              {
                langCode: "fr",
                word: "cent"
              },
              {
                langCode: "es",
                word: "ciento"
              }
            ],
            tone: "shifted",
            title: "Softened c",
            body:
              "This branch shows Latin c before e becoming a palatal sound. French cent makes the softened outcome visible in the connected graph.",
            placement: "above-right"
          },
          {
            id: "centum-unchanged-latin",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "centum"
            },
            fallbackTargets: [
              {
                langCode: "la",
                word: "centum"
              }
            ],
            tone: "unchanged",
            title: "Harder comparison",
            body:
              "This comparison branch keeps a harder k-like value before the Romance softening seen in French cent.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "cent-fr-palatalization",
            label: "French cent",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱm̥tóm"
            },
            to: {
              languageCode: "fr",
              languageName: "French",
              term: "cent"
            }
          }
        ],
        comparisons: [
          {
            id: "centum-la-palatalization",
            label: "Latin centum",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱm̥tóm"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "centum"
            }
          },
          {
            id: "hekaton-grc-palatalization",
            label: "Ancient Greek hekatón",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱm̥tóm"
            },
            to: {
              languageCode: "grc",
              languageName: "Ancient Greek",
              term: "ἑκατόν"
            }
          }
        ]
      },
    ]
  },
  {
    slug: "high-german-consonant-shift",
    title: "High German Consonant Shift",
    subtitle:
      "How older Germanic stops became the pf, z, and ch sounds that separate German from English and Dutch cognates.",
    overview: [
      "The High German Consonant Shift marks the branch that led to standard German and related southern varieties. Older Germanic ",
      { text: "stop consonants", termId: "stop-consonant" },
      " shifted into ",
      { text: "affricates", termId: "affricate" },
      " and ",
      { text: "fricatives", termId: "fricative" },
      ", which is why German zwei and machen look different from English two and make."
    ],
    affectedLanguages: ["Old High German", "German", "Yiddish", "Alemannic German", "Bavarian"],
    families: ["Indo-European", "Germanic"],
    sections: [
      {
        heading: "The change",
        body: [
          "In High German, several older Germanic ",
          { text: "voiceless stops", termId: "voiceless-stop" },
          " changed after the Germanic branch had already split. Older p often became pf or f, older t became z or ss, and older k became ch in many positions."
        ]
      },
      {
        heading: "Where it happened",
        body: [
          "The change belongs to the High German area. English, Dutch, Frisian, and most Low German lineages did not take the same shift, so they often preserve a clearer older p, t, or k comparison."
        ]
      },
      {
        heading: "How to read the examples",
        body: [
          "Each graph starts from a Germanic source form and compares shifted High German ",
          { text: "reflexes", termId: "reflex" },
          " with ",
          { text: "cognates", termId: "cognate" },
          " from Germanic branches that did not undergo the High German change."
        ]
      }
    ],
    examples: [
      {
        id: "t-to-z",
        title: "t becomes z",
        pattern: "Proto-Germanic t → High German z",
        explanation:
          "The word for two makes the contrast compact: German shows the shifted z spelling while English and Dutch keep t-like forms.",
        shiftedLabel: "High German reflexes with z",
        comparisonLabel: "Germanic cognates without the High German shift",
        annotations: [
          {
            id: "high-german-z-shifted-german",
            targetGroupId: "shifted",
            target: {
              langCode: "de",
              word: "zwei"
            },
            fallbackTargets: [
              {
                langCode: "yi",
                word: "צוויי"
              }
            ],
            tone: "shifted",
            title: "Branch with z",
            body:
              "This branch shows older t becoming High German z. German zwei carries the shifted consonant at the start of the word.",
            placement: "above-right"
          },
          {
            id: "high-german-z-unchanged-dutch",
            targetGroupId: "comparisons",
            target: {
              langCode: "nl",
              word: "twee"
            },
            fallbackTargets: [
              {
                langCode: "en",
                word: "two"
              }
            ],
            tone: "unchanged",
            title: "Branch with t",
            body:
              "This comparison branch did not take the High German t to z shift. Dutch twee and English two keep the older t comparison visible.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "zwei-de-high-german",
            label: "German zwei",
            from: {
              languageCode: "gem-pro",
              languageName: "Proto-Germanic",
              term: "*twai"
            },
            to: {
              languageCode: "de",
              languageName: "German",
              term: "zwei"
            }
          },
          {
            id: "tsvey-yi-high-german",
            label: "Yiddish צוויי",
            from: {
              languageCode: "gem-pro",
              languageName: "Proto-Germanic",
              term: "*twai"
            },
            to: {
              languageCode: "yi",
              languageName: "Yiddish",
              term: "צוויי"
            }
          }
        ],
        comparisons: [
          {
            id: "two-en-high-german",
            label: "English two",
            from: {
              languageCode: "gem-pro",
              languageName: "Proto-Germanic",
              term: "*twai"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "two"
            }
          },
          {
            id: "twee-nl-high-german",
            label: "Dutch twee",
            from: {
              languageCode: "gem-pro",
              languageName: "Proto-Germanic",
              term: "*twai"
            },
            to: {
              languageCode: "nl",
              languageName: "Dutch",
              term: "twee"
            }
          }
        ]
      },
      {
        id: "k-to-ch",
        title: "k becomes ch",
        pattern: "Proto-West Germanic k → High German ch",
        explanation:
          "Make words show the High German fricative outcome beside English and Dutch forms that keep k-like spellings.",
        shiftedLabel: "High German reflexes with ch",
        comparisonLabel: "Germanic cognates without the High German shift",
        annotations: [
          {
            id: "high-german-ch-shifted-german",
            targetGroupId: "shifted",
            target: {
              langCode: "de",
              word: "machen"
            },
            fallbackTargets: [
              {
                langCode: "yi",
                word: "מאַכן"
              }
            ],
            tone: "shifted",
            title: "Branch with ch",
            body:
              "This branch shows older k becoming a High German ch sound. German machen keeps the shifted fricative visible in writing.",
            placement: "above-right"
          },
          {
            id: "high-german-ch-unchanged-english",
            targetGroupId: "comparisons",
            target: {
              langCode: "en",
              word: "make"
            },
            fallbackTargets: [
              {
                langCode: "nl",
                word: "maken"
              }
            ],
            tone: "unchanged",
            title: "Branch with k",
            body:
              "This comparison branch did not take the High German k to ch shift. English make and Dutch maken preserve the k-like contrast.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "machen-de-high-german",
            label: "German machen",
            from: {
              languageCode: "gmw-pro",
              languageName: "Proto-West Germanic",
              term: "*makōn"
            },
            to: {
              languageCode: "de",
              languageName: "German",
              term: "machen"
            }
          },
          {
            id: "makhn-yi-high-german",
            label: "Yiddish מאַכן",
            from: {
              languageCode: "gmw-pro",
              languageName: "Proto-West Germanic",
              term: "*makōn"
            },
            to: {
              languageCode: "yi",
              languageName: "Yiddish",
              term: "מאַכן"
            }
          }
        ],
        comparisons: [
          {
            id: "make-en-high-german",
            label: "English make",
            from: {
              languageCode: "gmw-pro",
              languageName: "Proto-West Germanic",
              term: "*makōn"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "make"
            }
          },
          {
            id: "maken-nl-high-german",
            label: "Dutch maken",
            from: {
              languageCode: "gmw-pro",
              languageName: "Proto-West Germanic",
              term: "*makōn"
            },
            to: {
              languageCode: "nl",
              languageName: "Dutch",
              term: "maken"
            }
          }
        ]
      }
    ]
  },
  {
    slug: "satem-palatalization",
    title: "Satem Palatalization",
    subtitle:
      "How one Indo-European branch turned older palatal k-like sounds into sibilants while centum branches kept harder consonants.",
    overview: [
      "Satem palatalization is one of the clearest sound changes separating Indo-European branches. In Indo-Iranian, Balto-Slavic, and some neighboring branches, older ",
      { text: "palatal k-like sounds", termId: "palatal" },
      " became ",
      { text: "sibilants", termId: "sibilant" },
      ", while Latin, Greek, Germanic, Celtic, and others kept harder outcomes."
    ],
    affectedLanguages: ["Sanskrit", "Avestan", "Russian", "Lithuanian", "Armenian"],
    families: ["Indo-European", "Indo-Iranian", "Balto-Slavic"],
    sections: [
      {
        heading: "The change",
        body: [
          "Older Indo-European ",
          { text: "palatal stops", termId: "palatal" },
          " moved forward into ",
          { text: "fricatives", termId: "fricative" },
          " or ",
          { text: "sibilant-like sounds", termId: "sibilant" },
          " in satem branches. That is why Sanskrit and Slavic words often show s or sh where Latin and Greek show c, k, or related hard consonants."
        ]
      },
      {
        heading: "Why the name matters",
        body: [
          "The label comes from the word for hundred. Avestan satəm shows the satem outcome, while Latin centum belongs to the centum side with a harder consonant history."
        ]
      },
      {
        heading: "How to read the examples",
        body: [
          "Each graph compares satem ",
          { text: "reflexes", termId: "reflex" },
          " with centum ",
          { text: "cognates", termId: "cognate" },
          " from branches that did not take the same palatalizing change."
        ]
      }
    ],
    examples: [
      {
        id: "hundred-satem",
        title: "k-like sounds become sibilants",
        pattern: "Proto-Indo-European ḱ → satem s or sh",
        explanation:
          "Hundred words give the pattern its name: satem branches show s-like outcomes beside centum branches with harder c or k-like consonants.",
        shiftedLabel: "Satem reflexes with s-like outcomes",
        comparisonLabel: "Centum cognates with harder consonants",
        annotations: [
          {
            id: "hundred-satem-shifted-sanskrit",
            targetGroupId: "shifted",
            target: {
              langCode: "sa",
              word: "शत"
            },
            fallbackTargets: [
              {
                langCode: "ru",
                word: "сто"
              }
            ],
            tone: "shifted",
            title: "Satem branch",
            body:
              "This branch shows the palatal k-like sound becoming a sibilant. Sanskrit śatam makes the shifted outcome visible in the connected graph.",
            placement: "above-right"
          },
          {
            id: "hundred-satem-unchanged-latin",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "centum"
            },
            fallbackTargets: [
              {
                langCode: "grc",
                word: "ἑκατόν"
              }
            ],
            tone: "unchanged",
            title: "Centum branch",
            body:
              "This comparison branch did not take satem palatalization. Latin centum and Greek hekatón preserve harder consonant outcomes.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "satam-sa-satem",
            label: "Sanskrit śatam",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱm̥tóm"
            },
            to: {
              languageCode: "sa",
              languageName: "Sanskrit",
              term: "शत"
            }
          }
        ],
        comparisons: [
          {
            id: "centum-la-satem",
            label: "Latin centum",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱm̥tóm"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "centum"
            }
          },
          {
            id: "hekaton-grc-satem",
            label: "Ancient Greek hekatón",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱm̥tóm"
            },
            to: {
              languageCode: "grc",
              languageName: "Ancient Greek",
              term: "ἑκατόν"
            }
          }
        ]
      },
      {
        id: "ten-satem",
        title: "k becomes sh or s",
        pattern: "Proto-Indo-European ḱ → Indo-Iranian ś and Slavic s",
        explanation:
          "Ten words show the same branch split: Sanskrit has a sibilant outcome while Greek keeps a harder consonant.",
        shiftedLabel: "Satem reflexes with sibilants",
        comparisonLabel: "Centum cognates with hard consonants",
        annotations: [
          {
            id: "ten-satem-shifted-sanskrit",
            targetGroupId: "shifted",
            target: {
              langCode: "sa",
              word: "दश"
            },
            fallbackTargets: [
              {
                langCode: "ru",
                word: "десять"
              }
            ],
            tone: "shifted",
            title: "Satem branch",
            body:
              "This branch shows the palatal stop shifting into a sibilant. Sanskrit daśa belongs to the satem side.",
            placement: "above-right"
          },
          {
            id: "ten-satem-unchanged-greek",
            targetGroupId: "comparisons",
            target: {
              langCode: "grc",
              word: "δέκα"
            },
            fallbackTargets: [
              {
                langCode: "grc",
                word: "δέκα"
              }
            ],
            tone: "unchanged",
            title: "Centum branch",
            body:
              "This comparison branch did not take satem palatalization. Greek deka keeps the harder consonant contrast in the connected graph.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "dasa-sa-satem",
            label: "Sanskrit daśa",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*déḱm̥"
            },
            to: {
              languageCode: "sa",
              languageName: "Sanskrit",
              term: "दश"
            }
          }
        ],
        comparisons: [
          {
            id: "deka-grc-satem",
            label: "Ancient Greek deka",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*déḱm̥"
            },
            to: {
              languageCode: "grc",
              languageName: "Ancient Greek",
              term: "δέκα"
            }
          }
        ]
      }
    ]
  },
  {
    slug: "spanish-f-to-h",
    title: "Spanish F to H",
    subtitle:
      "How many Latin initial f sounds became Spanish h, while neighboring Romance languages kept f-like descendants.",
    overview: [
      "Spanish f to h is a Romance sound change where Latin initial f weakened in many words. Modern Spanish often writes h, now usually silent, where related ",
      { text: "cognates", termId: "cognate" },
      " can still show f or a related consonant."
    ],
    affectedLanguages: ["Spanish", "Old Spanish", "Asturian", "Gascon"],
    families: ["Indo-European", "Romance"],
    sections: [
      {
        heading: "The change",
        body: [
          "In many Spanish lineages, Latin initial f weakened to h and later became silent in standard pronunciation. The spelling h still marks that history in words such as hijo."
        ]
      },
      {
        heading: "Where it stands out",
        body: [
          "The contrast is clearest beside related forms that preserve f-like sounds in the same word families where Spanish shows h."
        ]
      },
      {
        heading: "How to read the examples",
        body: [
          "Each graph starts from a Latin source and compares Spanish ",
          { text: "reflexes", termId: "reflex" },
          " with Romance ",
          { text: "cognates", termId: "cognate" },
          " that did not take the Spanish f to h shift."
        ]
      }
    ],
    examples: [
      {
        id: "filius-f-to-h",
        title: "f becomes h before i",
        pattern: "Latin initial f → Spanish h before i",
        explanation:
          "Son words show Spanish hijo beside Latin fīlius, which preserves the older f spelling in the connected graph.",
        shiftedLabel: "Spanish reflexes with h",
        comparisonLabel: "Romance cognates with f-like sounds",
        annotations: [
          {
            id: "filius-f-to-h-shifted-spanish",
            targetGroupId: "shifted",
            target: {
              langCode: "es",
              word: "hijo"
            },
            tone: "shifted",
            title: "Spanish branch with h",
            body:
              "This branch shows Latin initial f weakening on the path to Spanish hijo.",
            placement: "above-right"
          },
          {
            id: "filius-f-to-h-unchanged-portuguese",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "fīlius"
            },
            tone: "unchanged",
            title: "Branch with f",
            body:
              "This comparison branch did not take the Spanish f to h shift. Latin fīlius keeps the f-family contrast.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "hijo-es-f-to-h",
            label: "Spanish hijo",
            from: {
              languageCode: "itc-pro",
              languageName: "Proto-Italic",
              term: "*fīlios"
            },
            to: {
              languageCode: "es",
              languageName: "Spanish",
              term: "hijo"
            }
          }
        ],
        comparisons: [
          {
            id: "filius-la-f-to-h",
            label: "Latin fīlius",
            from: {
              languageCode: "itc-pro",
              languageName: "Proto-Italic",
              term: "*fīlios"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "fīlius"
            }
          }
        ]
      },
    ]
  }
];

/** Finds editorial sound-change content by its route slug. */
export const findSoundChangeArticle = (slug: string): SoundChangeArticle | undefined =>
  soundChangeArticles.find((article) => article.slug === slug);

/** Converts an editorial example set into the grouped API request that compares cognate paths. */
export const comparisonSetQueryForSoundChangeExample = (example: SoundChangeExampleSet): ComparisonSetQuery => {
  const rootLineage = example.shifted[0] ?? example.comparisons[0];

  if (!rootLineage) {
    throw new Error(`Sound-change example ${example.id} has no comparison terms`);
  }

  return {
    root: {
      langCode: rootLineage.from.languageCode,
      word: rootLineage.from.term
    },
    maxDepth: 10,
    groups: [
      {
        id: "shifted",
        label: example.shiftedLabel,
        items: example.shifted.map((lineage) => ({
          id: lineage.id,
          label: lineage.label,
          langCode: lineage.to.languageCode,
          word: lineage.to.term
        }))
      },
      {
        id: "comparisons",
        label: example.comparisonLabel,
        items: example.comparisons.map((lineage) => ({
          id: lineage.id,
          label: lineage.label,
          langCode: lineage.to.languageCode,
          word: lineage.to.term
        }))
      }
    ]
  };
};