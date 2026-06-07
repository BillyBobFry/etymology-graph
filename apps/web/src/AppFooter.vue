<script setup lang="ts">
import Link from "./uiComponents/Link.vue";

const githubRepositoryUrl = "https://github.com/BillyBobFry/etymology-graph";
const wiktionaryUrl = "https://www.wiktionary.org/";
</script>

<template>
  <footer class="mx-auto mt-auto grid w-full max-w-6xl gap-5 px-6 pb-8 pt-4 text-text-page-muted sm:pb-10">
    <div class="border-t border-border-strong pt-5">
      <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div class="max-w-2xl">
          <p class="font-label text-xs font-bold uppercase tracking-[0.14em]">
            Lingraphic
          </p>
          <p class="mt-2 text-sm leading-6">
            An archival language atlas for tracing word lineages. Built from
            <Link :href="wiktionaryUrl" target="_blank">Wiktionary</Link>
            -derived lexical data. Etymologies can be incomplete, uncertain, or source-dependent.
          </p>
        </div>

        <nav
          aria-label="Footer"
          class="flex flex-wrap gap-x-4 gap-y-2 md:justify-end"
        >
          <Link variant="list" :to="{ name: 'etymology-search' }">Search</Link>
          <Link variant="list" :to="{ name: 'ancestor-language-search' }">Word lineages</Link>
          <Link variant="list" :to="{ name: 'sound-changes' }">Sound changes</Link>
          <Link variant="list" :to="{ name: 'glossary' }">Glossary</Link>
          <Link variant="list" :href="githubRepositoryUrl" target="_blank">GitHub</Link>
        </nav>
      </div>
    </div>
  </footer>
</template>
