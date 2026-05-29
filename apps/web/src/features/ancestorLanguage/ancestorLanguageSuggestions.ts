import type { Language } from "@etymology-graph/graph";

export type ResolvedAncestorLanguageSuggestion = {
  ancestorLangCode: string;
  ancestorName: string;
  description: string;
};

type AncestorLanguageSuggestion = {
  ancestorLangCode: string;
  description: string;
};

const interestingAncestorsByLanguage: Record<string, AncestorLanguageSuggestion[]> = {
  en: [
    { ancestorLangCode: "ang", description: "The inherited Germanic core behind most everyday words." },
    { ancestorLangCode: "non", description: "Viking-age contact reshaped basic vocabulary and pronouns." },
    { ancestorLangCode: "la", description: "Centuries of learned, legal, and church vocabulary entered through Latin." },
    { ancestorLangCode: "fr", description: "Norman rule layered thousands of French words onto English." },
    { ancestorLangCode: "gem-pro", description: "The reconstructed root shared with German and Norse." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  es: [
    { ancestorLangCode: "la", description: "Spanish inherits its core directly from spoken Latin." },
    { ancestorLangCode: "ar", description: "Centuries of Al-Andalus contact left a large borrowed layer." },
    { ancestorLangCode: "grc", description: "A source of scientific and learned terms." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  pt: [
    { ancestorLangCode: "la", description: "Portuguese inherits its core from spoken Latin." },
    { ancestorLangCode: "ar", description: "Iberian contact left an Arabic-derived layer." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  fr: [
    { ancestorLangCode: "la", description: "French is a direct descendant of spoken Latin." },
    { ancestorLangCode: "fro", description: "Trace medieval forms before modern spelling settled." },
    { ancestorLangCode: "frk", description: "Germanic rule left an early borrowed layer." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  it: [
    { ancestorLangCode: "la", description: "Italian stays close to Latin in its inherited core." },
    { ancestorLangCode: "grc", description: "Greek supplied learned and coastal-trade vocabulary." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  ro: [
    { ancestorLangCode: "la", description: "Romanian inherits its core from spoken Latin." },
    { ancestorLangCode: "sla-pro", description: "Slavic neighbours contributed a major borrowed layer." },
    { ancestorLangCode: "grc", description: "Byzantine contact added Greek vocabulary." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  de: [
    { ancestorLangCode: "goh", description: "The earliest attested stage of German vocabulary." },
    { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root." },
    { ancestorLangCode: "la", description: "Learned and ecclesiastical borrowings entered through Latin." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  nl: [
    { ancestorLangCode: "dum", description: "The medieval stage behind modern Dutch words." },
    { ancestorLangCode: "gem-pro", description: "The reconstructed Germanic root." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  la: [
    { ancestorLangCode: "itc-pro", description: "The branch root linking Latin to its Italic siblings." },
    { ancestorLangCode: "grc", description: "Greek shaped Roman learned and literary vocabulary." },
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ],
  grc: [
    { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." }
  ]
};

const fallbackAncestorSuggestions: AncestorLanguageSuggestion[] = [
  { ancestorLangCode: "la", description: "A major source of borrowed and learned vocabulary." },
  { ancestorLangCode: "ine-pro", description: "The deepest shared ancestor the graph reaches." },
  { ancestorLangCode: "gem-pro", description: "The reconstructed root of the Germanic languages." },
  { ancestorLangCode: "grc", description: "A common source of scientific and cultural terms." }
];

/** Resolves curated source-language suggestions against the imported language catalog. */
export function resolveAncestorLanguageSuggestions(
  langCode: string | undefined,
  availableLanguages: Language[]
): ResolvedAncestorLanguageSuggestion[] {
  const curated = (langCode && interestingAncestorsByLanguage[langCode]) || [];
  const seen = new Set<string>();

  return [...curated, ...fallbackAncestorSuggestions]
    .filter((suggestion) => {
      if (suggestion.ancestorLangCode === langCode || seen.has(suggestion.ancestorLangCode)) {
        return false;
      }

      seen.add(suggestion.ancestorLangCode);

      return availableLanguages.some((language) => language.code === suggestion.ancestorLangCode);
    })
    .map((suggestion) => ({
      ancestorLangCode: suggestion.ancestorLangCode,
      ancestorName: languageName(suggestion.ancestorLangCode, availableLanguages),
      description: suggestion.description
    }));
}

/** Looks up the imported language display name while preserving code fallbacks. */
function languageName(langCode: string, availableLanguages: Language[]): string {
  return availableLanguages.find((language) => language.code === langCode)?.canonicalName ?? langCode;
}
