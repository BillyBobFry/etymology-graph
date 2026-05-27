<script setup lang="ts">
import { usePreferredReducedMotion } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  type AncestorsQuery,
  type ChildTermsQuery,
  type DoubletsQuery,
  type EtymologyGraph,
  type GraphTraversalNode
} from "@etymology-graph/graph";

import GraphCanvas from "./GraphCanvas.vue";
import TermSearchForm from "./TermSearchForm.vue";
import { useAncestorGraphQuery } from "./composables/useAncestorGraphQuery";
import { useChildTermsGraphQuery } from "./composables/useChildTermsGraphQuery";
import { useDoubletGraphQuery } from "./composables/useDoubletGraphQuery";
import { mergeEtymologyGraphs } from "./mergeEtymologyGraphs";
import { defaultStarterLangCode, doubletStarterQueries } from "./starterQueries";
import Button from "./uiComponents/Button.vue";
import Divider from "./uiComponents/Divider.vue";
import StatusNote from "./uiComponents/StatusNote.vue";

type GraphStatus = "idle" | "loadingDoublets" | "loadingFallback" | "success" | "empty" | "error" | "fallbackError";
type ChildTermsStatus = "idle" | "loading" | "success" | "empty" | "error";

const defaultMaxDepth = 6;
const defaultLimit = 18;
const defaultChildTermsLimit = 50;

const route = useRoute();
const router = useRouter();

const langCode = computed(() => firstRouteParam(route.params.langCode));
const term = computed(() => firstRouteParam(route.params.term));
const childTermsGraphInput = ref<ChildTermsQuery | null>(null);
const expandedGraph = ref<EtymologyGraph | null>(null);
const fallbackNoteDismissed = ref(false);
const graphResultRef = ref<HTMLElement | null>(null);
const shouldScrollToNextGraph = ref(false);
const preferredMotion = usePreferredReducedMotion();

const doubletGraphInput = computed<DoubletsQuery | null>(() => {
  if (!langCode.value || !term.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    maxDepth: defaultMaxDepth,
    limit: defaultLimit
  };
});

const doubletGraphQuery = useDoubletGraphQuery(doubletGraphInput);
const fallbackAncestorGraphInput = computed<AncestorsQuery | null>(() => {
  if (!langCode.value || !term.value || doubletGraphQuery.data.value?.graph) {
    return null;
  }

  if (doubletGraphQuery.isPending.value || doubletGraphQuery.isError.value || doubletGraphQuery.isFetching.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    maxDepth: defaultMaxDepth
  };
});
const fallbackAncestorGraphQuery = useAncestorGraphQuery(fallbackAncestorGraphInput);
const childTermsGraphQuery = useChildTermsGraphQuery(childTermsGraphInput);
const selectedGraph = computed(
  () => expandedGraph.value ?? doubletGraphQuery.data.value?.graph ?? fallbackAncestorGraphQuery.data.value?.graph ?? null
);

const graphStatus = computed<GraphStatus>(() => {
  if (!doubletGraphInput.value) {
    return "idle";
  }

  if (doubletGraphQuery.isPending.value || (doubletGraphQuery.isFetching.value && !doubletGraphQuery.data.value)) {
    return "loadingDoublets";
  }

  if (doubletGraphQuery.isError.value) {
    return "error";
  }

  if (doubletGraphQuery.data.value?.graph) {
    return "success";
  }

  if (
    fallbackAncestorGraphQuery.isPending.value ||
    (fallbackAncestorGraphQuery.isFetching.value && !fallbackAncestorGraphQuery.data.value)
  ) {
    return "loadingFallback";
  }

  if (fallbackAncestorGraphQuery.isError.value) {
    return "fallbackError";
  }

  return selectedGraph.value ? "success" : "empty";
});

const graphError = computed(() => doubletGraphQuery.error.value?.message ?? "Doublet graph failed");
const fallbackAncestorError = computed(() => fallbackAncestorGraphQuery.error.value?.message ?? "Ancestry graph failed");
const isFallbackGraph = computed(() => !doubletGraphQuery.data.value?.graph && Boolean(fallbackAncestorGraphQuery.data.value?.graph));
const showFallbackNote = computed(() => isFallbackGraph.value && !fallbackNoteDismissed.value);
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
const graphTitle = computed(() => (term.value ? `${term.value} doublet candidates` : "Doublets"));
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

/** Opens terms with known shared-ancestor doublets in the English seed graph. */
function openDoubletStarterTerm(term: string): void {
  void router.push({
    name: "doublets",
    params: {
      langCode: defaultStarterLangCode,
      term
    }
  });
}

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

/** Moves a newly loaded route result into view without affecting in-graph exploration. */
async function scrollGraphResultIntoView(): Promise<void> {
  await nextTick();

  graphResultRef.value?.scrollIntoView({
    block: "start",
    behavior: preferredMotion.value === "reduce" ? "auto" : "smooth"
  });
}

