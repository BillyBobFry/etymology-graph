<script setup lang="ts">
import { computed } from "vue";

import { starterQueriesForLanguage } from "../features/terms/starterQueries";
import { useSearchLanguageStore } from "../features/terms/searchLanguageStore";
import EtymologyStarterQueries from "../features/terms/EtymologyStarterQueries.vue";
import TermSearchForm from "../features/terms/TermSearchForm.vue";
import PageMain from "../uiComponents/PageMain.vue";

const searchLanguageStore = useSearchLanguageStore();
const etymologyStarterSet = computed(() =>
  starterQueriesForLanguage(searchLanguageStore.selectedSearchLanguage, "etymology")
);
const etymologyStarterHelpText = computed(() =>
  etymologyStarterSet.value.isFallback
    ? "No examples for this language yet. Showing English examples."
    : "Example words for the selected language."
);
</script>

<template>
  <PageMain>
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Etymology
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Trace a word to its sources.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-page-muted">
        Open an etymology page to follow source languages, ancestor forms, and
        relationships across a word's lineage.
      </p>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Search the index
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight text-text">
          Search for a word
        </h2>
      </div>
      <div class="rounded-[3px] border border-border bg-surface/60 p-5 shadow-paper">
        <TermSearchForm
          id-prefix="etymology-search"
          :lang-code="searchLanguageStore.selectedSearchLanguage"
          @update:lang-code="searchLanguageStore.setSelectedSearchLanguage"
        />
      </div>
    </section>

    <section class="rounded-[3px] border border-border bg-surface/55 p-5 shadow-paper" aria-labelledby="etymology-search-starters">
      <div class="mb-5">
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Starting points
        </p>
        <h2 id="etymology-search-starters" class="text-2xl font-bold leading-tight">
          Example words with source paths
        </h2>
        <p class="mt-1 text-sm leading-6 text-text-muted">
          {{ etymologyStarterHelpText }}
        </p>
      </div>
      <EtymologyStarterQueries :lang-code="etymologyStarterSet.langCode" :queries="etymologyStarterSet.queries" />
    </section>
  </PageMain>
</template>
