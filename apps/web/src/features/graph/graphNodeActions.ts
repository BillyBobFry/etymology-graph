import type { EdgeType } from "@etymology-graph/graph";
import type { PositionedGraphNode } from "./composables/useGraphLayout";

export type NodeContextAction = "load-children" | "view-etymology" | "view-doublets" | "find-source-language-links";

export type NodeActionItem = {
  value: NodeContextAction;
  label: string;
  description: string;
};

export type SelectedNodeRelationship = {
  id: string;
  type: EdgeType;
  otherNode: PositionedGraphNode;
  uncertain: boolean;
};

export const nodeActionItems: NodeActionItem[] = [
  {
    value: "load-children",
    label: "Load child terms",
    description: "Show direct descendants of this word."
  },
  {
    value: "view-etymology",
    label: "View etymology",
    description: "Open this word's ancestry graph."
  },
  {
    value: "view-doublets",
    label: "View doublets",
    description: "Find same-language terms with shared sources."
  },
  {
    value: "find-source-language-links",
    label: "Find source links",
    description: "Search selected-language words that trace to this language."
  }
];

/** Narrows reusable menu values to the graph actions GraphCanvas can perform. */
export function isNodeContextAction(value: string): value is NodeContextAction {
  return (
    value === "load-children" ||
    value === "view-etymology" ||
    value === "view-doublets" ||
    value === "find-source-language-links"
  );
}
