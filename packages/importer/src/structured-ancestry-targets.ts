import { canonicalGraphWord } from "@etymology-graph/graph";

import {
  seedTargetKey,
  type SeedTarget,
  type WiktextractEntry
} from "./wiktextract.js";

type WiktextractTemplate = NonNullable<WiktextractEntry["etymology_templates"]>[number];
type WiktextractDescendant = NonNullable<WiktextractEntry["descendants"]>[number];

export type StructuredAncestryDiscoveryReason =
  | "ancestor_template"
  | "alternative_form"
  | "cognate_template"
  | "doublet_template"
  | "structured_descendant"
  | "structured_derived";

export type StructuredAncestryDiscoveredTarget = {
  target: SeedTarget;
  reason: StructuredAncestryDiscoveryReason;
};

type DescendantWithIndex = {
  descendant: WiktextractDescendant;
  index: number;
};

export type StructuredDescendantTargetRanks = ReadonlyMap<string, number>;

/** Reads every follow-up target a matched entry should add to the structured ancestry frontier. */
export function structuredAncestryDiscoveredTargets(entry: WiktextractEntry): StructuredAncestryDiscoveredTarget[] {
  return [
    ...ancestorTemplateTargets(entry).map((target) => ({ target, reason: "ancestor_template" as const })),
    ...relationshipTemplateTargets(entry),
    ...alternativeFormTargets(entry),
    ...structuredChildTargets(entry)
  ];
}

/**
 * Preserves queued descendant spellings before the importer collapses same-language variant lists.
 *
 * The structured importer intentionally keeps one sibling per language to avoid noisy variant fan-out.
 * During seed extraction, however, flat template hints may already have queued the specific spelling a
 * target entry uses as its immediate source. Moving those queued variants first lets the existing
 * one-per-language import keep the path the frontier asked for.
 */
export function prioritizeStructuredDescendantTargets(
  entry: WiktextractEntry,
  targets: readonly SeedTarget[]
): WiktextractEntry {
  return prioritizeStructuredDescendantTargetsWithRanks(entry, buildStructuredDescendantTargetRanks(targets));
}

/** Builds the target priority map once per extractor pass instead of once per matched record. */
export function buildStructuredDescendantTargetRanks(targets: readonly SeedTarget[]): StructuredDescendantTargetRanks {
  return new Map(targets.map((target, index) => [seedTargetKey(canonicalSeedTarget(target)), index] as const));
}

/** Reorders descendant variants using a precomputed target priority map. */
export function prioritizeStructuredDescendantTargetsWithRanks(
  entry: WiktextractEntry,
  targetRanks: StructuredDescendantTargetRanks
): WiktextractEntry {
  const descendants = prioritizeDescendantList(entry.descendants, targetRanks);

  return descendants === entry.descendants ? entry : { ...entry, descendants };
}

/** Reads flat ancestry templates as seed hints, not graph edges. */
function ancestorTemplateTargets(entry: WiktextractEntry): SeedTarget[] {
  const targets = (entry.etymology_templates ?? []).flatMap((template) => {
    if (!isAncestorTemplate(template.name)) {
      return [];
    }

    return seedTargetFromTemplate(template);
  });

  return uniqueSeedTargets(targets);
}

/** Recognizes templates that point at likely ancestor records. */
function isAncestorTemplate(templateName: string | undefined): boolean {
  const normalizedName = templateName?.replace(/\+$/, "");

  return normalizedName
    ? new Set([
      "inh",
      "inherited",
      "der",
      "derived",
      "uder",
      "from",
      "bor",
      "borrowed",
      "lbor",
      "root"
    ]).has(normalizedName)
    : false;
}

/** Converts a Wiktionary ancestry template argument pair to a seed target. */
function seedTargetFromTemplate(template: WiktextractTemplate): SeedTarget[] {
  const langCode = trimOptional(template.args?.["2"]);
  const linkedTerm = trimOptional(template.args?.["3"]);
  const displayedTerm = preferredDisplayedTemplateTerm(linkedTerm, template.args?.["4"]) ?? linkedTerm;

  if (!langCode || !displayedTerm || displayedTerm === "-") {
    return [];
  }

  return [{ langCode, word: displayedTerm }];
}

/** Reads explicit doublet and cognate links as records to process later. */
function relationshipTemplateTargets(entry: WiktextractEntry): StructuredAncestryDiscoveredTarget[] {
  return uniqueRelationshipTargets((entry.etymology_templates ?? []).flatMap((template) => {
    switch (template.name) {
      case "doublet":
        return doubletTemplateTargets(template, entry.lang_code);
      case "cog":
      case "cognate":
        return cognateTemplateTargets(template);
      default:
        return [];
    }
  }));
}

/** Converts a same-language doublet template to one or more seed targets. */
function doubletTemplateTargets(
  template: WiktextractTemplate,
  fallbackLangCode: string | undefined
): StructuredAncestryDiscoveredTarget[] {
  const langCode = trimOptional(template.args?.["1"]) ?? fallbackLangCode;
  if (!langCode || !isSingleLanguageCode(langCode)) {
    return [];
  }

  return numericTemplateArgsFrom(template.args ?? {}, 2).map((word) => ({
    target: { langCode, word },
    reason: "doublet_template"
  }));
}

