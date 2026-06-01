export type StarterQuery = {
  term: string;
  description: string;
};

export type StarterQueryKind = "etymology" | "doublets";

export type StarterQuerySet = {
  langCode: string;
  queries: StarterQuery[];
  isFallback: boolean;
};

type StarterQueriesByKind = Partial<Record<StarterQueryKind, StarterQuery[]>>;

export const defaultStarterLangCode = "en";

const englishEtymologyStarterQueries: StarterQuery[] = [
  {
    term: "bread",
    description: "Trace a core inherited word"
  },
  {
    term: "wine",
    description: "Follow a borrowed lineage"
  },
  {
    term: "father",
    description: "Inspect a deep family term"
  },
  {
    term: "cheese",
    description: "Compare source paths"
  },
  {
    term: "mother",
    description: "Follow a kinship root"
  },
  {
    term: "brother",
    description: "Compare family-word ancestry"
  },
  {
    term: "name",
    description: "Trace an inherited noun"
  },
  {
    term: "night",
    description: "Open a deep Indo-European path"
  },
  {
    term: "heart",
    description: "Inspect a body-part lineage"
  },
  {
    term: "two",
    description: "Trace a numeral ancestor"
  },
  {
    term: "three",
    description: "Compare numeral cognates"
  },
  {
    term: "seven",
    description: "Follow a stable numeral"
  },
  {
    term: "ten",
    description: "Inspect a counting root"
  },
  {
    term: "new",
    description: "Trace a common adjective"
  },
  {
    term: "king",
    description: "Compare inherited and royal terms"
  },
  {
    term: "royal",
    description: "Follow a French borrowing"
  },
  {
    term: "regal",
    description: "Inspect a Latin route"
  },
  {
    term: "wheel",
    description: "Trace a technology word"
  },
  {
    term: "cycle",
    description: "Follow a Greek source path"
  },
  {
    term: "chakra",
    description: "Compare a Sanskrit borrowing"
  },
  {
    term: "sugar",
    description: "Follow a trade-word route"
  },
  {
    term: "ginger",
    description: "Trace a spice name"
  },
  {
    term: "orange",
    description: "Inspect a long borrowing chain"
  },
  {
    term: "school",
    description: "Follow a learned borrowing"
  },
  {
    term: "water",
    description: "Trace a basic vocabulary root"
  },
  {
    term: "fire",
    description: "Inspect an elemental word"
  },
  {
    term: "sun",
    description: "Follow a celestial lineage"
  },
  {
    term: "moon",
    description: "Trace a sky-word source"
  },
  {
    term: "star",
    description: "Compare a celestial root"
  },
  {
    term: "earth",
    description: "Inspect a ground-word path"
  },
  {
    term: "stone",
    description: "Trace a material word"
  },
  {
    term: "tree",
    description: "Follow a plant-word lineage"
  },
  {
    term: "leaf",
    description: "Inspect a botanical term"
  },
  {
    term: "flower",
    description: "Trace a plant-name route"
  },
  {
    term: "seed",
    description: "Open a growth-word path"
  },
  {
    term: "fish",
    description: "Trace an animal-name root"
  },
  {
    term: "bird",
    description: "Inspect an animal-word lineage"
  },
  {
    term: "dog",
    description: "Follow a common animal term"
  },
  {
    term: "cow",
    description: "Trace a livestock word"
  },
  {
    term: "horse",
    description: "Inspect a domestic-animal term"
  },
  {
    term: "eye",
    description: "Trace a body-part source"
  },
  {
    term: "ear",
    description: "Follow a sensory-word path"
  },
  {
    term: "nose",
    description: "Inspect a body-word lineage"
  },
  {
    term: "tooth",
    description: "Trace a dental root"
  },
  {
    term: "tongue",
    description: "Compare body and language senses"
  },
  {
    term: "hand",
    description: "Follow a common body term"
  },
  {
    term: "foot",
    description: "Trace a body-part lineage"
  },
  {
    term: "blood",
    description: "Inspect an old body word"
  },
  {
    term: "bone",
    description: "Follow a skeletal term"
  },
  {
    term: "one",
    description: "Trace a numeral source"
  },
  {
    term: "four",
    description: "Inspect a counting word"
  },
  {
    term: "five",
    description: "Follow a numeral root"
  },
  {
    term: "six",
    description: "Trace a counting lineage"
  },
  {
    term: "eight",
    description: "Inspect a numeral ancestor"
  },
  {
    term: "nine",
    description: "Follow a number-word route"
  }
];

