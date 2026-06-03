import {
  CURATED_SOURCE_LANGUAGE_ATLAS,
  isCuratedSourceLanguageAtlasLanguage,
  isCuratedSourceLanguageAtlasPair,
  type Language,
  type SourceLanguageLayerStatus
} from "@etymology-graph/graph";

export type ResolvedDescendantLanguageOption = {
  value: string;
  label: string;
  description: string;
};

export type ResolvedAncestorLanguageSuggestion = {
  ancestorLangCode: string;
  ancestorName: string;
  description: string;
  status?: SourceLanguageLayerStatus;
  matchCount?: number;
};


/** Resolves the curated result-language list against the imported language catalog. */
export function resolveDescendantLanguageOptions(
  availableLanguages: Language[]
): ResolvedDescendantLanguageOption[] {
  return CURATED_SOURCE_LANGUAGE_ATLAS
    .map((option) => {
      const language = availableLanguages.find((candidate) => candidate.code === option.langCode);

      if (!language) {
        return undefined;
      }

      return {
        value: option.langCode,
        label: language.canonicalName,
        description: option.description
      };
    })
    .filter((option): option is ResolvedDescendantLanguageOption => option !== undefined);
}

/** Resolves curated source-language suggestions against the imported language catalog. */
export function resolveAncestorLanguageSuggestions(
  langCode: string | undefined,
  availableLanguages: Language[]
): ResolvedAncestorLanguageSuggestion[] {
  const curated = CURATED_SOURCE_LANGUAGE_ATLAS.find((language) => language.langCode === langCode)?.sourceLayers ?? [];
  const seen = new Set<string>();

  return curated
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

/** Checks whether a result language is part of the curated atlas surface. */
export function isCuratedDescendantLanguage(langCode: string | undefined): boolean {
  return isCuratedSourceLanguageAtlasLanguage(langCode);
}

/** Checks whether a source-language pair is part of the curated atlas surface. */
export function isCuratedAncestorLanguage(
  langCode: string | undefined,
  ancestorLangCode: string | undefined
): boolean {
  return isCuratedSourceLanguageAtlasPair(langCode, ancestorLangCode);
}

/** Looks up the imported language display name while preserving code fallbacks. */
function languageName(langCode: string, availableLanguages: Language[]): string {
  return availableLanguages.find((language) => language.code === langCode)?.canonicalName ?? langCode;
}
