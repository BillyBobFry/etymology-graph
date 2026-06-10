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
      class="group grid h-full cursor-pointer content-center gap-1 rounded-[3px] bg-surface/30 px-3 py-2.5 text-left transition duration-200 hover:bg-surface/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span class="font-label text-base font-bold leading-tight text-text transition group-hover:text-accent">
        {{ query.term }}
      </span>
      <span class="text-sm leading-5 text-text-page-muted transition group-hover:text-text-muted">
        {{ query.description }}
      </span>
    </RouterLink>
  </div>
</template>
