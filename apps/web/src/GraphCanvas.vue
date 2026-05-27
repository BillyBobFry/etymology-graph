<script setup lang="ts">
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from "d3-force";
import { CircleHelp, Maximize2, Minimize2, Minus, Plus, RotateCcw, X } from "@lucide/vue";
import { useEventListener, useMediaQuery, useScrollLock } from "@vueuse/core";
import { computed, onBeforeUnmount, ref, watch } from "vue";

import type { EdgeType, EtymologyGraph, GraphTraversalNode } from "@etymology-graph/graph";
import { useGraphViewport } from "./composables/useGraphViewport";
import Badge from "./uiComponents/Badge.vue";
import ContextMenu from "./uiComponents/ContextMenu.vue";
import IconButton from "./uiComponents/IconButton.vue";
import Popover from "./uiComponents/Popover.vue";

const canvasWidth = 920;
const canvasHeight = 560;
const centerX = canvasWidth / 2;
const centerY = canvasHeight / 2;
const initialSiblingSpacing = 74;
const initialDepthYSpacing = 64;
const depthBandSpacing = 92;
const horizontalDepthBandSpacing = 150;
const labelClearanceRadius = 58;
const layoutWarmupTicks = 180;
const layeredOrderingPasses = 4;
const graphFitPadding = 64;
const graphFitMaxZoom = 1;
const graphFitTextHalfWidthPerCharacter = 4.2;

type GraphLayoutOrientation = "horizontal" | "vertical";

type PositionedGraphNode = GraphTraversalNode &
  SimulationNodeDatum & {
    preferredSiblingPosition: number;
  };

type PositionedGraphLink = SimulationLinkDatum<PositionedGraphNode> & {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  uncertain: boolean;
};

type LinkEndpoint = "source" | "target";

type NodeContextAction = "load-children" | "view-etymology" | "view-doublets";

type SelectedNodeRelationship = {
  id: string;
  type: EdgeType;
  otherNode: PositionedGraphNode;
  uncertain: boolean;
};

type GraphPoint = {
  x: number;
  y: number;
};

type GraphBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type NodeDragState = {
  pointerId: number;
  nodeId: string;
  lastPoint: GraphPoint;
  hasMoved: boolean;
};

type ContextMenuInstance = {
  close(): void;
};

const props = withDefaults(
  defineProps<{
    graph: EtymologyGraph;
    rootNodeId?: string;
    showControls?: boolean;
  }>(),
  {
    showControls: true
  }
);

const emit = defineEmits<{
  "load-children": [node: GraphTraversalNode];
  "view-etymology": [node: GraphTraversalNode];
  "view-doublets": [node: GraphTraversalNode];
}>();

const nodes = ref<PositionedGraphNode[]>([]);
const links = ref<PositionedGraphLink[]>([]);
const tickVersion = ref(0);
const selectedNodeId = ref<string>();
const contextNodeId = ref<string>();
const nodeDragState = ref<NodeDragState>();
const suppressNextNodeClick = ref(false);
const isGraphGuideOpen = ref(false);
const isNodeContextMenuOpen = ref(false);
const isGraphExpanded = ref(false);
const isBodyScrollLocked = useScrollLock(() => document.body);
const nodeContextMenu = ref<ContextMenuInstance | null>(null);
const usesDesktopGraphLayout = useMediaQuery("(min-width: 768px)");
const {
  svgRef,
  panX,
  panY,
  zoom,
  zoomPercentage,
  viewportTransform,
  isPanning,
  zoomIn,
  zoomOut,
  resetViewport,
  setHomeViewport,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleWheel,
  handleDoubleClick,
  handleKeydown
} = useGraphViewport({
  width: canvasWidth,
  height: canvasHeight,
  minZoom: 0.12
});

let simulation: Simulation<PositionedGraphNode, PositionedGraphLink> | null = null;
let renderedLayoutOrientation: GraphLayoutOrientation | null = null;

const renderedNodes = computed(() => {
  tickVersion.value;
  return nodes.value;
});

const renderedLinks = computed(() => {
  tickVersion.value;
  return links.value;
});

const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value));
const nodesById = computed(() => new Map(nodes.value.map((node) => [node.id, node])));
const selectedNodeRelationships = computed<SelectedNodeRelationship[]>(() => {
  const node = selectedNode.value;

  if (!node) {
    return [];
  }

  return links.value
    .flatMap((link) => selectedRelationshipForLink(link, node.id, nodesById.value))
    .sort((left, right) => edgeLabel(left.type).localeCompare(edgeLabel(right.type)));
});
const contextNode = computed(() => nodes.value.find((node) => node.id === contextNodeId.value));
const expandButtonLabel = computed(() => (isGraphExpanded.value ? "Collapse graph" : "Expand graph"));
const graphLayoutOrientation = computed<GraphLayoutOrientation>(() =>
  usesDesktopGraphLayout.value ? "horizontal" : "vertical"
);
const edgeLegendItems = (
  [
    "inherited_from",
    "derived_from",
    "borrowed_from",
    "cognate_with",
    "doublet_of",
    "descendant_of",
    "related_to",
    "see_also"
  ] as const
).map((type) => ({ type, label: edgeLabel(type) }));
const nodeContextMenuItems = computed(() => [
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
  }
]);

watch(
  [() => props.graph, graphLayoutOrientation],
  ([graph, orientation]) => {
    buildSimulation(graph, orientation);
  },
  { immediate: true }
);

watch(isGraphExpanded, (expanded) => {
  isBodyScrollLocked.value = expanded;
});

useEventListener("keydown", handleDocumentKeydown);

onBeforeUnmount(() => {
  isBodyScrollLocked.value = false;
  stopSimulation();
});

