<script setup lang="ts">
import { useEventListener, useMediaQuery, useScrollLock } from "@vueuse/core";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";

import type { EtymologyGraph, GraphTraversalNode } from "@etymology-graph/graph";
import GraphCanvasAnnotations from "./GraphCanvasAnnotations.vue";
import GraphCanvasControls from "./GraphCanvasControls.vue";
import GraphCanvasLinks from "./GraphCanvasLinks.vue";
import GraphCanvasMapTexture from "./GraphCanvasMapTexture.vue";
import GraphCanvasNodeDetails from "./GraphCanvasNodeDetails.vue";
import GraphCanvasNodes from "./GraphCanvasNodes.vue";
import {
  useGraphLayout,
  type GraphLayoutOrientation,
  type GraphLayoutPreset,
  type PositionedGraphLink,
  type PositionedGraphNode
} from "./composables/useGraphLayout";
import { useGraphNodeDrag } from "./composables/useGraphNodeDrag";
import {
  useGraphNodeRoutes,
  type AncestorLanguageRouteParams,
  type GraphNodeRouteParams
} from "./composables/useGraphNodeRoutes";
import { useGraphViewport, type GraphViewportContentBounds } from "./composables/useGraphViewport";
import { useLanguagesQuery } from "../languages/useLanguagesQuery";
import { fallbackSearchLanguage, useSearchLanguageStore } from "../terms/searchLanguageStore";
import { graphCanvasHeight, graphCanvasWidth } from "./graphCanvasConstants";
import {
  createNodeActionItems,
  isNodeContextAction,
  type NodeActionLanguageContext,
  type NodeContextAction,
  type SelectedNodeRelationship
} from "./graphNodeActions";
import { hasImportedLexicalEntry, wiktionaryHrefForNode } from "./graphNodeDisplay";
import { edgeLabel, isSourceDirectedEdgeType } from "./graphRelationshipDisplay";
import type { GraphNodeAnnotation } from "./graphAnnotations";
import type { GraphNodeHighlight } from "./graphNodeHighlights";
import ContextMenu from "../../uiComponents/ContextMenu.vue";

type ContextMenuInstance = {
  close(): void;
};
type GraphOrientationMode = "default" | "fan-out";
type GraphLineageFocus = {
  nodeIds: Set<string>;
  linkIds: Set<string>;
};
type LineageStep = {
  nodeId: string;
  linkId: string;
};
type CanvasPointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
};
type ViewportFocusTarget = {
  panX: number;
  panY: number;
  zoom: number;
};

const inlineGraphControlsPanRoom = 76;
const canvasClickDragThreshold = 4;
const focusedNodeMinimumZoom = 0.45;
const focusedNodeAnimationMs = 240;

const props = withDefaults(
  defineProps<{
    graph: EtymologyGraph;
    layoutPreset?: GraphLayoutPreset;
    orientationMode?: GraphOrientationMode;
    nodeHighlights?: GraphNodeHighlight[];
    showControls?: boolean;
    annotations?: GraphNodeAnnotation[];
  }>(),
  {
    layoutPreset: () => ({ type: "auto" }),
    orientationMode: "default",
    nodeHighlights: () => [],
    showControls: true,
    annotations: () => []
  }
);

const emit = defineEmits<{
  "load-children": [node: GraphTraversalNode];
  "node-details-open-change": [open: boolean];
}>();

