import type { EtymologyGraph } from "@etymology-graph/graph";

type PublicGraphEdge = EtymologyGraph["edges"][number];

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

/** Removes one added branch while keeping the first shared ancestor and the root-connected graph. */
export function pruneGraphBranchUntilSharedDescendant(graph: EtymologyGraph, branchRootNodeId: string): EtymologyGraph {
  if (branchRootNodeId === graph.rootNodeId || !graph.nodes.some((node) => node.id === branchRootNodeId)) {
    return graph;
  }

  const incomingEdgesByNodeId = groupEdgesByTarget(graph.edges);
  const nodesToRemove = new Set<string>([branchRootNodeId]);
  const edgesToRemove = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;

    for (const edge of graph.edges) {
      if (!nodesToRemove.has(edge.fromNodeId) || edgesToRemove.has(edge.id)) {
        continue;
      }

      edgesToRemove.add(edge.id);
      changed = true;
    }

    for (const edge of graph.edges) {
      if (!edgesToRemove.has(edge.id) || nodesToRemove.has(edge.toNodeId) || edge.toNodeId === graph.rootNodeId) {
        continue;
      }

      if (!hasRemainingDescendant(edge.toNodeId, incomingEdgesByNodeId, nodesToRemove, edgesToRemove)) {
        nodesToRemove.add(edge.toNodeId);
        changed = true;
      }
    }
  }

  const retainedNodeIds = new Set(graph.nodes.map((node) => node.id).filter((nodeId) => !nodesToRemove.has(nodeId)));
  const retainedEdges = graph.edges.filter(
    (edge) => !edgesToRemove.has(edge.id) && retainedNodeIds.has(edge.fromNodeId) && retainedNodeIds.has(edge.toNodeId)
  );
  const connectedNodeIds = rootConnectedNodeIds(graph.rootNodeId, retainedEdges);

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => connectedNodeIds.has(node.id)),
    edges: retainedEdges.filter((edge) => connectedNodeIds.has(edge.fromNodeId) && connectedNodeIds.has(edge.toNodeId))
  };
}

/** Groups edges by ancestor node so branch pruning can count remaining descendants. */
function groupEdgesByTarget(edges: PublicGraphEdge[]): Map<string, PublicGraphEdge[]> {
  const edgesByTarget = new Map<string, PublicGraphEdge[]>();

  for (const edge of edges) {
    edgesByTarget.set(edge.toNodeId, [...(edgesByTarget.get(edge.toNodeId) ?? []), edge]);
  }

  return edgesByTarget;
}

/** Checks whether an ancestor still has a child outside the branch being removed. */
function hasRemainingDescendant(
  nodeId: string,
  incomingEdgesByNodeId: Map<string, PublicGraphEdge[]>,
  nodesToRemove: Set<string>,
  edgesToRemove: Set<string>
): boolean {
  return (incomingEdgesByNodeId.get(nodeId) ?? []).some(
    (edge) => !edgesToRemove.has(edge.id) && !nodesToRemove.has(edge.fromNodeId)
  );
}

/** Finds the component still reachable from the selected route root after pruning. */
function rootConnectedNodeIds(rootNodeId: string, edges: PublicGraphEdge[]): Set<string> {
  const connectedNodeIds = new Set<string>([rootNodeId]);
  const adjacentNodeIds = new Map<string, string[]>();

  for (const edge of edges) {
    adjacentNodeIds.set(edge.fromNodeId, [...(adjacentNodeIds.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    adjacentNodeIds.set(edge.toNodeId, [...(adjacentNodeIds.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }

  const queue = [rootNodeId];
  for (const nodeId of queue) {
    for (const adjacentNodeId of adjacentNodeIds.get(nodeId) ?? []) {
      if (connectedNodeIds.has(adjacentNodeId)) {
        continue;
      }

      connectedNodeIds.add(adjacentNodeId);
      queue.push(adjacentNodeId);
    }
  }

  return connectedNodeIds;
}