/** Builds a fresh force layout whenever the user opens a different graph. */
function buildSimulation(graph: EtymologyGraph, orientation: GraphLayoutOrientation): void {
  const previousNodesById = new Map(nodes.value.map((node) => [node.id, node]));
  const shouldPreserveLayout =
    renderedLayoutOrientation === orientation && shouldPreserveExistingLayout(graph, previousNodesById);

  stopSimulation();

  const generationLevels = graphGenerationLevels(graph);
  const maxGenerationLevel = Math.max(1, ...generationLevels.values());
  const generationOrders = orderedGenerationNodeIds(graph, generationLevels, maxGenerationLevel);
  const preferredSiblingPositions = preferredNodeSiblingPositions(generationOrders, orientation);

  const positionedNodes = graph.nodes.map((node) => {
    const generationLevel = generationLevels.get(node.id) ?? 0;
    const preferredSiblingPosition = preferredSiblingPositions.get(node.id) ?? siblingAxisCenter(orientation);
    const previousNode = shouldPreserveLayout ? previousNodesById.get(node.id) : undefined;

    if (previousNode) {
      return {
        ...node,
        preferredSiblingPosition: previousNode.preferredSiblingPosition,
        x: nodeX(previousNode),
        y: nodeY(previousNode),
        fx: previousNode.fx,
        fy: previousNode.fy
      };
    }

    return {
      ...node,
      preferredSiblingPosition,
      x: initialNodeX(generationLevel, maxGenerationLevel, preferredSiblingPosition, orientation),
      y: initialNodeY(generationLevel, maxGenerationLevel, preferredSiblingPosition, orientation)
    };
  });

  const positionedLinks = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId,
    sourceNodeId: edge.fromNodeId,
    targetNodeId: edge.toNodeId,
    type: edge.type,
    uncertain: edge.uncertain ?? false
  }));

  simulation = forceSimulation<PositionedGraphNode, PositionedGraphLink>(positionedNodes)
    .force(
      "link",
      forceLink<PositionedGraphNode, PositionedGraphLink>(positionedLinks)
        .id((node) => node.id)
        .distance((link) => linkDistance(link.type))
        .strength(0.55)
    )
    .force("charge", forceManyBody().strength(-640))
    .force("collide", forceCollide<PositionedGraphNode>().radius((node) => nodeRadius(node) + labelClearanceRadius))
    .force("center", forceCenter(centerX, centerY))
    .force("siblingX", siblingForceX(orientation))
    .force("generationX", generationForceX(generationLevels, maxGenerationLevel, orientation))
    .force("siblingY", siblingForceY(orientation))
    .force(
      "generationY",
      generationForceY(generationLevels, maxGenerationLevel, orientation)
    )
    .stop();

  const restoredPins = shouldPreserveLayout ? pinExistingNodesForWarmup(positionedNodes, previousNodesById) : [];

  simulation.tick(layoutWarmupTicks);
  restoreNodePins(restoredPins);

  nodes.value = positionedNodes;
  links.value = positionedLinks;
  selectedNodeId.value = shouldPreserveLayout ? retainedNodeId(selectedNodeId.value, positionedNodes) : undefined;
  contextNodeId.value = shouldPreserveLayout ? retainedNodeId(contextNodeId.value, positionedNodes) : undefined;
  nodeDragState.value = undefined;
  suppressNextNodeClick.value = false;

  if (!shouldPreserveLayout) {
    isGraphGuideOpen.value = false;
    isNodeContextMenuOpen.value = false;
    nodeContextMenu.value?.close();
    setHomeViewport(fittedViewportForNodes(positionedNodes));
  }

  tickVersion.value += 1;
  renderedLayoutOrientation = orientation;
}

/** Computes the initial map transform so the whole rendered graph starts in view. */
function fittedViewportForNodes(positionedNodes: PositionedGraphNode[]): { panX: number; panY: number; zoom: number } {
  if (positionedNodes.length === 0) {
    return { panX: 0, panY: 0, zoom: 1 };
  }

  const bounds = positionedNodes.map(nodeVisualBounds).reduce(mergeGraphBounds);
  const boundsWidth = bounds.maxX - bounds.minX + graphFitPadding * 2;
  const boundsHeight = bounds.maxY - bounds.minY + graphFitPadding * 2;
  const fittedZoom = Math.min(graphFitMaxZoom, canvasWidth / boundsWidth, canvasHeight / boundsHeight);
  const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
  const boundsCenterY = (bounds.minY + bounds.maxY) / 2;

  return {
    panX: centerX - boundsCenterX * fittedZoom,
    panY: centerY - boundsCenterY * fittedZoom,
    zoom: fittedZoom
  };
}

/** Estimates each node's rendered footprint, including labels below the circle. */
function nodeVisualBounds(node: PositionedGraphNode): GraphBounds {
  const x = nodeX(node);
  const y = nodeY(node);
  const radius = nodeRadius(node);
  const textHalfWidth = estimatedNodeTextHalfWidth(node);
  const visualHalfWidth = Math.max(radius, textHalfWidth);
  const labelBottom = radius + (formatIpa(node) ? 56 : 40);

  return {
    minX: x - visualHalfWidth,
    minY: y - radius,
    maxX: x + visualHalfWidth,
    maxY: y + labelBottom
  };
}

/** Keeps the first view wide enough for text labels without requiring DOM measurement. */
function estimatedNodeTextHalfWidth(node: PositionedGraphNode): number {
  const longestLabelLength = Math.max(
    node.word.length,
    (node.langName ?? node.langCode).length,
    formatIpa(node)?.length ?? 0
  );

  return longestLabelLength * graphFitTextHalfWidthPerCharacter;
}

/** Combines node bounds into one graph-wide rectangle. */
function mergeGraphBounds(left: GraphBounds, right: GraphBounds): GraphBounds {
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY)
  };
}

/** Expands the graph into an app-level overlay without breaking portalled floating UI. */
function toggleGraphExpanded(): void {
  setGraphExpanded(!isGraphExpanded.value);
}

/** Centralizes expanded-state cleanup for toolbar clicks and Escape. */
function setGraphExpanded(expanded: boolean): void {
  isGraphExpanded.value = expanded;

  if (!expanded) {
    isGraphGuideOpen.value = false;
    isNodeContextMenuOpen.value = false;
    nodeContextMenu.value?.close();
  }
}

/** Lets users leave the expanded graph with the standard Escape shortcut. */
function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !isGraphExpanded.value) {
    return;
  }

  setGraphExpanded(false);
}

/** Holds existing nodes steady while new nodes settle around the expanded graph. */
function pinExistingNodesForWarmup(
  positionedNodes: PositionedGraphNode[],
  previousNodesById: Map<string, PositionedGraphNode>
): Array<{ node: PositionedGraphNode; fx: number | null | undefined; fy: number | null | undefined }> {
  const restoredPins: Array<{ node: PositionedGraphNode; fx: number | null | undefined; fy: number | null | undefined }> = [];

  for (const node of positionedNodes) {
    if (!previousNodesById.has(node.id)) {
      continue;
    }

    restoredPins.push({ node, fx: node.fx, fy: node.fy });
    node.fx = nodeX(node);
    node.fy = nodeY(node);
  }

  return restoredPins;
}

/** Restores manual drag pins after the temporary expansion warmup pins are no longer needed. */
function restoreNodePins(restoredPins: Array<{ node: PositionedGraphNode; fx: number | null | undefined; fy: number | null | undefined }>): void {
  for (const restoredPin of restoredPins) {
    restoredPin.node.fx = restoredPin.fx;
    restoredPin.node.fy = restoredPin.fy;
  }
}

/** Preserves the mental map only when the new graph extends the currently rendered one. */
function shouldPreserveExistingLayout(
  graph: EtymologyGraph,
  previousNodesById: Map<string, PositionedGraphNode>
): boolean {
  if (previousNodesById.size === 0) {
    return false;
  }

  const nextNodeIds = new Set(graph.nodes.map((node) => node.id));

  return Array.from(previousNodesById.keys()).every((nodeId) => nextNodeIds.has(nodeId));
}