const englishDoubletStarterQueries: StarterQuery[] = [
  {
    term: "shirt",
    description: "Find same-language relatives"
  },
  {
    term: "chief",
    description: "Compare a borrowed route"
  },
  {
    term: "channel",
    description: "Open a shared-source case"
  },
  {
    term: "fragile",
    description: "Check a learned borrowing"
  },
  {
    term: "skirt",
    description: "Compare the Norse route"
  },
  {
    term: "chef",
    description: "Pair a culinary borrowing"
  },
  {
    term: "canal",
    description: "Compare canal and channel"
  },
  {
    term: "frail",
    description: "Open the inherited partner"
  },
  {
    term: "ward",
    description: "Compare ward and guard"
  },
  {
    term: "guard",
    description: "Trace a Germanic doublet"
  },
  {
    term: "warranty",
    description: "Compare legal-word routes"
  },
  {
    term: "guarantee",
    description: "Inspect a guarantee doublet"
  },
  {
    term: "cattle",
    description: "Compare property-word history"
  },
  {
    term: "chattel",
    description: "Open a Norman French route"
  },
  {
    term: "capital",
    description: "Trace the caput family"
  }
];

const romanceCoreStarterQueries: StarterQuery[] = [
  {
    term: "padre",
    description: "Trace a family-word lineage"
  },
  {
    term: "madre",
    description: "Follow a kinship source"
  },
  {
    term: "nombre",
    description: "Inspect an inherited noun"
  },
  {
    term: "noche",
    description: "Open a deep ancestry path"
  },
  {
    term: "agua",
    description: "Trace a basic vocabulary root"
  },
  {
    term: "fuego",
    description: "Inspect an elemental word"
  },
  {
    term: "sol",
    description: "Follow a celestial lineage"
  },
  {
    term: "luna",
    description: "Trace a sky-word source"
  }
];

