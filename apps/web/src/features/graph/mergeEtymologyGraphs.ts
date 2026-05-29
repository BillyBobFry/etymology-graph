import type { EtymologyGraph } from "@etymology-graph/graph";

/** Combines graph expansions while preserving the existing root and de-duplicating graph records. */
export function mergeEtymologyGraphs(baseGraph: EtymologyGraph, expansionGraph: EtymologyGraph): EtymologyGraph {
  const nodesById = new Map(baseGraph.nodes.map((node) => [node.id, node]));
  const edgesById = new Map(baseGraph.edges.map((edge) => [edge.id, edge]));

  for (const node of expansionGraph.nodes) {
    const existingNode = nodesById.get(node.id);
    nodesById.set(node.id, existingNode ? { ...node, depth: Math.min(existingNode.depth, node.depth) } : node);
  }

  for (const edge of expansionGraph.edges) {
    edgesById.set(edge.id, edge);
  }

  return {
    rootNodeId: baseGraph.rootNodeId,
    nodes: Array.from(nodesById.values()),
    edges: Array.from(edgesById.values()),
    maxDepth: Math.max(baseGraph.maxDepth, expansionGraph.maxDepth)
  };
}