/** Converts a cognate template to a cross-language seed target. */
function cognateTemplateTargets(template: WiktextractTemplate): StructuredAncestryDiscoveredTarget[] {
  const langCode = trimOptional(template.args?.["1"]);
  const word = trimOptional(template.args?.["2"]);
  if (!langCode || !word || word === "-" || !isSingleLanguageCode(langCode)) {
    return [];
  }

  return [{
    target: { langCode, word },
    reason: "cognate_template"
  }];
}

/** Returns positional template arguments from a start index while skipping gloss metadata keys. */
function numericTemplateArgsFrom(args: Record<string, string>, startIndex: number): string[] {
  return Object.entries(args)
    .map(([key, value]) => ({
      argumentIndex: Number.parseInt(key, 10),
      value
    }))
    .filter(({ argumentIndex }) => Number.isInteger(argumentIndex) && argumentIndex >= startIndex)
    .sort((left, right) => left.argumentIndex - right.argumentIndex)
    .flatMap(({ value }) => {
      const word = trimOptional(value);
      return word && word !== "-" ? [word] : [];
    });
}

/** Keeps combined language lists from becoming impossible seed language codes. */
function isSingleLanguageCode(langCode: string): boolean {
  return !langCode.includes(",");
}

/** Enqueues same-language lemma records for Wiktextract alternative-form pages. */
function alternativeFormTargets(entry: WiktextractEntry): StructuredAncestryDiscoveredTarget[] {
  return uniqueSeedTargets((entry.senses ?? []).flatMap((sense) => {
    const tags = new Set([...(sense.tags ?? []), ...(sense.raw_tags ?? [])]);
    if (!tags.has("alt-of") && !tags.has("alternative")) {
      return [];
    }

    return (sense.alt_of ?? []).flatMap((alternative) => {
      const word = trimOptional(alternative.word);

      return entry.lang_code && word ? [{ langCode: entry.lang_code, word }] : [];
    });
  })).map((target) => ({ target, reason: "alternative_form" }));
}

/** Keeps display variants such as Latin macrons when they correspond to a linked template target. */
function preferredDisplayedTemplateTerm(
  linkedTerm: string | undefined,
  displayedTerm: string | undefined
): string | undefined {
  if (!linkedTerm) {
    return undefined;
  }

  const linkedTermKey = stripDiacritics(linkedTerm);
  const displayedTerms = trimOptional(displayedTerm)
    ?.split(",")
    .map((term) => trimOptional(term))
    .filter((term): term is string => term !== undefined);

  return displayedTerms?.find((term) => term !== linkedTerm && stripDiacritics(term) === linkedTermKey);
}

/** Compares displayed variants to plain Wiktionary links without losing graph spelling. */
function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/** Reads structured descendants and concise derived terms as records to process later. */
function structuredChildTargets(entry: WiktextractEntry): StructuredAncestryDiscoveredTarget[] {
  return [
    ...descendantTargets(entry.descendants ?? [], "structured_descendant"),
    ...derivedTargets(entry)
  ];
}

/** Walks structured descendants while avoiding same-language spelling variant fan-out. */
function descendantTargets(
  descendants: WiktextractDescendant[],
  reason: StructuredAncestryDiscoveryReason
): StructuredAncestryDiscoveredTarget[] {
  return firstDescendantPerLanguage(descendants).flatMap((descendant) => {
    const target = seedTargetFromDescendant(descendant);
    const childTargets = descendantTargets(descendant.descendants ?? [], reason);

    return target ? [{ target, reason }, ...childTargets] : childTargets;
  });
}

/** Converts one Wiktextract descendant node to a seed target. */
function seedTargetFromDescendant(descendant: WiktextractDescendant): SeedTarget | undefined {
  const langCode = descendant.lang_code;
  const word = trimOptional(descendant.word);

  if (!langCode || !word) {
    return undefined;
  }

  return { langCode, word };
}

/** Recursively moves queued variants ahead of unqueued siblings in each same-language group. */
function prioritizeDescendantList(
  descendants: WiktextractDescendant[] | undefined,
  targetRanks: ReadonlyMap<string, number>
): WiktextractDescendant[] | undefined {
  if (!descendants) {
    return descendants;
  }

  let changed = false;
  const descendantsWithPrioritizedChildren = descendants.map((descendant) => {
    const prioritizedChildren = prioritizeDescendantList(descendant.descendants, targetRanks);
    if (prioritizedChildren === descendant.descendants) {
      return descendant;
    }

    changed = true;
    return { ...descendant, descendants: prioritizedChildren };
  });
  const prioritizedDescendants = prioritizeSameLanguageTargetVariants(
    descendantsWithPrioritizedChildren,
    targetRanks
  );

  if (prioritizedDescendants !== descendantsWithPrioritizedChildren) {
    changed = true;
  }

  return changed ? prioritizedDescendants : descendants;
}

