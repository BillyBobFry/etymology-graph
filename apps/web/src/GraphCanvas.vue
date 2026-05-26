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
import { CircleHelp, Minus, Plus, X } from "@lucide/vue";
import type { Point } from "@zag-js/menu";
import { computed, onBeforeUnmount, ref, watch } from "vue";

import type { EdgeType, EtymologyGraph, GraphTraversalNode } from "@etymology-graph/graph";
import { useGraphViewport } from "./composables/useGraphViewport";
import Button from "./uiComponents/Button.vue";
import ContextMenu from "./uiComponents/ContextMenu.vue";
import IconButton from "./uiComponents/IconButton.vue";
import Popover from "./uiComponents/Popover.vue";

const canvasWidth = 920;
const canvasHeight = 560;
const centerX = canvasWidth / 2;
const centerY = canvasHeight / 2;
const initialSiblingXSpacing = 74;
const initialDepthYSpacing = 64;
const depthBandSpacing = 92;
const labelClearanceRadius = 58;
const layoutWarmupTicks = 180;

type PositionedGraphNode = GraphTraversalNode & SimulationNodeDatum;

type PositionedGraphLink = SimulationLinkDatum<PositionedGraphNode> & {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  uncertain: boolean;
};

type LinkEndpoint = "source" | "target";

type NodeContextAction = "load-children" | "view-etymology" | "view-doublets";

type ContextMenuInstance = {
  close(): void;
  openAt(point: Point): void;
};

const props = defineProps<{
  graph: EtymologyGraph;
}>();

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
const isGraphGuideOpen = ref(false);
const nodeContextMenu = ref<ContextMenuInstance | null>(null);
const {
  svgRef,
  zoomPercentage,
  viewportTransform,
  isPanning,
  zoomIn,
  zoomOut,
  resetViewport,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleWheel,
  handleDoubleClick,
  handleKeydown
} = useGraphViewport({
  width: canvasWidth,
  height: canvasHeight
});

let simulation: Simulation<PositionedGraphNode, PositionedGraphLink> | null = null;

const renderedNodes = computed(() => {
  tickVersion.value;
  return nodes.value;
});

const renderedLinks = computed(() => {
  tickVersion.value;
  return links.value;
});

const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value));
const contextNode = computed(() => nodes.value.find((node) => node.id === contextNodeId.value));
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
  () => props.graph,
  (graph) => {
    buildSimulation(graph);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopSimulation();
});

