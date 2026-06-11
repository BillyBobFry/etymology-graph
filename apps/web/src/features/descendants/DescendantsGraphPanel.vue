<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { computed, ref, watch } from "vue";

import type { DescendantsQuery } from "@etymology-graph/graph";

import GraphCanvas from "../graph/GraphCanvas.vue";
import { useDescendantsGraphQuery } from "../graph/composables/useDescendantsGraphQuery";
import type { GraphNodeHighlight } from "../graph/graphNodeHighlights";
import Button from "../../uiComponents/Button.vue";
import Skeleton from "../../uiComponents/Skeleton.vue";
import { isModernLanguageCode, modernLanguageCodes } from "./descendantGraphScope";

type DescendantsGraphStatus = "loading" | "success" | "empty" | "error";
type GraphCanvasInstance = InstanceType<typeof GraphCanvas>;

const props = withDefaults(
  defineProps<{
    root: DescendantsQuery;
    emptyGuidance?: string;
  }>(),
  {
    emptyGuidance: "This source may need broader coverage before its descendants appear here. Try another word or reduce the graph scope."
  }
);

const panelElement = ref<HTMLElement | null>(null);
const descendantsGraphCanvas = ref<GraphCanvasInstance | null>(null);
const isLargeDescendantPreview = useMediaQuery("(min-width: 768px)");
const showsAllModernDescendants = ref(false);
const collapsedModernDescendantPreviewLimit = computed(() => (isLargeDescendantPreview.value ? 8 : 5));
const descendantsInput = computed<DescendantsQuery>(() => ({
  ...props.root,
  terminalLangCodes: [...modernLanguageCodes]
}));
const graphRenderKey = computed(
  () => `${props.root.langCode}:${props.root.word}:${props.root.maxDepth}:${props.root.limit}`
);
const descendantsGraphQuery = useDescendantsGraphQuery(descendantsInput);
const descendantsGraph = computed(() => descendantsGraphQuery.data.value?.graph ?? null);
const descendantsGraphStatus = computed<DescendantsGraphStatus>(() => {
  if (descendantsGraphQuery.isPending.value || (descendantsGraphQuery.isFetching.value && !descendantsGraphQuery.data.value)) {
    return "loading";
  }

  if (descendantsGraphQuery.isError.value) {
    return "error";
  }

  return descendantsGraph.value ? "success" : "empty";
});
const nodeHighlights = computed<GraphNodeHighlight[]>(() => {
  const graph = descendantsGraph.value;

  if (!graph) {
    return [];
  }

  return [
    { nodeId: graph.rootNodeId, tone: "primary" },
    ...graph.nodes
      .filter((node) => node.depth > 0 && isModernLanguageCode(node.langCode))
      .map((node) => ({ nodeId: node.id, tone: "terminal" }) satisfies GraphNodeHighlight)
  ];
});
const modernDescendants = computed(() => {
  const graph = descendantsGraph.value;

  if (!graph) {
    return [];
  }

  const seenNodeLabels = new Set<string>();

  return graph.nodes
    .filter((node) => node.depth > 0 && isModernLanguageCode(node.langCode))
    .map((node) => ({
      id: node.id,
      languageLabel: node.langName ?? node.langCode,
      word: node.word,
      depth: node.depth
    }))
    .filter((node) => {
      const label = `${node.languageLabel}:${node.word}`;

      if (seenNodeLabels.has(label)) {
        return false;
      }

      seenNodeLabels.add(label);
      return true;
    })
    .sort((left, right) => left.languageLabel.localeCompare(right.languageLabel) || left.word.localeCompare(right.word) || left.depth - right.depth);
});
const modernDescendantPreview = computed(() => {
  if (showsAllModernDescendants.value) {
    return modernDescendants.value;
  }

  return modernDescendants.value.slice(0, collapsedModernDescendantPreviewLimit.value);
});
const hiddenModernDescendantCount = computed(() => Math.max(modernDescendants.value.length - modernDescendantPreview.value.length, 0));
const errorMessage = computed(() => descendantsGraphQuery.error.value?.message ?? "This descendant graph could not load.");

