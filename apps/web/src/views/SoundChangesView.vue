<script setup lang="ts">
import { plainTextFromGlossarySegments } from "../features/glossary/linguisticGlossary";
import { soundChangeArticles } from "../features/soundChanges/soundChanges";
import Button from "../uiComponents/Button.vue";
import Divider from "../uiComponents/Divider.vue";
import PageMain from "../uiComponents/PageMain.vue";
</script>

<template>
  <PageMain>
    <section class="grid gap-5 border-b border-border-strong pb-8">
      <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Sound changes
      </p>
      <div class="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(220px,0.3fr)] lg:items-start">
        <div>
          <h1 class="text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
            Why related words stop looking alike.
          </h1>
        </div>
        <p class="max-w-xl text-lg leading-8 text-text-page-muted">
          Sound changes are regular shifts in pronunciation that affect groups of words over time. These articles pair short explanations with graph examples, so a historical pattern can be read through real word lineages.
        </p>
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="sound-change-list-heading">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-page-muted">
            Sound-change articles
          </p>
          <h2 id="sound-change-list-heading" class="mt-2 text-3xl font-black tracking-tighter">
            Browse the patterns
          </h2>
        </div>
      </div>

      <div class="grid gap-4">
        <article
          v-for="article in soundChangeArticles"
          :key="article.slug"
          class="rounded-[3px] border border-border bg-surface/55 p-5 shadow-paper"
        >
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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

            <Button
              size="sm"
              :to="{ name: 'sound-change-article', params: { slug: article.slug } }"
            >
              Read article
            </Button>
          </div>
        </article>
      </div>
    </section>

    <Divider />
  </PageMain>
</template>
