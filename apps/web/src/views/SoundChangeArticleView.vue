<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";

import GlossaryText from "../features/glossary/GlossaryText.vue";
import type { GlossaryTextSegment } from "../features/glossary/linguisticGlossary";
import SoundChangeExampleGraph from "../features/soundChanges/SoundChangeExampleGraph.vue";
import { findSoundChangeArticle } from "../features/soundChanges/soundChanges";
import Divider from "../uiComponents/Divider.vue";
import PageMain from "../uiComponents/PageMain.vue";

const route = useRoute();
const article = computed(() => findSoundChangeArticle(firstRouteParam(route.params.slug) ?? ""));
const graphExamplesIntro: GlossaryTextSegment[] = [
  "Each set compares Germanic ",
  { text: "reflexes", termId: "reflex" },
  " with ",
  { text: "cognates", termId: "cognate" },
  " from other branches in one shared graph, so the branches can be read against the same source form."
];

/** Extracts a single route parameter from Vue Router's array-capable param shape. */
function firstRouteParam(param: string | string[] | undefined): string | null {
  if (Array.isArray(param)) {
    return param[0] ?? null;
  }

  return param ?? null;
}
</script>

<template>
  <PageMain v-if="article">
    <section class="grid gap-5 border-b border-border-strong pb-8">
      <RouterLink
        class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        :to="{ name: 'sound-changes' }"
      >
        Sound changes
      </RouterLink>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,0.68fr)_minmax(240px,0.32fr)] lg:items-end">
        <div>
          <h1 class="text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
            {{ article.title }}
          </h1>
          <p class="mt-5 max-w-3xl text-xl leading-8 text-text-page-muted">
            {{ article.subtitle }}
          </p>
        </div>

        <dl class="grid gap-4 rounded-[3px] border border-border bg-surface/55 p-5 shadow-paper">
          <div>
            <dt class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
              Families
            </dt>
            <dd class="mt-1 text-lg font-bold text-text">
              {{ article.families.join(", ") }}
            </dd>
          </div>
          <div>
            <dt class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
              Affects
            </dt>
            <dd class="mt-1 leading-7 text-text-muted">
              {{ article.affectedLanguages.join(", ") }}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-[minmax(180px,0.24fr)_minmax(0,0.76fr)] lg:items-start">
      <div>
        <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Note
        </p>
      </div>

      <div class="grid gap-6 text-lg leading-8">
        <p class="text-text-page-muted">
          <GlossaryText :segments="article.overview" />
        </p>
        <div class="grid gap-5">
          <section v-for="section in article.sections" :key="section.heading" class="grid gap-2">
            <h2 class="text-2xl font-black tracking-[-0.04em] text-text">
              {{ section.heading }}
            </h2>
            <p class="text-text-page-muted">
              <GlossaryText :segments="section.body" />
            </p>
          </section>
        </div>
      </div>
    </section>

    <Divider />

    <section class="grid gap-5" aria-labelledby="sound-change-examples-heading">
      <div class="grid gap-3">
        <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Sound-change paths
        </p>
        <h2 id="sound-change-examples-heading" class="text-4xl font-black tracking-tighter">
          Compare related words in the graph
        </h2>
        <p class="max-w-3xl text-text-page-muted">
          <GlossaryText :segments="graphExamplesIntro" />
        </p>
      </div>

      <div class="grid gap-5">
        <SoundChangeExampleGraph
          v-for="example in article.examples"
          :key="example.id"
          :example="example"
        />
      </div>
    </section>
  </PageMain>

  <PageMain v-else>
    <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
      Sound changes
    </p>
    <h1 class="text-5xl font-black tracking-[-0.06em]">
      Article not found.
    </h1>
    <p class="text-text-page-muted">
      This sound-change note is not available yet.
    </p>
    <RouterLink
      class="inline-flex w-fit items-center justify-center rounded-md border border-accent bg-accent px-5 py-3 font-label text-sm font-bold leading-none text-accent-contrast shadow-paper transition duration-200 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      :to="{ name: 'sound-changes' }"
    >
      Back to sound changes
    </RouterLink>
  </PageMain>
</template>