/** Keeps language order stable while selecting a queued spelling as that language's primary variant. */
function prioritizeSameLanguageTargetVariants(
  descendants: WiktextractDescendant[],
  targetRanks: ReadonlyMap<string, number>
): WiktextractDescendant[] {
  const targetRankByIndex = new Map<number, number>();
  descendants.forEach((descendant, index) => {
    const targetKey = descendantTargetKey(descendant);
    const targetRank = targetKey ? targetRanks.get(targetKey) : undefined;
    if (targetRank !== undefined) {
      targetRankByIndex.set(index, targetRank);
    }
  });

  if (targetRankByIndex.size === 0) {
    return descendants;
  }

  return descendants
    .map((descendant, index) => ({ descendant, index }))
    .sort((left, right) => compareDescendantTargetPriority(left, right, targetRankByIndex))
    .map(({ descendant }) => descendant);
}

/** Orders queued variants before unqueued siblings without moving unrelated language rows. */
function compareDescendantTargetPriority(
  left: DescendantWithIndex,
  right: DescendantWithIndex,
  targetRankByIndex: ReadonlyMap<number, number>
): number {
  if (left.descendant.lang_code !== right.descendant.lang_code) {
    return left.index - right.index;
  }

  const leftRank = targetRankByIndex.get(left.index);
  const rightRank = targetRankByIndex.get(right.index);
  if (leftRank !== undefined && rightRank !== undefined) {
    return leftRank - rightRank;
  }
  if (leftRank !== undefined) {
    return -1;
  }
  if (rightRank !== undefined) {
    return 1;
  }

  return left.index - right.index;
}

/** Builds a frontier key for a descendant row without inventing incomplete targets. */
function descendantTargetKey(descendant: WiktextractDescendant): string | undefined {
  const target = seedTargetFromDescendant(descendant);

  return target ? seedTargetKey(canonicalSeedTarget(target)) : undefined;
}

/** Enqueues concise derived terms, using the entry language when Wiktextract omits one. */
function derivedTargets(entry: WiktextractEntry): StructuredAncestryDiscoveredTarget[] {
  return uniqueSeedTargets(
    (entry.derived ?? []).flatMap((derivedTerm) => {
      const target = seedTargetFromDerivedTerm(derivedTerm, entry.lang_code);

      return target ? [target] : [];
    })
  ).map((target) => ({ target, reason: "structured_derived" }));
}

/** Converts a derived list item to a seed target when it is a single lexical item. */
function seedTargetFromDerivedTerm(
  derivedTerm: WiktextractDescendant,
  fallbackLangCode: string | undefined
): SeedTarget | undefined {
  const langCode = derivedTerm.lang_code ?? fallbackLangCode;
  const word = trimOptional(derivedTerm.word);

  if (!langCode || !word || !isSingleWordDerivedTerm(word)) {
    return undefined;
  }

  return { langCode, word };
}

/** Avoids queueing sayings, compounds, and phrase-like derived entries from Wiktionary lists. */
function isSingleWordDerivedTerm(word: string): boolean {
  return !/[\s-]/u.test(word);
}

/** Keeps the first sibling descendant for each language so variants do not dominate the frontier. */
function firstDescendantPerLanguage(descendants: WiktextractDescendant[]): WiktextractDescendant[] {
  const seenLanguageCodes = new Set<string>();
  const primaryDescendants: WiktextractDescendant[] = [];

  for (const descendant of descendants) {
    const languageCode = descendant.lang_code;
    if (!languageCode || seenLanguageCodes.has(languageCode)) {
      continue;
    }

    seenLanguageCodes.add(languageCode);
    primaryDescendants.push(descendant);
  }

  return primaryDescendants;
}

/** Removes duplicate relationship targets while keeping their first discovery reason. */
function uniqueRelationshipTargets(
  discoveredTargets: StructuredAncestryDiscoveredTarget[]
): StructuredAncestryDiscoveredTarget[] {
  const uniqueTargets = new Map<string, StructuredAncestryDiscoveredTarget>();

  for (const discoveredTarget of discoveredTargets) {
    const canonicalTarget = canonicalSeedTarget(discoveredTarget.target);
    const key = seedTargetKey(canonicalTarget);
    if (!uniqueTargets.has(key)) {
      uniqueTargets.set(key, { ...discoveredTarget, target: canonicalTarget });
    }
  }

  return [...uniqueTargets.values()];
}

/** Removes duplicate targets while preserving discovery order. */
function uniqueSeedTargets(targets: SeedTarget[]): SeedTarget[] {
  const uniqueTargets = new Map<string, SeedTarget>();

  for (const target of targets) {
    const canonicalTarget = canonicalSeedTarget(target);
    if (!uniqueTargets.has(seedTargetKey(canonicalTarget))) {
      uniqueTargets.set(seedTargetKey(canonicalTarget), canonicalTarget);
    }
  }

  return [...uniqueTargets.values()];
}

/** Canonicalizes proto-form stars before frontier matching and reporting. */
function canonicalSeedTarget(target: SeedTarget): SeedTarget {
  return {
    langCode: target.langCode,
    word: target.langCode ? canonicalGraphWord(target.langCode, target.word) : target.word
  };
}

/** Trims optional strings so empty source values do not become seed targets. */
function trimOptional(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}
