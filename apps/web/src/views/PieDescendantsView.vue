<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import type { DescendantsQuery } from "@etymology-graph/graph";

import GlossaryText from "../features/glossary/GlossaryText.vue";
import type { GlossaryTextSegment } from "../features/glossary/linguisticGlossary";
import GraphCanvas from "../features/graph/GraphCanvas.vue";
import { useDescendantsGraphQuery } from "../features/graph/composables/useDescendantsGraphQuery";
import type { GraphNodeHighlight } from "../features/graph/graphNodeHighlights";
import {
  defaultPieDescendantDepth,
  defaultPieDescendantLimit,
  pieDescendantConceptForSlug,
  pieDescendantConcepts,
  pieDescendantTerminalLangCodes,
  type PieDescendantConcept
} from "../features/pieDescendants/pieDescendantConcepts";
import Divider from "../uiComponents/Divider.vue";
import PageMain from "../uiComponents/PageMain.vue";
import ResultsAccordion from "../uiComponents/ResultsAccordion.vue";
import Skeleton from "../uiComponents/Skeleton.vue";

type DescendantsGraphStatus = "loading" | "success" | "empty" | "error";

const route = useRoute();
const router = useRouter();

const introSegments: GlossaryTextSegment[] = [
  "Choose a common concept, then inspect the ",
  { text: "descendant", termId: "descendant" },
  " graph from its ",
  { text: "reconstructed", termId: "reconstructed" },
  " Proto-Indo-European source."
];
const pieDefinitionSegments: GlossaryTextSegment[] = [
  "Proto-Indo-European is the ",
  { text: "reconstructed", termId: "reconstructed" },
  " source language behind many words in Europe and parts of Asia. It was not written down directly; linguists infer it by comparing related languages."
];
const pieGraphInterestSegments: GlossaryTextSegment[] = [
  "Instead of tracing one modern word backward, this view starts with an older source and looks forward. The graph shows how one PIE word branches into ",
  { text: "descendant", termId: "descendant" },
  " words across later languages."
];

const selectedConceptSlug = computed(() => firstQueryValue(route.query.concept));
const selectedConcept = computed(() => pieDescendantConceptForSlug(selectedConceptSlug.value));
const selectedDepth = computed(() => numberQueryValue(route.query.depth, defaultPieDescendantDepth, 1, 12));
const selectedLimit = computed(() => numberQueryValue(route.query.limit, defaultPieDescendantLimit, 1, 300));
const conceptIds = computed(() => pieDescendantConcepts.map((concept) => concept.slug));
const expandedConceptSlug = ref<string | undefined>(selectedConceptSlug.value);
const expandedConceptModel = computed({
  get: () => expandedConceptSlug.value,
  set: (slug) => {
    expandedConceptSlug.value = slug;

    if (slug) {
      updateConceptQuery(slug);
    }
  }
});
const descendantsInput = computed<DescendantsQuery>(() => ({
  ...selectedConcept.value.root,
  maxDepth: selectedDepth.value,
  limit: selectedLimit.value,
  terminalLangCodes: [...pieDescendantTerminalLangCodes]
}));
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
const terminalLangCodeSet = computed(() => new Set<string>(pieDescendantTerminalLangCodes));
const nodeHighlights = computed<GraphNodeHighlight[]>(() => {
  const graph = descendantsGraph.value;

  if (!graph) {
    return [];
  }

  return [
    { nodeId: graph.rootNodeId, tone: "primary" },
    ...graph.nodes
      .filter((node) => node.depth > 0 && terminalLangCodeSet.value.has(node.langCode))
      .map((node) => ({ nodeId: node.id, tone: "terminal" }) satisfies GraphNodeHighlight)
  ];
});
const selectedModernDescendantPreview = computed(() => {
  const graph = descendantsGraph.value;

  if (!graph) {
    return [];
  }

  const seenNodeLabels = new Set<string>();

  return graph.nodes
    .filter((node) => node.depth > 0 && terminalLangCodeSet.value.has(node.langCode))
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
    .sort((left, right) => left.depth - right.depth || left.languageLabel.localeCompare(right.languageLabel) || left.word.localeCompare(right.word))
    .slice(0, 5);
});
const errorMessage = computed(() => descendantsGraphQuery.error.value?.message ?? "This descendant graph could not load.");

