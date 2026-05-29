<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import type { EtymologyGraph } from "@etymology-graph/graph";

import Button from "../uiComponents/Button.vue";
import GraphCanvas from "../features/graph/GraphCanvas.vue";
import TermSearchForm from "../features/terms/TermSearchForm.vue";
import { starterQueriesForLanguage } from "../features/terms/starterQueries";
import { useSearchLanguageStore } from "../features/terms/searchLanguageStore";

const homePreviewGraph: EtymologyGraph = {
  rootNodeId: "en:wine",
  nodes: [
    {
      id: "en:wine",
      langCode: "en",
      langName: "English",
      word: "wine",
      normalizedWord: "wine",
      depth: 0,
      lexicalSummary: {
        pos: "noun",
        definition: "An alcoholic drink made by fermenting grape juice."
      }
    },
    {
      id: "la:vinum",
      langCode: "la",
      langName: "Latin",
      word: "vīnum",
      normalizedWord: "vīnum",
      depth: 1,
      lexicalSummary: {
        pos: "noun",
        definition: "Wine."
      }
    },
    {
      id: "ine-pro:*wóyh₁nom",
      langCode: "ine-pro",
      langName: "Proto-Indo-European",
      word: "*wóyh₁nom",
      normalizedWord: "*wóyh₁nom",
      depth: 2
    }
  ],
  edges: [
    {
      id: "en:wine->la:vinum",
      fromNodeId: "en:wine",
      toNodeId: "la:vinum",
      type: "borrowed_from",
      source: "wiktextract",
      originatingEntryId: "en:wine:entry:noun:0"
    },
    {
      id: "la:vinum->ine-pro:*wóyh₁nom",
      fromNodeId: "la:vinum",
      toNodeId: "ine-pro:*wóyh₁nom",
      type: "derived_from",
      source: "wiktextract",
      originatingEntryId: "en:wine:entry:noun:0"
    }
  ],
  maxDepth: 2
};

const router = useRouter();
const searchLanguageStore = useSearchLanguageStore();
const homeStarterPreviewCount = 4;
const showAllHomeStarters = ref(false);
const homeEtymologyStarterSet = computed(() =>
  starterQueriesForLanguage(searchLanguageStore.selectedSearchLanguage, "etymology")
);
const homeDoubletStarterSet = computed(() =>
  starterQueriesForLanguage(searchLanguageStore.selectedSearchLanguage, "doublets")
);
const homeEtymologyStarterQueries = computed(() =>
  showAllHomeStarters.value
    ? homeEtymologyStarterSet.value.queries
    : homeEtymologyStarterSet.value.queries.slice(0, homeStarterPreviewCount)
);
const homeDoubletStarterQueries = computed(() =>
  showAllHomeStarters.value
    ? homeDoubletStarterSet.value.queries
    : homeDoubletStarterSet.value.queries.slice(0, homeStarterPreviewCount)
);
const hasHiddenHomeStarters = computed(
  () =>
    homeEtymologyStarterSet.value.queries.length > homeStarterPreviewCount ||
    homeDoubletStarterSet.value.queries.length > homeStarterPreviewCount
);
const homeStarterDisclosureLabel = computed(() => (showAllHomeStarters.value ? "Show fewer" : "See more"));
const homeEtymologyStarterHelpText = computed(() =>
  homeEtymologyStarterSet.value.isFallback
    ? "Showing English starting points until this language has curated examples."
    : "Start with terms curated for the selected language."
);
const homeDoubletStarterHelpText = computed(() =>
  homeDoubletStarterSet.value.isFallback
    ? "Showing English doublet cases until this language has curated examples."
    : "Try doublet cases curated for the selected language."
);

/** Keeps the homepage concise while making the full known-good starter set available. */
function toggleHomeStarterExpansion(): void {
  showAllHomeStarters.value = !showAllHomeStarters.value;
}

/** Sends known starter terms to the language route they were curated for. */
function openStarterTerm(term: string): void {
  void router.push({
    name: "etymology",
    params: {
      langCode: homeEtymologyStarterSet.value.langCode,
      term
    }
  });
}

/** Opens known doublet starter terms in the language they were curated for. */
function openDoubletStarterTerm(term: string): void {
  void router.push({
    name: "doublets",
    params: {
      langCode: homeDoubletStarterSet.value.langCode,
      term
    }
  });
}

</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 text-text sm:gap-10 sm:py-12">
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Wiktionary-powered graph exploration
      </p>
      <h1 class="mb-4 max-w-3xl text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
        Search a word. Follow its lineage.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Open a word page, inspect its sources, and follow relationships across inheritance,
        derivation, borrowing, cognates, and doublets.
      </p>
    </section>

    <section class="grid gap-5 border-b border-border pb-8 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Search etymology
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight">
          Choose a language, then open a word page
        </h2>
        <p class="mt-3 max-w-sm leading-7 text-text-muted">
          Search by language and word. Open an etymology page, or find doublets
          when words share ancestry.
        </p>
      </div>
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <TermSearchForm
          id-prefix="home-term-search"
          :lang-code="searchLanguageStore.selectedSearchLanguage"
          @update:lang-code="searchLanguageStore.setSelectedSearchLanguage"
        />
      </div>
    </section>

    <section class="grid gap-5 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)] lg:items-stretch">
      <GraphCanvas
        inert
        :graph="homePreviewGraph"
        :root-node-id="homePreviewGraph.rootNodeId"
        :show-controls="false"
      />

      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          What you will see
        </p>
        <h2 class="mb-3 text-2xl font-bold leading-tight">
          A graph, plus the source trail
        </h2>
        <p class="leading-7 text-text-muted">
          Result pages pair a navigable graph with source notes, relationship labels,
          and entry details.
        </p>
      </div>
    </section>

    <section class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
      <div class="mb-5">
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Starting points
        </p>
        <h2 class="text-2xl font-bold leading-tight">Try a known path through the graph</h2>
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-2 overflow-y-auto max-h-[min(34rem,65vh)]">
        <section class="grid gap-3" aria-labelledby="home-etymology-examples">
          <div>
            <h3 id="home-etymology-examples" class="text-lg font-bold leading-7">
              Trace an etymology
            </h3>
            <p class="mt-1 text-sm leading-6 text-text-muted">
              {{ homeEtymologyStarterHelpText }}
            </p>
          </div>
          <div class="grid  grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3  pr-1">
            <Button
              v-for="query in homeEtymologyStarterQueries"
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

        <section class="grid gap-3" aria-labelledby="home-doublet-examples">
          <div>
            <h3 id="home-doublet-examples" class="text-lg font-bold leading-7">
              Find doublets
            </h3>
            <p class="mt-1 text-sm leading-6 text-text-muted">
              {{ homeDoubletStarterHelpText }}
            </p>
          </div>
          <div class="grid max-h-[min(34rem,65vh)] grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 overflow-y-auto pr-1">
            <Button
              v-for="query in homeDoubletStarterQueries"
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
      </div>

      <div v-if="hasHiddenHomeStarters" class="mt-6 flex justify-center border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          :aria-expanded="showAllHomeStarters"
          @click="toggleHomeStarterExpansion"
        >
          {{ homeStarterDisclosureLabel }}
        </Button>
      </div>
    </section>
  </main>
</template>
