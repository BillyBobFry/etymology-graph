<script setup lang="ts">
import TermSearchForm from "./TermSearchForm.vue";
</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 sm:gap-10 sm:py-12">
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Etymology lookup
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Choose a language, then a term.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Start with the language you want to explore, then search within that graph index
        to open a canonical etymology page.
      </p>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Search the index
        </p>
        <h2 class="max-w-sm text-2xl font-black tracking-[-0.03em] text-text">
          Open a canonical word page
        </h2>
      </div>
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <TermSearchForm id-prefix="etymology-search" />
      </div>
    </section>
  </main>
</template>
