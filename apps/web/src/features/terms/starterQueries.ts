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
    description: "Inherited from Old English"
  },
  {
    term: "wine",
    description: "Borrowed through Latin"
  },
  {
    term: "father",
    description: "Kinship word with old Germanic roots"
  },
  {
    term: "cheese",
    description: "Food word borrowed through Latin"
  },
  {
    term: "mother",
    description: "Kinship word inherited from Old English"
  },
  {
    term: "brother",
    description: "Family word with Germanic ancestry"
  },
  {
    term: "name",
    description: "Inherited noun from Old English"
  },
  {
    term: "night",
    description: "Old Germanic and Indo-European ancestors"
  },
  {
    term: "heart",
    description: "Body-part word from Old English"
  },
  {
    term: "two",
    description: "Numeral with Indo-European ancestry"
  },
  {
    term: "three",
    description: "Numeral shared across related languages"
  },
  {
    term: "seven",
    description: "Stable inherited numeral"
  },
  {
    term: "ten",
    description: "Counting word from Old English"
  },
  {
    term: "new",
    description: "Common adjective inherited from Old English"
  },
  {
    term: "king",
    description: "Inherited title word"
  },
  {
    term: "royal",
    description: "Borrowed through French"
  },
  {
    term: "regal",
    description: "Borrowed from Latin"
  },
  {
    term: "wheel",
    description: "Old word for a practical object"
  },
  {
    term: "cycle",
    description: "Borrowed from Greek through Latin"
  },
  {
    term: "chakra",
    description: "Borrowed from Sanskrit"
  },
  {
    term: "sugar",
    description: "Trade word borrowed through several languages"
  },
  {
    term: "ginger",
    description: "Spice name borrowed through Old French"
  },
  {
    term: "orange",
    description: "Borrowed through several languages"
  },
  {
    term: "school",
    description: "Learned borrowing from Greek through Latin"
  },
  {
    term: "water",
    description: "Basic word inherited from Old English"
  },
  {
    term: "fire",
    description: "Inherited word for fire"
  },
  {
    term: "sun",
    description: "Inherited word for the sun"
  },
  {
    term: "moon",
    description: "Inherited word for the moon"
  },
  {
    term: "star",
    description: "Inherited word for a star"
  },
  {
    term: "earth",
    description: "Inherited word for the ground"
  },
  {
    term: "stone",
    description: "Inherited word for stone"
  },
  {
    term: "tree",
    description: "Inherited word for a tree"
  },
  {
    term: "leaf",
    description: "Inherited word for a leaf"
  },
  {
    term: "flower",
    description: "Plant word from Old French"
  },
  {
    term: "seed",
    description: "Inherited word for seed"
  },
  {
    term: "fish",
    description: "Inherited word for fish"
  },
  {
    term: "bird",
    description: "Animal word from Old English"
  },
  {
    term: "dog",
    description: "Common animal word"
  },
  {
    term: "cow",
    description: "Livestock word from Old English"
  },
  {
    term: "horse",
    description: "Domestic animal word"
  },
  {
    term: "eye",
    description: "Body-part word from Old English"
  },
  {
    term: "ear",
    description: "Body-part word from Old English"
  },
  {
    term: "nose",
    description: "Body-part word from Old English"
  },
  {
    term: "tooth",
    description: "Body-part word with Germanic ancestry"
  },
  {
    term: "tongue",
    description: "Body-part word with language senses"
  },
  {
    term: "hand",
    description: "Body-part word from Old English"
  },
  {
    term: "foot",
    description: "Body-part word with Germanic ancestry"
  },
  {
    term: "blood",
    description: "Inherited body word"
  },
  {
    term: "bone",
    description: "Body-part word from Old English"
  },
  {
    term: "one",
    description: "Inherited numeral"
  },
  {
    term: "four",
    description: "Inherited numeral"
  },
  {
    term: "five",
    description: "Inherited numeral"
  },
  {
    term: "six",
    description: "Inherited numeral"
  },
  {
    term: "eight",
    description: "Inherited numeral"
  },
  {
    term: "nine",
    description: "Inherited numeral"
  }
];

const englishDoubletStarterQueries: StarterQuery[] = [
  {
    term: "shirt",
    description: "Find same-language relatives"
  },
  {
    term: "chief",
    description: "Borrowed doublet of head"
  },
  {
    term: "channel",
    description: "Shared source with canal"
  },
  {
    term: "fragile",
    description: "Check a learned borrowing"
  },
  {
    term: "skirt",
    description: "Norse relative of shirt"
  },
  {
    term: "chef",
    description: "Pair a culinary borrowing"
  },
  {
    term: "canal",
    description: "Shared source with channel"
  },
  {
    term: "frail",
    description: "Shared source with fragile"
  },
  {
    term: "ward",
    description: "Shared source with guard"
  },
  {
    term: "guard",
    description: "Germanic doublet of ward"
  },
  {
    term: "warranty",
    description: "Shared source with guarantee"
  },
  {
    term: "guarantee",
    description: "Shared source with warranty"
  },
  {
    term: "cattle",
    description: "Shared source with chattel"
  },
  {
    term: "chattel",
    description: "Norman French doublet of cattle"
  },
  {
    term: "capital",
    description: "Shared source in the caput family"
  }
];

