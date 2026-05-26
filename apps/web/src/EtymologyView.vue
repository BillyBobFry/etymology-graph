<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { type AncestorsQuery, type ChildTermsQuery, type EtymologyGraph, type GraphTraversalNode } from "@etymology-graph/graph";

import GraphCanvas from "./GraphCanvas.vue";
import TermSearchForm from "./TermSearchForm.vue";
import { useAncestorGraphQuery } from "./composables/useAncestorGraphQuery";
import { useChildTermsGraphQuery } from "./composables/useChildTermsGraphQuery";
import { mergeEtymologyGraphs } from "./mergeEtymologyGraphs";
import Divider from "./uiComponents/Divider.vue";

type GraphStatus = "idle" | "loading" | "success" | "empty" | "error";
type ChildTermsStatus = "idle" | "loading" | "success" | "empty" | "error";

const defaultMaxDepth = 6;
const defaultChildTermsLimit = 50;

const route = useRoute();
const router = useRouter();

const langCode = computed(() => firstRouteParam(route.params.langCode));
const term = computed(() => firstRouteParam(route.params.term));
const childTermsGraphInput = ref<ChildTermsQuery | null>(null);
const expandedGraph = ref<EtymologyGraph | null>(null);

const ancestorGraphInput = computed<AncestorsQuery | null>(() => {
  if (!langCode.value || !term.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    maxDepth: defaultMaxDepth
  };
});

const ancestorGraphQuery = useAncestorGraphQuery(ancestorGraphInput);
const childTermsGraphQuery = useChildTermsGraphQuery(childTermsGraphInput);
const selectedGraph = computed(() => expandedGraph.value ?? ancestorGraphQuery.data.value?.graph ?? null);

const graphStatus = computed<GraphStatus>(() => {
  if (!ancestorGraphInput.value) {
    return "idle";
  }

  if (ancestorGraphQuery.isPending.value || (ancestorGraphQuery.isFetching.value && !ancestorGraphQuery.data.value)) {
    return "loading";
  }

  if (ancestorGraphQuery.isError.value) {
    return "error";
  }

  return selectedGraph.value ? "success" : "empty";
});

const graphError = computed(() => ancestorGraphQuery.error.value?.message ?? "Graph failed");
const childTermsStatus = computed<ChildTermsStatus>(() => {
  if (!childTermsGraphInput.value) {
    return "idle";
  }

  if (childTermsGraphQuery.isPending.value || (childTermsGraphQuery.isFetching.value && !childTermsGraphQuery.data.value)) {
    return "loading";
  }

  if (childTermsGraphQuery.isError.value) {
    return "error";
  }

  return childTermsGraphQuery.data.value?.graph ? "success" : "empty";
});
const childTermsError = computed(() => childTermsGraphQuery.error.value?.message ?? "Child terms graph failed");
const childTermsRouteLabel = computed(() => {
  if (!childTermsGraphInput.value) {
    return "";
  }

  return `${childTermsGraphInput.value.langCode}:${childTermsGraphInput.value.word}`;
});
const routeLabel = computed(() => {
  if (!langCode.value || !term.value) {
    return "";
  }

  return `${langCode.value}:${term.value}`;
});

/** Extracts a single typed route parameter from Vue Router's param shape. */
function firstRouteParam(param: string | string[] | undefined): string | null {
  if (Array.isArray(param)) {
    return param[0] ?? null;
  }

  return param ?? null;
}

/** Loads one generation of direct descendants for the selected graph node. */
function handleLoadChildren(node: GraphTraversalNode): void {
  childTermsGraphInput.value = {
    langCode: node.langCode,
    word: node.word,
    limit: defaultChildTermsLimit
  };
}

/** Navigates to the selected node's ancestry graph from a graph context menu. */
function handleViewEtymology(node: GraphTraversalNode): void {
  void router.push({
    name: "etymology",
    params: {
      langCode: node.langCode,
      term: node.word
    }
  });
}

/** Navigates to inferred same-language doublets for the selected node. */
function handleViewDoublets(node: GraphTraversalNode): void {
  void router.push({
    name: "doublets",
    params: {
      langCode: node.langCode,
      term: node.word
    }
  });
}

watch([langCode, term], () => {
  childTermsGraphInput.value = null;
  expandedGraph.value = null;
});

watch(
  () => ancestorGraphQuery.data.value?.graph ?? null,
  (graph) => {
    expandedGraph.value = graph;
  }
);

watch(
  () => childTermsGraphQuery.data.value?.graph ?? null,
  (graph) => {
    if (!graph || !expandedGraph.value) {
      return;
    }

    expandedGraph.value = mergeEtymologyGraphs(expandedGraph.value, graph);
  }
);
</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 sm:gap-10 sm:py-12">
    <section>
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Etymology
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        {{ term ?? "Unknown term" }}
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Exploring the ancestry graph for <span class="font-bold text-text">{{ routeLabel }}</span>.
      </p>
    </section>

    <Divider />

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Explore another term
        </p>
        <h2 class="max-w-sm text-2xl font-black tracking-[-0.03em] text-text">
          Choose a language, then search its words
        </h2>
      </div>
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <TermSearchForm
          id-prefix="etymology-term-search"
          compact
          :initial-lang-code="langCode"
          :initial-term="term"
        />
      </div>
    </section>

    <Divider />

    <section class="grid gap-5">
      <p v-if="graphStatus === 'idle'" class="text-text-muted">
        This etymology route is missing a term or language code.
      </p>
      <p v-else-if="graphStatus === 'loading'" class="text-text-muted">
        Loading the ancestry graph...
      </p>
      <p v-else-if="graphStatus === 'error'" class="text-danger">
        {{ graphError }}
      </p>
      <p v-else-if="graphStatus === 'empty'" class="text-text-muted">
        No ancestor graph found for {{ routeLabel }}.
      </p>
      <template v-else-if="selectedGraph">
        <p v-if="childTermsStatus === 'loading'" class="text-text-muted">
          Loading direct child terms for {{ childTermsRouteLabel }}...
        </p>
        <p v-else-if="childTermsStatus === 'error'" class="text-danger">
          {{ childTermsError }}
        </p>
        <p v-else-if="childTermsStatus === 'empty'" class="text-text-muted">
          No direct child terms found for {{ childTermsRouteLabel }}.
        </p>
        <GraphCanvas
          :graph="selectedGraph"
          @load-children="handleLoadChildren"
          @view-etymology="handleViewEtymology"
          @view-doublets="handleViewDoublets"
        />
      </template>
    </section>
  </main>
</template>
