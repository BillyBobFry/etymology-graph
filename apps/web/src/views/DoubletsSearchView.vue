<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  normalizeWord,
  type ComparisonSetQuery,
  type DoubletGroup,
  type EtymologyGraph,
  type Language
} from "@etymology-graph/graph";

import DoubletGroupsAccordion from "../features/graph/DoubletGroupsAccordion.vue";
import GraphEvidencePanel from "../features/graph/GraphEvidencePanel.vue";
import type { GraphLayoutPreset } from "../features/graph/composables/useGraphLayout";
import { primaryGraphNodeHighlights } from "../features/graph/graphNodeHighlights";
import {
  comparisonSetQueryKey,
  fetchComparisonSet,
  useComparisonSetQuery
} from "../features/soundChanges/useComparisonSetQuery";
import { useDoubletGroupsQuery } from "../features/graph/composables/useDoubletGroupsQuery";
import LanguageSelector from "../features/languages/LanguageSelector.vue";
import { useLanguagesQuery } from "../features/languages/useLanguagesQuery";
import { fallbackSearchLanguage, useSearchLanguageStore } from "../features/terms/searchLanguageStore";
import Button from "../uiComponents/Button.vue";
import PageMain from "../uiComponents/PageMain.vue";
import Skeleton from "../uiComponents/Skeleton.vue";

const defaultGroupLimit = 5;
const defaultEntryLimit = 12;

type ResultsStatus = "idle" | "loading" | "success" | "empty" | "error";
type GraphStatus = "idle" | "loading" | "success" | "empty" | "error";

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const searchLanguageStore = useSearchLanguageStore();
const languagesQuery = useLanguagesQuery();
const languages = computed(() => languagesQuery.data.value?.languages ?? []);
const routeLangCode = computed(() => firstRouteParam(route.params.langCode));
const expandedGroupId = ref<string>();
const selectedLangCode = computed({
  get: () => searchLanguageStore.selectedSearchLanguage,
  set: setSelectedLanguage
});
const selectedLanguage = computed(() => findLanguage(selectedLangCode.value));
const resultQueryInput = computed(() => {
  if (!selectedLangCode.value) {
    return null;
  }

  return {
    langCode: selectedLangCode.value,
    maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
    limit: defaultGroupLimit,
    entryLimit: defaultEntryLimit
  };
});
const groupsQuery = useDoubletGroupsQuery(resultQueryInput);
const groups = computed(() => groupsQuery.data.value?.pages.flatMap((page) => page.groups) ?? []);
const expandedGroup = computed(() => groups.value.find((group) => group.sharedAncestor.id === expandedGroupId.value));
const expandedGraphInput = computed<ComparisonSetQuery | null>(() =>
  expandedGroup.value ? comparisonSetQueryForGroup(expandedGroup.value) : null
);
const expandedGraphQuery = useComparisonSetQuery(expandedGraphInput);
const expandedGraphRootNodeId = computed(() => {
  const graph = expandedGraphQuery.data.value?.graph;
  const sharedAncestorId = expandedGroup.value?.sharedAncestor.id;

  if (graph && sharedAncestorId && graph.nodes.some((node) => node.id === sharedAncestorId)) {
    return sharedAncestorId;
  }

  return graph?.rootNodeId;
});
const expandedGraphLayoutPreset = computed<GraphLayoutPreset>(() =>
  expandedGraphRootNodeId.value
    ? { type: "doublet-arms", rootNodeId: expandedGraphRootNodeId.value }
    : { type: "auto" }
);
const expandedGraphNodeHighlights = computed(() =>
  primaryGraphNodeHighlights(
    highlightedTermNodeIds(
      expandedGraphQuery.data.value?.graph ?? null,
      expandedGroup.value?.entries.map((entry) => ({ langCode: entry.langCode, word: entry.word })) ?? []
    )
  )
);
const resultsStatus = computed<ResultsStatus>(() => {
  if (!resultQueryInput.value) {
    return "idle";
  }

  if (groupsQuery.isPending.value || (groupsQuery.isFetching.value && !groupsQuery.data.value)) {
    return "loading";
  }

  if (groupsQuery.isError.value) {
    return "error";
  }

  return groups.value.length > 0 ? "success" : "empty";
});
const graphStatus = computed<GraphStatus>(() => {
  if (!expandedGraphInput.value) {
    return "idle";
  }

  if (expandedGraphQuery.isPending.value || (expandedGraphQuery.isFetching.value && !expandedGraphQuery.data.value)) {
    return "loading";
  }

  if (expandedGraphQuery.isError.value) {
    return "error";
  }

  return expandedGraphQuery.data.value?.graph ? "success" : "empty";
});
const resultHeading = computed(() =>
  selectedLanguage.value
    ? `${selectedLanguage.value.canonicalName} doublet groups`
    : "Choose a language"
);
const resultHelpText = computed(() =>
  selectedLanguage.value
    ? `Browse ${selectedLanguage.value.canonicalName} entries grouped by shared ancestors.`
    : "Choose a language to find same-language entries that reconnect through shared ancestry."
);

