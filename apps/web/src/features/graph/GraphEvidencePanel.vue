<script setup lang="ts">
import type { EtymologyGraph, GraphTraversalNode } from "@etymology-graph/graph";

import Skeleton from "../../uiComponents/Skeleton.vue";
import GraphCanvas from "./GraphCanvas.vue";
import type { GraphLayoutPreset } from "./composables/useGraphLayout";

type GraphEvidenceStatus = "idle" | "loading" | "success" | "empty" | "error";

withDefaults(
  defineProps<{
    status: GraphEvidenceStatus;
    graph: EtymologyGraph | null;
    layoutPreset?: GraphLayoutPreset;
    rootNodeId?: string;
    loadingLabel?: string;
    errorText?: string;
    emptyText?: string;
  }>(),
  {
    layoutPreset: "auto",
    rootNodeId: undefined,
    loadingLabel: "Loading graph evidence...",
    errorText: "Graph evidence failed to load.",
    emptyText: "No graph evidence is available for this entry."
  }
);

const emit = defineEmits<{
  "load-children": [node: GraphTraversalNode];
}>();
</script>

<template>
  <div class="grid gap-4">
    <div
      v-if="status === 'loading'"
      class="relative min-h-[360px] overflow-hidden rounded-md border border-border bg-surface/75 p-4 shadow-paper"
      role="status"
      aria-busy="true"
    >
      <Skeleton
        variant="block"
        tone="raised"
        class="absolute inset-0 h-full w-full rounded-md border-0"
      />
      <div class="relative z-1 grid min-h-[328px] place-items-center">
        <div class="relative h-56 w-full max-w-2xl" aria-hidden="true">
          <Skeleton variant="circle" tone="raised" class="absolute left-[8%] top-[42%] size-14" />
          <Skeleton variant="circle" tone="raised" class="absolute left-[42%] top-[12%] size-16" />
          <Skeleton variant="circle" tone="raised" class="absolute right-[10%] top-[46%] size-14" />
          <Skeleton variant="line" class="absolute left-[4%] top-[74%] w-24" />
          <Skeleton variant="line" class="absolute left-[38%] top-[46%] w-32" />
          <Skeleton variant="line" class="absolute right-[6%] top-[78%] w-24" />
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
      :root-node-id="rootNodeId"
      @load-children="emit('load-children', $event)"
    />
  </div>
</template>