/** Keeps selected/context nodes only while they still exist after the graph update. */
function retainedNodeId(nodeId: string | undefined, positionedNodes: PositionedGraphNode[]): string | undefined {
  if (!nodeId) {
    return undefined;
  }

  return positionedNodes.some((node) => node.id === nodeId) ? nodeId : undefined;
}

/** Derives linguistic generations from source-directed graph edges instead of query traversal depth. */
function graphGenerationLevels(graph: EtymologyGraph): Map<string, number> {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const ancestorIds = new Set<string>();
  const outgoingAncestorIds = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (!isSourceDirectedEdgeType(edge.type) || !nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      continue;
    }

    ancestorIds.add(edge.toNodeId);
    outgoingAncestorIds.set(edge.fromNodeId, [...(outgoingAncestorIds.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  }

  const generationLevels = new Map(graph.nodes.map((node) => [node.id, 0]));
  const descendantTipIds = graph.nodes.filter((node) => !ancestorIds.has(node.id)).map((node) => node.id);
  const pendingNodeIds = descendantTipIds.length > 0 ? descendantTipIds : graph.nodes.map((node) => node.id);

  for (const nodeId of pendingNodeIds) {
    assignAncestorLevels(nodeId, generationLevels, outgoingAncestorIds, nodeIds.size);
  }

  return generationLevels;
}

/** Orders each generation by connected neighbor positions so layered edges cross less often. */
function orderedGenerationNodeIds(
  graph: EtymologyGraph,
  generationLevels: Map<string, number>,
  maxGenerationLevel: number
): Map<number, string[]> {
  const generationOrders = new Map<number, string[]>();
  const adjacency = graphAdjacency(graph, generationLevels);

  for (const node of graph.nodes) {
    const generationLevel = generationLevels.get(node.id) ?? 0;
    generationOrders.set(generationLevel, [...(generationOrders.get(generationLevel) ?? []), node.id]);
  }

  for (let pass = 0; pass < layeredOrderingPasses; pass += 1) {
    for (let generationLevel = 1; generationLevel <= maxGenerationLevel; generationLevel += 1) {
      reorderGenerationByNeighborOrder(
        generationOrders,
        adjacency,
        generationLevel,
        (neighborGenerationLevel) => neighborGenerationLevel < generationLevel
      );
    }

    for (let generationLevel = maxGenerationLevel - 1; generationLevel >= 0; generationLevel -= 1) {
      reorderGenerationByNeighborOrder(
        generationOrders,
        adjacency,
        generationLevel,
        (neighborGenerationLevel) => neighborGenerationLevel > generationLevel
      );
    }
  }

  return generationOrders;
}

/** Builds undirected graph adjacency because crossing reduction cares about visual links, not edge direction. */
function graphAdjacency(
  graph: EtymologyGraph,
  generationLevels: Map<string, number>
): Map<string, Array<{ nodeId: string; generationLevel: number }>> {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const adjacency = new Map<string, Array<{ nodeId: string; generationLevel: number }>>();

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      continue;
    }

    const fromGenerationLevel = generationLevels.get(edge.fromNodeId) ?? 0;
    const toGenerationLevel = generationLevels.get(edge.toNodeId) ?? 0;

    adjacency.set(edge.fromNodeId, [
      ...(adjacency.get(edge.fromNodeId) ?? []),
      { nodeId: edge.toNodeId, generationLevel: toGenerationLevel }
    ]);
    adjacency.set(edge.toNodeId, [
      ...(adjacency.get(edge.toNodeId) ?? []),
      { nodeId: edge.fromNodeId, generationLevel: fromGenerationLevel }
    ]);
  }

  return adjacency;
}

/** Re-sorts one layer by the barycenter of neighboring layers while preserving stable ties. */
function reorderGenerationByNeighborOrder(
  generationOrders: Map<number, string[]>,
  adjacency: Map<string, Array<{ nodeId: string; generationLevel: number }>>,
  generationLevel: number,
  shouldUseNeighbor: (generationLevel: number) => boolean
): void {
  const nodeIds = generationOrders.get(generationLevel);

  if (!nodeIds || nodeIds.length < 2) {
    return;
  }

  const orderIndexes = generationOrderIndexes(generationOrders);
  const currentIndexes = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const scoredNodeIds = nodeIds.map((nodeId) => {
    const neighborOrders = (adjacency.get(nodeId) ?? [])
      .filter((neighbor) => shouldUseNeighbor(neighbor.generationLevel))
      .map((neighbor) => orderIndexes.get(neighbor.nodeId))
      .filter((index): index is number => index !== undefined);
    const averageNeighborOrder =
      neighborOrders.length > 0
        ? neighborOrders.reduce((total, order) => total + order, 0) / neighborOrders.length
        : currentIndexes.get(nodeId) ?? 0;

    return {
      nodeId,
      averageNeighborOrder,
      currentIndex: currentIndexes.get(nodeId) ?? 0
    };
  });

  scoredNodeIds.sort((left, right) => {
    const orderDifference = left.averageNeighborOrder - right.averageNeighborOrder;

    return orderDifference === 0 ? left.currentIndex - right.currentIndex : orderDifference;
  });

  generationOrders.set(
    generationLevel,
    scoredNodeIds.map((node) => node.nodeId)
  );
}

/** Gives each node a sortable index within its current generation order. */
function generationOrderIndexes(generationOrders: Map<number, string[]>): Map<string, number> {
  const orderIndexes = new Map<string, number>();

  for (const nodeIds of generationOrders.values()) {
    nodeIds.forEach((nodeId, index) => {
      orderIndexes.set(nodeId, index);
    });
  }

  return orderIndexes;
}

/** Converts layer order into centered sibling-axis targets for the force simulation. */
function preferredNodeSiblingPositions(
  generationOrders: Map<number, string[]>,
  orientation: GraphLayoutOrientation
): Map<string, number> {
  const positions = new Map<string, number>();

  for (const nodeIds of generationOrders.values()) {
    const centeredOffset = (nodeIds.length - 1) / 2;

    nodeIds.forEach((nodeId, index) => {
      positions.set(nodeId, siblingAxisCenter(orientation) + (index - centeredOffset) * initialSiblingSpacing);
    });
  }

  return positions;
}

/** Places new nodes on the correct graph axis before force warmup begins. */
function initialNodeX(
  generationLevel: number,
  maxGenerationLevel: number,
  preferredSiblingPosition: number,
  orientation: GraphLayoutOrientation
): number {
  return orientation === "horizontal"
    ? generationAxisPosition(generationLevel, maxGenerationLevel, orientation, horizontalDepthBandSpacing)
    : preferredSiblingPosition;
}