const router = useRouter();
const searchLanguageStore = useSearchLanguageStore();
const { getEtymologyRoute, getAncestorLanguageRoute, getWordDescendantsRoute } = useGraphNodeRoutes();
const selectedNodeId = ref<string>();
const contextNodeId = ref<string>();
const pendingExpansionAnchorNodeId = ref<string>();
const isGraphGuideOpen = ref(false);
const isNodeContextMenuOpen = ref(false);
const isGraphExpanded = ref(false);
const graphCanvasRoot = ref<HTMLElement | null>(null);
const isBodyScrollLocked = useScrollLock(() => document.body);
const nodeContextMenu = ref<ContextMenuInstance | null>(null);
const usesDesktopGraphLayout = useMediaQuery("(min-width: 768px)");
const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
const canDragGraphNodes = computed(() => usesDesktopGraphLayout.value || isGraphExpanded.value);
const isInlineScrollHandoffEnabled = computed(() => !isGraphExpanded.value);
const graphNodeBounds = ref<GraphViewportContentBounds | null>(null);
let canvasPointerState: CanvasPointerState | undefined;
let suppressNextCanvasClick = false;
let viewportFocusAnimationFrame: number | undefined;
const {
  svgRef,
  panX,
  panY,
  zoom,
  viewportFrame,
  viewBox,
  zoomPercentage,
  viewportTransform,
  isPanning,
  canUseNativeInlineTouchScroll,
  zoomIn,
  zoomOut,
  setHomeViewport,
  cancelViewportAnimation,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleWheel,
  handleDoubleClick,
  handleKeydown
} = useGraphViewport({
  width: graphCanvasWidth,
  height: graphCanvasHeight,
  minZoom: 0.12,
  contentBounds: graphNodeBounds,
  inlineScrollTopPanRoom: props.showControls ? inlineGraphControlsPanRoom : 0,
  isInlineScrollHandoffEnabled,
  prefersReducedMotion
});

const {
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
  pullLinkedNodes,
  nodeX,
  nodeY,
  hasResolvedEndpoints,
  linkEndpointX,
  linkEndpointY
} = useGraphLayout({
  selectedNodeId,
  contextNodeId,
  viewportFrame,
  setHomeViewport,
  onFreshLayout: closeFloatingGraphUi
});
const graphLayoutOrientation = computed<GraphLayoutOrientation>(() => {
  if (props.orientationMode === "fan-out") {
    return usesDesktopGraphLayout.value ? "vertical" : "horizontal";
  }

  return usesDesktopGraphLayout.value ? "horizontal" : "vertical";
});
const {
  suppressNextNodeClick,
  startNodeDrag,
  dragNode,
  endNodeDrag,
  isNodeDragging,
  resetNodeDrag
} = useGraphNodeDrag({
  svgRef,
  panX,
  panY,
  zoom,
  graphLayoutOrientation,
  isNodeDragEnabled: canDragGraphNodes,
  nodeX,
  nodeY,
  requestRenderTick,
  onNodeDrag: (node, delta) => {
    moveAnchoredAnnotations(node.id, delta.x, delta.y);
    for (const pulledNode of pullLinkedNodes(node.id, delta.x, delta.y)) {
      moveAnchoredAnnotations(pulledNode.node.id, pulledNode.delta.x, pulledNode.delta.y);
    }
  }
});
const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value));
const nodesById = computed(() => new Map(nodes.value.map((node) => [node.id, node])));
const selectedLineageFocus = computed<GraphLineageFocus | undefined>(() => {
  const selectedId = selectedNodeId.value;

  if (!selectedId) {
    return undefined;
  }

  const ancestorsByDescendantId = new Map<string, LineageStep[]>();
  const descendantsBySourceId = new Map<string, LineageStep[]>();

  for (const link of links.value) {
    if (!isSourceDirectedEdgeType(link.type)) {
      continue;
    }

    appendLineageStep(ancestorsByDescendantId, link.sourceNodeId, {
      nodeId: link.targetNodeId,
      linkId: link.id
    });
    appendLineageStep(descendantsBySourceId, link.targetNodeId, {
      nodeId: link.sourceNodeId,
      linkId: link.id
    });
  }

  const nodeIds = new Set([selectedId]);
  const linkIds = new Set<string>();

  addReachableLineage(selectedId, ancestorsByDescendantId, nodeIds, linkIds);
  addReachableLineage(selectedId, descendantsBySourceId, nodeIds, linkIds);

  return { nodeIds, linkIds };
});
const graphInteractionAriaLabel = computed(() => {
  const graphSummary = `Etymology graph with ${props.graph.nodes.length} words and ${props.graph.edges.length} links.`;

  if (isInlineScrollHandoffEnabled.value) {
    return `${graphSummary} Scroll or swipe to pan the graph. When the graph reaches an edge, the page scrolls. Pinch to zoom. Use plus, minus, arrow keys, or zero when focused.`;
  }

  if (canDragGraphNodes.value) {
    return `${graphSummary} Drag or use two fingers to pan. Pinch, double-click, or press control and wheel to zoom. Use plus, minus, arrow keys, or zero when focused.`;
  }

  return `${graphSummary} Drag or use keyboard shortcuts to pan. Pinch, double-click, or press control and wheel to zoom. Use plus, minus, arrow keys, or zero when focused.`;
});
const languagesQuery = useLanguagesQuery();
const languageNamesByCode = computed(
  () => new Map(languagesQuery.data.value?.languages.map((language) => [language.code, language.canonicalName]) ?? [])
);
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
const selectedNodeWiktionaryHref = computed(() => {
  const node = selectedNode.value;

  if (!node || !hasImportedLexicalEntry(node)) {
    return undefined;
  }

  const canonicalName = languageNamesByCode.value.get(node.langCode);

  return canonicalName ? wiktionaryHrefForNode(node, canonicalName) : undefined;
});
const selectedSearchLanguageCode = computed(() => searchLanguageStore.selectedSearchLanguage ?? fallbackSearchLanguage);
const nodeContextMenuItems = computed(() => createNodeActionItems(nodeActionLanguageContextForNode(contextNode.value)));
const selectedNodeActionItems = computed(() => createNodeActionItems(nodeActionLanguageContextForNode(selectedNode.value)));

