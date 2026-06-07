<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { useIntersectionObserver, usePreferredReducedMotion } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorsQuery,
  type ChildTermsQuery,
  type CognatesQuery,
  type EtymologyGraph,
  type GraphNode,
  type GraphTraversalNode,
  type SimilarTermsQuery
} from "@etymology-graph/graph";

import EntryChooser from "../features/terms/EntryChooser.vue";
import EtymologyStarterQueries from "../features/terms/EtymologyStarterQueries.vue";
import EtymologyExploreSuggestions from "./EtymologyExploreSuggestions.vue";
import EtymologyExploreTray from "./EtymologyExploreTray.vue";
import GraphCanvas from "../features/graph/GraphCanvas.vue";
import TermSearchForm from "../features/terms/TermSearchForm.vue";
import {
  ancestorGraphQueryKey,
  fetchAncestorGraph,
  useAncestorGraphQuery
} from "../features/graph/composables/useAncestorGraphQuery";
import { useChildTermsGraphQuery } from "../features/graph/composables/useChildTermsGraphQuery";
import { useLanguagesQuery } from "../features/languages/useLanguagesQuery";
import { useCognatesQuery } from "../features/terms/composables/useCognatesQuery";
import { useSimilarTermsQuery } from "../features/terms/composables/useSimilarTermsQuery";
import { useTermEntrySelection } from "../features/terms/composables/useTermEntrySelection";
import { mergeEtymologyGraphs, pruneGraphBranchUntilSharedDescendant } from "../features/graph/mergeEtymologyGraphs";
import { starterQueriesForLanguage } from "../features/terms/starterQueries";
import { useSearchLanguageStore } from "../features/terms/searchLanguageStore";
import Divider from "../uiComponents/Divider.vue";
import Link from "../uiComponents/Link.vue";
import PageMain from "../uiComponents/PageMain.vue";
import Skeleton from "../uiComponents/Skeleton.vue";

type GraphStatus = "idle" | "loading" | "success" | "empty" | "error";
type ChildTermsStatus = "idle" | "loading" | "success" | "empty" | "error";

const defaultChildTermsLimit = 50;

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const searchLanguageStore = useSearchLanguageStore();

const langCode = computed(() => firstRouteParam(route.params.langCode));
const term = computed(() => firstRouteParam(route.params.term));
const childTermsGraphInput = ref<ChildTermsQuery | null>(null);
const cognateExpansionError = ref<string | null>(null);
const cognateExpansionGraphs = ref<Map<string, EtymologyGraph | null>>(new Map());
const loadingCognateGraphIds = ref<Set<string>>(new Set());
const selectedCognateGraphIds = ref<Set<string>>(new Set());
const expandedGraph = ref<EtymologyGraph | null>(null);
const exploreSuggestionsRef = ref<HTMLElement | null>(null);
const graphResultRef = ref<HTMLElement | null>(null);
const isGraphResultVisible = ref(false);
const areExploreSuggestionsVisible = ref(true);
const isGraphNodeDetailOpen = ref(false);
const shouldScrollToNextGraph = ref(Boolean(langCode.value && term.value));
const preferredMotion = usePreferredReducedMotion();

const entrySelection = useTermEntrySelection(() => ({
  langCode: langCode.value,
  word: term.value
}));

const ancestorGraphInput = computed<AncestorsQuery | null>(() => {
  if (!langCode.value || !term.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
    pos: entrySelection.selectedPos.value,
    etymologyNumber: entrySelection.selectedEtymologyNumber.value
  };
});

const similarTermsInput = computed<SimilarTermsQuery | null>(() => {
  if (!langCode.value || !term.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    limit: 4
  };
});

const cognatesInput = computed<CognatesQuery | null>(() => {
  if (!langCode.value || !term.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    limit: 12,
    pos: entrySelection.selectedPos.value,
    etymologyNumber: entrySelection.selectedEtymologyNumber.value
  };
});

