<script setup lang="ts">
import { RouterLink } from "vue-router";

import type { StarterQuery } from "./starterQueries";

defineProps<{
  langCode: string;
  queries: StarterQuery[];
}>();
</script>

<template>
  <div class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
    <RouterLink
      v-for="query in queries"
      :key="query.term"
      :to="{
        name: 'etymology',
        params: {
          langCode,
          term: query.term
        }
      }"
      class="starter-query-paper group h-full w-full cursor-pointer rounded-[3px] border border-border bg-surface/40 px-3 py-2.5 text-left font-label shadow-paper transition duration-200 hover:border-border-strong hover:bg-surface/70 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background flex items-center"
    >
      <span class="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span class="relative z-10 font-bold leading-none text-text">{{ query.term }}</span>
        <span class="relative z-10 font-sans text-sm font-normal leading-5 text-text-muted">
          {{ query.description }}
        </span>
      </span>
    </RouterLink>
  </div>
</template>

<style scoped>
.starter-query-paper {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background-image:
    linear-gradient(
      180deg,
      color-mix(in oklch, white 14%, transparent),
      transparent 48%,
      color-mix(in oklch, black 4%, transparent)
    ),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cfilter id='fiber'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.38 0 0 0 0 0.3 0 0 0 0 0.18 0 0 0 0.13 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23fiber)'/%3E%3C/svg%3E");
  background-blend-mode: soft-light, multiply;
  background-size:
    100% 100%,
    120px 120px;
}

:global(.dark) .starter-query-paper {
  background-image:
    linear-gradient(
      180deg,
      color-mix(in oklch, white 8%, transparent),
      transparent 50%,
      color-mix(in oklch, black 10%, transparent)
    ),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cfilter id='fiber'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.86 0 0 0 0 0.76 0 0 0 0 0.58 0 0 0 0.1 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23fiber)'/%3E%3C/svg%3E");
  background-blend-mode: soft-light, screen;
}
</style>