watch(
  [() => props.graph, graphLayoutOrientation, () => props.layoutPreset],
  ([graph, orientation, layoutPreset]) => {
    const expansionAnchorNodeId = pendingExpansionAnchorNodeId.value;

    buildSimulation(graph, orientation, {
      layoutPreset,
      annotations: props.annotations,
      expansionAnchorNodeId
    });
    pendingExpansionAnchorNodeId.value = undefined;
    resetNodeDrag();
  },
  { immediate: true }
);

watch(
  renderedNodeBounds,
  (bounds) => {
    graphNodeBounds.value = bounds;
  },
  { immediate: true }
);

watch(
  () => props.annotations,
  () => {
    buildSimulation(props.graph, graphLayoutOrientation.value, {
      layoutPreset: props.layoutPreset,
      annotations: props.annotations
    });
  }
);

watch(
  () => [viewportFrame.value.x, viewportFrame.value.y, viewportFrame.value.width, viewportFrame.value.height],
  () => {
    fitLayoutToViewport();
  }
);

watch(isGraphExpanded, (expanded) => {
  isBodyScrollLocked.value = expanded;

  if (!expanded) {
    void scrollInlineGraphIntoView();
  }
});

watch(usesDesktopGraphLayout, (usesDesktopLayout) => {
  if (usesDesktopLayout) {
    return;
  }

  closeNodeContextMenu();
});

useEventListener("keydown", handleDocumentKeydown);

onBeforeUnmount(() => {
  cancelViewportFocusAnimation();
  isBodyScrollLocked.value = false;
});

defineExpose({
  focusNode
});

/** Expands the graph into an app-level overlay without breaking portalled floating UI. */
function toggleGraphExpanded(): void {
  setGraphExpanded(!isGraphExpanded.value);
}

/** Returns users to the graph's inline page position after leaving the full-screen workspace. */
async function scrollInlineGraphIntoView(): Promise<void> {
  await nextTick();

  graphCanvasRoot.value?.scrollIntoView({
    block: "start",
    behavior: "auto"
  });
}

/** Centralizes expanded-state cleanup for toolbar clicks and Escape. */
function setGraphExpanded(expanded: boolean): void {
  isGraphExpanded.value = expanded;

  if (!expanded) {
    closeFloatingGraphUi();
  }
}