/** Places new nodes on the correct graph axis before force warmup begins. */
function initialNodeY(
  generationLevel: number,
  maxGenerationLevel: number,
  preferredSiblingPosition: number,
  orientation: GraphLayoutOrientation
): number {
  return orientation === "horizontal"
    ? preferredSiblingPosition
    : generationAxisPosition(generationLevel, maxGenerationLevel, orientation, initialDepthYSpacing);
}

/** Walks descendant-to-source edges so each older source lands below its highest descendant chain. */
function assignAncestorLevels(
  nodeId: string,
  generationLevels: Map<string, number>,
  outgoingAncestorIds: Map<string, string[]>,
  maxLevel: number
): void {
  const nextLevel = (generationLevels.get(nodeId) ?? 0) + 1;

  if (nextLevel > maxLevel) {
    return;
  }

  for (const ancestorId of outgoingAncestorIds.get(nodeId) ?? []) {
    if ((generationLevels.get(ancestorId) ?? 0) >= nextLevel) {
      continue;
    }

    generationLevels.set(ancestorId, nextLevel);
    assignAncestorLevels(ancestorId, generationLevels, outgoingAncestorIds, maxLevel);
  }
}

/** Limits vertical hierarchy to edge types whose direction points from descendant to source. */
function isSourceDirectedEdgeType(type: EdgeType): boolean {
  switch (type) {
    case "borrowed_from":
    case "derived_from":
    case "descendant_of":
    case "inherited_from":
      return true;
    case "cognate_with":
    case "doublet_of":
    case "related_to":
    case "see_also":
      return false;
  }
}

/** Pulls siblings across X for vertical graphs and leaves X for generational depth on desktop. */
function siblingForceX(orientation: GraphLayoutOrientation): ReturnType<typeof forceX<PositionedGraphNode>> | null {
  return orientation === "vertical"
    ? forceX<PositionedGraphNode>((node) => node.preferredSiblingPosition).strength(0.08)
    : null;
}

/** Pulls older generations across X when the graph has enough horizontal room. */
function generationForceX(
  generationLevels: Map<string, number>,
  maxGenerationLevel: number,
  orientation: GraphLayoutOrientation
): ReturnType<typeof forceX<PositionedGraphNode>> | null {
  return orientation === "horizontal"
    ? forceX<PositionedGraphNode>((node) =>
        generationAxisPosition(generationLevels.get(node.id) ?? 0, maxGenerationLevel, orientation, horizontalDepthBandSpacing)
      ).strength(0.16)
    : null;
}

/** Pulls siblings down Y on desktop and leaves Y for generational depth on mobile. */
function siblingForceY(orientation: GraphLayoutOrientation): ReturnType<typeof forceY<PositionedGraphNode>> | null {
  return orientation === "horizontal"
    ? forceY<PositionedGraphNode>((node) => node.preferredSiblingPosition).strength(0.08)
    : null;
}

/** Pulls older generations down Y in the mobile-friendly vertical graph. */
function generationForceY(
  generationLevels: Map<string, number>,
  maxGenerationLevel: number,
  orientation: GraphLayoutOrientation
): ReturnType<typeof forceY<PositionedGraphNode>> | null {
  return orientation === "vertical"
    ? forceY<PositionedGraphNode>((node) =>
        generationAxisPosition(generationLevels.get(node.id) ?? 0, maxGenerationLevel, orientation, depthBandSpacing)
      ).strength(0.16)
    : null;
}

/** Centers sibling placement on the axis perpendicular to generational depth. */
function siblingAxisCenter(orientation: GraphLayoutOrientation): number {
  return orientation === "horizontal" ? centerY : centerX;
}

/** Places older linguistic generations lower on mobile and farther right on desktop. */
function generationAxisPosition(
  generationLevel: number,
  maxGenerationLevel: number,
  orientation: GraphLayoutOrientation,
  spacing: number
): number {
  const center = orientation === "horizontal" ? centerX : centerY;

  return center + (generationLevel - maxGenerationLevel / 2) * spacing;
}

/** Stops the old simulation so background ticks do not keep mutating stale nodes. */
function stopSimulation(): void {
  if (!simulation) {
    return;
  }

  simulation.stop();
  simulation = null;
}

/** Keeps root terms visually dominant while still letting deeper nodes breathe. */
function nodeRadius(node: PositionedGraphNode): number {
  return Math.max(9, 18 - node.depth * 2);
}

/** Uses edge type semantics to give cognates and loose relations a little more room. */
function linkDistance(type: EdgeType): number {
  switch (type) {
    case "cognate_with":
    case "doublet_of":
    case "related_to":
    case "see_also":
      return 220;
    case "descendant_of":
      return 180;
    case "inherited_from":
    case "derived_from":
    case "borrowed_from":
      return 155;
  }
}

/** Reads the mutable x coordinate D3 attaches to a simulation node. */
function nodeX(node: PositionedGraphNode): number {
  const x = node.x;

  return typeof x === "number" && Number.isFinite(x) ? x : centerX;
}

/** Reads the mutable y coordinate D3 attaches to a simulation node. */
function nodeY(node: PositionedGraphNode): number {
  const y = node.y;

  return typeof y === "number" && Number.isFinite(y) ? y : centerY;
}

/** Resolves force-link endpoints after D3 replaces IDs with node objects. */
function endpointNode(endpoint: PositionedGraphLink["source"]): PositionedGraphNode | null {
  return typeof endpoint === "object" ? endpoint : null;
}

/** Checks whether D3 has resolved both linked node IDs into positioned node objects. */
function hasResolvedEndpoints(link: PositionedGraphLink): boolean {
  return endpointNode(link.source) !== null && endpointNode(link.target) !== null;
}

/** Moves link endpoints from node centers to circle edges so arrows touch the node boundary. */
function linkEndpointX(link: PositionedGraphLink, endpoint: LinkEndpoint): number {
  return linkEndpointCoordinate(link, endpoint).x;
}

/** Moves link endpoints from node centers to circle edges so arrows touch the node boundary. */
function linkEndpointY(link: PositionedGraphLink, endpoint: LinkEndpoint): number {
  return linkEndpointCoordinate(link, endpoint).y;
}

/** Computes the clipped point where a link should meet a source or target node. */
function linkEndpointCoordinate(link: PositionedGraphLink, endpoint: LinkEndpoint): { x: number; y: number } {
  const source = endpointNode(link.source);
  const target = endpointNode(link.target);

  if (!source || !target) {
    return { x: centerX, y: centerY };
  }

  const sourceX = nodeX(source);
  const sourceY = nodeY(source);
  const targetX = nodeX(target);
  const targetY = nodeY(target);
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    const node = endpoint === "source" ? source : target;
    return { x: nodeX(node), y: nodeY(node) };
  }

  const node = endpoint === "source" ? source : target;
  const direction = endpoint === "source" ? 1 : -1;
  const radius = nodeRadius(node);

  return {
    x: nodeX(node) + (dx / distance) * radius * direction,
    y: nodeY(node) + (dy / distance) * radius * direction
  };
}

