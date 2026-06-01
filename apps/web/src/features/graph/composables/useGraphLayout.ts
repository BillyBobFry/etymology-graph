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
import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from "vue";

import { normalizeWord, type EdgeType, type EtymologyGraph, type GraphTraversalNode } from "@etymology-graph/graph";
import { graphCanvasHeight, graphCanvasWidth, graphNodeRadius } from "../graphCanvasConstants";
import type { GraphAnnotationPlacement, GraphAnnotationTone, GraphNodeAnnotation, GraphNodeAnnotationTarget } from "../graphAnnotations";
import { formatIpaPronunciation } from "../graphNodeDisplay";
import { isSourceDirectedEdgeType } from "../graphRelationshipDisplay";
import type { GraphViewportFrame } from "./useGraphViewport";

const centerX = graphCanvasWidth / 2;
const centerY = graphCanvasHeight / 2;
const initialSiblingSpacing = 74;
const initialDepthYSpacing = 64;
const depthBandSpacing = 92;
const horizontalDepthBandSpacing = 150;
const linearGraphXSpacing = 154;
const linearGraphYSpacing = 78;
const linearGraphMaxXSpan = 760;
const linearGraphMaxYSpan = 410;
const doubletArmDepthSpacing = 154;
const doubletArmLaneSpacing = 92;
const doubletArmMaxDepthSpan = 860;
const radialDepthSpacing = 156;
const radialArcSpacing = 118;
const radialMinimumDirectChildren = 3;
const radialMinimumDescendants = 6;
const labelClearanceRadius = 58;
const layoutWarmupTicks = 180;
const layeredOrderingPasses = 4;
const graphFitPadding = 64;
const graphFitMaxZoom = 2.4;
const graphFitTextHalfWidthPerCharacter = 4.2;
export const graphAnnotationCalloutWidth = 228;
export const graphAnnotationCalloutHeight = 118;
const annotationCalloutGap = 48;
const annotationCalloutVerticalLift = 112;
const annotationCollisionPadding = 18;
const annotationAnchorLinkDistance = 150;

export type GraphLayoutOrientation = "horizontal" | "vertical";
export type GraphLayoutPreset = "auto" | "doublet-arms";

export type PositionedGraphNode = GraphTraversalNode &
  SimulationNodeDatum & {
    layoutKind: "term";
    preferredSiblingPosition: number;
  };

export type PositionedGraphLink = SimulationLinkDatum<PositionedGraphNode> & {
  id: string;
  layoutKind: "term";
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  uncertain: boolean;
};

export type PositionedGraphAnnotation = {
  annotation: GraphNodeAnnotation;
  node: PositionedGraphNode;
  calloutX: number;
  calloutY: number;
  anchorX: number;
  anchorY: number;
  lineEndX: number;
  lineEndY: number;
};

export type LinkEndpoint = "source" | "target";

type PositionedAnnotationNode = SimulationNodeDatum & {
  id: string;
  layoutKind: "annotation";
  annotation: GraphNodeAnnotation;
  anchorNode: PositionedGraphNode;
  anchorNodeId: string;
  targetX: number;
  targetY: number;
};

type LayoutSimulationNode = PositionedGraphNode | PositionedAnnotationNode;

type AnnotationLayoutLink = SimulationLinkDatum<LayoutSimulationNode> & {
  id: string;
  layoutKind: "annotation";
  sourceNodeId: string;
  targetNodeId: string;
};

type LayoutSimulationLink = PositionedGraphLink | AnnotationLayoutLink;

type GraphLayoutPoint = {
  x: number;
  y: number;
};

export type GraphBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type ViewportState = {
  panX: number;
  panY: number;
  zoom: number;
};

export type GraphLayoutPlan =
  | {
      shape: "linear";
      orderedNodeIds: string[];
      orientation: GraphLayoutOrientation;
    }
  | {
      shape: "doublet-arms";
      rootNodeId: string;
      nodePositions: Map<string, GraphLayoutPoint>;
    }
  | {
      shape: "radial";
      rootNodeId: string;
      depthOrders: Map<number, string[]>;
    }
  | {
      shape: "force";
    };

type GraphLayoutOptions = {
  selectedNodeId: Ref<string | undefined>;
  contextNodeId: Ref<string | undefined>;
  viewportFrame: ComputedRef<GraphViewportFrame>;
  setHomeViewport: (viewport: ViewportState) => void;
  onFreshLayout: () => void;
};

type BuildSimulationOptions = {
  layoutPreset?: GraphLayoutPreset;
  preserveExistingLayout?: boolean;
  rootNodeId?: string;
  annotations?: GraphNodeAnnotation[];
};

