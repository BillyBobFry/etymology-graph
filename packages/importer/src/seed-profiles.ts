export type SeedProfileName = keyof typeof seedProfiles;

export type ResolvedSeedProfiles = {
  profileNames: SeedProfileName[];
  targetSpecs: string[];
};

const inheritedCoreTargets = [
  "en:father",
  "fr:père",
  "de:Vater",
  "hi:पिता",
  "en:mother",
  "fr:mère",
  "de:Mutter",
  "hi:माता",
  "en:brother",
  "fr:frère",
  "de:Bruder",
  "hi:भाई",
  "en:name",
  "fr:nom",
  "de:Name",
  "hi:नाम",
  "en:night",
  "fr:nuit",
  "de:Nacht",
  "hi:रात",
  "en:heart",
  "fr:cœur",
  "de:Herz",
  "hi:हृदय",
  "en:two",
  "fr:deux",
  "de:zwei",
  "hi:दो",
  "en:three",
  "fr:trois",
  "de:drei",
  "hi:तीन",
  "en:seven",
  "fr:sept",
  "de:sieben",
  "hi:सात",
  "en:ten",
  "fr:dix",
  "de:zehn",
  "hi:दस",
  "en:new",
  "fr:neuf",
  "de:neu",
  "hi:नव"
] as const;

const loanwordTargets = [
  "en:king",
  "en:royal",
  "en:regal",
  "fr:roi",
  "de:Reich",
  "hi:राजा",
  "en:wheel",
  "en:cycle",
  "en:chakra",
  "fr:roue",
  "de:Rad",
  "hi:चक्र",
  "en:wine",
  "fr:vin",
  "de:Wein",
  "hi:वाइन",
  "en:sugar",
  "fr:sucre",
  "de:Zucker",
  "hi:शक्कर",
  "en:ginger",
  "fr:gingembre",
  "de:Ingwer",
  "hi:अदरक",
  "en:orange",
  "fr:orange",
  "de:Orange",
  "hi:नारंगी",
  "en:school",
  "fr:école",
  "de:Schule",
  "hi:स्कूल"
] as const;

const doubletTargets = [
  "en:shirt",
  "en:skirt",
  "en:chief",
  "en:chef",
  "en:canal",
  "en:channel",
  "en:fragile",
  "en:frail",
  "en:ward",
  "en:guard",
  "en:warranty",
  "en:guarantee",
  "en:cattle",
  "en:chattel",
  "en:capital"
] as const;

const broadStressTargets = [
  "en:water",
  "fr:eau",
  "de:Wasser",
  "hi:जल",
  "en:fire",
  "fr:feu",
  "de:Feuer",
  "hi:अग्नि",
  "en:sun",
  "fr:soleil",
  "de:Sonne",
  "hi:सूर्य",
  "en:moon",
  "fr:lune",
  "de:Mond",
  "hi:चन्द्र",
  "en:star",
  "fr:étoile",
  "de:Stern",
  "hi:तारा",
  "en:earth",
  "fr:terre",
  "de:Erde",
  "hi:पृथ्वी",
  "en:stone",
  "fr:pierre",
  "de:Stein",
  "hi:पत्थर",
  "en:tree",
  "fr:arbre",
  "de:Baum",
  "hi:पेड़",
  "en:leaf",
  "fr:feuille",
  "de:Blatt",
  "hi:पत्ता",
  "en:flower",
  "fr:fleur",
  "de:Blume",
  "hi:फूल",
  "en:seed",
  "fr:graine",
  "de:Samen",
  "hi:बीज",
  "en:fish",
  "fr:poisson",
  "de:Fisch",
  "hi:मछली",
  "en:bird",
  "fr:oiseau",
  "de:Vogel",
  "hi:पक्षी",
  "en:dog",
  "fr:chien",
  "de:Hund",
  "hi:कुत्ता",
  "en:cow",
  "fr:vache",
  "de:Kuh",
  "hi:गाय",
  "en:horse",
  "fr:cheval",
  "de:Pferd",
  "hi:घोड़ा",
  "en:eye",
  "fr:œil",
  "de:Auge",
  "hi:आँख",
  "en:ear",
  "fr:oreille",
  "de:Ohr",
  "hi:कान",
  "en:nose",
  "fr:nez",
  "de:Nase",
  "hi:नाक",
  "en:tooth",
  "fr:dent",
  "de:Zahn",
  "hi:दाँत",
  "en:tongue",
  "fr:langue",
  "de:Zunge",
  "hi:जीभ",
  "en:hand",
  "fr:main",
  "de:Hand",
  "hi:हाथ",
  "en:foot",
  "fr:pied",
  "de:Fuß",
  "hi:पैर",
  "en:blood",
  "fr:sang",
  "de:Blut",
  "hi:रक्त",
  "en:bone",
  "fr:os",
  "de:Knochen",
  "hi:हड्डी",
  "en:one",
  "fr:un",
  "de:ein",
  "hi:एक",
  "en:four",
  "fr:quatre",
  "de:vier",
  "hi:चार",
  "en:five",
  "fr:cinq",
  "de:fünf",
  "hi:पाँच",
  "en:six",
  "fr:six",
  "de:sechs",
  "hi:छह",
  "en:eight",
  "fr:huit",
  "de:acht",
  "hi:आठ",
  "en:nine",
  "fr:neuf",
  "de:neun",
  "hi:नौ"
] as const;