const ancestorGraphQuery = useAncestorGraphQuery(ancestorGraphInput);
const childTermsGraphQuery = useChildTermsGraphQuery(childTermsGraphInput);
const similarTermsQuery = useSimilarTermsQuery(similarTermsInput);
const cognatesQuery = useCognatesQuery(cognatesInput);
const languagesQuery = useLanguagesQuery();
const languages = computed(() => languagesQuery.data.value?.languages ?? []);
const similarTerms = computed(() => similarTermsQuery.data.value?.terms ?? []);
const cognates = computed(() => cognatesQuery.data.value?.terms ?? []);
const visibleCognates = computed(() =>
  cognates.value.filter((cognate) => {
    const graph = cognateExpansionGraphs.value.get(cognate.id);

    return graph ? graphSharesCurrentGraphAncestor(graph) : false;
  })
);
const isCheckingCognateGraphs = computed(() =>
  cognates.value.some((cognate) => loadingCognateGraphIds.value.has(cognate.id))
);
const selectedCognateIds = computed(() =>
  visibleCognates.value.filter((cognate) => isCognateInSelectedGraph(cognate)).map((cognate) => cognate.id)
);
const selectedGraph = computed(() => expandedGraph.value ?? ancestorGraphQuery.data.value?.graph ?? null);
const highlightedGraphNodeIds = computed(() => {
  const rootNodeId = selectedGraph.value?.rootNodeId;
  const highlightedNodeIds = rootNodeId ? [rootNodeId] : [];

  return [...new Set([...highlightedNodeIds, ...selectedCognateIds.value])];
});
const selectedLanguageLabel = computed(() => {
  if (!langCode.value) {
    return null;
  }

  return languages.value.find((language) => language.code === langCode.value)?.canonicalName ?? langCode.value;
});
const selectedEntryPronunciation = computed(() => entrySelection.selectedEntry.value?.primaryIpa);
const selectedEntryDefinition = computed(() => entrySelection.selectedEntry.value?.primaryGloss);
const hasSelectedEntryContext = computed(
  () => Boolean(selectedLanguageLabel.value) || Boolean(selectedEntryPronunciation.value) || Boolean(selectedEntryDefinition.value)
);

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

const graphError = computed(() => ancestorGraphQuery.error.value?.message ?? "This word's graph could not load.");
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
const childTermsError = computed(() => childTermsGraphQuery.error.value?.message ?? "Related terms could not load.");
const etymologyStarterSet = computed(() =>
  starterQueriesForLanguage(langCode.value ?? searchLanguageStore.selectedSearchLanguage, "etymology")
);
const etymologyStarterHelpText = computed(() =>
  etymologyStarterSet.value.isFallback
    ? "No examples for this language yet. Showing English examples."
    : "Example words for this language."
);
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
const hasExploreSuggestionsContent = computed(
  () => similarTerms.value.length > 0 || visibleCognates.value.length > 0
);
const shouldShowExploreTray = computed(
  () =>
    hasExploreSuggestionsContent.value &&
    isGraphResultVisible.value &&
    !areExploreSuggestionsVisible.value &&
    !isGraphNodeDetailOpen.value
);

useIntersectionObserver(
  graphResultRef,
  ([entry]) => {
    isGraphResultVisible.value = entry?.isIntersecting ?? false;
  },
  {
    threshold: 0.12
  }
);

useIntersectionObserver(
  exploreSuggestionsRef,
  ([entry]) => {
    areExploreSuggestionsVisible.value = entry?.isIntersecting ?? false;
  },
  {
    threshold: 0.1
  }
);