/** Provides user-facing relationship names for legends, tooltips, and detail cards. */
function edgeLabel(type: EdgeType): string {
  switch (type) {
    case "borrowed_from":
      return "borrowed from";
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

/** Produces stable CSS hooks so relationship type can be visible without text on every edge. */
function edgeTypeClass(type: EdgeType): string {
  return `type-${type.replaceAll("_", "-")}`;
}

/** Finds the selected node's direct relationships without depending on D3's mutable endpoint objects. */
function selectedRelationshipForLink(
  link: PositionedGraphLink,
  selectedId: string,
  graphNodesById: Map<string, PositionedGraphNode>
): SelectedNodeRelationship[] {
  if (link.sourceNodeId === selectedId) {
    const otherNode = graphNodesById.get(link.targetNodeId);

    return otherNode
      ? [{ id: link.id, type: link.type, otherNode, uncertain: link.uncertain }]
      : [];
  }

  if (link.targetNodeId === selectedId) {
    if (isSourceDirectedEdgeType(link.type)) {
      return [];
    }

    const otherNode = graphNodesById.get(link.sourceNodeId);

    return otherNode
      ? [{ id: link.id, type: link.type, otherNode, uncertain: link.uncertain }]
      : [];
  }

  return [];
}

/** Keeps relationship rows concise while preserving language context. */
function relationshipNodeLabel(node: PositionedGraphNode): string {
  return `${node.word} (${node.langName ?? node.langCode})`;
}

/** Selects a node so dense lexical metadata can live outside the graph label. */
function selectNode(node: PositionedGraphNode): void {
  selectedNodeId.value = node.id;
}

/** Separates click selection from drag release so repositioning a node does not reopen details. */
function handleNodeClick(node: PositionedGraphNode): void {
  if (suppressNextNodeClick.value) {
    suppressNextNodeClick.value = false;
    return;
  }

  selectNode(node);
}

/** Clears the detail card without rebuilding or disturbing the graph simulation. */
function clearSelectedNode(): void {
  selectedNodeId.value = undefined;
}

/** Starts direct node movement while keeping the background viewport from panning. */
function startNodeDrag(event: PointerEvent, node: PositionedGraphNode): void {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  nodeDragState.value = {
    pointerId: event.pointerId,
    nodeId: node.id,
    lastPoint: clientPointToGraphPoint(event.clientX, event.clientY),
    hasMoved: false
  };
  node.fx = nodeX(node);
  node.fy = nodeY(node);
  captureNodePointer(event.currentTarget, event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

/** Moves the active node in graph coordinates so dragging stays accurate through pan and zoom. */
function dragNode(event: PointerEvent, node: PositionedGraphNode): void {
  const dragState = nodeDragState.value;

  if (!dragState || dragState.pointerId !== event.pointerId || dragState.nodeId !== node.id) {
    return;
  }

  const point = clientPointToGraphPoint(event.clientX, event.clientY);
  const deltaX = point.x - dragState.lastPoint.x;
  const deltaY = point.y - dragState.lastPoint.y;
  const nextX = nodeX(node) + deltaX;
  const nextY = nodeY(node) + deltaY;

  node.x = nextX;
  node.y = nextY;
  node.fx = nextX;
  node.fy = nextY;
  node.preferredSiblingPosition = graphLayoutOrientation.value === "horizontal" ? nextY : nextX;
  dragState.lastPoint = point;
  dragState.hasMoved = dragState.hasMoved || Math.hypot(deltaX, deltaY) > 1;
  tickVersion.value += 1;
  event.preventDefault();
  event.stopPropagation();
}

/** Finishes node dragging and leaves the node pinned until this graph is rebuilt. */
function endNodeDrag(event: PointerEvent, node: PositionedGraphNode): void {
  const dragState = nodeDragState.value;

  if (!dragState || dragState.pointerId !== event.pointerId || dragState.nodeId !== node.id) {
    return;
  }

  suppressNextNodeClick.value = dragState.hasMoved;
  nodeDragState.value = undefined;
  releaseNodePointer(event.currentTarget, event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

/** Checks whether a node is the one currently following the pointer. */
function isNodeDragging(node: PositionedGraphNode): boolean {
  return nodeDragState.value?.nodeId === node.id;
}

/** Converts browser coordinates into the graph coordinate system inside the zoomed viewport. */
function clientPointToGraphPoint(clientX: number, clientY: number): GraphPoint {
  const svg = svgRef.value;

  if (!svg) {
    return { x: centerX, y: centerY };
  }

  const rect = svg.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    return { x: centerX, y: centerY };
  }

  const viewportX = ((clientX - rect.left) / rect.width) * canvasWidth;
  const viewportY = ((clientY - rect.top) / rect.height) * canvasHeight;

  return {
    x: (viewportX - panX.value) / zoom.value,
    y: (viewportY - panY.value) / zoom.value
  };
}

/** Keeps node drag events flowing after the pointer leaves the circle or label. */
function captureNodePointer(target: EventTarget | null, pointerId: number): void {
  if (!(target instanceof Element)) {
    return;
  }

  target.setPointerCapture(pointerId);
}

/** Releases capture once a node drag ends or is cancelled. */
function releaseNodePointer(target: EventTarget | null, pointerId: number): void {
  if (!(target instanceof Element) || !target.hasPointerCapture(pointerId)) {
    return;
  }

  target.releasePointerCapture(pointerId);
}

/** Routes context-menu selections back to the owning view so GraphCanvas stays data-agnostic. */
function handleNodeContextAction(item: { value: string }): void {
  const node = contextNode.value;

  if (!node || !isNodeContextAction(item.value)) {
    return;
  }

  switch (item.value) {
    case "load-children":
      emit("load-children", node);
      return;
    case "view-etymology":
      emit("view-etymology", node);
      return;
    case "view-doublets":
      emit("view-doublets", node);
      return;
    default: {
      const exhaustiveValue: never = item.value;
      throw new Error(`Unhandled graph node context action: ${exhaustiveValue}`);
    }
  }
}

/** Narrows reusable menu values to the graph actions this component emits. */
function isNodeContextAction(value: string): value is NodeContextAction {
  return value === "load-children" || value === "view-etymology" || value === "view-doublets";
}

/** Tracks which graph node supplied Zag's active context-menu trigger value. */
function handleNodeContextTriggerChange(value: string | null): void {
  contextNodeId.value = value ?? undefined;
}

/** Supports keyboard selection for graph nodes exposed as SVG buttons. */
function handleNodeKeydown(event: KeyboardEvent, node: PositionedGraphNode): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  selectNode(node);
}

/** Builds a compact accessible label for node buttons. */
function nodeAriaLabel(node: PositionedGraphNode): string {
  const details = [
    node.word,
    node.langName ?? node.langCode,
    formatIpa(node),
    node.lexicalSummary?.pos,
    node.lexicalSummary?.definition
  ].filter((part) => part !== undefined && part.length > 0);

  return details.join(", ");
}

/** Formats IPA with its Wiktionary accent or region label when available. */
function formatIpa(node: PositionedGraphNode): string | undefined {
  const ipa = node.lexicalSummary?.ipa;

  if (!ipa) {
    return undefined;
  }

  return node.lexicalSummary?.ipaLabel ? `${ipa} ${node.lexicalSummary.ipaLabel}` : ipa;
}
</script>

<template>
  <div class="graph-canvas" :class="{ 'is-expanded': isGraphExpanded }">
    <div v-if="showControls" class="graph-controls" role="group" aria-label="Graph controls">
      <IconButton label="Zoom out" size="sm" @click="zoomOut">
        <Minus :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
      <output class="font-label" aria-live="polite">{{ zoomPercentage }}%</output>
      <IconButton label="Zoom in" size="sm" @click="zoomIn">
        <Plus :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
      <IconButton label="Reset viewport" size="sm" @click="resetViewport">
        <RotateCcw :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
      <IconButton :label="expandButtonLabel" size="sm" :active="isGraphExpanded" @click="toggleGraphExpanded">
        <Minimize2 v-if="isGraphExpanded" :size="16" stroke-width="2.75" aria-hidden="true" />
        <Maximize2 v-else :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
      <Popover v-model:open="isGraphGuideOpen" :close-on-interact-outside="false">
        <template #trigger="{ triggerProps, isOpen }">
          <IconButton v-bind="triggerProps" label="Graph guide" size="sm" :active="isOpen">
            <CircleHelp :size="16" stroke-width="2.75" aria-hidden="true" />
          </IconButton>
        </template>

        <template #default="{ titleProps, descriptionProps, api }">
          <div class="graph-guide-card relative">
            <IconButton class="absolute -top-1.5 -right-1.5" label="Close" size="xs" v-bind="api.getCloseTriggerProps()">
              <X :size="16" stroke-width="2.75" aria-hidden="true" />
            </IconButton>
            <p v-bind="titleProps" class="graph-guide-title font-label">Graph guide</p>
            <dl v-bind="descriptionProps">
              <div>
                <dt class="font-label">Click</dt>
                <dd>View term details.</dd>
              </div>
              <div>
                <dt class="font-label">Drag node</dt>
                <dd>Reposition it until the graph reloads.</dd>
              </div>
              <div>
                <dt class="font-label">Right-click</dt>
                <dd>Open node actions.</dd>
              </div>
              <div>
                <dt class="font-label">Edges</dt>
                <dd>Point from a term toward its source.</dd>
              </div>
              <div>
                <dt class="font-label">Dashed edge</dt>
                <dd>Marks an uncertain relationship.</dd>
              </div>
              <div>
                <dt class="font-label">Relationships</dt>
                <dd>
                  <ul class="relationship-key" aria-label="Relationship type legend">
                    <li v-for="item in edgeLegendItems" :key="item.type">
                      <span class="relationship-key-mark" :class="edgeTypeClass(item.type)" aria-hidden="true"></span>
                      <span>{{ item.label }}</span>
                    </li>
                  </ul>
                </dd>
              </div>
              <div>
                <dt class="font-label">Pan and zoom</dt>
                <dd>Drag, wheel, pinch, or use keyboard shortcuts.</dd>
              </div>
            </dl>
          </div>
        </template>
      </Popover>
    </div>

    <ContextMenu
      ref="nodeContextMenu"
      v-model:open="isNodeContextMenuOpen"
      label="Graph node actions"
      :items="nodeContextMenuItems"
      @trigger-value-change="handleNodeContextTriggerChange"
      @select="handleNodeContextAction"
    >
      <template #trigger="{ getContextTriggerProps }">
        <svg
          ref="svgRef"
          class="graph-svg"
          :class="{ 'is-panning': isPanning }"
          :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
          role="img"
          tabindex="0"
          aria-keyshortcuts="+ - ArrowUp ArrowDown ArrowLeft ArrowRight 0 Home"
          :aria-label="`Force-directed etymology graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges. Drag or use two fingers to pan. Pinch, double-click, or press control and wheel to zoom. Use plus, minus, arrow keys, or zero when focused.`"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
          @lostpointercapture="handlePointerUp"
          @wheel="handleWheel"
          @dblclick="handleDoubleClick"
          @keydown="handleKeydown"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker
              v-for="item in edgeLegendItems"
              :id="`arrowhead-${edgeTypeClass(item.type)}`"
              :key="item.type"
              class="relationship-marker"
              :class="edgeTypeClass(item.type)"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <pattern id="graph-map-grid" width="160" height="160" patternUnits="userSpaceOnUse">
              <path class="graph-map-grid-minor" d="M 32 0 V 160 M 64 0 V 160 M 96 0 V 160 M 128 0 V 160 M 0 32 H 160 M 0 64 H 160 M 0 96 H 160 M 0 128 H 160" />
              <path class="graph-map-grid-major" d="M 0 0 H 160 V 160 H 0 Z" />
            </pattern>
            <pattern id="graph-map-routes" width="260" height="190" patternUnits="userSpaceOnUse">
              <path class="graph-map-route-line" d="M -20 148 C 58 118 74 54 156 72 C 204 82 222 38 280 24" />
              <path class="graph-map-route-line alternate" d="M 22 -10 C 46 50 112 72 126 126 C 136 166 190 184 258 154" />
            </pattern>
          </defs>

          <g class="graph-viewport" :transform="viewportTransform">
            <rect
              class="graph-map-plane"
              :x="-canvasWidth"
              :y="-canvasHeight"
              :width="canvasWidth * 3"
              :height="canvasHeight * 3"
              fill="url(#graph-map-grid)"
            />
            <rect
              class="graph-map-plane graph-map-routes"
              :x="-canvasWidth"
              :y="-canvasHeight"
              :width="canvasWidth * 3"
              :height="canvasHeight * 3"
              fill="url(#graph-map-routes)"
            />
            <g class="graph-links">
              <g v-for="link in renderedLinks" :key="link.id">
                <line
                  v-if="hasResolvedEndpoints(link)"
                  :class="[edgeTypeClass(link.type), { uncertain: link.uncertain }]"
                  :x1="linkEndpointX(link, 'target')"
                  :y1="linkEndpointY(link, 'target')"
                  :x2="linkEndpointX(link, 'source')"
                  :y2="linkEndpointY(link, 'source')"
                />
                <title>{{ edgeLabel(link.type) }}</title>
              </g>
            </g>

            <g class="graph-nodes">
              <g
                v-for="node in renderedNodes"
                :key="node.id"
                v-bind="getContextTriggerProps({ value: node.id })"
                class="graph-node"
                :class="{
                  root: node.id === rootNodeId,
                  selected: node.id === selectedNodeId,
                  'context-open': node.id === contextNodeId && isNodeContextMenuOpen,
                  dragging: isNodeDragging(node)
                }"
                :transform="`translate(${nodeX(node)}, ${nodeY(node)})`"
                role="button"
                tabindex="0"
                :aria-label="nodeAriaLabel(node)"
                @click.stop="handleNodeClick(node)"
                @pointerdown.stop="startNodeDrag($event, node)"
                @pointermove.stop="dragNode($event, node)"
                @pointerup.stop="endNodeDrag($event, node)"
                @pointercancel.stop="endNodeDrag($event, node)"
                @lostpointercapture.stop="endNodeDrag($event, node)"
                @dblclick.stop
                @keydown="handleNodeKeydown($event, node)"
              >
                <circle :r="nodeRadius(node)" />
                <text :y="nodeRadius(node) + 18" text-anchor="middle">
                  {{ node.word }}
                </text>
                <text class="node-lang font-label" :y="nodeRadius(node) + 34" text-anchor="middle">
                  {{ node.langName ?? node.langCode }}
                </text>
                <text v-if="formatIpa(node)" class="node-ipa" :y="nodeRadius(node) + 50" text-anchor="middle">
                  {{ formatIpa(node) }}
                </text>
              </g>
            </g>
          </g>
        </svg>
      </template>
    </ContextMenu>

    <aside v-if="selectedNode" class="node-detail-card" aria-live="polite">
      <div class="flex items-center justify-between">
        <p class="node-detail-kicker font-label">{{ selectedNode.langName ?? selectedNode.langCode }}</p>
        <IconButton label="Close" size="sm" @click="clearSelectedNode">
          <X :size="16" stroke-width="2.75" aria-hidden="true" />
        </IconButton>
      </div>
      <div class="node-detail-heading">
        <h3>{{ selectedNode.word }}</h3>
      </div>

      <dl>
        <div v-if="formatIpa(selectedNode)">
          <dt class="font-label">Pronunciation</dt>
          <dd>{{ formatIpa(selectedNode) }}</dd>
        </div>
        <div v-if="selectedNode.lexicalSummary?.pos">
          <dt class="font-label">Part of speech</dt>
          <dd>{{ selectedNode.lexicalSummary.pos }}</dd>
        </div>
        <div v-if="selectedNode.lexicalSummary?.definition">
          <dt class="font-label">Definition</dt>
          <dd>{{ selectedNode.lexicalSummary.definition }}</dd>
        </div>
        <div v-if="selectedNode.lexicalSummary?.entryCount && selectedNode.lexicalSummary.entryCount > 1">
          <dt class="font-label">Entries</dt>
          <dd>{{ selectedNode.lexicalSummary.entryCount }} lexical entries imported</dd>
        </div>
        <div v-if="selectedNodeRelationships.length > 0">
          <dt class="font-label">Relationships</dt>
          <dd>
            <ul class="selected-relationships">
              <li v-for="relationship in selectedNodeRelationships" :key="relationship.id" class="selected-relationship">
                <Badge variant="custom" class="relationship-badge" :class="edgeTypeClass(relationship.type)">
                  {{ edgeLabel(relationship.type) }}
                </Badge>
                <span class="relationship-target">
                  {{ relationshipNodeLabel(relationship.otherNode) }}
                </span>
                <span v-if="relationship.uncertain" class="relationship-uncertainty">
                  (<Badge variant="custom" class="relationship-badge type-uncertain">Uncertain</Badge>)
                </span>
              </li>
            </ul>
          </dd>
        </div>
      </dl>
    </aside>

  </div>
</template>

<style scoped>
.graph-canvas {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  z-index: 0;
  border-radius: 6px;
  background:
    radial-gradient(ellipse at 50% 42%, transparent 58%, color-mix(in oklch, var(--theme-text) 6%, transparent) 100%),
    linear-gradient(135deg, color-mix(in oklch, var(--theme-surface-muted) 82%, var(--theme-background)) 0%, var(--theme-surface) 100%);
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--theme-surface-raised) 72%, transparent);
}

.graph-canvas.is-expanded {
  position: fixed;
  inset: 0;
  z-index: 900;
  border: 0;
  border-radius: 0;
}

.graph-canvas::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
}

