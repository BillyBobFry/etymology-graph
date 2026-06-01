<script setup lang="ts">
import { RouterLink } from "vue-router";

import { plainTextFromGlossarySegments } from "../features/glossary/linguisticGlossary";
import { soundChangeArticles } from "../features/soundChanges/soundChanges";
import Divider from "../uiComponents/Divider.vue";
</script>

<template>
  <main class="mx-auto grid max-w-5xl gap-8 px-6 py-8 text-text sm:gap-10 sm:py-12">
    <section class="grid gap-5 border-b border-border-strong pb-8">
      <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Sound changes
      </p>
      <div class="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(220px,0.3fr)] lg:items-end">
        <div>
          <h1 class="text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
            Why related words stop looking alike.
          </h1>
        </div>
        <p class="max-w-xl text-lg leading-8 text-text-muted">
          Sound changes are regular shifts in pronunciation that affect groups of words over time. These notes pair short explanations with graph examples, so a historical pattern can be read through real word lineages.
        </p>
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="sound-change-list-heading">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
            Articles
          </p>
          <h2 id="sound-change-list-heading" class="mt-2 text-3xl font-black tracking-tighter">
            Current notes
          </h2>
        </div>
        <p class="text-sm text-text-muted">
          More articles can be added as curated examples are verified.
        </p>
      </div>

      <div class="grid gap-4">
        <article
          v-for="article in soundChangeArticles"
          :key="article.slug"
          class="rounded-md border border-border bg-surface/80 p-5 shadow-paper"
        >
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div class="grid gap-3">
              <div>
                <p class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                  {{ article.families.join(" / ") }}
                </p>
                <h3 class="mt-2 text-3xl font-black tracking-tighter">
                  {{ article.title }}
                </h3>
              </div>
              <p class="max-w-3xl leading-7 text-text-muted">
                {{ plainTextFromGlossarySegments(article.overview) }}
              </p>
              <p class="text-sm text-text-muted">
                Affects: {{ article.affectedLanguages.join(", ") }}
              </p>
            </div>

            <RouterLink
              class="inline-flex w-fit items-center justify-center rounded-lg border border-accent bg-accent px-5 py-3 font-label text-sm font-bold leading-none text-accent-contrast shadow-paper transition duration-200 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              :to="{ name: 'sound-change-article', params: { slug: article.slug } }"
            >
              {{ article.routeLabel }}
            </RouterLink>
          </div>
        </article>
      </div>
    </section>

    <Divider />
  </main>
</template>