/** Returns to the etymology search page so the newly selected language's starters are visible. */
function goToEtymologySearch(): void {
  void router.push({ name: "etymology-search" });
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

/** Toggles a cognate's ancestry in the current graph so comparisons stay in one visual context. */
async function handleToggleCognateInGraph(cognate: GraphNode): Promise<void> {
  if (selectedCognateGraphIds.value.has(cognate.id)) {
    expandedGraph.value = selectedGraph.value
      ? pruneGraphBranchUntilSharedDescendant(selectedGraph.value, cognate.id)
      : expandedGraph.value;
    removeSelectedCognateGraph(cognate.id);
    cognateExpansionError.value = null;
    await scrollGraphResultIntoView();
    return;
  }

  if (isCognateInSelectedGraph(cognate)) {
    await scrollGraphResultIntoView();
    return;
  }

  const graph = cognateExpansionGraphs.value.get(cognate.id);

  if (!graph) {
    cognateExpansionError.value = "No source path is available for that cognate yet.";
    return;
  }

  cognateExpansionError.value = null;
  expandedGraph.value = expandedGraph.value ? mergeEtymologyGraphs(expandedGraph.value, graph) : graph;
  addSelectedCognateGraph(cognate.id);
  await scrollGraphResultIntoView();
}

/** Moves a newly loaded route result into view without affecting in-graph exploration. */
async function scrollGraphResultIntoView(): Promise<void> {
  await nextTick();

  graphResultRef.value?.scrollIntoView({
    block: "start",
    behavior: preferredMotion.value === "reduce" ? "auto" : "smooth"
  });
}

/** Checks graph membership so already-added cognates behave like stable selections. */
function isCognateInSelectedGraph(cognate: GraphNode): boolean {
  return selectedGraph.value?.nodes.some((node) => node.id === cognate.id) ?? false;
}

/** Loads candidate cognate ancestries so the strip only offers graph-connected comparisons. */
function ensureCognateExpansionGraphs(nextCognates: GraphNode[]): void {
  for (const cognate of nextCognates) {
    if (cognateExpansionGraphs.value.has(cognate.id) || loadingCognateGraphIds.value.has(cognate.id)) {
      continue;
    }

    void loadCognateExpansionGraph(cognate);
  }
}

/** Fetches one cognate ancestry through the shared graph cache used by normal etymology views. */
async function loadCognateExpansionGraph(cognate: GraphNode): Promise<void> {
  const query: AncestorsQuery = {
    langCode: cognate.langCode,
    word: cognate.word,
    maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH
  };

  addLoadingCognateGraph(cognate.id);

  try {
    const result = await queryClient.fetchQuery({
      queryKey: ancestorGraphQueryKey(query),
      queryFn: ({ signal }) => fetchAncestorGraph(query, signal),
      staleTime: 60_000
    });

    setCognateExpansionGraph(cognate.id, result.graph);
  } catch {
    setCognateExpansionGraph(cognate.id, null);
  } finally {
    removeLoadingCognateGraph(cognate.id);
  }
}

/** Confirms the candidate graph will attach through an ancestor already visible in the graph. */
function graphSharesCurrentGraphAncestor(candidateGraph: EtymologyGraph): boolean {
  if (!selectedGraph.value) {
    return false;
  }

  const currentNodeIds = new Set(selectedGraph.value.nodes.map((node) => node.id));

  return candidateGraph.nodes.some((node) => node.id !== candidateGraph.rootNodeId && currentNodeIds.has(node.id));
}

/** Replaces the map so Vue sees candidate graph cache changes. */
function setCognateExpansionGraph(nodeId: string, graph: EtymologyGraph | null): void {
  const nextGraphs = new Map(cognateExpansionGraphs.value);
  nextGraphs.set(nodeId, graph);
  cognateExpansionGraphs.value = nextGraphs;
}

/** Replaces the loading set so Vue updates checking states. */
function addLoadingCognateGraph(nodeId: string): void {
  const nextLoadingIds = new Set(loadingCognateGraphIds.value);
  nextLoadingIds.add(nodeId);
  loadingCognateGraphIds.value = nextLoadingIds;
}

/** Replaces the loading set after a candidate graph check finishes. */
function removeLoadingCognateGraph(nodeId: string): void {
  const nextLoadingIds = new Set(loadingCognateGraphIds.value);
  nextLoadingIds.delete(nodeId);
  loadingCognateGraphIds.value = nextLoadingIds;
}

/** Replaces the selected set so cognate buttons can distinguish expansion state from base graph membership. */
function addSelectedCognateGraph(nodeId: string): void {
  const nextSelectedIds = new Set(selectedCognateGraphIds.value);
  nextSelectedIds.add(nodeId);
  selectedCognateGraphIds.value = nextSelectedIds;
}

/** Replaces the selected set when a cognate expansion is removed from the graph. */
function removeSelectedCognateGraph(nodeId: string): void {
  const nextSelectedIds = new Set(selectedCognateGraphIds.value);
  nextSelectedIds.delete(nodeId);
  selectedCognateGraphIds.value = nextSelectedIds;
}

watch([langCode, term], () => {
  childTermsGraphInput.value = null;
  cognateExpansionError.value = null;
  cognateExpansionGraphs.value = new Map();
  loadingCognateGraphIds.value = new Set();
  selectedCognateGraphIds.value = new Set();
  expandedGraph.value = null;
  isGraphNodeDetailOpen.value = false;
  shouldScrollToNextGraph.value = Boolean(langCode.value && term.value);
});

watch(cognates, ensureCognateExpansionGraphs, { immediate: true });

watch(
  () => ancestorGraphQuery.data.value?.graph ?? null,
  (graph) => {
    selectedCognateGraphIds.value = new Set();
    expandedGraph.value = graph;
    isGraphNodeDetailOpen.value = false;
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
  <PageMain>
    <section>
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Etymology
      </p>
      <h1 class="text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        {{ term ?? "Unknown term" }}
      </h1>
      <dl
        v-if="hasSelectedEntryContext"
        class="mt-4 flex max-w-3xl flex-wrap items-baseline gap-y-1 text-lg leading-7 text-text-page-muted"
      >
        <template v-if="selectedLanguageLabel">
          <dt class="sr-only">Language</dt>
          <dd class="after:mx-3 after:text-text-page-muted after:content-['·'] last:after:hidden">
            <Link
              v-if="langCode"
              :to="{ name: 'language-detail', params: { langCode } }"
            >
              {{ selectedLanguageLabel }}
            </Link>
            <template v-else>{{ selectedLanguageLabel }}</template>
          </dd>
        </template>
        <template v-if="selectedEntryPronunciation">
          <dt class="sr-only">Pronunciation</dt>
          <dd class="after:mx-3 after:text-text-page-muted after:content-['·'] last:after:hidden">
            {{ selectedEntryPronunciation }}
          </dd>
        </template>
        <template v-if="selectedEntryDefinition">
          <dt class="sr-only">Definition</dt>
          <dd>{{ selectedEntryDefinition }}</dd>
        </template>
      </dl>
    </section>

    <Divider />

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Search another word
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight text-text">
          Choose a language, then search its words
        </h2>
      </div>
      <div class="grid gap-5 rounded-[3px] border border-border bg-surface/60 p-5 shadow-paper">
        <div ref="exploreSuggestionsRef">
          <EtymologyExploreSuggestions
            id-prefix="inline-etymology-explore"
            :similar-terms="similarTerms"
            :cognates="visibleCognates"
            :selected-cognate-ids="selectedCognateIds"
            :similar-terms-loading="similarTermsQuery.isPending.value"
            :similar-terms-error="similarTermsQuery.isError.value"
            :cognates-loading="cognatesQuery.isPending.value"
            :cognates-checking="isCheckingCognateGraphs"
            :cognates-error="cognatesQuery.isError.value"
            :cognate-expansion-error="cognateExpansionError"
            @toggle-cognate="handleToggleCognateInGraph"
          />
        </div>
        <TermSearchForm
          id-prefix="etymology-term-search"
          compact
          :lang-code="searchLanguageStore.selectedSearchLanguage"
          :initial-lang-code="langCode"
          :initial-term="term"
          @update:lang-code="searchLanguageStore.setSelectedSearchLanguage"
          @language-change="goToEtymologySearch"
        />
      </div>
    </section>

    <template v-if="entrySelection.entries.value.length > 1">
      <Divider />
      <EntryChooser
        :entries="entrySelection.entries.value"
        :selected-entry-id="entrySelection.selectedEntry.value?.id ?? null"
        @select="entrySelection.selectEntry"
      />
    </template>

    <Divider />

    <section
      ref="graphResultRef"
      class="scroll-mt-6 grid gap-5"
    >
      <section
        v-if="graphStatus === 'idle' || graphStatus === 'empty'"
        class="rounded-[3px] border border-border bg-surface/55 p-5 shadow-paper"
        aria-labelledby="etymology-empty-starters"
      >
        <p v-if="graphStatus === 'idle'" class="mb-4 text-text-muted">
          This etymology route is missing a term or language code.
        </p>
        <p v-else class="mb-4 text-text-muted">
          No source path in the index for {{ routeLabel }}.
        </p>
        <div class="mb-5">
          <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
            Starting points
          </p>
          <h2 id="etymology-empty-starters" class="text-2xl font-bold leading-tight">
            Example words with source paths
          </h2>
          <p class="mt-1 text-sm leading-6 text-text-muted">
            {{ etymologyStarterHelpText }}
          </p>
        </div>
        <EtymologyStarterQueries :lang-code="etymologyStarterSet.langCode" :queries="etymologyStarterSet.queries" />
      </section>
      <div
        v-else-if="graphStatus === 'loading'"
        class="relative z-0 min-h-[min(72dvh,560px)] overflow-hidden rounded-md border border-border [background:radial-gradient(ellipse_at_50%_42%,transparent_58%,color-mix(in_oklch,var(--theme-text)_6%,transparent)_100%),linear-gradient(135deg,color-mix(in_oklch,var(--theme-surface-muted)_82%,var(--theme-background))_0%,var(--theme-surface)_100%)] [box-shadow:inset_0_0_0_1px_color-mix(in_oklch,var(--theme-surface-raised)_72%,transparent)] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(color-mix(in_oklch,var(--theme-text)_12%,transparent)_0.7px,transparent_0.8px),radial-gradient(color-mix(in_oklch,var(--theme-surface-raised)_80%,transparent)_0.7px,transparent_0.8px)] after:bg-position-[0_0,11px_17px] after:bg-size-[19px_23px,29px_31px] after:opacity-[0.18] after:content-[''] md:min-h-[360px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="sr-only">Loading the ancestry graph</span>
        <div class="absolute right-3 top-3 z-2 flex gap-2" aria-hidden="true">
          <Skeleton class="h-9 w-9" tone="raised" />
          <Skeleton class="h-9 w-9" tone="raised" />
          <Skeleton class="h-9 w-20" tone="raised" />
        </div>
      </div>
      <p v-else-if="graphStatus === 'error'" class="text-danger">
        {{ graphError }}
      </p>
      <template v-else-if="selectedGraph">
        <p v-if="childTermsStatus === 'loading'" class="text-text-page-muted">
          Loading descendant words for {{ childTermsRouteLabel }}...
        </p>
        <p v-else-if="childTermsStatus === 'error'" class="text-danger">
          {{ childTermsError }}
        </p>
        <GraphCanvas
          :graph="selectedGraph"
          :highlighted-node-ids="highlightedGraphNodeIds"
          @load-children="handleLoadChildren"
          @node-details-open-change="isGraphNodeDetailOpen = $event"
        />
      </template>

      <EtymologyExploreTray
        :key="routeLabel"
        :show="shouldShowExploreTray"
        :similar-terms="similarTerms"
        :cognates="visibleCognates"
        :selected-cognate-ids="selectedCognateIds"
        :similar-terms-loading="similarTermsQuery.isPending.value"
        :similar-terms-error="similarTermsQuery.isError.value"
        :cognates-loading="cognatesQuery.isPending.value"
        :cognates-checking="isCheckingCognateGraphs"
        :cognates-error="cognatesQuery.isError.value"
        :cognate-expansion-error="cognateExpansionError"
        @toggle-cognate="handleToggleCognateInGraph"
      />
    </section>
  </PageMain>
</template>
