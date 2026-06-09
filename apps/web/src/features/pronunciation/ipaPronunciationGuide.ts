export type IpaGuideToken = {
  symbol: string;
  guide: string;
  details: string[];
};

const ipaWrapperCharacters = new Set(["/", "[", "]"]);
const ignoredCharacters = new Set([" ", "\u00a0"]);

const combiningGuideByMark = new Map<string, string>([
  ["\u0303", "nasalized"],
  ["\u0329", "syllabic"],
  ["\u032f", "non-syllabic glide, often part of a diphthong"],
  ["\u0325", "voiceless"],
  ["\u032c", "voiced"],
  ["\u031a", "not released"],
  ["\u02de", "rhoticized"],
  ["\u02b0", "with a puff of breath"],
  ["\u02b2", "palatalized"],
  ["\u02b7", "rounded"],
  ["\u02e0", "velarized or pharyngealized"]
]);

const guideBySymbol = new Map<string, string>([
  ["\u02c8", "main stress. Say the next syllable more strongly."],
  ["\u02cc", "secondary stress. Say the next syllable with lighter emphasis."],
  ["\u02d0", "long sound. Hold the previous sound a little longer."],
  ["\u02d1", "half-long sound. Hold the previous sound slightly longer."],
  [".", "syllable break."],
  ["\u0361", "tie mark. The neighboring sounds are pronounced together."],
  ["t\u0361\u0283", "ch as in \"church\"."],
  ["d\u0361\u0292", "j as in \"judge\"."],
  ["t\u0361s", "ts as in \"cats\"."],
  ["d\u0361z", "dz as in \"adze\"."],
  ["t\u0283", "ch as in \"church\"."],
  ["d\u0292", "j as in \"judge\"."],
  ["i", "ee as in \"see\"."],
  ["y", "French u, like \"ee\" said with rounded lips."],
  ["\u0268", "central \"ee\" sound, with the tongue farther back."],
  ["\u0289", "central \"oo\" sound, with the tongue farther forward."],
  ["\u026f", "unrounded \"oo\" sound."],
  ["u", "oo as in \"goose\"."],
  ["\u026a", "i as in \"kit\"."],
  ["\u028f", "short rounded \"i\" sound."],
  ["\u028a", "u as in \"foot\"."],
  ["e", "ay as in \"face\", without the glide."],
  ["\u00f8", "French eu, like \"ay\" said with rounded lips."],
  ["\u0258", "central \"e\" sound."],
  ["\u0275", "rounded central vowel, like \"uh\" with rounded lips."],
  ["\u0264", "unrounded back \"o\" sound."],
  ["o", "o as in \"go\", without the glide."],
  ["e\u031e", "e as in \"bed\"."],
  ["\u00f8\u031e", "rounded e, like \"bed\" with rounded lips."],
  ["\u0259", "uh as in the first sound of \"about\"."],
  ["\u0264\u031e", "open-mid unrounded back vowel."],
  ["o\u031e", "aw-like rounded vowel."],
  ["\u025b", "e as in \"bed\"."],
  ["\u0153", "French eu as in \"neuf\"."],
  ["\u025c", "er-like central vowel, without a strong r."],
  ["\u025e", "rounded central vowel."],
  ["\u028c", "u as in \"strut\"."],
  ["\u0254", "aw as in many pronunciations of \"thought\"."],
  ["\u00e6", "a as in \"cat\"."],
  ["\u0250", "central a-like vowel."],
  ["a", "a as in Spanish \"casa\"."],
  ["\u0276", "rounded front a-like vowel."],
  ["\u0251", "a as in \"father\"."],
  ["\u0252", "rounded a as in some pronunciations of \"lot\"."],
  ["\u0259r", "er as in unstressed \"butter\"."],
  ["\u025d", "er as in \"bird\"."],
  ["a\u026a", "eye as in \"price\"."],
  ["a\u028a", "ow as in \"mouth\"."],
  ["e\u026a", "ay as in \"face\"."],
  ["o\u028a", "oh as in \"goat\"."],
  ["\u0254\u026a", "oy as in \"choice\"."],
  ["p", "p as in \"spin\"."],
  ["b", "b as in \"bat\"."],
  ["t", "t as in \"stop\"."],
  ["d", "d as in \"dog\"."],
  ["\u0288", "t or d made with the tongue curled back."],
  ["\u0256", "d made with the tongue curled back."],
  ["c", "ky-like sound, made farther forward than k."],
  ["\u025f", "gy-like sound, made farther forward than g."],
  ["k", "k as in \"skin\"."],
  ["g", "g as in \"go\"."],
  ["q", "k-like sound made farther back in the throat."],
  ["\u0262", "g-like sound made farther back in the throat."],
  ["\u0294", "glottal stop, like the catch in \"uh-oh\"."],
  ["m", "m as in \"man\"."],
  ["\u0271", "m made with the teeth and lips."],
  ["n", "n as in \"no\"."],
  ["\u0273", "n made with the tongue curled back."],
  ["\u0272", "ny as in Spanish \"se\u00f1or\"."],
  ["\u014b", "ng as in \"sing\"."],
  ["\u0274", "ng-like sound made farther back in the throat."],
  ["\u0299", "trilled b-like sound."],
  ["r", "trilled r."],
  ["\u0280", "throaty trilled r."],
  ["\u2c71", "tapped v-like sound."],
  ["\u027e", "quick tapped r, like Spanish single r."],
  ["\u027d", "tapped r made with the tongue curled back."],
  ["\u0278", "soft bilabial f, made with both lips."],
  ["\u03b2", "soft b/v sound, as in Spanish \"haber\"."],
  ["f", "f as in \"fish\"."],
  ["v", "v as in \"voice\"."],
  ["\u03b8", "th as in \"thin\"."],
  ["\u00f0", "th as in \"this\"."],
  ["s", "s as in \"see\"."],
  ["z", "z as in \"zoo\"."],
  ["\u0283", "sh as in \"ship\"."],
  ["\u0292", "s in \"measure\"."],
  ["\u0282", "sh-like sound with the tongue curled back."],
  ["\u0290", "zh-like sound with the tongue curled back."],
  ["\u00e7", "hy as in German \"ich\"."],
  ["\u029d", "y-like voiced fricative."],
  ["x", "ch as in Scottish \"loch\"."],
  ["\u0263", "soft g-like sound, as in Spanish \"lago\"."],
  ["\u03c7", "rough h-like sound made farther back in the throat."],
  ["\u0281", "French r-like sound."],
  ["\u0127", "strong h-like sound made in the throat."],
  ["\u0295", "voiced throat fricative."],
  ["h", "h as in \"hat\"."],
  ["\u0266", "breathy voiced h."],
  ["\u026c", "breathy l-like sound."],
  ["\u026e", "z-like l sound."],
  ["\u028b", "w-like sound made with the lips and teeth."],
  ["\u0279", "r as in many English accents."],
  ["\u027b", "r made with the tongue curled back."],
  ["j", "y as in \"yes\"."],
  ["\u0270", "back-of-mouth y-like sound."],
  ["l", "l as in \"leaf\"."],
  ["\u026d", "l made with the tongue curled back."],
  ["\u028e", "ly as in Italian \"famiglia\"."],
  ["\u029f", "dark back-of-mouth l."],
  ["w", "w as in \"we\"."],
  ["\u028d", "wh as in some pronunciations of \"which\"."]
]);

