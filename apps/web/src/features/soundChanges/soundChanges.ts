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
          " data currently imported for each word."
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
        pattern: "Latin c before ae → Romance palatal consonants",
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
      ", which is why German Apfel, zwei, and machen look different from English apple, two, and make."
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
        id: "p-to-pf",
        title: "p becomes pf",
        pattern: "Proto-West Germanic p → High German pf",
        explanation:
          "Apple words show German pf beside English and Dutch forms that keep the older p comparison visible.",
        shiftedLabel: "High German reflexes with pf",
        comparisonLabel: "Germanic cognates without the High German shift",
        annotations: [
          {
            id: "high-german-pf-shifted-german",
            targetGroupId: "shifted",
            target: {
              langCode: "de",
              word: "Apfel"
            },
            fallbackTargets: [
              {
                langCode: "goh",
                word: "apful"
              }
            ],
            tone: "shifted",
            title: "Branch with pf",
            body:
              "This branch shows older p becoming High German pf. German Apfel keeps that shifted consonant visible.",
            placement: "above-right"
          },
          {
            id: "high-german-pf-unchanged-english",
            targetGroupId: "comparisons",
            target: {
              langCode: "en",
              word: "apple"
            },
            fallbackTargets: [
              {
                langCode: "nl",
                word: "appel"
              }
            ],
            tone: "unchanged",
            title: "Branch with p",
            body:
              "This comparison branch did not take the High German p to pf shift. English apple and Dutch appel preserve the older p contrast.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "apfel-de-high-german",
            label: "German Apfel",
            from: {
              languageCode: "gmw-pro",
              languageName: "Proto-West Germanic",
              term: "*applu"
            },
            to: {
              languageCode: "de",
              languageName: "German",
              term: "Apfel"
            }
          }
        ],
        comparisons: [
          {
            id: "apple-en-high-german",
            label: "English apple",
            from: {
              languageCode: "gmw-pro",
              languageName: "Proto-West Germanic",
              term: "*applu"
            },
            to: {
              languageCode: "en",
              languageName: "English",
              term: "apple"
            }
          },
          {
            id: "appel-nl-high-german",
            label: "Dutch appel",
            from: {
              languageCode: "gmw-pro",
              languageName: "Proto-West Germanic",
              term: "*applu"
            },
            to: {
              languageCode: "nl",
              languageName: "Dutch",
              term: "appel"
            }
          }
        ]
      },
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
              "This branch shows the palatal k-like sound becoming a sibilant. Sanskrit śatam and Russian sto make the shifted outcome visible.",
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
          },
          {
            id: "sto-ru-satem",
            label: "Russian sto",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*ḱm̥tóm"
            },
            to: {
              languageCode: "ru",
              languageName: "Russian",
              term: "сто"
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
          "Ten words show the same branch split: Sanskrit and Russian have sibilant outcomes while Latin and Greek keep harder consonants.",
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
              "This branch shows the palatal stop shifting into a sibilant. Sanskrit daśa and Russian desyat' belong to the satem side.",
            placement: "above-right"
          },
          {
            id: "ten-satem-unchanged-latin",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "decem"
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
              "This comparison branch did not take satem palatalization. Latin decem and Greek deka keep the harder consonant contrast.",
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
          },
          {
            id: "desyat-ru-satem",
            label: "Russian desyat'",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*déḱm̥"
            },
            to: {
              languageCode: "ru",
              languageName: "Russian",
              term: "десять"
            }
          }
        ],
        comparisons: [
          {
            id: "decem-la-satem",
            label: "Latin decem",
            from: {
              languageCode: "ine-pro",
              languageName: "Proto-Indo-European",
              term: "*déḱm̥"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "decem"
            }
          },
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
    slug: "romance-h-loss",
    title: "Romance H-Loss",
    subtitle:
      "How Latin h weakened until many Romance descendants kept only a written trace or no trace at all.",
    overview: [
      "Romance h-loss shows how a sound can disappear while spelling remembers it unevenly. Latin h was already weak, and in many Romance lineages it stopped being pronounced, leaving ",
      { text: "descendants", termId: "descendant" },
      " such as Italian uomo, French homme, and Spanish hombre."
    ],
    affectedLanguages: ["Italian", "French", "Spanish", "Portuguese", "Romanian"],
    families: ["Indo-European", "Romance"],
    sections: [
      {
        heading: "The change",
        body: [
          "Latin h weakened and disappeared as a pronounced consonant in Romance. Some descendants still write h, while others lost it from spelling as well."
        ]
      },
      {
        heading: "Where to look",
        body: [
          "The pattern is easiest to see at the start of Latin words. Romance descendants may begin with a vowel, keep silent h in spelling, or show later reshaping from surrounding sounds."
        ]
      },
      {
        heading: "How to read the examples",
        body: [
          "Each graph starts from a Latin source and compares Romance ",
          { text: "reflexes", termId: "reflex" },
          " that lost pronounced h with the Latin source form used as the comparison point."
        ]
      }
    ],
    examples: [
      {
        id: "homo-h-loss",
        title: "initial h disappears",
        pattern: "Latin h → silent or absent Romance h",
        explanation:
          "Human words show Latin h dropping from pronunciation, even when French or Spanish spelling keeps an h on the page.",
        shiftedLabel: "Romance reflexes without pronounced h",
        comparisonLabel: "Latin source with written h",
        annotations: [
          {
            id: "homo-h-loss-shifted-italian",
            targetGroupId: "shifted",
            target: {
              langCode: "it",
              word: "uomo"
            },
            fallbackTargets: [
              {
                langCode: "fr",
                word: "homme"
              },
              {
                langCode: "es",
                word: "hombre"
              }
            ],
            tone: "shifted",
            title: "Branch without pronounced h",
            body:
              "This branch shows Latin h disappearing as a pronounced sound. Italian uomo has no written h, while French homme and Spanish hombre keep silent spelling traces.",
            placement: "above-right"
          },
          {
            id: "homo-h-loss-latin-source",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "homō"
            },
            tone: "unchanged",
            title: "Latin source",
            body:
              "This source form keeps the written h that later Romance pronunciation lost.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "uomo-it-h-loss",
            label: "Italian uomo",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "homō"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "uomo"
            }
          },
          {
            id: "homme-fr-h-loss",
            label: "French homme",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "homō"
            },
            to: {
              languageCode: "fr",
              languageName: "French",
              term: "homme"
            }
          },
          {
            id: "hombre-es-h-loss",
            label: "Spanish hombre",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "homō"
            },
            to: {
              languageCode: "es",
              languageName: "Spanish",
              term: "hombre"
            }
          }
        ],
        comparisons: [
          {
            id: "homo-la-h-loss",
            label: "Latin homō",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "homō"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "homō"
            }
          }
        ]
      },
      {
        id: "habere-h-loss",
        title: "h falls away before a vowel",
        pattern: "Latin h before a → Romance vowel onset",
        explanation:
          "Have words show the Latin h disappearing before a vowel, producing Romance forms that begin directly with a vowel or silent h spelling.",
        shiftedLabel: "Romance reflexes without pronounced h",
        comparisonLabel: "Latin source with written h",
        annotations: [
          {
            id: "habere-h-loss-shifted-french",
            targetGroupId: "shifted",
            target: {
              langCode: "fr",
              word: "avoir"
            },
            fallbackTargets: [
              {
                langCode: "it",
                word: "avere"
              },
              {
                langCode: "es",
                word: "haber"
              }
            ],
            tone: "shifted",
            title: "Branch without h",
            body:
              "This branch shows Latin h lost before the following vowel. French avoir and Italian avere begin without a pronounced h.",
            placement: "above-right"
          },
          {
            id: "habere-h-loss-latin-source",
            targetGroupId: "comparisons",
            target: {
              langCode: "la",
              word: "habeō"
            },
            tone: "unchanged",
            title: "Latin source",
            body:
              "This source form keeps the written h that the Romance descendants lost in pronunciation.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "avoir-fr-h-loss",
            label: "French avoir",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "habeō"
            },
            to: {
              languageCode: "fr",
              languageName: "French",
              term: "avoir"
            }
          },
          {
            id: "avere-it-h-loss",
            label: "Italian avere",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "habeō"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "avere"
            }
          },
          {
            id: "haber-es-h-loss",
            label: "Spanish haber",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "habeō"
            },
            to: {
              languageCode: "es",
              languageName: "Spanish",
              term: "haber"
            }
          }
        ],
        comparisons: [
          {
            id: "habere-la-h-loss",
            label: "Latin habeō",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "habeō"
            },
            to: {
              languageCode: "la",
              languageName: "Latin",
              term: "habeō"
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
      "Spanish f to h is a Romance sound change where Latin initial f weakened in many words. Modern Spanish often writes h, now usually silent, where Portuguese, Italian, and French ",
      { text: "cognates", termId: "cognate" },
      " still show f or a related consonant."
    ],
    affectedLanguages: ["Spanish", "Old Spanish", "Asturian", "Gascon"],
    families: ["Indo-European", "Romance"],
    sections: [
      {
        heading: "The change",
        body: [
          "In many Spanish lineages, Latin initial f weakened to h and later became silent in standard pronunciation. The spelling h still marks the history in words such as hacer, hijo, and hierro."
        ]
      },
      {
        heading: "Where it stands out",
        body: [
          "The contrast is clearest beside other Romance branches. Portuguese, Italian, and French often preserve f-like sounds in the same word families where Spanish shows h."
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
        id: "facere-f-to-h",
        title: "f becomes h",
        pattern: "Latin initial f → Spanish h",
        explanation:
          "Make/do words show Spanish h where Portuguese and Italian keep f-like consonants from the Latin source.",
        shiftedLabel: "Spanish reflexes with h",
        comparisonLabel: "Romance cognates with f-like sounds",
        annotations: [
          {
            id: "facere-f-to-h-shifted-spanish",
            targetGroupId: "shifted",
            target: {
              langCode: "es",
              word: "hacer"
            },
            tone: "shifted",
            title: "Spanish branch with h",
            body:
              "This branch shows Latin initial f weakening to Spanish h. Modern hacer keeps the written trace of that shift.",
            placement: "above-right"
          },
          {
            id: "facere-f-to-h-unchanged-portuguese",
            targetGroupId: "comparisons",
            target: {
              langCode: "pt",
              word: "fazer"
            },
            fallbackTargets: [
              {
                langCode: "it",
                word: "fare"
              }
            ],
            tone: "unchanged",
            title: "Branch with f",
            body:
              "This comparison branch did not take the Spanish f to h shift. Portuguese fazer and Italian fare keep an f-like consonant.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "hacer-es-f-to-h",
            label: "Spanish hacer",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "facere"
            },
            to: {
              languageCode: "es",
              languageName: "Spanish",
              term: "hacer"
            }
          }
        ],
        comparisons: [
          {
            id: "fazer-pt-f-to-h",
            label: "Portuguese fazer",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "facere"
            },
            to: {
              languageCode: "pt",
              languageName: "Portuguese",
              term: "fazer"
            }
          },
          {
            id: "fare-it-f-to-h",
            label: "Italian fare",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "facere"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "fare"
            }
          }
        ]
      },
      {
        id: "filius-f-to-h",
        title: "f becomes h before i",
        pattern: "Latin initial f → Spanish h before i",
        explanation:
          "Son words show Spanish hijo beside Portuguese and Italian forms that preserve f-like descendants.",
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
              langCode: "pt",
              word: "filho"
            },
            fallbackTargets: [
              {
                langCode: "it",
                word: "figlio"
              }
            ],
            tone: "unchanged",
            title: "Branch with f",
            body:
              "This comparison branch did not take the Spanish f to h shift. Portuguese filho and Italian figlio keep the f-family contrast.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "hijo-es-f-to-h",
            label: "Spanish hijo",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "fīlius"
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
            id: "filho-pt-f-to-h",
            label: "Portuguese filho",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "fīlius"
            },
            to: {
              languageCode: "pt",
              languageName: "Portuguese",
              term: "filho"
            }
          },
          {
            id: "figlio-it-f-to-h",
            label: "Italian figlio",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "fīlius"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "figlio"
            }
          }
        ]
      },
      {
        id: "ferrum-f-to-h",
        title: "f becomes h before e",
        pattern: "Latin initial f → Spanish h before e",
        explanation:
          "Iron words show Spanish hierro beside Romance cognates that keep f from the Latin source.",
        shiftedLabel: "Spanish reflexes with h",
        comparisonLabel: "Romance cognates with f-like sounds",
        annotations: [
          {
            id: "ferrum-f-to-h-shifted-spanish",
            targetGroupId: "shifted",
            target: {
              langCode: "es",
              word: "hierro"
            },
            tone: "shifted",
            title: "Spanish branch with h",
            body:
              "This branch shows Latin initial f weakening to Spanish h before the following vowel.",
            placement: "above-right"
          },
          {
            id: "ferrum-f-to-h-unchanged-portuguese",
            targetGroupId: "comparisons",
            target: {
              langCode: "pt",
              word: "ferro"
            },
            fallbackTargets: [
              {
                langCode: "it",
                word: "ferro"
              }
            ],
            tone: "unchanged",
            title: "Branch with f",
            body:
              "This comparison branch keeps the f-like consonant visible. Portuguese ferro and Italian ferro did not take the Spanish f to h shift.",
            placement: "above-left"
          }
        ],
        shifted: [
          {
            id: "hierro-es-f-to-h",
            label: "Spanish hierro",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "ferrum"
            },
            to: {
              languageCode: "es",
              languageName: "Spanish",
              term: "hierro"
            }
          }
        ],
        comparisons: [
          {
            id: "ferro-pt-f-to-h",
            label: "Portuguese ferro",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "ferrum"
            },
            to: {
              languageCode: "pt",
              languageName: "Portuguese",
              term: "ferro"
            }
          },
          {
            id: "ferro-it-f-to-h",
            label: "Italian ferro",
            from: {
              languageCode: "la",
              languageName: "Latin",
              term: "ferrum"
            },
            to: {
              languageCode: "it",
              languageName: "Italian",
              term: "ferro"
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
