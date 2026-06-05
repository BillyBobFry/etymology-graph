<script setup lang="ts">
import type { StarterQuery } from "./starterQueries";

defineProps<{
  queries: StarterQuery[];
}>();

const emit = defineEmits<{
  select: [term: string];
}>();

/** Lets parent views route starter terms with their current language context. */
const selectStarterQuery = (term: string): void => emit("select", term);
</script>

<template>
  <div class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
    <button
      v-for="query in queries"
      :key="query.term"
      type="button"
      class="group h-full w-full cursor-pointer rounded-[3px] border border-border bg-transparent px-3 py-2.5 text-left font-label transition duration-200 hover:border-border-strong hover:bg-surface/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      @click="selectStarterQuery(query.term)"
    >
      <span class="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span class="font-bold leading-none text-text">{{ query.term }}</span>
        <span class="font-sans text-sm font-normal leading-5 text-text-muted">
          {{ query.description }}
        </span>
      </span>
    </button>
  </div>
</template>