export const starterQueriesByLanguage: Record<string, StarterQueriesByKind> = {
  en: {
    etymology: englishEtymologyStarterQueries,
    doublets: englishDoubletStarterQueries
  },
  es: {
    etymology: [
      {
        term: "pan",
        description: "Trace a food-word lineage"
      },
      {
        term: "vino",
        description: "Follow a borrowed source path"
      },
      ...romanceCoreStarterQueries,
      {
        term: "perro",
        description: "Inspect a common animal term"
      },
      {
        term: "caballo",
        description: "Trace a domestic-animal word"
      },
      {
        term: "rey",
        description: "Compare royal vocabulary"
      }
    ]
  },
  fr: {
    etymology: [
      {
        term: "pain",
        description: "Trace a food-word lineage"
      },
      {
        term: "vin",
        description: "Follow a borrowed source path"
      },
      {
        term: "père",
        description: "Trace a family-word lineage"
      },
      {
        term: "mère",
        description: "Follow a kinship source"
      },
      {
        term: "nom",
        description: "Inspect an inherited noun"
      },
      {
        term: "nuit",
        description: "Open a deep ancestry path"
      },
      {
        term: "eau",
        description: "Trace a basic vocabulary root"
      },
      {
        term: "feu",
        description: "Inspect an elemental word"
      },
      {
        term: "soleil",
        description: "Follow a celestial lineage"
      },
      {
        term: "lune",
        description: "Trace a sky-word source"
      },
      {
        term: "chien",
        description: "Inspect a common animal term"
      },
      {
        term: "cheval",
        description: "Trace a domestic-animal word"
      },
      {
        term: "roi",
        description: "Compare royal vocabulary"
      }
    ]
  },
  de: {
    etymology: [
      {
        term: "Brot",
        description: "Trace a food-word lineage"
      },
      {
        term: "Wein",
        description: "Follow a borrowed source path"
      },
      {
        term: "Vater",
        description: "Trace a family-word lineage"
      },
      {
        term: "Mutter",
        description: "Follow a kinship source"
      },
      {
        term: "Name",
        description: "Inspect an inherited noun"
      },
      {
        term: "Nacht",
        description: "Open a deep ancestry path"
      },
      {
        term: "Wasser",
        description: "Trace a basic vocabulary root"
      },
      {
        term: "Feuer",
        description: "Inspect an elemental word"
      },
      {
        term: "Sonne",
        description: "Follow a celestial lineage"
      },
      {
        term: "Mond",
        description: "Trace a sky-word source"
      },
      {
        term: "Hund",
        description: "Inspect a common animal term"
      },
      {
        term: "Pferd",
        description: "Trace a domestic-animal word"
      },
      {
        term: "König",
        description: "Compare royal vocabulary"
      }
    ]
  },
  it: {
    etymology: [
      {
        term: "pane",
        description: "Trace a food-word lineage"
      },
      {
        term: "vino",
        description: "Follow a borrowed source path"
      },
      {
        term: "padre",
        description: "Trace a family-word lineage"
      },
      {
        term: "madre",
        description: "Follow a kinship source"
      },
      {
        term: "nome",
        description: "Inspect an inherited noun"
      },
      {
        term: "notte",
        description: "Open a deep ancestry path"
      },
      {
        term: "acqua",
        description: "Trace a basic vocabulary root"
      },
      {
        term: "fuoco",
        description: "Inspect an elemental word"
      },
      {
        term: "sole",
        description: "Follow a celestial lineage"
      },
      {
        term: "luna",
        description: "Trace a sky-word source"
      },
      {
        term: "cane",
        description: "Inspect a common animal term"
      },
      {
        term: "cavallo",
        description: "Trace a domestic-animal word"
      },
      {
        term: "re",
        description: "Compare royal vocabulary"
      }
    ]
  },
  la: {
    etymology: [
      {
        term: "panis",
        description: "Trace a food-word lineage"
      },
      {
        term: "vinum",
        description: "Follow a borrowed source path"
      },
      {
        term: "pater",
        description: "Trace a family-word lineage"
      },
      {
        term: "mater",
        description: "Follow a kinship source"
      },
      {
        term: "nomen",
        description: "Inspect an inherited noun"
      },
      {
        term: "nox",
        description: "Open a deep ancestry path"
      },
      {
        term: "aqua",
        description: "Trace a basic vocabulary root"
      },
      {
        term: "ignis",
        description: "Inspect an elemental word"
      },
      {
        term: "sol",
        description: "Follow a celestial lineage"
      },
      {
        term: "luna",
        description: "Trace a sky-word source"
      },
      {
        term: "canis",
        description: "Inspect a common animal term"
      },
      {
        term: "equus",
        description: "Trace a domestic-animal word"
      },
      {
        term: "rex",
        description: "Compare royal vocabulary"
      }
    ]
  }
};

/** Returns curated starters for a language, falling back to English when that list is missing. */
export const starterQueriesForLanguage = (
  langCode: string | undefined,
  kind: StarterQueryKind
): StarterQuerySet => {
  const requestedLangCode = langCode ?? defaultStarterLangCode;
  const requestedQueries = starterQueriesByLanguage[requestedLangCode]?.[kind];

  if (requestedQueries && requestedQueries.length > 0) {
    return {
      langCode: requestedLangCode,
      queries: requestedQueries,
      isFallback: false
    };
  }

  return {
    langCode: defaultStarterLangCode,
    queries: starterQueriesByLanguage[defaultStarterLangCode]?.[kind] ?? [],
    isFallback: requestedLangCode !== defaultStarterLangCode
  };
};