watch(selectedConceptSlug, (slug) => {
  expandedConceptSlug.value = slug;
});

/** Reads a single route query value while ignoring repeated query params. */
function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const firstValue = value[0];

    return typeof firstValue === "string" ? firstValue : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

/** Parses numeric graph scope from the URL, falling back when links are hand-edited. */
function numberQueryValue(value: unknown, fallback: number, min: number, max: number): number {
  const rawValue = firstQueryValue(value);
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(Math.max(parsedValue, min), max);
}

/** Moves the accordion selection into the route so each opened root can be shared. */
function updateConceptQuery(slug: string): void {
  void router.push({
    name: "pie-descendants",
    query: {
      ...route.query,
      concept: slug,
      depth: String(selectedDepth.value),
      limit: String(selectedLimit.value)
    }
  });
}

/** Looks up a typed concept for the shared accordion slot id. */
function conceptForSlug(slug: string): PieDescendantConcept {
  return pieDescendantConceptForSlug(slug);
}

</script>

<template>
  <PageMain>
    <section class="pb-10">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        PIE descendants
      </p>
      <h1 class="max-w-4xl text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        See where one old word ends up.
      </h1>
      <p class="mt-5 max-w-3xl text-lg leading-8 text-text-page-muted">
        <GlossaryText :segments="introSegments" />
      </p>
    </section>

    <section class="grid gap-6 pb-10 text-text-page-muted sm:grid-cols-2">
      <div class="max-w-2xl">
        <h2 class="text-2xl font-black leading-tight tracking-[-0.035em] text-text">
          What is Proto-Indo-European?
        </h2>
        <p class="mt-3 leading-7">
          <GlossaryText :segments="pieDefinitionSegments" />
        </p>
      </div>
      <div class="max-w-2xl">
        <h2 class="text-2xl font-black leading-tight tracking-[-0.035em] text-text">
          Why start there?
        </h2>
        <p class="mt-3 leading-7">
          <GlossaryText :segments="pieGraphInterestSegments" />
        </p>
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="pie-concepts-heading">
      <div class="grid gap-2">
        <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Common concepts
        </p>
        <h2 id="pie-concepts-heading" class="text-3xl font-black leading-tight tracking-[-0.04em] text-text">
          Select a PIE source word.
        </h2>
      </div>

      <ResultsAccordion
        v-model="expandedConceptModel"
        :item-ids="conceptIds"
        labelled-by="pie-concepts-heading"
      >
        <template #trigger="{ itemId }">
          <span class="grid min-w-0 gap-1.5">
            <span class="truncate text-lg font-black leading-none tracking-[-0.045em] text-text sm:text-xl">
              {{ conceptForSlug(itemId).root.word }}
            </span>
            <span class="font-label text-xs font-bold uppercase tracking-widest text-text-muted sm:text-sm">
              {{ conceptForSlug(itemId).label }}
            </span>
          </span>
        </template>

        <template #panel>
          <div class="grid gap-5">
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
              <p v-else-if="selectedModernDescendantPreview.length === 0" class="text-sm leading-6 text-text-muted">
                No modern-language endpoints in the current graph scope.
              </p>
              <dl v-else class="flex flex-wrap gap-x-5 gap-y-3">
                <div
                  v-for="node in selectedModernDescendantPreview"
                  :key="node.id"
                  class="grid gap-0.5"
                >
                  <dt class="font-label text-[0.62rem] font-black uppercase tracking-[0.14em] text-text-muted">
                    {{ node.languageLabel }}
                  </dt>
                  <dd class="text-base font-black leading-tight tracking-[-0.02em] text-text">
                    {{ node.word }}
                  </dd>
                </div>
              </dl>
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
                This source may need broader coverage before its descendants appear here. Try another concept or reduce the graph scope.
              </p>
            </section>

            <p v-else-if="descendantsGraphStatus === 'error'" class="text-danger">
              {{ errorMessage }}
            </p>

            <GraphCanvas
              v-else-if="descendantsGraph"
              :key="`${selectedConcept.slug}:${selectedDepth}:${selectedLimit}`"
              :graph="descendantsGraph"
              orientation-mode="fan-out"
              :node-highlights="nodeHighlights"
            />
          </div>
        </template>
      </ResultsAccordion>
    </section>
  </PageMain>
</template>
