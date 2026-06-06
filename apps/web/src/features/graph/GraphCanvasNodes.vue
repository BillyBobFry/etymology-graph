<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

import type { PositionedGraphNode } from "./composables/useGraphLayout";
import { graphNodeRadius } from "./graphCanvasConstants";
import { formatIpaPronunciation, nodeAriaLabel } from "./graphNodeDisplay";

const props = defineProps<{
  nodes: PositionedGraphNode[];
  highlightedNodeIds: string[];
  selectedNodeId?: string;
  contextNodeId?: string;
  contextMenuOpen: boolean;
  zoom: number;
  usesDesktopGraphLayout: boolean;
  canDragNodes: boolean;
  getContextTriggerProps: (options: { value: string }) => HTMLAttributes;
  nodeX: (node: PositionedGraphNode) => number;
  nodeY: (node: PositionedGraphNode) => number;
  isNodeDragging: (node: PositionedGraphNode) => boolean;
}>();

const emit = defineEmits<{
  click: [node: PositionedGraphNode];
  "pointer-down": [event: PointerEvent, node: PositionedGraphNode];
  "pointer-move": [event: PointerEvent, node: PositionedGraphNode];
  "pointer-up": [event: PointerEvent, node: PositionedGraphNode];
  keydown: [event: KeyboardEvent, node: PositionedGraphNode];
}>();

const graphNodeClass = "group outline-none";
const draggableGraphNodeClass = "cursor-grab";
const draggingGraphNodeClass = "cursor-grabbing";
const graphNodeCircleClass =
  "fill-graph-node stroke-descendant stroke-[3] transition-[fill,filter,stroke,stroke-width] duration-150 ease-in [filter:drop-shadow(0_1px_2px_color-mix(in_oklch,var(--theme-text)_16%,transparent))] group-hover:fill-surface-raised group-hover:stroke-accent group-hover:stroke-[5] group-hover:[filter:drop-shadow(0_2px_4px_color-mix(in_oklch,var(--theme-text)_22%,transparent))] group-focus-visible:fill-surface-raised group-focus-visible:stroke-accent group-focus-visible:stroke-[5] group-focus-visible:[filter:drop-shadow(0_2px_4px_color-mix(in_oklch,var(--theme-text)_22%,transparent))]";
const highlightedGraphNodeCircleClass =
  "fill-graph-root stroke-ancestor stroke-[4] group-hover:fill-[color-mix(in_oklch,var(--theme-graph-root)_86%,var(--theme-accent))] group-focus-visible:fill-[color-mix(in_oklch,var(--theme-graph-root)_86%,var(--theme-accent))]";
const selectedGraphNodeCircleClass = "!stroke-accent !stroke-[5]";
const contextOpenGraphNodeCircleClass = "!fill-surface-muted !stroke-accent !stroke-[5]";
const draggingGraphNodeCircleClass = "!fill-surface-raised !stroke-accent !stroke-[5]";
const graphNodeTextClass =
  "fill-text font-bold [paint-order:stroke] [stroke:color-mix(in_oklch,var(--theme-surface)_88%,transparent)] [stroke-linejoin:round] [stroke-width:4px]";
const graphNodeLanguageTextClass =
  `${graphNodeTextClass} fill-text-muted font-label uppercase tracking-[0.12em]`;
const graphNodeIpaTextClass =
  `${graphNodeTextClass} fill-[color-mix(in_oklch,var(--theme-ancestor)_72%,var(--theme-text-muted))] font-normal tracking-[0.01em]`;
const graphNodeWordFontSize = computed(() => labelBaseSize(18, 28) * dampenedLabelFontScale(props.zoom));
const graphNodeMetaFontSize = computed(() => labelBaseSize(12, 18) * dampenedLabelFontScale(props.zoom));
const graphNodeWordLabelY = computed(() => graphNodeRadius + labelBaseSize(18, 24));
const graphNodeLanguageLabelY = computed(() => graphNodeRadius + labelBaseSize(34, 46));
const graphNodeIpaLabelY = computed(() => graphNodeRadius + labelBaseSize(50, 68));
const highlightedNodeIdSet = computed(() => new Set(props.highlightedNodeIds));

/** Starts node dragging only when the current surface can safely own drag gestures. */
function handlePointerDown(event: PointerEvent, node: PositionedGraphNode): void {
  if (!props.canDragNodes) {
    return;
  }

  emit("pointer-down", event, node);
}

/** Keeps disabled mobile node drags from swallowing canvas pan and scroll gestures. */
function handlePointerMove(event: PointerEvent, node: PositionedGraphNode): void {
  if (!props.canDragNodes) {
    return;
  }

  emit("pointer-move", event, node);
}

/** Completes node dragging only for surfaces that started a node drag. */
function handlePointerUp(event: PointerEvent, node: PositionedGraphNode): void {
  if (!props.canDragNodes) {
    return;
  }

  emit("pointer-up", event, node);
}

/** Keeps graph labels readable while preventing zoomed-in text from crowding nearby nodes. */
function dampenedLabelFontScale(zoom: number): number {
  const safeZoom = Math.max(zoom, 0.01);
  return clamp(Math.pow(safeZoom, -0.42), 0.62, 1.18);
}

/** Picks larger SVG label measurements for narrow screens where the graph is physically smaller. */
function labelBaseSize(desktopSize: number, mobileSize: number): number {
  return props.usesDesktopGraphLayout ? desktopSize : mobileSize;
}

/** Bounds label scaling so the graph remains useful at both overview and close-reading zoom levels. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
</script>

<template>
  <g class="graph-nodes">
    <g
      v-for="node in nodes"
      :key="node.id"
      v-bind="usesDesktopGraphLayout ? getContextTriggerProps({ value: node.id }) : {}"
      :class="[graphNodeClass, canDragNodes && draggableGraphNodeClass, isNodeDragging(node) && draggingGraphNodeClass]"
      :transform="`translate(${nodeX(node)}, ${nodeY(node)})`"
      role="button"
      tabindex="0"
      :aria-label="nodeAriaLabel(node)"
      @click.stop="emit('click', node)"
      @pointerdown="handlePointerDown($event, node)"
      @pointermove="handlePointerMove($event, node)"
      @pointerup="handlePointerUp($event, node)"
      @pointercancel="handlePointerUp($event, node)"
      @lostpointercapture="handlePointerUp($event, node)"
      @dblclick.stop
      @keydown="emit('keydown', $event, node)"
    >
      <circle
        :class="[
          graphNodeCircleClass,
          highlightedNodeIdSet.has(node.id) && highlightedGraphNodeCircleClass,
          node.id === selectedNodeId && selectedGraphNodeCircleClass,
          usesDesktopGraphLayout && node.id === contextNodeId && contextMenuOpen && contextOpenGraphNodeCircleClass,
          isNodeDragging(node) && draggingGraphNodeCircleClass
        ]"
        :r="graphNodeRadius"
      />
      <text :class="graphNodeTextClass" :font-size="graphNodeWordFontSize" :y="graphNodeWordLabelY" text-anchor="middle">
        {{ node.word }}
      </text>
      <text :class="graphNodeLanguageTextClass" :font-size="graphNodeMetaFontSize" :y="graphNodeLanguageLabelY" text-anchor="middle">
        {{ node.langName ?? node.langCode }}
      </text>
      <text
        v-if="formatIpaPronunciation(node)"
        :class="graphNodeIpaTextClass"
        :font-size="graphNodeMetaFontSize"
        :y="graphNodeIpaLabelY"
        text-anchor="middle"
      >
        {{ formatIpaPronunciation(node) }}
      </text>
    </g>
  </g>
</template>