watch(routeLangCode, syncLanguageFromRoute, { immediate: true });
watch(languages, ensureValidLanguageSelection, { immediate: true });
watch(selectedLangCode, () => {
  expandedGroupId.value = undefined;
});

/** Applies route language params to the shared language preference. */
function syncLanguageFromRoute(langCode: string | undefined): void {
  if (langCode) {
    searchLanguageStore.setSelectedSearchLanguage(langCode);
  }
}

/** Defaults group browsing to a valid imported language when browser language is unavailable. */
function ensureValidLanguageSelection(availableLanguages: Language[]): void {
  if (availableLanguages.length === 0) {
    return;
  }

  if (!selectedLangCode.value || !hasLanguage(availableLanguages, selectedLangCode.value)) {
    searchLanguageStore.setSelectedSearchLanguage(
      findPreferredLanguageCode(availableLanguages, [fallbackSearchLanguage, availableLanguages[0]?.code])
    );
  }
}

/** Stores the selected language and opens a shareable language-specific doublet group route. */
function setSelectedLanguage(langCode: string | undefined): void {
  searchLanguageStore.setSelectedSearchLanguage(langCode);

  if (!langCode) {
    void router.push({ name: "doublets-search" });
    return;
  }

  void router.push({
    name: "doublet-groups",
    params: {
      langCode
    }
  });
}

/** Finds the first candidate language code present in the imported language list. */
function findPreferredLanguageCode(availableLanguages: Language[], candidates: Array<string | undefined>): string | undefined {
  return candidates.find((candidate) =>
    candidate !== undefined && availableLanguages.some((language) => language.code === candidate)
  );
}

/** Checks that a language code is present in the imported language list. */
function hasLanguage(availableLanguages: Language[], langCode: string): boolean {
  return availableLanguages.some((language) => language.code === langCode);
}

/** Looks up language metadata for headings and picker descriptions. */
function findLanguage(langCode: string | undefined): Language | undefined {
  if (!langCode) {
    return undefined;
  }

  return languages.value.find((language) => language.code === langCode);
}

/** Builds a focused evidence graph from the verified ancestor and sampled group entries. */
function comparisonSetQueryForGroup(group: DoubletGroup): ComparisonSetQuery | null {
  if (group.entries.length === 0) {
    return null;
  }

  return {
    root: {
      langCode: group.sharedAncestor.langCode,
      word: group.sharedAncestor.word
    },
    maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
    groups: [
      {
        id: group.sharedAncestor.id,
        label: "Doublet group",
        items: group.entries.map((entry) => ({
          id: entry.id,
          langCode: entry.langCode,
          word: entry.word,
          pos: entry.pos,
          etymologyNumber: entry.etymologyNumber
        }))
      }
    ]
  };
}

/** Starts loading graph evidence as soon as a result trigger shows user intent. */
function prefetchDoubletGraph(group: DoubletGroup): void {
  const query = comparisonSetQueryForGroup(group);

  if (!query) {
    return;
  }

  void queryClient.prefetchQuery({
    queryKey: comparisonSetQueryKey(query),
    queryFn: ({ signal }) => fetchComparisonSet(query, signal),
    staleTime: 60_000
  });
}

/** Loads the next verified group page only after explicit user intent. */
function loadMoreGroups(): void {
  if (!groupsQuery.hasNextPage.value || groupsQuery.isFetchingNextPage.value) {
    return;
  }

  void groupsQuery.fetchNextPage();
}

