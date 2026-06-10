export type GraphNodeHighlightTone = "primary" | "terminal";

export type GraphNodeHighlight = {
  nodeId: string;
  tone: GraphNodeHighlightTone;
};

/** Marks existing primary node IDs with the default graph highlight tone. */
export const primaryGraphNodeHighlights = (nodeIds: string[]): GraphNodeHighlight[] =>
  nodeIds.map((nodeId) => ({ nodeId, tone: "primary" }));
