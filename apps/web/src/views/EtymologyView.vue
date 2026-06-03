<script setup lang="ts">
import { usePreferredReducedMotion } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorsQuery,
  type ChildTermsQuery,
  type EtymologyGraph,
  type GraphTraversalNode,
  type SimilarTermsQuery
} from "@etymology-graph/graph";

import EntryChooser from "../features/terms/EntryChooser.vue";
import GraphCanvas from "../features/graph/GraphCanvas.vue";
import TermSearchForm from "../features/terms/TermSearchForm.vue";
import { useAncestorGraphQuery } from "../features/graph/composables/useAncestorGraphQuery";
import { useChildTermsGraphQuery } from "../features/graph/composables/useChildTermsGraphQuery";
import { useLanguagesQuery } from "../features/languages/useLanguagesQuery";
import { useSimilarTermsQuery } from "../features/terms/composables/useSimilarTermsQuery";
import { useTermEntrySelection } from "../features/terms/composables/useTermEntrySelection";
import { mergeEtymologyGraphs } from "../features/graph/mergeEtymologyGraphs";
import { starterQueriesForLanguage } from "../features/terms/starterQueries";
import { useSearchLanguageStore } from "../features/terms/searchLanguageStore";
import Button from "../uiComponents/Button.vue";
import Divider from "../uiComponents/Divider.vue";
import Link from "../uiComponents/Link.vue";
import PageMain from "../uiComponents/PageMain.vue";
import Skeleton from "../uiComponents/Skeleton.vue";

type GraphStatus = "idle" | "loading" | "success" | "empty" | "error";
type ChildTermsStatus = "idle" | "loading" | "success" | "empty" | "error";

const defaultChildTermsLimit = 50;
const similarTermsSkeletonItems = [0, 1, 2, 3] as const;

const route = useRoute();
const router = useRouter();
const searchLanguageStore = useSearchLanguageStore();

const langCode = computed(() => firstRouteParam(route.params.langCode));
const term = computed(() => firstRouteParam(route.params.term));
const childTermsGraphInput = ref<ChildTermsQuery | null>(null);
const expandedGraph = ref<EtymologyGraph | null>(null);
const graphResultRef = ref<HTMLElement | null>(null);
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

const ancestorGraphQuery = useAncestorGraphQuery(ancestorGraphInput);
const childTermsGraphQuery = useChildTermsGraphQuery(childTermsGraphInput);
const similarTermsQuery = useSimilarTermsQuery(similarTermsInput);
const languagesQuery = useLanguagesQuery();
const languages = computed(() => languagesQuery.data.value?.languages ?? []);
const similarTerms = computed(() => similarTermsQuery.data.value?.terms ?? []);
const selectedGraph = computed(() => expandedGraph.value ?? ancestorGraphQuery.data.value?.graph ?? null);
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
    ? "Showing English starting points until this language has curated examples."
    : "Try terms curated for this language."
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

/** Returns to the etymology search page so the newly selected language's starters are visible. */
function goToEtymologySearch(): void {
  void router.push({ name: "etymology-search" });
}

/** Sends known starter terms to the language route they were curated for. */
function openStarterTerm(term: string): void {
  void router.push({
    name: "etymology",
    params: {
      langCode: etymologyStarterSet.value.langCode,
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
  shouldScrollToNextGraph.value = Boolean(langCode.value && term.value);
});

watch(
  () => ancestorGraphQuery.data.value?.graph ?? null,
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
          Explore another term
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight text-text">
          Choose a language, then search its words
        </h2>
      </div>
      <div class="grid gap-5 rounded-[3px] border border-border bg-surface/60 p-5 shadow-paper">
        <section
          v-if="similarTerms.length > 0 || similarTermsQuery.isPending.value || similarTermsQuery.isError.value"
          aria-labelledby="similar-terms-heading"
        >
          <div class="mb-3">
            <div>
              <h3 class="mb-1 font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
                Similar terms
              </h3>
            </div>
          </div>
          <div
            v-if="similarTermsQuery.isPending.value"
            class="flex flex-nowrap gap-2 overflow-hidden"
            role="status"
            aria-live="polite"
          >
            <span class="sr-only">Finding nearby entries</span>
            <span
              v-for="item in similarTermsSkeletonItems"
              :key="item"
              class="min-w-0 h-[34px] w-[72px] shrink-0 rounded-md"
              aria-hidden="true"
            >
              <Skeleton class="h-full" tone="raised" />
            </span>
          </div>
          <p v-else-if="similarTermsQuery.isError.value" class="text-sm leading-6 text-text-muted">
            Similar terms are unavailable right now.
          </p>
          <div v-else class="flex flex-wrap gap-2">
            <Button
              v-for="similarTerm in similarTerms"
              :key="similarTerm.node.id"
              variant="secondary"
              size="sm"
              :to="{
                name: 'etymology',
                params: {
                  langCode: similarTerm.node.langCode,
                  term: similarTerm.node.word
                }
              }"
            >
              {{ similarTerm.node.word }}
            </Button>
          </div>
        </section>
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

    <section ref="graphResultRef" class="scroll-mt-6 grid gap-5">
      <section
        v-if="graphStatus === 'idle' || graphStatus === 'empty'"
        class="rounded-[3px] border border-border bg-surface/55 p-5 shadow-paper"
        aria-labelledby="etymology-empty-starters"
      >
        <p v-if="graphStatus === 'idle'" class="mb-4 text-text-muted">
          This etymology route is missing a term or language code.
        </p>
        <p v-else class="mb-4 text-text-muted">
          No source trail in the index for {{ routeLabel }}.
        </p>
        <div class="mb-5">
          <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
            Starting points
          </p>
          <h2 id="etymology-empty-starters" class="text-2xl font-bold leading-tight">
            Try a known ancestry path
          </h2>
          <p class="mt-1 text-sm leading-6 text-text-muted">
            {{ etymologyStarterHelpText }}
          </p>
        </div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <Button
            v-for="query in etymologyStarterSet.queries"
            :key="query.term"
            variant="secondary"
            full-width
            @click="openStarterTerm(query.term)"
          >
            <span class="grid gap-1 text-left">
              <span>{{ query.term }}</span>
              <span class="font-sans text-sm font-normal leading-5 text-text-muted">{{ query.description }}</span>
            </span>
          </Button>
        </div>
      </section>
      <p v-else-if="graphStatus === 'loading'" class="text-text-page-muted">
        Loading the ancestry graph...
      </p>
      <p v-else-if="graphStatus === 'error'" class="text-danger">
        {{ graphError }}
      </p>
      <template v-else-if="selectedGraph">
        <p v-if="childTermsStatus === 'loading'" class="text-text-page-muted">
          Loading direct child terms for {{ childTermsRouteLabel }}...
        </p>
        <p v-else-if="childTermsStatus === 'error'" class="text-danger">
          {{ childTermsError }}
        </p>
        <GraphCanvas
          :graph="selectedGraph"
          :root-node-id="selectedGraph.rootNodeId"
          @load-children="handleLoadChildren"
        />
      </template>
    </section>
  </PageMain>
</template>