/** Extracts the first string value from Vue Router params. */
function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Finds graph nodes that represent the entries shown for an expanded doublet group. */
function highlightedTermNodeIds(graph: EtymologyGraph | null, terms: Array<{ langCode: string; word: string }>): string[] {
  if (!graph || terms.length === 0) {
    return [];
  }

  const termKeys = new Set(terms.map((term) => termKey(term.langCode, term.word)));

  return graph.nodes
    .filter((node) => termKeys.has(termKey(node.langCode, node.normalizedWord)))
    .map((node) => node.id);
}

/** Keeps highlight matching aligned with graph-node normalization. */
function termKey(langCode: string, word: string): string {
  return `${langCode}:${normalizeWord(word)}`;
}
</script>

<template>
  <PageMain>
    <section class="pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Doublets
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Find words that split from one source.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-page-muted">
        Doublets are words in the same language that trace back to one source, like
        fragile and frail. Choose a language to find those pairs and follow their
        shared lineage.
      </p>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Language
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight text-text">
          Choose a language to group its doublets
        </h2>
      </div>
      <div class="rounded-[3px] border border-border bg-surface/55 p-5">
        <LanguageSelector
          id="doublet-groups-language"
          v-model="selectedLangCode"
          label="Words in"
          placeholder="Choose a language"
        />
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="doublet-groups-results">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
            {{ resultsStatus === 'idle' ? 'Starting point' : 'Groups' }}
          </p>
          <h2 id="doublet-groups-results" class="text-2xl font-bold leading-tight text-text">
            {{ resultHeading }}
          </h2>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-text-page-muted">
            {{ resultHelpText }}
          </p>
        </div>
      </div>

      <div v-if="resultsStatus === 'idle'" class="grid max-w-2xl gap-2 py-2 text-text-page-muted">
        <h3 class="font-label text-sm font-black uppercase tracking-[0.12em] text-text">
          Choose a language
        </h3>
        <p class="leading-7">
          Doublet groups list same-language words that share a source. Pick a language above to browse the
          groups currently available in the index.
        </p>
      </div>

      <div
        v-else-if="resultsStatus === 'loading'"
        class="grid gap-3"
        role="status"
        aria-busy="true"
        aria-label="Loading doublet groups"
      >
        <Skeleton
          v-for="item in 4"
          :key="item"
          variant="block"
          tone="raised"
          class="h-25 rounded-[3px]"
        />
      </div>

      <div v-else-if="resultsStatus === 'error'" class="border-y border-danger/50 py-5 text-danger">
        Could not load doublet groups.
      </div>

      <div v-else-if="resultsStatus === 'empty'" class="grid gap-2 py-2 text-text-page-muted">
        <h3 class="font-label text-sm font-black uppercase tracking-[0.12em] text-text">
          No doublet groups for this language yet
        </h3>
        <p class="max-w-2xl leading-7">
          No entries in this language currently share a source within the search depth. Try another language
          or open a starter term.
        </p>
      </div>

      <DoubletGroupsAccordion
        v-else
        v-model="expandedGroupId"
        :groups="groups"
        @prefetch-group="prefetchDoubletGraph"
      >
        <template #panel="{ group }">
          <GraphEvidencePanel
            :key="group.sharedAncestor.id"
            :status="graphStatus"
            :graph="expandedGraphQuery.data.value?.graph ?? null"
            :layout-preset="expandedGraphLayoutPreset"
            :node-highlights="expandedGraphNodeHighlights"
            empty-text="No focused graph is available for this group."
          />
        </template>
      </DoubletGroupsAccordion>

      <div
        v-if="groupsQuery.isFetchingNextPage.value"
        class="grid gap-3"
        role="status"
        aria-busy="true"
        aria-label="Loading more doublet groups"
      >
        <Skeleton
          v-for="item in 5"
          :key="item"
          variant="block"
          tone="raised"
          class="h-22 rounded-[3px]"
        />
      </div>
      <div v-else-if="groupsQuery.hasNextPage.value" class="flex justify-center pt-2">
        <Button
          variant="secondary"
          :loading="groupsQuery.isFetchingNextPage.value"
          loading-label="Loading groups"
          @click="loadMoreGroups"
        >
          Load more
        </Button>
      </div>
    </section>
  </PageMain>
</template>
