<script setup lang="ts">
import type { EtymologyGraph, GraphTraversalNode } from "@etymology-graph/graph";

import Skeleton from "../../uiComponents/Skeleton.vue";
import GraphCanvas from "./GraphCanvas.vue";
import type { GraphNodeAnnotation } from "./graphAnnotations";
import type { GraphNodeHighlight } from "./graphNodeHighlights";
import type { GraphLayoutPreset } from "./composables/useGraphLayout";

type GraphEvidenceStatus = "idle" | "loading" | "success" | "empty" | "error";

withDefaults(
  defineProps<{
    status: GraphEvidenceStatus;
    graph: EtymologyGraph | null;
    layoutPreset?: GraphLayoutPreset;
    nodeHighlights?: GraphNodeHighlight[];
    showControls?: boolean;
    annotations?: GraphNodeAnnotation[];
    loadingLabel?: string;
    errorText?: string;
    emptyText?: string;
  }>(),
  {
    layoutPreset: () => ({ type: "auto" }),
    nodeHighlights: () => [],
    showControls: true,
    annotations: () => [],
    loadingLabel: "Loading graph...",
    errorText: "This graph could not be loaded.",
    emptyText: "No graph path is available for this entry."
  }
);

const emit = defineEmits<{
  "load-children": [node: GraphTraversalNode];
}>();
</script>

<template>
  <div class="grid min-w-0 gap-4">
    <div
      v-if="status === 'loading'"
      class="relative min-h-[360px] min-w-0 overflow-hidden rounded-md border border-border bg-surface/75 p-4 shadow-paper"
      role="status"
      aria-busy="true"
    >
      <Skeleton
        variant="block"
        tone="raised"
        class="absolute inset-0 h-full w-full rounded-md border-0"
      />
      <div class="relative z-1 grid min-h-[328px] min-w-0 place-items-center">
        <div class="relative h-48 w-full max-w-[min(100%,32rem)] sm:h-56 sm:max-w-2xl" aria-hidden="true">
          <Skeleton variant="circle" tone="raised" class="absolute left-[8%] top-[42%] size-10 sm:size-14" />
          <Skeleton variant="circle" tone="raised" class="absolute left-[42%] top-[12%] size-12 sm:size-16" />
          <Skeleton variant="circle" tone="raised" class="absolute right-[10%] top-[46%] size-10 sm:size-14" />
          <Skeleton variant="line" class="absolute left-[4%] top-[74%] w-[clamp(3.5rem,22vw,6rem)]" />
          <Skeleton variant="line" class="absolute left-[38%] top-[46%] w-[clamp(4.5rem,28vw,8rem)]" />
          <Skeleton variant="line" class="absolute right-[6%] top-[78%] w-[clamp(3.5rem,22vw,6rem)]" />
        </div>
        <p class="absolute bottom-4 left-4 font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
          {{ loadingLabel }}
        </p>
      </div>
    </div>
    <div
      v-else-if="status === 'error'"
      class="rounded-md border border-danger/50 bg-surface/75 p-5 text-danger"
    >
      {{ errorText }}
    </div>
    <div
      v-else-if="status === 'empty'"
      class="rounded-md border border-border bg-surface/75 p-5 text-text-muted"
    >
      {{ emptyText }}
    </div>
    <GraphCanvas
      v-else-if="graph"
      :graph="graph"
      :layout-preset="layoutPreset"
      :node-highlights="nodeHighlights"
      :show-controls="showControls"
      :annotations="annotations"
      @load-children="emit('load-children', $event)"
    />
  </div>
</template>
