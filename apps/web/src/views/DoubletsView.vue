<script setup lang="ts">
import { usePreferredReducedMotion } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorsQuery,
  type ChildTermsQuery,
  type DoubletsQuery,
  type EtymologyGraph,
  type GraphTraversalNode
} from "@etymology-graph/graph";

import EntryChooser from "../features/terms/EntryChooser.vue";
import GraphCanvas from "../features/graph/GraphCanvas.vue";
import type { GraphLayoutPreset } from "../features/graph/composables/useGraphLayout";
import { useAncestorGraphQuery } from "../features/graph/composables/useAncestorGraphQuery";
import { useChildTermsGraphQuery } from "../features/graph/composables/useChildTermsGraphQuery";
import { useDoubletGraphQuery } from "../features/graph/composables/useDoubletGraphQuery";
import { primaryGraphNodeHighlights } from "../features/graph/graphNodeHighlights";
import GlossaryText from "../features/glossary/GlossaryText.vue";
import type { GlossaryTextSegment } from "../features/glossary/linguisticGlossary";
import { useLanguagesQuery } from "../features/languages/useLanguagesQuery";
import { useTermEntrySelection } from "../features/terms/composables/useTermEntrySelection";
import { mergeEtymologyGraphs } from "../features/graph/mergeEtymologyGraphs";
import { starterQueriesForLanguage } from "../features/terms/starterQueries";
import Button from "../uiComponents/Button.vue";
import Divider from "../uiComponents/Divider.vue";
import PageMain from "../uiComponents/PageMain.vue";
import Skeleton from "../uiComponents/Skeleton.vue";
import StatusNote from "../uiComponents/StatusNote.vue";

type GraphStatus = "idle" | "loadingDoublets" | "loadingFallback" | "success" | "empty" | "error" | "fallbackError";
type ChildTermsStatus = "idle" | "loading" | "success" | "empty" | "error";

const defaultLimit = 18;
const defaultChildTermsLimit = 50;

const route = useRoute();
const languagesQuery = useLanguagesQuery();
const languages = computed(() => languagesQuery.data.value?.languages ?? []);

const langCode = computed(() => firstRouteParam(route.params.langCode));
const term = computed(() => firstRouteParam(route.params.term));
const childTermsGraphInput = ref<ChildTermsQuery | null>(null);
const expandedGraph = ref<EtymologyGraph | null>(null);
const fallbackNoteDismissed = ref(false);
const graphResultRef = ref<HTMLElement | null>(null);
const shouldScrollToNextGraph = ref(Boolean(langCode.value && term.value));
const preferredMotion = usePreferredReducedMotion();

const entrySelection = useTermEntrySelection(() => ({
  langCode: langCode.value,
  word: term.value
}));