.graph-canvas::after {
  opacity: 0.18;
  background-image:
    radial-gradient(color-mix(in oklch, var(--theme-text) 12%, transparent) 0.7px, transparent 0.8px),
    radial-gradient(color-mix(in oklch, var(--theme-surface-raised) 80%, transparent) 0.7px, transparent 0.8px);
  background-position:
    0 0,
    11px 17px;
  background-size:
    19px 23px,
    29px 31px;
}

.graph-map-plane {
  pointer-events: none;
  opacity: 0.42;
}

.graph-map-routes {
  opacity: 0.24;
}

.graph-map-grid-minor,
.graph-map-grid-major,
.graph-map-route-line {
  fill: none;
  vector-effect: non-scaling-stroke;
}

.graph-map-grid-minor {
  stroke: color-mix(in oklch, var(--theme-border) 38%, transparent);
  stroke-width: 0.8;
}

.graph-map-grid-major {
  stroke: color-mix(in oklch, var(--theme-border-strong) 28%, transparent);
  stroke-width: 1;
}

.graph-map-route-line {
  stroke: color-mix(in oklch, var(--theme-borrowed) 34%, transparent);
  stroke-dasharray: 9 11;
  stroke-linecap: round;
  stroke-width: 1.1;
}

.graph-map-route-line.alternate {
  stroke: color-mix(in oklch, var(--theme-ancestor) 28%, transparent);
  stroke-dasharray: 2 13;
}

