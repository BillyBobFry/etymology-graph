export const defaultDescendantGraphDepth = 8;
export const defaultDescendantGraphLimit = 200;
export const maxDescendantGraphDepth = 12;
export const maxDescendantGraphLimit = 300;

/**
 * Languages treated as modern endpoints for descendant graphs. Walks stop
 * expanding once they reach these, and older sources outside this list can
 * anchor their own descendant view.
 */
export const modernLanguageCodes = [
  "af",
  "be",
  "bg",
  "bn",
  "ca",
  "cs",
  "cy",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fa",
  "fr",
  "ga",
  "gd",
  "hi",
  "is",
  "it",
  "lt",
  "lv",
  "mk",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sq",
  "sv",
  "uk"
] as const;

const modernLanguageCodeSet = new Set<string>(modernLanguageCodes);

/** Distinguishes modern endpoint languages from older sources whose descendant graphs are worth opening. */
export const isModernLanguageCode = (langCode: string): boolean => modernLanguageCodeSet.has(langCode);
