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
  routeLabel: string;
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
    routeLabel: "Read Grimm's Law",
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
          " such as b, d, and g moved toward voiceless stops. ",
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
          " data currently imported for each word."
        ]
      }
    ],
    examples: [
      {
        id: "p-to-f",
        title: "p becomes f",
        pattern: "Proto-Indo-European p -> Germanic f",
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
              "This branch did not undergo the Germanic p to f shift. Spanish padre and French père preserve the older p-lineage contrast.",
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
            id: "pere-fr",
            label: "French père",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ph₂tḗr"
            },
            to: {
              languageCode: "fr",
              languageName: "French",
              term: "père"
            }
          }
        ]
      },
      {
        id: "t-to-th",
        title: "t becomes th",
        pattern: "Proto-Indo-European t -> Germanic th",
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
              "This branch did not take the Germanic t to th shift. Italian tre and Russian три keep the comparison with t visible.",
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
            id: "tre-it",
            label: "Italian tre",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*tréyes"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "tre"
            }
          },
          {
            id: "tri-ru",
            label: "Russian три",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*tréyes"
            },
            to: {
              languageCode: "ru",
              languageName: "Russian",
              term: "три"
            }
          }
        ]
      },
      {
        id: "k-to-h",
        title: "k becomes h",
        pattern: "Proto-Indo-European k -> Germanic h",
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
    routeLabel: "Read Verner's Law",
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
        pattern: "Proto-Indo-European t -> Germanic d after Verner's Law",
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
        pattern: "Proto-Indo-European s -> Germanic z -> North and West Germanic r",
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
              "This comparison form did not develop the r outcome. English was keeps the s comparison visible beside were.",
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
          },
          {
            id: "waren-de-verner",
            label: "German waren",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*h₂wes-"
            },
            to: {
              languageCode: "de",
              languageName: "German",
              term: "waren"
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
            id: "vasati-sa-verner",
            label: "Sanskrit vasati",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*h₂wes-"
            },
            to: {
              languageCode: "sa",
              languageName: "Sanskrit",
              term: "वसति"
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
    routeLabel: "Read Romance palatalization",
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
        pattern: "Latin c before e -> Romance palatal consonants",
        explanation:
          "Centum words show a hard Latin c splitting into different Romance outcomes, while Sardinian keeps a conservative k-like spelling path.",
        shiftedLabel: "Romance reflexes with softened c",
        comparisonLabel: "Forms with harder c or k-like outcomes",
        annotations: [
          {
            id: "centum-shifted-italian",
            targetGroupId: "shifted",
            target: {
              langCode: "it",
              word: "cento"
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
              "This branch shows Latin c before e becoming a palatal sound. Italian cento and French cent make the softened outcome visible.",
            placement: "above-right"
          },
          {
            id: "centum-unchanged-sardinian",
            targetGroupId: "comparisons",
            target: {
              langCode: "sc",
              word: "chentu"
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
              "This comparison branch keeps a harder k-like value where many Romance branches show a softened consonant.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "cento-it-palatalization",
            label: "Italian cento",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "centum"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "cento"
            }
          },
          {
            id: "cent-fr-palatalization",
            label: "French cent",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "centum"
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
            id: "chentu-sc-palatalization",
            label: "Sardinian chentu",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "centum"
            },
            to: {
              languageCode: "sc",
              languageName: "Sardinian",
              term: "chentu"
            }
          }
        ]
      },
      {
        id: "caelum-c-before-ae",
        title: "c before ae softens",
        pattern: "Latin c before ae -> Romance palatal consonants",
        explanation:
          "Caelum descendants show the same front-vowel environment after Latin ae developed toward an e-like vowel in Romance.",
        shiftedLabel: "Romance reflexes with softened c",
        comparisonLabel: "Forms with harder c or k-like outcomes",
        annotations: [
          {
            id: "caelum-shifted-italian",
            targetGroupId: "shifted",
            target: {
              langCode: "it",
              word: "cielo"
            },
            fallbackTargets: [
              {
                langCode: "fr",
                word: "ciel"
              },
              {
                langCode: "es",
                word: "cielo"
              }
            ],
            tone: "shifted",
            title: "Palatal branch",
            body:
              "This branch shows Latin c moving toward a palatal sound before an e-like vowel.",
            placement: "above-right"
          },
          {
            id: "caelum-unchanged-sardinian",
            targetGroupId: "comparisons",
            target: {
              langCode: "sc",
              word: "chelu"
            },
            fallbackTargets: [
              {
                langCode: "la",
                word: "caelum"
              }
            ],
            tone: "unchanged",
            title: "Harder comparison",
            body:
              "This comparison branch keeps a k-like written form where the larger Romance pattern shows softening.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "cielo-it-palatalization",
            label: "Italian cielo",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "caelum"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "cielo"
            }
          },
          {
            id: "ciel-fr-palatalization",
            label: "French ciel",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "caelum"
            },
            to: {
              languageCode: "fr",
              languageName: "French",
              term: "ciel"
            }
          }
        ],
        comparisons: [
          {
            id: "chelu-sc-palatalization",
            label: "Sardinian chelu",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "caelum"
            },
            to: {
              languageCode: "sc",
              languageName: "Sardinian",
              term: "chelu"
            }
          }
        ]
      }
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