/** Closes all floating graph UI when a full reset or collapse changes interaction context. */
function closeFloatingGraphUi(): void {
  isGraphGuideOpen.value = false;
  closeNodeContextMenu();
}

/** Closes node menus without disturbing selected node details. */
function closeNodeContextMenu(): void {
  isNodeContextMenuOpen.value = false;
  contextNodeId.value = undefined;
  nodeContextMenu.value?.close();
}

/** Restores the generated graph layout and clears any manually pinned node positions. */
function resetGraphLayout(): void {
  cancelViewportFocusAnimation();
  cancelViewportAnimation();
  resetLayout(props.graph, graphLayoutOrientation.value, {
    layoutPreset: props.layoutPreset,
    annotations: props.annotations
  });
  resetNodeDrag();
}

/** Lets the visible zoom-in control interrupt programmatic focus motion. */
function handleZoomIn(): void {
  cancelViewportFocusAnimation();
  zoomIn();
}

/** Lets the visible zoom-out control interrupt programmatic focus motion. */
function handleZoomOut(): void {
  cancelViewportFocusAnimation();
  zoomOut();
}

/** Lets users leave the expanded graph with the standard Escape shortcut. */
function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !isGraphExpanded.value) {
    return;
  }

  setGraphExpanded(false);
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

/** Starts click tracking for every viewport pan gesture that reaches the canvas. */
function handleCanvasPointerDown(event: PointerEvent): void {
  cancelViewportFocusAnimation();

  if (event.pointerType !== "mouse" || event.button === 0) {
    suppressNextCanvasClick = false;
    canvasPointerState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false
    };
  }

  handlePointerDown(event);
}

/** Records whether the current canvas gesture moved far enough to count as a drag. */
function handleCanvasPointerMove(event: PointerEvent): void {
  updateCanvasPointerMovement(event);
  handlePointerMove(event);
}

/** Suppresses the follow-up click after a canvas pan gesture. */
function handleCanvasPointerUp(event: PointerEvent): void {
  updateCanvasPointerMovement(event);

  if (canvasPointerState?.pointerId === event.pointerId) {
    suppressNextCanvasClick = canvasPointerState.hasMoved;
    canvasPointerState = undefined;
  }

  handlePointerUp(event);
}

/** Lets wheel zooming interrupt a programmatic focus animation. */
function handleCanvasWheel(event: WheelEvent): void {
  cancelViewportFocusAnimation();
  handleWheel(event);
}

/** Lets double-click zooming interrupt a programmatic focus animation. */
function handleCanvasDoubleClick(event: MouseEvent): void {
  cancelViewportFocusAnimation();
  handleDoubleClick(event);
}

/** Lets keyboard viewport controls interrupt a programmatic focus animation. */
function handleCanvasKeydown(event: KeyboardEvent): void {
  cancelViewportFocusAnimation();
  handleKeydown(event);
}

/** Clears node selection only for true background clicks, not drags or graph marks. */
function handleCanvasClick(event: MouseEvent): void {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }

  if (!isCanvasBackgroundTarget(event.target)) {
    return;
  }

  clearSelectedNode();
}

/** Measures movement in screen coordinates so the drag guard is independent of zoom. */
function updateCanvasPointerMovement(event: PointerEvent): void {
  if (!canvasPointerState || canvasPointerState.pointerId !== event.pointerId) {
    return;
  }

  canvasPointerState.hasMoved =
    canvasPointerState.hasMoved ||
    Math.hypot(event.clientX - canvasPointerState.startX, event.clientY - canvasPointerState.startY) > canvasClickDragThreshold;
}

/** Treats the map texture and empty SVG space as background while preserving node and link clicks. */
function isCanvasBackgroundTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !target.closest(".graph-nodes, .graph-links");
}

/** Records a directed lineage step without obscuring the two traversal directions. */
function appendLineageStep(lineageByNodeId: Map<string, LineageStep[]>, fromNodeId: string, step: LineageStep): void {
  const existingSteps = lineageByNodeId.get(fromNodeId);

  if (existingSteps) {
    existingSteps.push(step);
    return;
  }

  lineageByNodeId.set(fromNodeId, [step]);
}