const romanceCoreStarterQueries: StarterQuery[] = [
  {
    term: "padre",
    description: "Kinship word from Latin"
  },
  {
    term: "madre",
    description: "Kinship word from Latin"
  },
  {
    term: "nombre",
    description: "Inherited noun from Latin"
  },
  {
    term: "noche",
    description: "Latin word with older ancestry"
  },
  {
    term: "agua",
    description: "Basic word from Latin"
  },
  {
    term: "fuego",
    description: "Element word from Latin"
  },
  {
    term: "sol",
    description: "Word for the sun from Latin"
  },
  {
    term: "luna",
    description: "Word for the moon from Latin"
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
        description: "Food word from Latin"
      },
      {
        term: "vino",
        description: "Word for wine from Latin"
      },
      ...romanceCoreStarterQueries,
      {
        term: "perro",
        description: "Common animal word"
      },
      {
        term: "caballo",
        description: "Domestic animal word from Latin"
      },
      {
        term: "rey",
        description: "Royal title from Latin"
      }
    ]
  },
  fr: {
    etymology: [
      {
        term: "pain",
        description: "Food word from Latin"
      },
      {
        term: "vin",
        description: "Word for wine from Latin"
      },
      {
        term: "père",
        description: "Kinship word from Latin"
      },
      {
        term: "mère",
        description: "Kinship word from Latin"
      },
      {
        term: "nom",
        description: "Inherited noun from Latin"
      },
      {
        term: "nuit",
        description: "Latin word with older ancestry"
      },
      {
        term: "eau",
        description: "Basic word from Latin"
      },
      {
        term: "feu",
        description: "Element word from Latin"
      },
      {
        term: "soleil",
        description: "Word for the sun from Latin"
      },
      {
        term: "lune",
        description: "Word for the moon from Latin"
      },
      {
        term: "chien",
        description: "Common animal word"
      },
      {
        term: "cheval",
        description: "Domestic animal word"
      },
      {
        term: "roi",
        description: "Royal title from Latin"
      }
    ]
  },
  de: {
    etymology: [
      {
        term: "Brot",
        description: "Food word with Germanic ancestry"
      },
      {
        term: "Wein",
        description: "Borrowed word for wine"
      },
      {
        term: "Vater",
        description: "Kinship word with Germanic ancestry"
      },
      {
        term: "Mutter",
        description: "Kinship word with Germanic ancestry"
      },
      {
        term: "Name",
        description: "Inherited noun"
      },
      {
        term: "Nacht",
        description: "Old Germanic and Indo-European ancestors"
      },
      {
        term: "Wasser",
        description: "Basic word with Germanic ancestry"
      },
      {
        term: "Feuer",
        description: "Element word with Germanic ancestry"
      },
      {
        term: "Sonne",
        description: "Word for the sun with Germanic ancestry"
      },
      {
        term: "Mond",
        description: "Word for the moon with Germanic ancestry"
      },
      {
        term: "Hund",
        description: "Common animal word"
      },
      {
        term: "Pferd",
        description: "Domestic animal word"
      },
      {
        term: "König",
        description: "Royal title with Germanic ancestry"
      }
    ]
  },
  it: {
    etymology: [
      {
        term: "pane",
        description: "Food word from Latin"
      },
      {
        term: "vino",
        description: "Word for wine from Latin"
      },
      {
        term: "padre",
        description: "Kinship word from Latin"
      },
      {
        term: "madre",
        description: "Kinship word from Latin"
      },
      {
        term: "nome",
        description: "Inherited noun from Latin"
      },
      {
        term: "notte",
        description: "Latin word with older ancestry"
      },
      {
        term: "acqua",
        description: "Basic word from Latin"
      },
      {
        term: "fuoco",
        description: "Element word from Latin"
      },
      {
        term: "sole",
        description: "Word for the sun from Latin"
      },
      {
        term: "luna",
        description: "Word for the moon from Latin"
      },
      {
        term: "cane",
        description: "Common animal word from Latin"
      },
      {
        term: "cavallo",
        description: "Domestic animal word from Latin"
      },
      {
        term: "re",
        description: "Royal title from Latin"
      }
    ]
  },
  la: {
    etymology: [
      {
        term: "panis",
        description: "Food word with Indo-European ancestry"
      },
      {
        term: "vinum",
        description: "Word for wine with older ancestry"
      },
      {
        term: "pater",
        description: "Kinship word with Indo-European ancestry"
      },
      {
        term: "mater",
        description: "Kinship word with Indo-European ancestry"
      },
      {
        term: "nomen",
        description: "Inherited noun with older ancestry"
      },
      {
        term: "nox",
        description: "Word for night with older ancestry"
      },
      {
        term: "aqua",
        description: "Basic word with older ancestry"
      },
      {
        term: "ignis",
        description: "Element word with older ancestry"
      },
      {
        term: "sol",
        description: "Word for the sun with older ancestry"
      },
      {
        term: "luna",
        description: "Word for the moon with older ancestry"
      },
      {
        term: "canis",
        description: "Common animal word with older ancestry"
      },
      {
        term: "equus",
        description: "Domestic animal word with older ancestry"
      },
      {
        term: "rex",
        description: "Royal title with older ancestry"
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
