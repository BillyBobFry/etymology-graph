<script setup lang="ts">
import { useRouter } from "vue-router";

import Button from "./uiComponents/Button.vue";
import TermSearchForm from "./TermSearchForm.vue";

const starterQueries = [
  "beer",
  "bread",
  "father",
  "wine",
  "cheese"
];

const doubletStarterQueries = [
  "shirt",
  "chief",
  "channel",
  "fragile"
];

const defaultStarterLangCode = "en";

const router = useRouter();

/** Sends known seed terms straight to their canonical English etymology route. */
function openStarterTerm(term: string): void {
  void router.push({
    name: "etymology",
    params: {
      langCode: defaultStarterLangCode,
      term
    }
  });
}

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
        Wiktionary-powered graph exploration
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Etymology Graph
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Search for a word, inspect its ancestry, and explore relationships such as
        inheritance, derivation, borrowing, cognates, and doublets.
      </p>
    </section>

    <section class="grid gap-5 border-b border-border pb-8 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Search the atlas
        </p>
        <h2 class="max-w-sm text-2xl font-black tracking-[-0.03em] text-text">
          Choose a language, then search its words
        </h2>
      </div>
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <TermSearchForm id-prefix="home-term-search" />
      </div>
    </section>

    <section class="grid gap-5 lg:grid-cols-2">
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <h2 class="mb-4 text-2xl font-black tracking-[-0.03em] text-text">Seed terms to try</h2>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
          <Button
            v-for="query in starterQueries"
            :key="query"
            variant="secondary"
            full-width
            @click="openStarterTerm(query)"
          >
            {{ query }}
          </Button>
        </div>
      </div>

      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <h2 class="mb-2 text-2xl font-black tracking-[-0.03em] text-text">Doublet examples</h2>
        <p class="mb-4 text-text-muted">
          These terms are good starting points for shared-ancestor doublet candidates.
        </p>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
          <Button
            v-for="query in doubletStarterQueries"
            :key="query"
            variant="secondary"
            full-width
            @click="openDoubletStarterTerm(query)"
          >
            {{ query }}
          </Button>
        </div>
      </div>
    </section>
  </main>
</template>