/** Walks every reachable source-directed edge so selected nodes reveal full ancestor and descendant branches. */
function addReachableLineage(
  startNodeId: string,
  lineageByNodeId: Map<string, LineageStep[]>,
  nodeIds: Set<string>,
  linkIds: Set<string>
): void {
  const visitedNodeIds = new Set([startNodeId]);
  const pendingNodeIds = [startNodeId];

  while (pendingNodeIds.length > 0) {
    const currentNodeId = pendingNodeIds.pop();

    if (!currentNodeId) {
      continue;
    }

    for (const step of lineageByNodeId.get(currentNodeId) ?? []) {
      linkIds.add(step.linkId);

      if (visitedNodeIds.has(step.nodeId)) {
        continue;
      }

      visitedNodeIds.add(step.nodeId);
      nodeIds.add(step.nodeId);
      pendingNodeIds.push(step.nodeId);
    }
  }
}

/** Selects a node so dense lexical metadata can live outside the graph label. */
function selectNode(node: PositionedGraphNode): void {
  selectedNodeId.value = node.id;
  emit("node-details-open-change", true);
}

/** Lets nearby result indexes ask the graph to reveal a node without owning graph selection state. */
function focusNode(nodeId: string): void {
  const node = nodesById.value.get(nodeId);

  if (!node) {
    return;
  }

  cancelViewportAnimation();
  selectNode(node);
  animateViewportTo(viewportTargetForNode(node, Math.max(zoom.value, focusedNodeMinimumZoom)));
}

/** Computes the transform that puts a selected node at the center of the visible graph frame. */
function viewportTargetForNode(node: PositionedGraphNode, targetZoom: number): ViewportFocusTarget {
  const frame = viewportFrame.value;

  return {
    panX: frame.x + frame.width / 2 - nodeX(node) * targetZoom,
    panY: frame.y + frame.height / 2 - nodeY(node) * targetZoom,
    zoom: targetZoom
  };
}

/** Smoothly moves external focus requests while keeping drag and wheel gestures immediate. */
function animateViewportTo(target: ViewportFocusTarget): void {
  cancelViewportFocusAnimation();

  if (prefersReducedMotion.value) {
    applyViewportTarget(target);
    return;
  }

  const start = {
    panX: panX.value,
    panY: panY.value,
    zoom: zoom.value
  };
  const startedAt = performance.now();

  const animateFrame = (now: number): void => {
    const progress = Math.min(Math.max((now - startedAt) / focusedNodeAnimationMs, 0), 1);
    const easedProgress = easeOutCubic(progress);

    applyViewportTarget({
      panX: interpolate(start.panX, target.panX, easedProgress),
      panY: interpolate(start.panY, target.panY, easedProgress),
      zoom: interpolate(start.zoom, target.zoom, easedProgress)
    });

    if (progress < 1) {
      viewportFocusAnimationFrame = window.requestAnimationFrame(animateFrame);
      return;
    }

    viewportFocusAnimationFrame = undefined;
  };

  viewportFocusAnimationFrame = window.requestAnimationFrame(animateFrame);
}

/** Applies a viewport transform without going through pointer gesture handlers. */
function applyViewportTarget(target: ViewportFocusTarget): void {
  panX.value = target.panX;
  panY.value = target.panY;
  zoom.value = target.zoom;
}

/** Stops programmatic viewport motion as soon as the user takes over the canvas. */
function cancelViewportFocusAnimation(): void {
  if (viewportFocusAnimationFrame === undefined) {
    return;
  }

  window.cancelAnimationFrame(viewportFocusAnimationFrame);
  viewportFocusAnimationFrame = undefined;
}

/** Gives the focus animation a quick start and a soft landing. */
function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/** Interpolates a viewport coordinate or zoom value for focus animation frames. */
function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/** Separates click selection from drag release so repositioning a node does not reopen details. */
function handleNodeClick(node: PositionedGraphNode): void {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }

  if (suppressNextNodeClick.value) {
    suppressNextNodeClick.value = false;
    return;
  }

  selectNode(node);
}

