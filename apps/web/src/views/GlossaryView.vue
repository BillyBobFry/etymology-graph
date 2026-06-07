<script setup lang="ts">
import { computed } from "vue";

import GlossaryText from "../features/glossary/GlossaryText.vue";
import {
  linguisticGlossaryTerms,
  type GlossaryTextSegment,
  type LinguisticGlossaryTerm
} from "../features/glossary/linguisticGlossary";
import Divider from "../uiComponents/Divider.vue";
import Link from "../uiComponents/Link.vue";
import PageMain from "../uiComponents/PageMain.vue";

const glossaryTerms = computed(() =>
  Object.values(linguisticGlossaryTerms).sort((firstTerm, secondTerm) =>
    firstTerm.label.localeCompare(secondTerm.label)
  )
);

/** Keeps glossary entries readable while allowing selected cross-references to carry tooltips. */
const definitionSegmentsForTerm = (term: LinguisticGlossaryTerm): GlossaryTextSegment[] =>
  term.definitionSegments ?? [term.shortDefinition];

/** Gives examples the same annotation surface as definitions when a term needs it. */
const exampleSegmentsForTerm = (term: LinguisticGlossaryTerm): GlossaryTextSegment[] | null => {
  if (term.exampleSegments) {
    return term.exampleSegments;
  }

  return term.example ? [term.example] : null;
};
</script>

<template>
  <PageMain>
    <section class="grid gap-5 border-b border-border-strong pb-8">
      <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Glossary
      </p>
      <div class="grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(240px,0.28fr)] lg:items-start">
        <h1 class="text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
          Read word histories with less guesswork.
        </h1>
        <p class="max-w-xl text-lg leading-8 text-text-page-muted">
          A compact reference for the linguistic terms used in sound-change articles, graph notes, and word lineages.
        </p>
      </div>
    </section>

    <section class="grid gap-4" aria-labelledby="glossary-index-heading">
      <div>
        <p class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-page-muted">
          Term index
        </p>
        <h2 id="glossary-index-heading" class="mt-2 text-3xl font-black tracking-tighter">
          Browse the vocabulary
        </h2>
      </div>

      <nav
        aria-label="Glossary term shortcuts"
        class="flex flex-wrap gap-x-4 gap-y-2"
      >
        <Link
          v-for="term in glossaryTerms"
          :key="term.id"
          variant="list"
          :href="`#${term.id}`"
        >
          {{ term.label }}
        </Link>
      </nav>
    </section>

    <Divider />

    <section class="grid gap-2 divide-y divide-border" aria-label="Glossary definitions">
      <article
        v-for="term in glossaryTerms"
        :id="term.id"
        :key="term.id"
        class="scroll-mt-8 py-5 first:pt-0 last:pb-0"
      >
        <div class="grid gap-3 sm:grid-cols-[minmax(0,0.28fr)_minmax(0,0.72fr)] sm:gap-8">
          <div class="grid content-start gap-3">
            <h3 class="text-2xl font-black tracking-tighter sm:text-3xl">
              {{ term.label }}
            </h3>
            <p
              v-if="term.aliases.length > 0"
              class="text-sm leading-6 text-text-muted"
            >
              Also: {{ term.aliases.join(", ") }}
            </p>
          </div>

          <div class="grid gap-3 leading-7 text-text">
            <p>
              <GlossaryText :segments="definitionSegmentsForTerm(term)" />
            </p>
            <p
              v-if="exampleSegmentsForTerm(term)"
              class="text-text-muted"
            >
              <span class="font-label text-xs font-bold uppercase tracking-[0.14em]">Example: </span>
              <GlossaryText :segments="exampleSegmentsForTerm(term) ?? []" />
            </p>
          </div>
        </div>
      </article>
    </section>
  </PageMain>
</template>
