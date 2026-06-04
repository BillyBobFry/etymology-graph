import type { EdgeType } from "@etymology-graph/graph";

const relationshipColorClasses: Record<EdgeType, string> = {
  borrowed_from: "[--relationship-color:var(--theme-borrowed)]",
  compound_of: "[--relationship-color:color-mix(in_oklch,var(--theme-derived)_68%,var(--theme-accent))]",
  cognate_with: "[--relationship-color:color-mix(in_oklch,var(--theme-descendant)_70%,var(--theme-accent))]",
  derived_from: "[--relationship-color:var(--theme-derived)]",
  descendant_of: "[--relationship-color:var(--theme-descendant)]",
  doublet_of: "[--relationship-color:var(--theme-accent)]",
  inherited_from: "[--relationship-color:var(--theme-inherited)]",
  related_to: "[--relationship-color:color-mix(in_oklch,var(--theme-graph-edge)_84%,var(--theme-text-muted))]",
  see_also: "[--relationship-color:color-mix(in_oklch,var(--theme-graph-edge)_62%,var(--theme-border-strong))]"
};

export const edgeLegendItems = (
  [
    "inherited_from",
    "derived_from",
    "borrowed_from",
  ] as const
).map((type) => ({ type, label: edgeLabel(type) }));

/** Provides user-facing relationship names for legends, tooltips, and detail cards. */
export function edgeLabel(type: EdgeType): string {
  switch (type) {
    case "borrowed_from":
      return "borrowed from";
    case "compound_of":
      return "compound of";
    case "cognate_with":
      return "cognate with";
    case "derived_from":
      return "derived from";
    case "descendant_of":
      return "descendant of";
    case "doublet_of":
      return "doublet of";
    case "inherited_from":
      return "inherited from";
    case "related_to":
      return "related to";
    case "see_also":
      return "see also";
  }
}

/** Limits layered hierarchy to edge types whose direction points from descendant to source. */
export function isSourceDirectedEdgeType(type: EdgeType): boolean {
  switch (type) {
    case "borrowed_from":
    case "derived_from":
    case "descendant_of":
    case "inherited_from":
      return true;
    case "cognate_with":
    case "compound_of":
    case "doublet_of":
    case "related_to":
    case "see_also":
      return false;
  }
}

/** Produces stable CSS hooks so relationship type can be visible without text on every edge. */
export function edgeTypeClass(type: EdgeType): string {
  return `type-${type.replaceAll("_", "-")}`;
}

/** Keeps relationship color utilities centralized for graph lines, badges, and legends. */
export function relationshipColorClass(type: EdgeType): string {
  return relationshipColorClasses[type];
}

/** Returns the SVG marker URL that matches a relationship type. */
export function markerUrlForEdgeType(type: EdgeType): string {
  return `url(#arrowhead-${edgeTypeClass(type)})`;
}