/** Clears the detail card without rebuilding or disturbing the graph simulation. */
function clearSelectedNode(): void {
  selectedNodeId.value = undefined;
  emit("node-details-open-change", false);
}

/** Builds action copy from the clicked source language and current result language. */
function nodeActionLanguageContextForNode(
  node?: Pick<GraphTraversalNode, "langCode" | "word"> & { langName?: string }
): NodeActionLanguageContext | undefined {
  if (!node) {
    return undefined;
  }

  return {
    nodeWord: node.word,
    sourceLanguageCode: node.langCode,
    sourceLanguageName: node.langName ?? languageNameForCode(node.langCode),
    targetLanguageCode: selectedSearchLanguageCode.value,
    targetLanguageName: languageNameForCode(selectedSearchLanguageCode.value)
  };
}

/** Uses loaded language metadata while keeping a readable fallback for unknown codes. */
function languageNameForCode(langCode: string): string {
  return languageNamesByCode.value.get(langCode) ?? langCode;
}

/** Routes context-menu selections to their shared graph action behavior. */
function handleNodeContextAction(item: { value: string }): void {
  const node = contextNode.value;

  if (!node || !isNodeContextAction(item.value)) {
    return;
  }

  performNodeAction(item.value, node);
}

/** Gives tap-first users the same node actions without requiring a context-menu gesture. */
function handleSelectedNodeAction(action: NodeContextAction): void {
  const node = selectedNode.value;

  if (!node) {
    return;
  }

  performNodeAction(action, node);
}

/** Performs graph node actions from every UI surface that can target a node. */
function performNodeAction(action: NodeContextAction, node: GraphTraversalNode): void {
  switch (action) {
    case "load-children":
      pendingExpansionAnchorNodeId.value = node.id;
      emit("load-children", node);
      return;
    case "load-descendants":
      void router.push(getWordDescendantsRoute(routeParamsForNode(node)));
      return;
    case "view-etymology":
      void router.push(getEtymologyRoute(routeParamsForNode(node)));
      return;
    case "find-source-language-links":
      void router.push(getAncestorLanguageRoute(ancestorLanguageRouteParamsForNode(node)));
      return;
    default: {
      const exhaustiveValue: never = action;
      throw new Error(`Unhandled graph node action: ${exhaustiveValue}`);
    }
  }
}

/** Converts graph traversal nodes into typed route params with the user-visible term as the path value. */
function routeParamsForNode(node: GraphTraversalNode): GraphNodeRouteParams {
  return {
    langCode: node.langCode,
    term: node.word
  };
}