const doubletGraphInput = computed<DoubletsQuery | null>(() => {
  if (!langCode.value || !term.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
    limit: defaultLimit,
    pos: entrySelection.selectedPos.value,
    etymologyNumber: entrySelection.selectedEtymologyNumber.value
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
    maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
    pos: entrySelection.selectedPos.value,
    etymologyNumber: entrySelection.selectedEtymologyNumber.value
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

const graphError = computed(() => doubletGraphQuery.error.value?.message ?? "This doublet graph could not load.");
const fallbackAncestorError = computed(() => fallbackAncestorGraphQuery.error.value?.message ?? "This etymology graph could not load.");
const isFallbackGraph = computed(() => !doubletGraphQuery.data.value?.graph && Boolean(fallbackAncestorGraphQuery.data.value?.graph));
const graphLayoutPreset = computed<GraphLayoutPreset>(() =>
  isFallbackGraph.value || !selectedGraph.value
    ? { type: "auto" }
    : { type: "doublet-arms", rootNodeId: selectedGraph.value.rootNodeId }
);
const graphNodeHighlights = computed(() => {
  const graph = selectedGraph.value;

  if (!graph) {
    return [];
  }

  if (isFallbackGraph.value) {
    return primaryGraphNodeHighlights([graph.rootNodeId]);
  }

  return primaryGraphNodeHighlights(
    graph.nodes.filter((node) => node.langCode === langCode.value && node.id !== graph.rootNodeId).map((node) => node.id)
  );
});
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
const childTermsError = computed(() => childTermsGraphQuery.error.value?.message ?? "Related terms could not load.");
const doubletStarterSet = computed(() => starterQueriesForLanguage(langCode.value ?? undefined, "doublets"));
const selectedLanguageLabel = computed(() => languageLabelFor(langCode.value));
const starterLanguageLabel = computed(() => languageLabelFor(doubletStarterSet.value.langCode));
const doubletStarterHelpText = computed(() =>
  doubletStarterSet.value.isFallback
    ? `Showing ${starterLanguageLabel.value} doublet cases for now.`
    : `Try doublet cases for ${starterLanguageLabel.value}.`
);
const doubletGroupsLabel = computed(() =>
  selectedLanguageLabel.value ? `See more ${selectedLanguageLabel.value} doublets` : "See more doublets"
);
const childTermsRouteLabel = computed(() => {
  if (!childTermsGraphInput.value) {
    return "";
  }

  return termLabelFor(childTermsGraphInput.value.langCode, childTermsGraphInput.value.word);
});
const routeLabel = computed(() => {
  if (!langCode.value || !term.value) {
    return "";
  }

  return termLabelFor(langCode.value, term.value);
});
const doubletsIntroSegments = computed<GlossaryTextSegment[]>(() => [
  "Exploring ",
  { text: "doublets", termId: "doublet" },
  `: same-language words that reconnect with ${routeLabel.value || "this word"} through shared ancestors.`
]);
const loadingGraphLabel = computed(() =>
  graphStatus.value === "loadingFallback"
    ? `Loading the etymology graph for ${routeLabel.value}.`
    : `Loading doublet paths for ${routeLabel.value}.`
);

/** Shows route terms with canonical language names when the language index is available. */
function termLabelFor(langCode: string, word: string): string {
  return `${languageLabelFor(langCode)}: ${word}`;
}

/** Falls back to the stable language code only when canonical metadata has not loaded. */
function languageLabelFor(nextLangCode: string | null | undefined): string {
  if (!nextLangCode) {
    return "";
  }

  return languages.value.find((language) => language.code === nextLangCode)?.canonicalName ?? nextLangCode;
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
  <PageMain>
    <section>
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Doublets
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        {{ term ?? "Unknown term" }}
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-page-muted">
        <GlossaryText :segments="doubletsIntroSegments" />
      </p>
      <Button
        v-if="langCode"
        :to="{ name: 'doublet-groups', params: { langCode } }"
        variant="secondary"
        size="sm"
        class="mt-5"
      >
        {{ doubletGroupsLabel }}
      </Button>
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

    <section ref="graphResultRef" class="scroll-mt-6 grid gap-5">
      <section
        v-if="graphStatus === 'idle' || graphStatus === 'empty'"
        class="grid max-w-4xl gap-5 py-4"
        aria-labelledby="doublets-empty-starters"
      >
        <p v-if="graphStatus === 'idle'" class="text-text-page-muted">
          This doublet route is missing a term or language code.
        </p>
        <p v-else class="text-text-page-muted">
          No doublet paths are in the index yet for {{ routeLabel }}, and the etymology graph is unavailable.
        </p>
        <div>
          <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
            Starting points
          </p>
          <h2 id="doublets-empty-starters" class="text-2xl font-bold leading-tight">
            Try known doublet cases
          </h2>
          <p class="mt-1 text-sm leading-6 text-text-page-muted">
            {{ doubletStarterHelpText }}
          </p>
        </div>
        <div class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
          <RouterLink
            v-for="query in doubletStarterSet.queries"
            :key="query.term"
            :to="{
              name: 'doublets',
              params: {
                langCode: doubletStarterSet.langCode,
                term: query.term
              }
            }"
            class="group grid h-full cursor-pointer content-center gap-1 rounded-[3px] bg-surface/30 px-3 py-2.5 text-left transition duration-200 hover:bg-surface/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span class="font-label text-base font-bold leading-tight text-text transition group-hover:text-accent">
              {{ query.term }}
            </span>
            <span class="text-sm leading-5 text-text-page-muted transition group-hover:text-text-muted">
              {{ query.description }}
            </span>
          </RouterLink>
        </div>
      </section>
      <div
        v-else-if="graphStatus === 'loadingDoublets' || graphStatus === 'loadingFallback'"
        class="relative z-0 min-h-[min(72dvh,560px)] overflow-hidden rounded-md border border-border [background:radial-gradient(ellipse_at_50%_42%,transparent_58%,color-mix(in_oklch,var(--theme-text)_6%,transparent)_100%),linear-gradient(135deg,color-mix(in_oklch,var(--theme-surface-muted)_82%,var(--theme-background))_0%,var(--theme-surface)_100%)] [box-shadow:inset_0_0_0_1px_color-mix(in_oklch,var(--theme-surface-raised)_72%,transparent)] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(color-mix(in_oklch,var(--theme-text)_12%,transparent)_0.7px,transparent_0.8px),radial-gradient(color-mix(in_oklch,var(--theme-surface-raised)_80%,transparent)_0.7px,transparent_0.8px)] after:bg-position-[0_0,11px_17px] after:bg-size-[19px_23px,29px_31px] after:opacity-[0.18] after:content-[''] md:min-h-[360px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="sr-only">{{ loadingGraphLabel }}</span>
        <StatusNote class="absolute left-4 top-4 z-10 max-w-[min(34rem,calc(100%-2rem))]">
          {{ loadingGraphLabel }}
        </StatusNote>
        <div class="absolute right-3 top-3 z-2 flex gap-2" aria-hidden="true">
          <Skeleton class="h-9 w-9" tone="raised" />
          <Skeleton class="h-9 w-9" tone="raised" />
          <Skeleton class="h-9 w-20" tone="raised" />
        </div>
      </div>
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
              No doublet paths are in the index yet for {{ routeLabel }}. Showing this word's etymology graph instead.
            </span>
          </StatusNote>
          <GraphCanvas
            :graph="selectedGraph"
            :layout-preset="graphLayoutPreset"
            :node-highlights="graphNodeHighlights"
            @load-children="handleLoadChildren"
          />
        </div>
      </template>
    </section>
  </PageMain>
</template>