.graph-controls {
  position: absolute;
  z-index: 10;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px solid color-mix(in oklch, var(--theme-border) 82%, transparent);
  border-radius: 999px;
  background: color-mix(in oklch, var(--theme-surface) 88%, transparent);
  box-shadow: 0 1px 2px color-mix(in oklch, var(--theme-text) 14%, transparent);
}

.graph-controls output {
  min-width: 34px;
  min-height: 34px;
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 700;
}

.graph-controls output {
  display: grid;
  min-width: 54px;
  place-items: center;
  color: var(--theme-text-muted);
}

.graph-guide-card {
  width: min(300px, calc(100vw - 48px));
}

.graph-guide-title {
  margin: 0 0 8px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.graph-guide-card dl {
  display: grid;
  gap: 7px;
  margin: 0;
}

.graph-guide-card div {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 10px;
}

.graph-guide-card dt {
  color: var(--theme-text);
  font-size: 12px;
  font-weight: 700;
}

.graph-guide-card dd {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.relationship-key {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.relationship-key li {
  display: flex;
  align-items: center;
  gap: 7px;
}

.relationship-key-mark {
  width: 26px;
  height: 0;
  border-top: 3px solid var(--relationship-color, var(--theme-graph-edge));
  border-radius: 999px;
}

.graph-svg {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  min-height: 360px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.graph-canvas.is-expanded .graph-svg {
  height: 100%;
  min-height: 100dvh;
}

.graph-svg.is-panning {
  cursor: grabbing;
}

.graph-svg:focus-visible {
  outline: 3px solid color-mix(in oklch, var(--theme-accent) 42%, transparent);
  outline-offset: -6px;
}

marker path {
  fill: var(--theme-graph-edge);
}

.relationship-marker path {
  fill: var(--relationship-color, var(--theme-graph-edge));
}

.graph-links line {
  stroke: color-mix(in oklch, var(--relationship-color, var(--theme-graph-edge)) 72%, transparent);
  stroke-linecap: round;
  stroke-width: 2;
}

.type-inherited-from {
  --relationship-color: var(--theme-inherited);
  marker-end: url("#arrowhead-type-inherited-from");
}

.type-derived-from {
  --relationship-color: var(--theme-derived);
  marker-end: url("#arrowhead-type-derived-from");
}

.type-borrowed-from {
  --relationship-color: var(--theme-borrowed);
  marker-end: url("#arrowhead-type-borrowed-from");
}

.type-cognate-with {
  --relationship-color: color-mix(in oklch, var(--theme-descendant) 70%, var(--theme-accent));
  marker-end: url("#arrowhead-type-cognate-with");
}

.type-doublet-of {
  --relationship-color: var(--theme-accent);
  marker-end: url("#arrowhead-type-doublet-of");
}

.type-descendant-of {
  --relationship-color: var(--theme-descendant);
  marker-end: url("#arrowhead-type-descendant-of");
}

.type-related-to {
  --relationship-color: color-mix(in oklch, var(--theme-graph-edge) 84%, var(--theme-text-muted));
  marker-end: url("#arrowhead-type-related-to");
}

.type-see-also {
  --relationship-color: color-mix(in oklch, var(--theme-graph-edge) 62%, var(--theme-border-strong));
  marker-end: url("#arrowhead-type-see-also");
}

marker.type-inherited-from path {
  fill: var(--theme-inherited);
}

marker.type-derived-from path {
  fill: var(--theme-derived);
}

marker.type-borrowed-from path {
  fill: var(--theme-borrowed);
}

marker.type-cognate-with path {
  fill: color-mix(in oklch, var(--theme-descendant) 70%, var(--theme-accent));
}

marker.type-doublet-of path {
  fill: var(--theme-accent);
}

marker.type-descendant-of path {
  fill: var(--theme-descendant);
}

marker.type-related-to path {
  fill: color-mix(in oklch, var(--theme-graph-edge) 84%, var(--theme-text-muted));
}

marker.type-see-also path {
  fill: color-mix(in oklch, var(--theme-graph-edge) 62%, var(--theme-border-strong));
}

.graph-links line.uncertain {
  stroke-dasharray: 6 7;
}

.graph-node {
  cursor: grab;
  outline: none;
}

.graph-node.dragging {
  cursor: grabbing;
}

.graph-node circle {
  fill: var(--theme-graph-node);
  stroke: var(--theme-descendant);
  stroke-width: 3;
  transition:
    fill 160ms ease,
    filter 160ms ease,
    stroke 160ms ease,
    stroke-width 160ms ease;
  filter: drop-shadow(0 1px 2px color-mix(in oklch, var(--theme-text) 16%, transparent));
}

.graph-node:hover circle,
.graph-node:focus-visible circle {
  fill: var(--theme-surface-raised);
  stroke: var(--theme-accent);
  stroke-width: 5;
  filter: drop-shadow(0 2px 4px color-mix(in oklch, var(--theme-text) 22%, transparent));
}

.graph-node.root circle {
  fill: var(--theme-graph-root);
  stroke: var(--theme-ancestor);
  stroke-width: 4;
}

.graph-node.root:hover circle,
.graph-node.root:focus-visible circle {
  fill: color-mix(in oklch, var(--theme-graph-root) 86%, var(--theme-accent));
  stroke: var(--theme-accent);
  stroke-width: 5;
}

.graph-node.selected circle {
  stroke: var(--theme-accent);
  stroke-width: 5;
}

.graph-node.context-open circle {
  fill: var(--theme-surface-muted);
  stroke: var(--theme-accent);
  stroke-width: 5;
}

.graph-node.dragging circle {
  fill: var(--theme-surface-raised);
  stroke: var(--theme-accent);
  stroke-width: 5;
}

.graph-node text {
  fill: var(--theme-text);
  font-size: 18px;
  font-weight: 700;
  paint-order: stroke;
  stroke: color-mix(in oklch, var(--theme-surface) 88%, transparent);
  stroke-linejoin: round;
  stroke-width: 4px;
}

.graph-node.root text {
  fill: var(--theme-text);
}

.graph-node .node-lang {
  fill: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.graph-node .node-ipa {
  fill: color-mix(in oklch, var(--theme-ancestor) 72%, var(--theme-text-muted));
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.01em;
}

.node-detail-card {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 1;
  display: grid;
  width: min(360px, calc(100% - 32px));
  gap: 12px;
  padding: 16px;
  border: 1px solid color-mix(in oklch, var(--theme-border-strong) 82%, transparent);
  border-radius: 6px;
  background: color-mix(in oklch, var(--theme-surface-raised) 94%, transparent);
  box-shadow: var(--shadow-overlay);
}

.graph-canvas.is-expanded .node-detail-card {
  right: 20px;
  bottom: 20px;
  max-height: calc(100dvh - 112px);
  overflow: auto;
}

.node-detail-kicker {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.node-detail-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.node-detail-heading h3 {
  margin: 0;
  color: var(--theme-text);
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
}

.node-detail-card dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

.node-detail-card dt {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.node-detail-card dd {
  margin: 2px 0 0;
  color: var(--theme-text);
  font-size: 14px;
  line-height: 1.5;
}

.selected-relationships {
  display: grid;
  gap: 8px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.selected-relationship {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  white-space: nowrap;
  flex-wrap: wrap;
}

.relationship-target {
  color: var(--theme-text);
}

.relationship-badge {
  --badge-color: var(--relationship-color, var(--theme-graph-edge));
}

.relationship-uncertainty {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.type-uncertain {
  --badge-color: var(--theme-text-muted);
}
</style>
