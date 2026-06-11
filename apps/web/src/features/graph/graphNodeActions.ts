import type { EdgeType } from "@etymology-graph/graph";

import { isModernLanguageCode } from "../descendants/descendantGraphScope";
import type { PositionedGraphNode } from "./composables/useGraphLayout";

export type NodeContextAction = "load-children" | "load-descendants" | "view-etymology" | "find-source-language-links";

export type NodeActionItem = {
  value: NodeContextAction;
  label: string;
  description: string;
};

export type NodeActionLanguageContext = {
  nodeWord: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
};

export type SelectedNodeRelationship = {
  id: string;
  type: EdgeType;
  otherNode: PositionedGraphNode;
  uncertain: boolean;
};

const stableNodeActionItems: NodeActionItem[] = [
  {
    value: "load-children",
    label: "Load child terms",
    description: "Show direct descendants of this word."
  },
  {
    value: "view-etymology",
    label: "View etymology",
    description: "Open this word's ancestry graph."
  }
];
/** Creates node action copy with optional source and result language context. */
export function createNodeActionItems(languageContext?: NodeActionLanguageContext): NodeActionItem[] {
  const items = stableNodeActionItems.map((item) => nodeActionItemWithContext(item, languageContext));

  if (languageContext && !isModernLanguageCode(languageContext.sourceLanguageCode)) {
    items.push({
      value: "load-descendants",
      label: `Load ${languageContext.nodeWord} descendants`,
      description: `Open the full descendant graph for ${nodeActionSubject(languageContext)}.`
    });
  }

  if (languageContext && languageContext.sourceLanguageCode !== languageContext.targetLanguageCode) {
    items.push({
      value: "find-source-language-links",
      label: sourceLanguageLinksLabel(languageContext),
      description: sourceLanguageLinksDescription(languageContext)
    });
  }

  return items;
}

/** Adds selected-word context to reusable actions without changing their behavior. */
function nodeActionItemWithContext(
  item: NodeActionItem,
  languageContext?: NodeActionLanguageContext
): NodeActionItem {
  if (!languageContext) {
    return item;
  }

  switch (item.value) {
    case "load-children":
      return {
        ...item,
        label: `Load ${languageContext.nodeWord} children`,
        description: `Show direct descendants of ${nodeActionSubject(languageContext)}.`
      };
    case "view-etymology":
      return {
        ...item,
        label: `View ${languageContext.nodeWord} etymology`,
        description: `Open the ancestry graph for ${nodeActionSubject(languageContext)}.`
      };
    case "load-descendants":
      return item;
    case "find-source-language-links":
      return item;
  }
}

/** Keeps term and language context compact enough for menu descriptions. */
function nodeActionSubject(languageContext: NodeActionLanguageContext): string {
  return `${languageContext.nodeWord} (${languageContext.sourceLanguageName})`;
}

/** Names the cross-language source-link search from the selected node's perspective. */
function sourceLanguageLinksLabel(languageContext?: NodeActionLanguageContext): string {
  if (!languageContext) {
    return "Find source links";
  }

  return `Links from ${languageContext.sourceLanguageName} to ${languageContext.targetLanguageName}`;
}

/** Explains which result language will be searched for this source language. */
function sourceLanguageLinksDescription(languageContext?: NodeActionLanguageContext): string {
  if (!languageContext) {
    return "Search selected-language words that trace to this language.";
  }

  return `Search ${languageContext.targetLanguageName} words that trace to ${languageContext.sourceLanguageName}.`;
}

/** Narrows reusable menu values to the graph actions GraphCanvas can perform. */
export function isNodeContextAction(value: string): value is NodeContextAction {
  return (
    value === "load-children" ||
    value === "load-descendants" ||
    value === "view-etymology" ||
    value === "find-source-language-links"
  );
}