/** Coordinates graph positioning so GraphCanvas can focus on orchestration and rendering. */
export function useGraphLayout(options: GraphLayoutOptions) {
  const nodes = ref<PositionedGraphNode[]>([]);
  const links = ref<PositionedGraphLink[]>([]);
  const annotationLayoutNodesRef = ref<PositionedAnnotationNode[]>([]);
  const tickVersion = ref(0);
  let simulation: Simulation<LayoutSimulationNode, LayoutSimulationLink> | null = null;
  let renderedLayoutOrientation: GraphLayoutOrientation | null = null;
  let renderedLayoutKey: string | null = null;

  const renderedNodes = computed(() => {
    tickVersion.value;
    return nodes.value;
  });

  const renderedLinks = computed(() => {
    tickVersion.value;
    return links.value;
  });

  const renderedAnnotations = computed(() => {
    tickVersion.value;
    return annotationLayoutNodesRef.value.map(positionedAnnotationFromNode);
  });
  const renderedNodeBounds = computed<GraphBounds | null>(() => {
    tickVersion.value;

    return nodes.value.length > 0 ? nodes.value.map(nodeVisualBounds).reduce(mergeGraphBounds) : null;
  });

  onBeforeUnmount(() => {
    stopSimulation();
  });

  /** Builds a fresh force layout whenever the user opens a different graph. */
  function buildSimulation(graph: EtymologyGraph, orientation: GraphLayoutOrientation, buildOptions: BuildSimulationOptions = {}): void {
    const previousNodesById = new Map(nodes.value.map((node) => [node.id, node]));
    const generationLevels = graphGenerationLevels(graph);
    const maxGenerationLevel = Math.max(1, ...generationLevels.values());
    const generationOrders = orderedGenerationNodeIds(graph, generationLevels, maxGenerationLevel);
    const preferredSiblingPositions = preferredNodeSiblingPositions(generationOrders, orientation);
    const layoutPlan = graphLayoutPlan(graph, generationLevels, {
      orientation,
      preset: buildOptions.layoutPreset ?? "auto",
      rootNodeId: buildOptions.rootNodeId
    });
    const layoutKey = graphLayoutPlanKey(layoutPlan);
    const canPreserveExistingLayout = buildOptions.preserveExistingLayout ?? true;
    const shouldPreserveLayout =
      canPreserveExistingLayout &&
      renderedLayoutOrientation === orientation &&
      renderedLayoutKey === layoutKey &&
      shouldPreserveExistingLayout(graph, previousNodesById);

    stopSimulation();

    const positionedNodes = graph.nodes.map((node) => {
      const generationLevel = generationLevels.get(node.id) ?? 0;
      const preferredSiblingPosition = preferredSiblingPositions.get(node.id) ?? siblingAxisCenter(orientation);
      const previousNode = shouldPreserveLayout ? previousNodesById.get(node.id) : undefined;

      if (previousNode) {
        return {
          ...node,
          layoutKind: "term" as const,
          preferredSiblingPosition: previousNode.preferredSiblingPosition,
          x: nodeX(previousNode),
          y: nodeY(previousNode),
          fx: previousNode.fx,
          fy: previousNode.fy
        };
      }

      return {
        ...node,
        layoutKind: "term" as const,
        preferredSiblingPosition,
        ...initialNodePosition(node.id, generationLevel, maxGenerationLevel, preferredSiblingPosition, orientation, layoutPlan)
      };
    });

    const annotationNodes = annotationLayoutNodes(buildOptions.annotations ?? [], positionedNodes);
    const positionedLinks: PositionedGraphLink[] = graph.edges.map((edge) => ({
      id: edge.id,
      layoutKind: "term",
      source: edge.fromNodeId,
      target: edge.toNodeId,
      sourceNodeId: edge.fromNodeId,
      targetNodeId: edge.toNodeId,
      type: edge.type,
      uncertain: edge.uncertain ?? false
    }));
    const annotationLinks = annotationNodes.map((node) => ({
      id: `${node.id}:anchor`,
      layoutKind: "annotation" as const,
      source: node.id,
      target: node.anchorNodeId,
      sourceNodeId: node.id,
      targetNodeId: node.anchorNodeId
    }));
    const layoutNodes: LayoutSimulationNode[] = [...positionedNodes, ...annotationNodes];
    const layoutLinks: LayoutSimulationLink[] = [...positionedLinks, ...annotationLinks];

    simulation = forceSimulation<LayoutSimulationNode, LayoutSimulationLink>(layoutNodes)
      .force(
        "link",
        forceLink<LayoutSimulationNode, LayoutSimulationLink>(layoutLinks)
          .id((node) => node.id)
          .distance((link) => link.layoutKind === "annotation" ? annotationAnchorLinkDistance : linkDistance(link.type))
          .strength(linkStrength(layoutPlan))
      )
      .force("charge", forceManyBody<LayoutSimulationNode>().strength((node) => chargeStrength(layoutPlan, node)))
      .force("collide", forceCollide<LayoutSimulationNode>((node) => collisionRadius(node)).strength(0.95).iterations(3))
      .force("center", forceCenter(centerX, centerY))
      .force("siblingX", siblingForceX(orientation, layoutPlan))
      .force("generationX", generationForceX(generationLevels, maxGenerationLevel, orientation, layoutPlan))
      .force("siblingY", siblingForceY(orientation, layoutPlan))
      .force("generationY", generationForceY(generationLevels, maxGenerationLevel, orientation, layoutPlan))
      .force("shapeX", shapeForceX(layoutPlan))
      .force("shapeY", shapeForceY(layoutPlan))
      .force("annotationX", annotationForceX())
      .force("annotationY", annotationForceY())
      .stop();

    const restoredPins = shouldPreserveLayout ? pinExistingNodesForWarmup(positionedNodes, previousNodesById) : [];

    simulation.tick(layoutWarmupTicks);
    restoreNodePins(restoredPins);

    nodes.value = positionedNodes;
    links.value = positionedLinks;
    annotationLayoutNodesRef.value = annotationNodes;
    options.selectedNodeId.value = shouldPreserveLayout ? retainedNodeId(options.selectedNodeId.value, positionedNodes) : undefined;
    options.contextNodeId.value = shouldPreserveLayout ? retainedNodeId(options.contextNodeId.value, positionedNodes) : undefined;

    if (!shouldPreserveLayout) {
      options.onFreshLayout();
      fitLayoutToViewport();
    }

    requestRenderTick();
    renderedLayoutOrientation = orientation;
    renderedLayoutKey = layoutKey;
  }

  /** Recomputes the graph layout from source data and drops user-created node pins. */
  function resetLayout(graph: EtymologyGraph, orientation: GraphLayoutOrientation, buildOptions: BuildSimulationOptions = {}): void {
    buildSimulation(graph, orientation, { ...buildOptions, preserveExistingLayout: false });
  }

  /** Rehomes the current graph when the rendered SVG frame changes shape. */
  function fitLayoutToViewport(extraBounds: GraphBounds[] = []): void {
    options.setHomeViewport(fittedViewportForNodes(nodes.value, options.viewportFrame.value, [
      ...annotationVisualBounds(renderedAnnotations.value),
      ...extraBounds
    ]));
  }

  /** Marks D3-mutated coordinates as ready for Vue to read. */
  function requestRenderTick(): void {
    tickVersion.value += 1;
  }

  /** Moves callout layout nodes with a manually dragged anchor so labels stay visually attached. */
  function moveAnchoredAnnotations(anchorNodeId: string, deltaX: number, deltaY: number): void {
    for (const annotationNode of annotationLayoutNodesRef.value) {
      if (annotationNode.anchorNodeId !== anchorNodeId) {
        continue;
      }

      annotationNode.x = layoutNodeX(annotationNode) + deltaX;
      annotationNode.y = layoutNodeY(annotationNode) + deltaY;
      annotationNode.targetX += deltaX;
      annotationNode.targetY += deltaY;
    }
  }

  /** Stops the old simulation so background ticks do not keep mutating stale nodes. */
  function stopSimulation(): void {
    if (!simulation) {
      return;
    }

    simulation.stop();
    simulation = null;
  }

  return {
    nodes,
    links,
    renderedNodes,
    renderedLinks,
    renderedAnnotations,
    renderedNodeBounds,
    buildSimulation,
    resetLayout,
    fitLayoutToViewport,
    requestRenderTick,
    moveAnchoredAnnotations,
    nodeX,
    nodeY,
    hasResolvedEndpoints,
    linkEndpointX,
    linkEndpointY
  };
}