/** Builds a fresh force layout whenever the user opens a different graph. */
function buildSimulation(graph: EtymologyGraph): void {
  stopSimulation();

  const generationLevels = graphGenerationLevels(graph);
  const maxGenerationLevel = Math.max(1, ...generationLevels.values());
  const generationCounts = new Map<number, number>();
  const generationIndexes = new Map<number, number>();

  for (const node of graph.nodes) {
    const generationLevel = generationLevels.get(node.id) ?? 0;
    generationCounts.set(generationLevel, (generationCounts.get(generationLevel) ?? 0) + 1);
  }

  const positionedNodes = graph.nodes.map((node) => {
    const generationLevel = generationLevels.get(node.id) ?? 0;
    const generationIndex = generationIndexes.get(generationLevel) ?? 0;
    const generationCount = generationCounts.get(generationLevel) ?? 1;
    const centeredGenerationIndex = generationIndex - (generationCount - 1) / 2;

    generationIndexes.set(generationLevel, generationIndex + 1);

    return {
      ...node,
      x: centerX + centeredGenerationIndex * initialSiblingXSpacing,
      y: generationBandY(generationLevel, maxGenerationLevel, initialDepthYSpacing)
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
    .force("branchX", forceX<PositionedGraphNode>(centerX).strength(0.035))
    .force(
      "generationY",
      forceY<PositionedGraphNode>((node) =>
        generationBandY(generationLevels.get(node.id) ?? 0, maxGenerationLevel, depthBandSpacing)
      ).strength(0.16)
    )
    .stop();

  simulation.tick(layoutWarmupTicks);

  nodes.value = positionedNodes;
  links.value = positionedLinks;
  selectedNodeId.value = undefined;
  contextNodeId.value = undefined;
  isGraphGuideOpen.value = false;
  nodeContextMenu.value?.close();
  tickVersion.value += 1;
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

/** Places older linguistic generations lower so source-to-descendant edges read upward. */
function generationBandY(generationLevel: number, maxGenerationLevel: number, spacing: number): number {
  return centerY + (generationLevel - maxGenerationLevel / 2) * spacing;
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

/** Provides a readable fallback label for links while the simulation is settling. */
function edgeLabel(type: EdgeType): string {
  return type.replaceAll("_", " ");
}

/** Selects a node so dense lexical metadata can live outside the graph label. */
function selectNode(node: PositionedGraphNode): void {
  selectedNodeId.value = node.id;
}

/** Clears the detail card without rebuilding or disturbing the graph simulation. */
function clearSelectedNode(): void {
  selectedNodeId.value = undefined;
}

/** Opens node actions at the browser context-menu position without selecting unrelated graph controls. */
function openNodeContextMenu(event: MouseEvent, node: PositionedGraphNode): void {
  event.preventDefault();
  contextNodeId.value = node.id;
  nodeContextMenu.value?.openAt({
    x: event.clientX,
    y: event.clientY
  });
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
  <div class="graph-canvas">
    <div class="graph-controls" role="group" aria-label="Graph controls">
      <IconButton label="Zoom out" size="sm" @click="zoomOut">
        <Minus :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
      <output aria-live="polite">{{ zoomPercentage }}%</output>
      <IconButton label="Zoom in" size="sm" @click="zoomIn">
        <Plus :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
      <Button variant="ghost" size="sm" @click="resetViewport">Reset</Button>
      <Popover v-model:open="isGraphGuideOpen">
        <template #trigger="{ triggerProps, isOpen }">
          <IconButton v-bind="triggerProps" label="Graph guide" size="sm" :active="isOpen">
            <CircleHelp :size="16" stroke-width="2.75" aria-hidden="true" />
          </IconButton>
        </template>

        <template #default="{ titleProps, descriptionProps }">
          <div class="graph-guide-card">
            <p v-bind="titleProps" class="graph-guide-title">Graph guide</p>
            <dl v-bind="descriptionProps">
              <div>
                <dt>Click</dt>
                <dd>View term details.</dd>
              </div>
              <div>
                <dt>Right-click</dt>
                <dd>Open node actions.</dd>
              </div>
              <div>
                <dt>Edges</dt>
                <dd>Point from a term toward its source.</dd>
              </div>
              <div>
                <dt>Dashed edge</dt>
                <dd>Marks an uncertain relationship.</dd>
              </div>
              <div>
                <dt>Pan and zoom</dt>
                <dd>Drag, wheel, pinch, or use keyboard shortcuts.</dd>
              </div>
            </dl>
          </div>
        </template>
      </Popover>
    </div>

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
              :class="{ uncertain: link.uncertain }"
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
            class="graph-node"
            :class="{ root: node.id === graph.rootNodeId, selected: node.id === selectedNodeId }"
            :transform="`translate(${nodeX(node)}, ${nodeY(node)})`"
            role="button"
            tabindex="0"
            :aria-label="nodeAriaLabel(node)"
            @click.stop="selectNode(node)"
            @contextmenu.stop="openNodeContextMenu($event, node)"
            @pointerdown.stop
            @dblclick.stop
            @keydown="handleNodeKeydown($event, node)"
          >
            <circle :r="nodeRadius(node)" />
            <text :y="nodeRadius(node) + 18" text-anchor="middle">
              {{ node.word }}
            </text>
            <text class="node-lang" :y="nodeRadius(node) + 34" text-anchor="middle">
              {{ node.langName ?? node.langCode }}
            </text>
            <text v-if="formatIpa(node)" class="node-ipa" :y="nodeRadius(node) + 50" text-anchor="middle">
              {{ formatIpa(node) }}
            </text>
          </g>
        </g>
      </g>
    </svg>

    <aside v-if="selectedNode" class="node-detail-card" aria-live="polite">
      <div class="flex items-center justify-between">
        <p class="node-detail-kicker">{{ selectedNode.langName ?? selectedNode.langCode }}</p>
        <IconButton label="Close" size="sm" @click="clearSelectedNode">
          <X :size="16" stroke-width="2.75" aria-hidden="true" />
        </IconButton>
      </div>
      <div class="node-detail-heading">
        <h3>{{ selectedNode.word }}</h3>
      </div>

      <dl>
        <div v-if="formatIpa(selectedNode)">
          <dt>Pronunciation</dt>
          <dd>{{ formatIpa(selectedNode) }}</dd>
        </div>
        <div v-if="selectedNode.lexicalSummary?.pos">
          <dt>Part of speech</dt>
          <dd>{{ selectedNode.lexicalSummary.pos }}</dd>
        </div>
        <div v-if="selectedNode.lexicalSummary?.definition">
          <dt>Definition</dt>
          <dd>{{ selectedNode.lexicalSummary.definition }}</dd>
        </div>
        <div v-if="selectedNode.lexicalSummary?.entryCount && selectedNode.lexicalSummary.entryCount > 1">
          <dt>Entries</dt>
          <dd>{{ selectedNode.lexicalSummary.entryCount }} lexical entries imported</dd>
        </div>
      </dl>
    </aside>

    <ContextMenu
      ref="nodeContextMenu"
      label="Graph node actions"
      :items="nodeContextMenuItems"
      @select="handleNodeContextAction"
    />
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
  font-weight: 900;
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
  font-weight: 900;
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
  font-weight: 900;
}

.graph-guide-card dd {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 12px;
  line-height: 1.4;
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

.graph-links line {
  stroke: color-mix(in oklch, var(--theme-graph-edge) 64%, transparent);
  stroke-linecap: round;
  stroke-width: 2;
  marker-end: url("#arrowhead");
}

.graph-links line.uncertain {
  stroke-dasharray: 6 7;
}

.graph-node {
  cursor: pointer;
  outline: none;
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

.graph-node text {
  fill: var(--theme-text);
  font-size: 18px;
  font-weight: 800;
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
  font-weight: 900;
  letter-spacing: 0.04em;
}

.graph-node .node-ipa {
  fill: color-mix(in oklch, var(--theme-ancestor) 72%, var(--theme-text-muted));
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 850;
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

.node-detail-kicker {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 900;
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
  font-weight: 950;
  letter-spacing: -0.04em;
}

.node-detail-card dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

.node-detail-card dt {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.node-detail-card dd {
  margin: 2px 0 0;
  color: var(--theme-text);
  font-size: 14px;
  line-height: 1.5;
}
</style>
