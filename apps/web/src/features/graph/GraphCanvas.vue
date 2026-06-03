<script setup lang="ts">
import { useEventListener, useMediaQuery, useScrollLock } from "@vueuse/core";
import { computed, onBeforeUnmount, ref, watch } from "vue";
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
import { wiktionaryHrefForNode } from "./graphNodeDisplay";
import { edgeLabel, isSourceDirectedEdgeType } from "./graphRelationshipDisplay";
import type { GraphNodeAnnotation } from "./graphAnnotations";
import ContextMenu from "../../uiComponents/ContextMenu.vue";

type ContextMenuInstance = {
  close(): void;
};

const props = withDefaults(
  defineProps<{
    graph: EtymologyGraph;
    layoutPreset?: GraphLayoutPreset;
    rootNodeId?: string;
    showControls?: boolean;
    annotations?: GraphNodeAnnotation[];
  }>(),
  {
    layoutPreset: "auto",
    showControls: true,
    annotations: () => []
  }
);

const emit = defineEmits<{
  "load-children": [node: GraphTraversalNode];
}>();

const router = useRouter();
const searchLanguageStore = useSearchLanguageStore();
const { getEtymologyRoute, getDoubletsRoute, getAncestorLanguageRoute } = useGraphNodeRoutes();
const selectedNodeId = ref<string>();
const contextNodeId = ref<string>();
const pendingExpansionAnchorNodeId = ref<string>();
const isGraphGuideOpen = ref(false);
const isNodeContextMenuOpen = ref(false);
const isGraphExpanded = ref(false);
const isBodyScrollLocked = useScrollLock(() => document.body);
const nodeContextMenu = ref<ContextMenuInstance | null>(null);
const usesDesktopGraphLayout = useMediaQuery("(min-width: 768px)");
const canDragGraphNodes = computed(() => usesDesktopGraphLayout.value || isGraphExpanded.value);
const isInlineScrollHandoffEnabled = computed(() => !isGraphExpanded.value);
const graphNodeBounds = ref<GraphViewportContentBounds | null>(null);
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
  zoomIn,
  zoomOut,
  setHomeViewport,
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
  isInlineScrollHandoffEnabled
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
const graphLayoutOrientation = computed<GraphLayoutOrientation>(() =>
  usesDesktopGraphLayout.value ? "horizontal" : "vertical"
);
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
  }
});
const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value));
const nodesById = computed(() => new Map(nodes.value.map((node) => [node.id, node])));
const graphInteractionAriaLabel = computed(() => {
  const graphSummary = `Force-directed etymology graph with ${props.graph.nodes.length} words and ${props.graph.edges.length} relationships.`;

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

  if (!node) {
    return undefined;
  }

  const canonicalName = languageNamesByCode.value.get(node.langCode);

  return canonicalName ? wiktionaryHrefForNode(node, canonicalName) : undefined;
});
const selectedSearchLanguageCode = computed(() => searchLanguageStore.selectedSearchLanguage ?? fallbackSearchLanguage);
const nodeContextMenuItems = computed(() => createNodeActionItems(nodeActionLanguageContextForNode(contextNode.value)));
const selectedNodeActionItems = computed(() => createNodeActionItems(nodeActionLanguageContextForNode(selectedNode.value)));

watch(
  [() => props.graph, graphLayoutOrientation, () => props.layoutPreset, () => props.rootNodeId],
  ([graph, orientation, layoutPreset, rootNodeId]) => {
    const expansionAnchorNodeId = pendingExpansionAnchorNodeId.value;

    buildSimulation(graph, orientation, {
      layoutPreset,
      rootNodeId,
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
      rootNodeId: props.rootNodeId,
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
});

watch(usesDesktopGraphLayout, (usesDesktopLayout) => {
  if (usesDesktopLayout) {
    return;
  }

  closeNodeContextMenu();
});

useEventListener("keydown", handleDocumentKeydown);

onBeforeUnmount(() => {
  isBodyScrollLocked.value = false;
});

/** Expands the graph into an app-level overlay without breaking portalled floating UI. */
function toggleGraphExpanded(): void {
  setGraphExpanded(!isGraphExpanded.value);
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
  resetLayout(props.graph, graphLayoutOrientation.value, {
    layoutPreset: props.layoutPreset,
    rootNodeId: props.rootNodeId,
    annotations: props.annotations
  });
  resetNodeDrag();
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

/** Builds action copy from the clicked source language and current result language. */
function nodeActionLanguageContextForNode(
  node?: Pick<GraphTraversalNode, "langCode" | "word"> & { langName?: string }
): NodeActionLanguageContext | undefined {
  if (!node) {
    return undefined;
  }

  return {
    nodeWord: node.word,
    sourceLanguageName: node.langName ?? languageNameForCode(node.langCode),
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
    case "view-etymology":
      void router.push(getEtymologyRoute(routeParamsForNode(node)));
      return;
    case "view-doublets":
      void router.push(getDoubletsRoute(routeParamsForNode(node)));
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
    class="overflow-hidden [background:radial-gradient(ellipse_at_50%_42%,transparent_58%,color-mix(in_oklch,var(--theme-text)_6%,transparent)_100%),linear-gradient(135deg,color-mix(in_oklch,var(--theme-surface-muted)_82%,var(--theme-background))_0%,var(--theme-surface)_100%)] [box-shadow:inset_0_0_0_1px_color-mix(in_oklch,var(--theme-surface-raised)_72%,transparent)] after:absolute after:inset-0 after:pointer-events-none after:content-[''] after:opacity-[0.18] after:bg-[radial-gradient(color-mix(in_oklch,var(--theme-text)_12%,transparent)_0.7px,transparent_0.8px),radial-gradient(color-mix(in_oklch,var(--theme-surface-raised)_80%,transparent)_0.7px,transparent_0.8px)] after:bg-position-[0_0,11px_17px] after:bg-size-[19px_23px,29px_31px]"
    :class="isGraphExpanded ? 'fixed inset-0 z-900 rounded-none border-0' : 'relative z-0 rounded-md border border-border'"
  >
    <GraphCanvasControls
      v-if="showControls"
      v-model:guide-open="isGraphGuideOpen"
      :zoom-percentage="zoomPercentage"
      :expanded="isGraphExpanded"
      :uses-desktop-layout="usesDesktopGraphLayout"
      @zoom-out="zoomOut"
      @zoom-in="zoomIn"
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
          class="relative z-1 block w-full touch-none select-none focus-visible:outline-[3px] focus-visible:outline-offset-[-6px] focus-visible:outline-accent/40 focus:outline-none h-full"
          :class="[
            isGraphExpanded ? 'min-h-dvh' : 'min-h-[min(72dvh,560px)] md:min-h-[360px]',
            canDragGraphNodes ? 'cursor-grab' : 'cursor-default',
            isPanning && 'cursor-grabbing'
          ]"
          :viewBox="viewBox"
          role="img"
          tabindex="0"
          aria-keyshortcuts="+ - ArrowUp ArrowDown ArrowLeft ArrowRight 0 Home"
          :aria-label="graphInteractionAriaLabel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
          @lostpointercapture="handlePointerUp"
          @wheel="handleWheel"
          @dblclick="handleDoubleClick"
          @keydown="handleKeydown"
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
              :has-resolved-endpoints="hasResolvedEndpoints"
              :link-endpoint-x="linkEndpointX"
              :link-endpoint-y="linkEndpointY"
            />
            <GraphCanvasNodes
              :nodes="renderedNodes"
              :root-node-id="rootNodeId"
              :selected-node-id="selectedNodeId"
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