/** Computes the initial map transform so the whole rendered graph starts in view. */
function fittedViewportForNodes(
  positionedNodes: PositionedGraphNode[],
  viewportFrame: GraphViewportFrame,
  extraBounds: GraphBounds[] = []
): ViewportState {
  if (positionedNodes.length === 0 && extraBounds.length === 0) {
    return { panX: 0, panY: 0, zoom: 1 };
  }

  const bounds = [...positionedNodes.map(nodeVisualBounds), ...extraBounds].reduce(mergeGraphBounds);
  const boundsWidth = bounds.maxX - bounds.minX + graphFitPadding * 2;
  const boundsHeight = bounds.maxY - bounds.minY + graphFitPadding * 2;
  const fittedZoom = Math.min(graphFitMaxZoom, viewportFrame.width / boundsWidth, viewportFrame.height / boundsHeight);
  const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
  const boundsCenterY = (bounds.minY + bounds.maxY) / 2;
  const viewportCenterX = viewportFrame.x + viewportFrame.width / 2;
  const viewportCenterY = viewportFrame.y + viewportFrame.height / 2;

  return {
    panX: viewportCenterX - boundsCenterX * fittedZoom,
    panY: viewportCenterY - boundsCenterY * fittedZoom,
    zoom: fittedZoom
  };
}