const guideSymbols = [...guideBySymbol.keys()].sort((left, right) => right.length - left.length);

/** Builds the plain-English pronunciation guide shown in IPA tooltips. */
export function describeIpaPronunciation(ipa: string): IpaGuideToken[] {
  const normalizedIpa = ipa.normalize("NFC");
  return describeIpaSegment(normalizedIpa, 0).tokens;
}

/** Returns a concise accessibility label for an IPA guide trigger. */
export function ipaGuideLabel(ipa: string): string {
  return `Pronunciation guide for ${ipa}`;
}

/** Tokenizes IPA, treating parenthesized sounds as optional rather than separate sound symbols. */
function describeIpaSegment(
  ipa: string,
  startIndex: number,
  options: { stopCharacter?: string; optional?: boolean } = {}
): { tokens: IpaGuideToken[]; nextIndex: number } {
  const tokens: IpaGuideToken[] = [];
  let index = startIndex;

  while (index < ipa.length) {
    const character = ipa[index];

    if (!character) {
      break;
    }

    if (options.stopCharacter && character === options.stopCharacter) {
      return { tokens, nextIndex: index + character.length };
    }

    if (character === "(") {
      const optionalSegment = describeIpaSegment(ipa, index + character.length, {
        stopCharacter: ")",
        optional: true
      });
      tokens.push(...optionalSegment.tokens);
      index = optionalSegment.nextIndex;
      continue;
    }

    if (ipaWrapperCharacters.has(character) || ignoredCharacters.has(character)) {
      index += character.length;
      continue;
    }

    const symbol = matchGuideSymbol(ipa, index) ?? character;
    const { details, nextIndex } = collectTokenDetails(ipa, index + symbol.length);
    const guide = guideBySymbol.get(symbol) ?? "sound not in the guide yet.";

    tokens.push({
      symbol: formatTokenSymbol(`${symbol}${details.symbolSuffix}`, Boolean(options.optional)),
      guide,
      details: options.optional ? ["optional sound", ...details.guides] : details.guides
    });
    index = nextIndex;
  }

  return { tokens, nextIndex: index };
}

/** Finds the longest known IPA symbol at the current string offset. */
function matchGuideSymbol(ipa: string, index: number): string | undefined {
  return guideSymbols.find((symbol) => ipa.startsWith(symbol, index));
}

/** Keeps optional IPA notation attached to the sound it marks. */
function formatTokenSymbol(symbol: string, optional: boolean): string {
  return optional ? `(${symbol})` : symbol;
}

/** Attaches combining marks and modifier letters to the symbol they explain. */
function collectTokenDetails(
  ipa: string,
  index: number
): { details: { symbolSuffix: string; guides: string[] }; nextIndex: number } {
  const guides: string[] = [];
  let symbolSuffix = "";
  let nextIndex = index;

  while (nextIndex < ipa.length) {
    const mark = ipa[nextIndex];

    if (!mark) {
      break;
    }

    const guide = combiningGuideByMark.get(mark);

    if (!guide) {
      break;
    }

    symbolSuffix = `${symbolSuffix}${mark}`;
    guides.push(guide);
    nextIndex += mark.length;
  }

  return {
    details: {
      symbolSuffix,
      guides
    },
    nextIndex
  };
}