watch(descendantsInput, () => {
  showsAllModernDescendants.value = false;
});

/** Reveals a listed modern endpoint in the graph while keeping the panel itself in view. */
function focusModernDescendant(nodeId: string): void {
  panelElement.value?.scrollIntoView({
    behavior: "instant",
    block: "nearest"
  });

  descendantsGraphCanvas.value?.focusNode(nodeId);
}
</script>

<template>
  <div ref="panelElement" class="grid gap-5">
    <section class="grid gap-3 py-1">
      <p class="font-label text-xs font-black uppercase tracking-[0.14em] text-text-muted">
        Modern terms
      </p>
      <div
        v-if="descendantsGraphStatus === 'loading'"
        class="flex flex-wrap gap-2"
        aria-hidden="true"
      >
        <Skeleton class="h-7 w-24 rounded-full" />
        <Skeleton class="h-7 w-28 rounded-full" />
        <Skeleton class="h-7 w-20 rounded-full" />
        <Skeleton class="h-7 w-32 rounded-full" />
      </div>
      <p v-else-if="modernDescendants.length === 0" class="text-sm leading-6 text-text-muted">
        No modern-language endpoints in the current graph scope.
      </p>
      <div v-else class="flex flex-wrap items-end gap-x-5 gap-y-3">
        <dl class="contents">
          <div
            v-for="node in modernDescendantPreview"
            :key="node.id"
            class="grid gap-0.5"
          >
            <dt class="font-label text-[0.62rem] font-black uppercase tracking-[0.14em] text-text-muted">
              {{ node.languageLabel }}
            </dt>
            <dd>
              <button
                type="button"
                class="cursor-pointer rounded-md text-left text-base font-black leading-tight tracking-[-0.02em] text-text underline decoration-border-strong decoration-1 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-accent/40"
                :aria-label="`Show ${node.word} (${node.languageLabel}) in the graph`"
                @click="focusModernDescendant(node.id)"
              >
                {{ node.word }}
              </button>
            </dd>
          </div>
        </dl>
        <Button
          v-if="hiddenModernDescendantCount > 0"
          variant="secondary"
          size="sm"
          class="mb-0.5 shrink-0"
          :aria-label="`Show ${hiddenModernDescendantCount} more modern terms`"
          :aria-expanded="showsAllModernDescendants"
          @click="showsAllModernDescendants = true"
        >
          +{{ hiddenModernDescendantCount }} more
        </Button>
      </div>
    </section>

    <div
      v-if="descendantsGraphStatus === 'loading'"
      class="grid min-h-[min(72dvh,560px)] gap-3 rounded-md border border-border bg-background/40 p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span class="sr-only">Loading the descendant graph</span>
      <div class="flex justify-end gap-2">
        <Skeleton class="h-9 w-9" tone="raised" />
        <Skeleton class="h-9 w-9" tone="raised" />
        <Skeleton class="h-9 w-24" tone="raised" />
      </div>
      <Skeleton variant="block" class="min-h-[420px]" />
    </div>

    <section
      v-else-if="descendantsGraphStatus === 'empty'"
      class="max-w-2xl py-4"
      aria-live="polite"
    >
      <h3 class="text-xl font-bold leading-tight">
        No descendant graph in the index yet.
      </h3>
      <p class="mt-3 leading-7 text-text-muted">
        {{ emptyGuidance }}
      </p>
    </section>

    <p v-else-if="descendantsGraphStatus === 'error'" class="text-danger">
      {{ errorMessage }}
    </p>

    <GraphCanvas
      v-else-if="descendantsGraph"
      ref="descendantsGraphCanvas"
      :key="graphRenderKey"
      :graph="descendantsGraph"
      orientation-mode="fan-out"
      :node-highlights="nodeHighlights"
    />
  </div>
</template>