/** Pairs the clicked source language with the user's current result-language preference. */
function ancestorLanguageRouteParamsForNode(node: GraphTraversalNode): AncestorLanguageRouteParams {
  return {
    langCode: searchLanguageStore.selectedSearchLanguage ?? fallbackSearchLanguage,
    ancestorLangCode: node.langCode
  };
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
</script>

<template>
  <div
    ref="graphCanvasRoot"
    class="overflow-hidden [background:radial-gradient(ellipse_at_50%_42%,transparent_58%,color-mix(in_oklch,var(--theme-text)_6%,transparent)_100%),linear-gradient(135deg,color-mix(in_oklch,var(--theme-surface-muted)_82%,var(--theme-background))_0%,var(--theme-surface)_100%)] [box-shadow:inset_0_0_0_1px_color-mix(in_oklch,var(--theme-surface-raised)_72%,transparent)] after:absolute after:inset-0 after:pointer-events-none after:content-[''] after:opacity-[0.18] after:bg-[radial-gradient(color-mix(in_oklch,var(--theme-text)_12%,transparent)_0.7px,transparent_0.8px),radial-gradient(color-mix(in_oklch,var(--theme-surface-raised)_80%,transparent)_0.7px,transparent_0.8px)] after:bg-position-[0_0,11px_17px] after:bg-size-[19px_23px,29px_31px]"
    :class="isGraphExpanded ? 'fixed inset-0 z-900 rounded-none border-0' : 'relative z-0 rounded-md border border-border'"
  >
    <GraphCanvasControls
      v-if="showControls"
      v-model:guide-open="isGraphGuideOpen"
      :zoom-percentage="zoomPercentage"
      :expanded="isGraphExpanded"
      :uses-desktop-layout="usesDesktopGraphLayout"
      @zoom-out="handleZoomOut"
      @zoom-in="handleZoomIn"
      @reset="resetGraphLayout"
      @toggle-expanded="toggleGraphExpanded"
    />

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
          class="relative z-1 block w-full select-none focus-visible:outline-[3px] focus-visible:outline-offset-[-6px] focus-visible:outline-accent/40 focus:outline-none h-full"
          :class="[
            isGraphExpanded ? 'min-h-dvh' : 'min-h-[min(72dvh,560px)] md:min-h-[360px]',
            canUseNativeInlineTouchScroll ? 'touch-pan-y' : 'touch-none',
            canDragGraphNodes ? 'cursor-grab' : 'cursor-default',
            isPanning && 'cursor-grabbing'
          ]"
          :viewBox="viewBox"
          role="img"
          tabindex="0"
          aria-keyshortcuts="+ - ArrowUp ArrowDown ArrowLeft ArrowRight 0 Home"
          :aria-label="graphInteractionAriaLabel"
          @pointerdown="handleCanvasPointerDown"
          @pointermove="handleCanvasPointerMove"
          @pointerup="handleCanvasPointerUp"
          @pointercancel="handleCanvasPointerUp"
          @lostpointercapture="handleCanvasPointerUp"
          @click="handleCanvasClick"
          @wheel="handleCanvasWheel"
          @dblclick="handleCanvasDoubleClick"
          @keydown="handleCanvasKeydown"
        >
          <g class="graph-viewport" :transform="viewportTransform">
            <GraphCanvasMapTexture
              :graph="graph"
              :pan-x="panX"
              :pan-y="panY"
              :zoom="zoom"
              :viewport-frame="viewportFrame"
            />
            <GraphCanvasLinks
              :links="renderedLinks"
              :focused-link-ids="selectedLineageFocus?.linkIds"
              :has-resolved-endpoints="hasResolvedEndpoints"
              :link-endpoint-x="linkEndpointX"
              :link-endpoint-y="linkEndpointY"
            />
            <GraphCanvasNodes
              :nodes="renderedNodes"
              :node-highlights="nodeHighlights"
              :selected-node-id="selectedNodeId"
              :focused-node-ids="selectedLineageFocus?.nodeIds"
              :context-node-id="contextNodeId"
              :context-menu-open="isNodeContextMenuOpen"
              :zoom="zoom"
              :uses-desktop-graph-layout="usesDesktopGraphLayout"
              :can-drag-nodes="canDragGraphNodes"
              :get-context-trigger-props="getContextTriggerProps"
              :node-x="nodeX"
              :node-y="nodeY"
              :is-node-dragging="isNodeDragging"
              @click="handleNodeClick"
              @pointer-down="startNodeDrag"
              @pointer-move="dragNode"
              @pointer-up="endNodeDrag"
              @keydown="handleNodeKeydown"
            />
            <GraphCanvasAnnotations
              v-if="renderedAnnotations.length > 0"
              :positioned-annotations="renderedAnnotations"
            />
          </g>
        </svg>
      </template>
    </ContextMenu>

    <GraphCanvasNodeDetails
      v-if="selectedNode"
      :node="selectedNode"
      :relationships="selectedNodeRelationships"
      :actions="selectedNodeActionItems"
      :wiktionary-href="selectedNodeWiktionaryHref"
      :expanded="isGraphExpanded"
      @close="clearSelectedNode"
      @action="handleSelectedNodeAction"
    />
  </div>
</template>
