<script setup lang="ts">
import { useRouter } from "vue-router";

import { defaultStarterLangCode, doubletStarterQueries } from "./starterQueries";
import TermSearchForm from "./TermSearchForm.vue";
import Button from "./uiComponents/Button.vue";

const router = useRouter();

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
</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 sm:gap-10 sm:py-12">
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Doublet lookup
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Find words with a shared ancestry.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Choose a language and term to infer same-language doublet candidates from
        shared inherited, borrowed, and derived ancestors.
      </p>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Search the index
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight text-text">
          Start with a language and term
        </h2>
      </div>
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <TermSearchForm id-prefix="doublets-search" target-route-name="doublets" />
      </div>
    </section>

    <section class="rounded-md border border-border bg-surface/75 p-5 shadow-paper" aria-labelledby="doublets-search-starters">
      <div class="mb-5">
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Starting points
        </p>
        <h2 id="doublets-search-starters" class="text-2xl font-bold leading-tight">
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
  </main>
</template>
