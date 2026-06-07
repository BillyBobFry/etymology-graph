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
      class="flex h-full w-full cursor-pointer items-center rounded-[3px] border border-border bg-surface/45 px-3 py-2.5 text-left font-label shadow-paper transition duration-200 hover:border-border-strong hover:bg-surface/75 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span class="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span class="font-bold leading-none text-text">{{ query.term }}</span>
        <span class="font-sans text-sm font-normal leading-5 text-text-muted">
          {{ query.description }}
        </span>
      </span>
    </RouterLink>
  </div>
</template>