const highDescendantCandidateTargets = [
  "*ph₂tḗr",
  "*méh₂tēr",
  "*bʰréh₂tēr",
  "*swésōr",
  "*h₁nómn̥",
  "*h₂éḱwos",
  "*wódr̥",
  "*h₁n̥gʷnís",
  "*sóh₂wl̥",
  "*mḗh₁n̥s",
  "*h₂stḗr",
  "*dʰéǵʰōm",
  "*tréyes",
  "*kʷetwóres",
  "*pénkʷe",
  "*swéḱs",
  "*septḿ̥",
  "*oḱtṓw",
  "*h₁néwn̥",
  "*déḱm̥",
  "*bʰréh₁wr̥",
  "*h₂éǵros",
  "*ḱm̥tóm",
  "*ḱerd-",
  "*h₃ekʷ-",
  "*h₃éh₁os",
  "*h₁ésh₂r̥",
  "*ǵénh₁-",
  "*weyd-",
  "*sed-",
  "*steh₂-",
  "*bʰer-",
  "*h₁ed-",
  "*peh₂-",
  "*lewk-",
  "*h₃reǵ-"
] as const;

export const seedProfiles = {
  core: [...inheritedCoreTargets, ...loanwordTargets, ...doubletTargets],
  inheritedCore: inheritedCoreTargets,
  loanwords: loanwordTargets,
  doublets: doubletTargets,
  broadStress: broadStressTargets,
  highDescendantCandidates: highDescendantCandidateTargets,
  stress: [
    ...inheritedCoreTargets,
    ...loanwordTargets,
    ...doubletTargets,
    ...broadStressTargets,
    ...highDescendantCandidateTargets
  ]
} as const;

/** Expands a comma-separated profile list into de-duplicated seed target specs. */
export function resolveSeedProfiles(profileSpec: string): ResolvedSeedProfiles {
  const profileNames = profileSpec
    .split(",")
    .map((profileName) => profileName.trim())
    .filter((profileName) => profileName.length > 0);

  if (profileNames.length === 0) {
    throw new Error("SEED_PROFILE must include at least one profile name");
  }

  const resolvedProfileNames = profileNames.map((profileName) => {
    if (profileName in seedProfiles) {
      return profileName as SeedProfileName;
    }

    throw new Error(`Unknown seed profile "${profileName}". Available profiles: ${listSeedProfileNames().join(", ")}`);
  });

  return {
    profileNames: resolvedProfileNames,
    targetSpecs: dedupeTargetSpecs(resolvedProfileNames.flatMap((profileName) => seedProfiles[profileName]))
  };
}

/** Lists profile names for CLI errors and documentation output. */
export function listSeedProfileNames(): SeedProfileName[] {
  return Object.keys(seedProfiles) as SeedProfileName[];
}

/** Keeps target order stable while avoiding duplicate scans and duplicate report keys. */
export function dedupeTargetSpecs(targetSpecs: readonly string[]): string[] {
  return [...new Set(targetSpecs)];
}