/** Estimates each node's rendered footprint, including labels below the circle. */
function nodeVisualBounds(node: PositionedGraphNode): GraphBounds {
  const x = nodeX(node);
  const y = nodeY(node);
  const radius = graphNodeRadius;
  const textHalfWidth = estimatedNodeTextHalfWidth(node);
  const visualHalfWidth = Math.max(radius, textHalfWidth);
  const labelBottom = radius + (formatIpaPronunciation(node) ? 56 : 40);

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
    formatIpaPronunciation(node)?.length ?? 0
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

/** Resolves editorial annotations into render-only layout nodes anchored to graph term nodes. */
function annotationLayoutNodes(
  annotations: GraphNodeAnnotation[],
  positionedNodes: PositionedGraphNode[]
): PositionedAnnotationNode[] {
  return annotations.flatMap((annotation) => {
    const anchorNode = findAnnotatedNode(annotation, positionedNodes);

    if (!anchorNode) {
      return [];
    }

    const anchorX = nodeX(anchorNode);
    const anchorY = nodeY(anchorNode);
    const target = annotationTargetPosition(annotation.placement ?? defaultAnnotationPlacement(annotation.tone), anchorX, anchorY);

    return [
      {
        id: `annotation:${annotation.id}`,
        layoutKind: "annotation" as const,
        annotation,
        anchorNode,
        anchorNodeId: anchorNode.id,
        targetX: target.x,
        targetY: target.y,
        x: target.x,
        y: target.y
      }
    ];
  });
}

/** Matches an annotation to the first available graph node target, including fallbacks. */
function findAnnotatedNode(
  annotation: GraphNodeAnnotation,
  positionedNodes: PositionedGraphNode[]
): PositionedGraphNode | undefined {
  const targets = [annotation.target, ...(annotation.fallbackTargets ?? [])];

  for (const target of targets) {
    const node = findNodeTarget(target, positionedNodes);

    if (node) {
      return node;
    }
  }

  return undefined;
}

/** Resolves one annotation target against graph nodes using normalized term keys. */
function findNodeTarget(
  target: GraphNodeAnnotationTarget,
  positionedNodes: PositionedGraphNode[]
): PositionedGraphNode | undefined {
  const normalizedTargetWord = normalizeWord(target.word);

  return positionedNodes.find(
    (node) => node.langCode === target.langCode && node.normalizedWord === normalizedTargetWord
  );
}

/** Converts a settled annotation layout node into the card/leader-line coordinates used by the renderer. */
function positionedAnnotationFromNode(node: PositionedAnnotationNode): PositionedGraphAnnotation {
  const anchorX = nodeX(node.anchorNode);
  const anchorY = nodeY(node.anchorNode);
  const centerX = layoutNodeX(node);
  const centerY = layoutNodeY(node);
  const calloutX = centerX - graphAnnotationCalloutWidth / 2;
  const calloutY = centerY - graphAnnotationCalloutHeight / 2;
  const lineStartX = anchorX < centerX ? calloutX : calloutX + graphAnnotationCalloutWidth;
  const lineStartY = clamp(anchorY, calloutY + 14, calloutY + graphAnnotationCalloutHeight - 14);

  return {
    annotation: node.annotation,
    node: node.anchorNode,
    calloutX,
    calloutY,
    anchorX: lineStartX,
    anchorY: lineStartY,
    lineEndX: anchorX + Math.sign(lineStartX - anchorX || 1) * graphNodeRadius,
    lineEndY: anchorY
  };
}

/** Computes fixed targets for annotation cards before the force simulation relaxes them. */
function annotationTargetPosition(
  placement: GraphAnnotationPlacement,
  anchorX: number,
  anchorY: number
): GraphLayoutPoint {
  const isLeft = placement.endsWith("left");
  const isAbove = placement.startsWith("above");

  return {
    x: anchorX + (isLeft ? -graphAnnotationCalloutWidth / 2 - annotationCalloutGap : graphAnnotationCalloutWidth / 2 + annotationCalloutGap),
    y: anchorY + (isAbove ? -annotationCalloutVerticalLift : annotationCalloutVerticalLift)
  };
}

/** Gives annotation tones stable default sides before collision forces refine placement. */
function defaultAnnotationPlacement(tone: GraphAnnotationTone): GraphAnnotationPlacement {
  switch (tone) {
    case "shifted":
      return "above-right";
    case "unchanged":
      return "above-left";
    case "context":
      return "below-right";
    default: {
      const exhaustiveValue: never = tone;
      throw new Error(`Unhandled annotation tone: ${exhaustiveValue}`);
    }
  }
}

/** Calculates annotation card bounds so the initial viewport includes explanatory labels. */
function annotationVisualBounds(annotations: PositionedGraphAnnotation[]): GraphBounds[] {
  return annotations.map((annotation) => ({
    minX: annotation.calloutX,
    minY: annotation.calloutY,
    maxX: annotation.calloutX + graphAnnotationCalloutWidth,
    maxY: annotation.calloutY + graphAnnotationCalloutHeight
  }));
}

/** Restricts a value to an inclusive range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Type guard for render-only annotation nodes inside the D3 simulation. */
function isAnnotationNode(node: LayoutSimulationNode): node is PositionedAnnotationNode {
  return node.layoutKind === "annotation";
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

/** Tracks layout identity so explicit presets recompute when their chosen root changes. */
function graphLayoutPlanKey(layoutPlan: GraphLayoutPlan): string {
  switch (layoutPlan.shape) {
    case "linear":
      return `linear:${layoutPlan.orientation}:${layoutPlan.orderedNodeIds.join("|")}`;
    case "doublet-arms":
      return `doublet-arms:${layoutPlan.rootNodeId}`;
    case "radial":
      return `radial:${layoutPlan.rootNodeId}`;
    case "force":
      return "force";
  }
}

type GraphLayoutPlanOptions = {
  orientation: GraphLayoutOrientation;
  preset: GraphLayoutPreset;
  rootNodeId?: string;
};

/** Chooses the least surprising layout preset that matches the graph topology. */
export function graphLayoutPlan(
  graph: EtymologyGraph,
  generationLevels = graphGenerationLevels(graph),
  options: GraphLayoutPlanOptions = { orientation: "horizontal", preset: "auto" }
): GraphLayoutPlan {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const sourceEdges = graph.edges.filter(
    (edge) => isSourceDirectedEdgeType(edge.type) && nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)
  );

  if (graph.edges.length !== sourceEdges.length) {
    return { shape: "force" };
  }

  if (options.preset === "doublet-arms") {
    const doubletArmPlan = doubletArmLayoutPlan(graph, sourceEdges, options.orientation, options.rootNodeId);

    if (doubletArmPlan) {
      return doubletArmPlan;
    }
  }

  const linearOrder = linearSourcePathOrder(graph, sourceEdges);

  if (linearOrder) {
    return { shape: "linear", orderedNodeIds: linearOrder, orientation: options.orientation };
  }

  const radialRootId = radialSourceTreeRootId(graph, sourceEdges);

  if (!radialRootId) {
    return { shape: "force" };
  }

  return {
    shape: "radial",
    rootNodeId: radialRootId,
    depthOrders: radialDepthOrders(graph, sourceEdges, radialRootId, generationLevels)
  };
}

/** Builds a root-convergent layout for doublet graphs with several mostly linear arms. */
function doubletArmLayoutPlan(
  graph: EtymologyGraph,
  sourceEdges: EtymologyGraph["edges"],
  orientation: GraphLayoutOrientation,
  preferredRootNodeId: string | undefined
): GraphLayoutPlan | null {
  if (graph.nodes.length < 3 || sourceEdges.length === 0) {
    return null;
  }

  const sourceMap = sourceEdgeMap(sourceEdges);
  const rootNodeId = doubletArmRootNodeId(graph, sourceMap, preferredRootNodeId);

  if (!rootNodeId) {
    return null;
  }

  const depths = doubletArmDepths(rootNodeId, sourceMap.childrenByParentId, graph.nodes.length);

  if (!depths || depths.size !== graph.nodes.length) {
    return null;
  }

  const leafNodeIds = doubletArmLeafNodeIds(graph, sourceMap.childrenByParentId, depths);

  if (leafNodeIds.length < 2) {
    return null;
  }

  const laneIndexes = doubletArmLaneIndexes(leafNodeIds);
  const laneContributions = doubletArmLaneContributions(
    leafNodeIds,
    rootNodeId,
    laneIndexes,
    depths,
    sourceMap.parentsByChildId
  );

  if (!laneContributions) {
    return null;
  }

  return {
    shape: "doublet-arms",
    rootNodeId,
    nodePositions: doubletArmNodePositions(graph, rootNodeId, leafNodeIds, depths, laneContributions, orientation)
  };
}

type SourceEdgeMap = {
  childrenByParentId: Map<string, string[]>;
  parentsByChildId: Map<string, string[]>;
};

/** Indexes source-directed edges in both directions for root-to-leaf layout work. */
function sourceEdgeMap(sourceEdges: EtymologyGraph["edges"]): SourceEdgeMap {
  const childrenByParentId = new Map<string, string[]>();
  const parentsByChildId = new Map<string, string[]>();

  for (const edge of sourceEdges) {
    childrenByParentId.set(edge.toNodeId, [...(childrenByParentId.get(edge.toNodeId) ?? []), edge.fromNodeId]);
    parentsByChildId.set(edge.fromNodeId, [...(parentsByChildId.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  }

  return { childrenByParentId, parentsByChildId };
}

/** Finds the common source root, respecting an explicit root when it is a source sink. */
function doubletArmRootNodeId(
  graph: EtymologyGraph,
  sourceMap: SourceEdgeMap,
  preferredRootNodeId: string | undefined
): string | null {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  if (
    preferredRootNodeId &&
    nodeIds.has(preferredRootNodeId) &&
    (sourceMap.parentsByChildId.get(preferredRootNodeId)?.length ?? 0) === 0
  ) {
    return preferredRootNodeId;
  }

  const rootNodeIds = graph.nodes
    .filter(
      (node) =>
        (sourceMap.parentsByChildId.get(node.id)?.length ?? 0) === 0 &&
        (sourceMap.childrenByParentId.get(node.id)?.length ?? 0) > 0
    )
    .map((node) => node.id);

  return rootNodeIds.length === 1 ? rootNodeIds[0] : null;
}

/** Measures each node's distance from the shared source root through descendant links. */
function doubletArmDepths(
  rootNodeId: string,
  childrenByParentId: Map<string, string[]>,
  nodeCount: number
): Map<string, number> | null {
  const depths = new Map<string, number>([[rootNodeId, 0]]);
  const pendingNodeIds = [rootNodeId];

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.shift();

    if (!nodeId) {
      break;
    }

    const nextDepth = (depths.get(nodeId) ?? 0) + 1;

    if (nextDepth > nodeCount) {
      return null;
    }

    for (const childNodeId of childrenByParentId.get(nodeId) ?? []) {
      if ((depths.get(childNodeId) ?? -1) >= nextDepth) {
        continue;
      }

      depths.set(childNodeId, nextDepth);
      pendingNodeIds.push(childNodeId);
    }
  }

  return depths;
}

/** Treats descendant tips as lane anchors so same-language targets line up cleanly. */
function doubletArmLeafNodeIds(
  graph: EtymologyGraph,
  childrenByParentId: Map<string, string[]>,
  depths: Map<string, number>
): string[] {
  return graph.nodes
    .filter((node) => (depths.get(node.id) ?? 0) > 0 && (childrenByParentId.get(node.id)?.length ?? 0) === 0)
    .sort((left, right) => left.word.localeCompare(right.word) || left.langCode.localeCompare(right.langCode))
    .map((node) => node.id);
}

/** Assigns a stable vertical or horizontal lane to each doublet destination. */
function doubletArmLaneIndexes(leafNodeIds: string[]): Map<string, number> {
  return new Map(leafNodeIds.map((nodeId, index) => [nodeId, index]));
}

/** Propagates destination lanes back through every source path so shared ancestors sit between their arms. */
function doubletArmLaneContributions(
  leafNodeIds: string[],
  rootNodeId: string,
  laneIndexes: Map<string, number>,
  depths: Map<string, number>,
  parentsByChildId: Map<string, string[]>
): Map<string, number[]> | null {
  const contributions = new Map<string, number[]>();

  for (const leafNodeId of leafNodeIds) {
    const laneIndex = laneIndexes.get(leafNodeId);

    if (laneIndex === undefined) {
      return null;
    }

    if (!addDoubletArmLaneContribution(leafNodeId, rootNodeId, laneIndex, depths, parentsByChildId, contributions)) {
      return null;
    }
  }

  return contributions;
}

/** Walks one destination lane toward the root while rejecting cycles and disconnected branches. */
function addDoubletArmLaneContribution(
  nodeId: string,
  rootNodeId: string,
  laneIndex: number,
  depths: Map<string, number>,
  parentsByChildId: Map<string, string[]>,
  contributions: Map<string, number[]>,
  visitedNodeIds = new Set<string>()
): boolean {
  if (visitedNodeIds.has(nodeId)) {
    return false;
  }

  contributions.set(nodeId, [...(contributions.get(nodeId) ?? []), laneIndex]);

  if (nodeId === rootNodeId) {
    return true;
  }

  const nodeDepth = depths.get(nodeId);

  if (nodeDepth === undefined) {
    return false;
  }

  const nextVisitedNodeIds = new Set(visitedNodeIds);
  nextVisitedNodeIds.add(nodeId);

  const parentNodeIds = (parentsByChildId.get(nodeId) ?? []).filter((parentNodeId) => {
    const parentDepth = depths.get(parentNodeId);

    return parentDepth !== undefined && parentDepth < nodeDepth;
  });

  if (parentNodeIds.length === 0) {
    return false;
  }

  return parentNodeIds.every((parentNodeId) =>
    addDoubletArmLaneContribution(
      parentNodeId,
      rootNodeId,
      laneIndex,
      depths,
      parentsByChildId,
      contributions,
      nextVisitedNodeIds
    )
  );
}

/** Converts doublet arm depths and lane averages into fixed canvas target points. */
function doubletArmNodePositions(
  graph: EtymologyGraph,
  rootNodeId: string,
  leafNodeIds: string[],
  depths: Map<string, number>,
  laneContributions: Map<string, number[]>,
  orientation: GraphLayoutOrientation
): Map<string, GraphLayoutPoint> {
  const maxDepth = Math.max(1, ...depths.values());
  const depthSpan = Math.min(doubletArmMaxDepthSpan, doubletArmDepthSpacing * maxDepth);
  const centerLaneIndex = (leafNodeIds.length - 1) / 2;
  const leafNodeIdSet = new Set(leafNodeIds);
  const nodePositions = new Map<string, GraphLayoutPoint>();

  for (const node of graph.nodes) {
    const depth = depths.get(node.id) ?? 0;
    const lanes = laneContributions.get(node.id) ?? [centerLaneIndex];
    const averageLaneIndex = lanes.reduce((total, laneIndex) => total + laneIndex, 0) / lanes.length;
    const laneOffset = (averageLaneIndex - centerLaneIndex) * doubletArmLaneSpacing;
    const depthProgress = node.id === rootNodeId ? 0 : leafNodeIdSet.has(node.id) ? 1 : depth / maxDepth;

    nodePositions.set(
      node.id,
      orientation === "horizontal"
        ? {
            x: centerX + depthSpan / 2 - depthProgress * depthSpan,
            y: centerY + laneOffset
          }
        : {
            x: centerX + laneOffset,
            y: centerY + depthSpan / 2 - depthProgress * depthSpan
          }
    );
  }

  return nodePositions;
}

/** Finds a single source-directed path so one-line etymologies can use a diagonal layout. */
function linearSourcePathOrder(graph: EtymologyGraph, sourceEdges: EtymologyGraph["edges"]): string[] | null {
  if (graph.nodes.length < 2 || sourceEdges.length !== graph.nodes.length - 1) {
    return null;
  }

  const incomingByNodeId = new Map<string, string[]>();
  const outgoingByNodeId = new Map<string, string[]>();

  for (const edge of sourceEdges) {
    incomingByNodeId.set(edge.toNodeId, [...(incomingByNodeId.get(edge.toNodeId) ?? []), edge.fromNodeId]);
    outgoingByNodeId.set(edge.fromNodeId, [...(outgoingByNodeId.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  }

  const startNodeIds = graph.nodes
    .filter((node) => (incomingByNodeId.get(node.id)?.length ?? 0) === 0 && (outgoingByNodeId.get(node.id)?.length ?? 0) === 1)
    .map((node) => node.id);

  if (startNodeIds.length !== 1) {
    return null;
  }

  const orderedNodeIds: string[] = [];
  const visitedNodeIds = new Set<string>();
  let nextNodeId: string | undefined = startNodeIds[0];

  while (nextNodeId) {
    if (visitedNodeIds.has(nextNodeId)) {
      return null;
    }

    const incomingCount = incomingByNodeId.get(nextNodeId)?.length ?? 0;
    const outgoingNodeIds: string[] = outgoingByNodeId.get(nextNodeId) ?? [];

    if (incomingCount > 1 || outgoingNodeIds.length > 1) {
      return null;
    }

    orderedNodeIds.push(nextNodeId);
    visitedNodeIds.add(nextNodeId);
    nextNodeId = outgoingNodeIds[0];
  }

  return orderedNodeIds.length === graph.nodes.length ? orderedNodeIds : null;
}

/** Finds the single ancestor sink for a descendant tree when branching is strong enough for radial layout. */
function radialSourceTreeRootId(graph: EtymologyGraph, sourceEdges: EtymologyGraph["edges"]): string | null {
  if (graph.nodes.length < 4 || sourceEdges.length !== graph.nodes.length - 1) {
    return null;
  }

  const incomingByNodeId = new Map<string, string[]>();
  const outgoingByNodeId = new Map<string, string[]>();

  for (const edge of sourceEdges) {
    incomingByNodeId.set(edge.toNodeId, [...(incomingByNodeId.get(edge.toNodeId) ?? []), edge.fromNodeId]);
    outgoingByNodeId.set(edge.fromNodeId, [...(outgoingByNodeId.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  }

  if (Array.from(outgoingByNodeId.values()).some((targetNodeIds) => targetNodeIds.length > 1)) {
    return null;
  }

  const rootNodeIds = graph.nodes.filter((node) => (outgoingByNodeId.get(node.id)?.length ?? 0) === 0).map((node) => node.id);

  if (rootNodeIds.length !== 1) {
    return null;
  }

  const rootNodeId = rootNodeIds[0];
  const directChildCount = incomingByNodeId.get(rootNodeId)?.length ?? 0;
  const descendantCount = graph.nodes.length - 1;

  if (directChildCount < radialMinimumDirectChildren && descendantCount < radialMinimumDescendants) {
    return null;
  }

  return rootNodeId;
}

/** Groups descendants by distance from the source root so radial rings reflect graph depth. */
function radialDepthOrders(
  graph: EtymologyGraph,
  sourceEdges: EtymologyGraph["edges"],
  rootNodeId: string,
  generationLevels: Map<string, number>
): Map<number, string[]> {
  const childrenByParentId = new Map<string, string[]>();

  for (const edge of sourceEdges) {
    childrenByParentId.set(edge.toNodeId, [...(childrenByParentId.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }

  const depthOrders = new Map<number, string[]>([[0, [rootNodeId]]]);
  const pendingNodes: Array<{ nodeId: string; depth: number }> = [{ nodeId: rootNodeId, depth: 0 }];
  const visitedNodeIds = new Set<string>([rootNodeId]);

  while (pendingNodes.length > 0) {
    const pendingNode = pendingNodes.shift();

    if (!pendingNode) {
      break;
    }

    const childNodeIds = [...(childrenByParentId.get(pendingNode.nodeId) ?? [])].sort((left, right) =>
      compareRadialSiblings(left, right, generationLevels, graph)
    );

    for (const childNodeId of childNodeIds) {
      if (visitedNodeIds.has(childNodeId)) {
        continue;
      }

      const depth = pendingNode.depth + 1;
      depthOrders.set(depth, [...(depthOrders.get(depth) ?? []), childNodeId]);
      pendingNodes.push({ nodeId: childNodeId, depth });
      visitedNodeIds.add(childNodeId);
    }
  }

  return depthOrders;
}

/** Keeps radial sibling order stable while roughly grouping equivalent generations. */
function compareRadialSiblings(
  leftNodeId: string,
  rightNodeId: string,
  generationLevels: Map<string, number>,
  graph: EtymologyGraph
): number {
  const generationDifference = (generationLevels.get(leftNodeId) ?? 0) - (generationLevels.get(rightNodeId) ?? 0);

  if (generationDifference !== 0) {
    return generationDifference;
  }

  const leftNode = graph.nodes.find((node) => node.id === leftNodeId);
  const rightNode = graph.nodes.find((node) => node.id === rightNodeId);

  return (leftNode?.word ?? leftNodeId).localeCompare(rightNode?.word ?? rightNodeId);
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

/** Picks deterministic starting coordinates for shape-aware layouts before any force relaxation. */
function initialNodePosition(
  nodeId: string,
  generationLevel: number,
  maxGenerationLevel: number,
  preferredSiblingPosition: number,
  orientation: GraphLayoutOrientation,
  layoutPlan: GraphLayoutPlan
): { x: number; y: number } {
  const shapePosition = shapeTargetPosition(nodeId, layoutPlan);

  if (shapePosition) {
    return shapePosition;
  }

  return {
    x: initialNodeX(generationLevel, maxGenerationLevel, preferredSiblingPosition, orientation),
    y: initialNodeY(generationLevel, maxGenerationLevel, preferredSiblingPosition, orientation)
  };
}

/** Computes the fixed target point for deterministic layouts such as diagonal chains and radial trees. */
function shapeTargetPosition(nodeId: string, layoutPlan: GraphLayoutPlan): { x: number; y: number } | null {
  switch (layoutPlan.shape) {
    case "linear":
      return linearTargetPosition(nodeId, layoutPlan.orderedNodeIds, layoutPlan.orientation);
    case "doublet-arms":
      return layoutPlan.nodePositions.get(nodeId) ?? null;
    case "radial":
      return radialTargetPosition(nodeId, layoutPlan.depthOrders);
    case "force":
      return null;
  }
}

/** Places a pure etymology line on a diagonal so labels have room on both axes. */
function linearTargetPosition(
  nodeId: string,
  orderedNodeIds: string[],
  orientation: GraphLayoutOrientation
): { x: number; y: number } | null {
  const index = orderedNodeIds.indexOf(nodeId);

  if (index === -1) {
    return null;
  }

  const denominator = Math.max(1, orderedNodeIds.length - 1);
  const progress = index / denominator;
  const xSpan =
    orientation === "horizontal"
      ? Math.min(linearGraphMaxXSpan, linearGraphXSpacing * denominator)
      : Math.min(linearGraphMaxYSpan, linearGraphYSpacing * denominator);
  const ySpan =
    orientation === "horizontal"
      ? Math.min(linearGraphMaxYSpan, linearGraphYSpacing * denominator)
      : Math.min(linearGraphMaxXSpan, linearGraphXSpacing * denominator);

  return {
    x: centerX - xSpan / 2 + progress * xSpan,
    y: centerY - ySpan / 2 + progress * ySpan
  };
}

/** Places descendant trees in rings around their shared source root. */
function radialTargetPosition(nodeId: string, depthOrders: Map<number, string[]>): { x: number; y: number } | null {
  for (const [depth, nodeIds] of depthOrders) {
    const index = nodeIds.indexOf(nodeId);

    if (index === -1) {
      continue;
    }

    if (depth === 0) {
      return { x: centerX, y: centerY };
    }

    const radius = Math.max(radialDepthSpacing * depth, (nodeIds.length * radialArcSpacing) / (Math.PI * 2));
    const angleStep = (Math.PI * 2) / nodeIds.length;
    const angleOffset = depth % 2 === 0 ? angleStep / 2 : 0;
    const angle = -Math.PI / 2 + angleOffset + index * angleStep;

    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  }

  return null;
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

/** Uses stronger link springs for free layouts and gentler ones when a preset owns placement. */
function linkStrength(layoutPlan: GraphLayoutPlan): (link: LayoutSimulationLink) => number {
  return (link) => link.layoutKind === "annotation" ? 0.18 : layoutPlan.shape === "force" ? 0.55 : 0.2;
}

/** Keeps sprawling graphs apart while letting preset layouts mostly respect their target geometry. */
function chargeStrength(layoutPlan: GraphLayoutPlan, node: LayoutSimulationNode): number {
  if (isAnnotationNode(node)) {
    return -80;
  }

  switch (layoutPlan.shape) {
    case "linear":
      return -120;
    case "doublet-arms":
      return -100;
    case "radial":
      return -190;
    case "force":
      return -640;
  }
}

/** Pulls siblings across X for vertical graphs and leaves X for generational depth on desktop. */
function siblingForceX(
  orientation: GraphLayoutOrientation,
  layoutPlan: GraphLayoutPlan
): ReturnType<typeof forceX<LayoutSimulationNode>> | null {
  return layoutPlan.shape === "force" && orientation === "vertical"
    ? forceX<LayoutSimulationNode>((node) => isAnnotationNode(node) ? layoutNodeX(node) : node.preferredSiblingPosition)
      .strength((node) => isAnnotationNode(node) ? 0 : 0.08)
    : null;
}

/** Pulls older generations across X when the graph has enough horizontal room. */
function generationForceX(
  generationLevels: Map<string, number>,
  maxGenerationLevel: number,
  orientation: GraphLayoutOrientation,
  layoutPlan: GraphLayoutPlan
): ReturnType<typeof forceX<LayoutSimulationNode>> | null {
  return layoutPlan.shape === "force" && orientation === "horizontal"
    ? forceX<LayoutSimulationNode>((node) =>
        isAnnotationNode(node)
          ? layoutNodeX(node)
          : generationAxisPosition(generationLevels.get(node.id) ?? 0, maxGenerationLevel, orientation, horizontalDepthBandSpacing)
      ).strength((node) => isAnnotationNode(node) ? 0 : 0.16)
    : null;
}

/** Pulls siblings down Y on desktop and leaves Y for generational depth on mobile. */
function siblingForceY(
  orientation: GraphLayoutOrientation,
  layoutPlan: GraphLayoutPlan
): ReturnType<typeof forceY<LayoutSimulationNode>> | null {
  return layoutPlan.shape === "force" && orientation === "horizontal"
    ? forceY<LayoutSimulationNode>((node) => isAnnotationNode(node) ? layoutNodeY(node) : node.preferredSiblingPosition)
      .strength((node) => isAnnotationNode(node) ? 0 : 0.08)
    : null;
}

/** Pulls older generations down Y in the mobile-friendly vertical graph. */
function generationForceY(
  generationLevels: Map<string, number>,
  maxGenerationLevel: number,
  orientation: GraphLayoutOrientation,
  layoutPlan: GraphLayoutPlan
): ReturnType<typeof forceY<LayoutSimulationNode>> | null {
  return layoutPlan.shape === "force" && orientation === "vertical"
    ? forceY<LayoutSimulationNode>((node) =>
        isAnnotationNode(node)
          ? layoutNodeY(node)
          : generationAxisPosition(generationLevels.get(node.id) ?? 0, maxGenerationLevel, orientation, depthBandSpacing)
      ).strength((node) => isAnnotationNode(node) ? 0 : 0.16)
    : null;
}

/** Pulls preset layouts back toward their target X coordinate after collision/link relaxation. */
function shapeForceX(layoutPlan: GraphLayoutPlan): ReturnType<typeof forceX<LayoutSimulationNode>> | null {
  return layoutPlan.shape === "force"
    ? null
    : forceX<LayoutSimulationNode>((node) =>
        isAnnotationNode(node) ? layoutNodeX(node) : shapeTargetPosition(node.id, layoutPlan)?.x ?? nodeX(node)
      ).strength((node) => isAnnotationNode(node) ? 0 : 0.24);
}

/** Pulls preset layouts back toward their target Y coordinate after collision/link relaxation. */
function shapeForceY(layoutPlan: GraphLayoutPlan): ReturnType<typeof forceY<LayoutSimulationNode>> | null {
  return layoutPlan.shape === "force"
    ? null
    : forceY<LayoutSimulationNode>((node) =>
        isAnnotationNode(node) ? layoutNodeY(node) : shapeTargetPosition(node.id, layoutPlan)?.y ?? nodeY(node)
      ).strength((node) => isAnnotationNode(node) ? 0 : 0.24);
}

/** Pulls annotation cards toward their preferred side of the anchor node inside the shared simulation. */
function annotationForceX(): ReturnType<typeof forceX<LayoutSimulationNode>> {
  return forceX<LayoutSimulationNode>((node) => isAnnotationNode(node) ? node.targetX : nodeX(node))
    .strength((node) => isAnnotationNode(node) ? 0.2 : 0);
}

/** Pulls annotation cards toward their preferred side of the anchor node inside the shared simulation. */
function annotationForceY(): ReturnType<typeof forceY<LayoutSimulationNode>> {
  return forceY<LayoutSimulationNode>((node) => isAnnotationNode(node) ? node.targetY : nodeY(node))
    .strength((node) => isAnnotationNode(node) ? 0.2 : 0);
}

/** Gives term and annotation layout nodes appropriately sized collision envelopes. */
function collisionRadius(node: LayoutSimulationNode): number {
  return isAnnotationNode(node)
    ? Math.hypot(graphAnnotationCalloutWidth / 2, graphAnnotationCalloutHeight / 2) + annotationCollisionPadding
    : graphNodeRadius + labelClearanceRadius;
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

/** Uses edge type semantics to give cognates and loose relations a little more room. */
function linkDistance(type: EdgeType): number {
  switch (type) {
    case "compound_of":
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

/** Reads the mutable x coordinate from an annotation layout node. */
function layoutNodeX(node: PositionedAnnotationNode): number {
  const x = node.x;

  return typeof x === "number" && Number.isFinite(x) ? x : node.targetX;
}

/** Reads the mutable y coordinate from an annotation layout node. */
function layoutNodeY(node: PositionedAnnotationNode): number {
  const y = node.y;

  return typeof y === "number" && Number.isFinite(y) ? y : node.targetY;
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
  const radius = graphNodeRadius;

  return {
    x: nodeX(node) + (dx / distance) * radius * direction,
    y: nodeY(node) + (dy / distance) * radius * direction
  };
}