watch([langCode, term], () => {
  childTermsGraphInput.value = null;
  expandedGraph.value = null;
  fallbackNoteDismissed.value = false;
  shouldScrollToNextGraph.value = Boolean(langCode.value && term.value);
});

watch(
  () => doubletGraphQuery.data.value?.graph ?? null,
  (graph) => {
    expandedGraph.value = graph;
  }
);

watch(
  [graphStatus, selectedGraph],
  ([status]) => {
    if (status !== "success" || !shouldScrollToNextGraph.value) {
      return;
    }

    shouldScrollToNextGraph.value = false;
    void scrollGraphResultIntoView();
  },
  { flush: "post" }
);

watch(
  () => fallbackAncestorGraphQuery.data.value?.graph ?? null,
  (graph) => {
    if (!graph || doubletGraphQuery.data.value?.graph) {
      return;
    }

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
        Doublets
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        {{ term ?? "Unknown term" }}
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Exploring same-language candidates that reconnect with
        <span class="font-bold text-text">{{ routeLabel }}</span> through shared ancestors.
      </p>
    </section>

    <Divider />

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Explore another word
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight text-text">
          Choose a language, then search its words
        </h2>
      </div>
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <TermSearchForm
          id-prefix="doublets-term-search"
          target-route-name="doublets"
          compact
          :initial-lang-code="langCode"
          :initial-term="term"
        />
      </div>
    </section>

    <Divider />

    <section ref="graphResultRef" class="scroll-mt-6 grid gap-5">
      <section
        v-if="graphStatus === 'idle' || graphStatus === 'empty'"
        class="rounded-md border border-border bg-surface/75 p-5 shadow-paper"
        aria-labelledby="doublets-empty-starters"
      >
        <p v-if="graphStatus === 'idle'" class="mb-4 text-text-muted">
          This doublet route is missing a term or language code.
        </p>
        <p v-else class="mb-4 text-text-muted">
          No same-language doublet candidates or ancestry graph found for {{ routeLabel }}.
        </p>
        <div class="mb-5">
          <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
            Starting points
          </p>
          <h2 id="doublets-empty-starters" class="text-2xl font-bold leading-tight">
            Try known doublet cases
          </h2>
          <p class="mt-1 text-sm leading-6 text-text-muted">
            These English seed terms reconnect with same-language relatives through a shared source.
          </p>
        </div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <Button
            v-for="query in doubletStarterQueries"
            :key="query.term"
            variant="secondary"
            full-width
            @click="openDoubletStarterTerm(query.term)"
          >
            <span class="grid gap-1 text-left">
              <span>{{ query.term }}</span>
              <span class="font-sans text-sm font-normal leading-5 text-text-muted">{{ query.description }}</span>
            </span>
          </Button>
        </div>
      </section>
      <p v-else-if="graphStatus === 'loadingDoublets'" class="text-text-muted">
        Loading doublet candidates...
      </p>
      <p v-else-if="graphStatus === 'loadingFallback'" class="text-text-muted">
        No same-language doublets found yet. Loading the known ancestry for {{ routeLabel }}...
      </p>
      <p v-else-if="graphStatus === 'error'" class="text-danger">
        {{ graphError }}
      </p>
      <p v-else-if="graphStatus === 'fallbackError'" class="text-danger">
        {{ fallbackAncestorError }}
      </p>
      <template v-else-if="selectedGraph">
        <div class="relative">
          <StatusNote
            v-if="showFallbackNote || childTermsStatus === 'loading' || childTermsStatus === 'error'"
            class="absolute left-4 top-4 z-10 max-w-[min(34rem,calc(100%-2rem))]"
            :variant="childTermsStatus === 'error' ? 'danger' : 'neutral'"
            :dismissible="showFallbackNote && childTermsStatus !== 'loading' && childTermsStatus !== 'error'"
            dismiss-label="Dismiss graph note"
            @dismiss="fallbackNoteDismissed = true"
          >
            <span v-if="childTermsStatus === 'loading'">
              Loading direct child terms for {{ childTermsRouteLabel }}...
            </span>
            <span v-else-if="childTermsStatus === 'error'">
              {{ childTermsError }}
            </span>
            <span v-else>
              No same-language doublet candidates were found for {{ routeLabel }} in the current graph. Showing its known
              ancestry instead.
            </span>
          </StatusNote>
          <GraphCanvas
            :graph="selectedGraph"
            :root-node-id="isFallbackGraph ? selectedGraph.rootNodeId : undefined"
            @load-children="handleLoadChildren"
            @view-etymology="handleViewEtymology"
            @view-doublets="handleViewDoublets"
          />
        </div>
      </template>
    </section>
  </main>
</template>
