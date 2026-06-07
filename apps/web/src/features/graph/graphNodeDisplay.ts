import type { GraphTraversalNode } from "@etymology-graph/graph";

/** Builds a compact accessible label for node buttons. */
export function nodeAriaLabel(node: GraphTraversalNode): string {
  const details = [
    node.word,
    node.langName ?? node.langCode,
    formatIpaPronunciation(node),
    node.lexicalSummary?.pos,
    node.lexicalSummary?.definition
  ].filter((part) => part !== undefined && part.length > 0);

  return details.join(", ");
}

/** Keeps graph labels compact by showing only the IPA value. */
export function formatIpaPronunciation(node: GraphTraversalNode): string | undefined {
  return node.lexicalSummary?.ipa;
}

/** Formats IPA with its Wiktionary accent or region label for the details aside. */
export function formatDetailedIpa(node: GraphTraversalNode): string | undefined {
  const ipa = formatIpaPronunciation(node);

  if (!ipa) {
    return undefined;
  }

  return node.lexicalSummary?.ipaLabel ? `${ipa} ${node.lexicalSummary.ipaLabel}` : ipa;
}

/** Distinguishes imported dictionary entries from graph-only nodes discovered inside another entry. */
export function hasImportedLexicalEntry(node: GraphTraversalNode): boolean {
  return (node.lexicalSummary?.entryCount ?? 0) > 0;
}

/** Creates a stable Wiktionary entry URL for the selected graph node. */
export function wiktionaryHrefForNode(node: GraphTraversalNode, canonicalName: string): string {
  if (node.word.startsWith("*")) {
    return `https://en.wiktionary.org/wiki/Reconstruction:${wiktionaryPathSegment(canonicalName)}/${encodeURIComponent(node.word.slice(1))}`;
  }

  return `https://en.wiktionary.org/wiki/${encodeURIComponent(node.word)}#${wiktionaryLanguageAnchor(canonicalName)}`;
}

/** Encodes Wiktionary path segments while preserving MediaWiki-style word breaks. */
function wiktionaryPathSegment(value: string): string {
  return encodeURIComponent(value.replaceAll(" ", "_"));
}

/** Matches Wiktionary language section anchors from canonical language names. */
function wiktionaryLanguageAnchor(canonicalName: string): string {
  return wiktionaryPathSegment(canonicalName);
}
