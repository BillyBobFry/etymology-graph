<script setup lang="ts">
import { computed } from "vue";
import type { TermEntrySummary } from "@etymology-graph/graph";

const props = defineProps<{
  entries: TermEntrySummary[];
  selectedEntryId: string | null;
}>();

const emit = defineEmits<{
  (event: "select", entry: TermEntrySummary): void;
}>();

const hasMultipleEntries = computed(() => props.entries.length > 1);

/** Renders a compact label for each entry so the chooser surfaces pos and etymology number. */
function entryLabel(entry: TermEntrySummary): string {
  const parts: string[] = [];
  if (entry.pos) {
    parts.push(entry.pos);
  }
  if (entry.etymologyNumber !== undefined) {
    parts.push(`etym ${entry.etymologyNumber}`);
  }
  if (parts.length === 0) {
    parts.push("entry");
  }

  return parts.join(" · ");
}
</script>

<template>
  <section v-if="hasMultipleEntries" aria-label="Etymological entries" class="grid gap-2">
    <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
      Choose an entry
    </p>
    <p class="text-sm leading-5 text-text-muted">
      This word has more than one recorded history. Pick the one to follow.
    </p>
    <div role="radiogroup" aria-label="Lexical entry" class="flex flex-wrap gap-2">
      <button
        v-for="entry in entries"
        :key="entry.id"
        type="button"
        role="radio"
        :aria-checked="entry.id === selectedEntryId"
        class="inline-flex max-w-sm flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        :class="
          entry.id === selectedEntryId
            ? 'border-accent bg-accent text-accent-contrast shadow-paper'
            : 'border-border-strong bg-surface-muted text-text hover:border-accent hover:bg-surface-raised hover:text-accent'
        "
        @click="emit('select', entry)"
      >
        <span class="font-label text-sm font-bold leading-none">{{ entryLabel(entry) }}</span>
        <span
          v-if="entry.primaryGloss"
          class="text-sm leading-5"
          :class="entry.id === selectedEntryId ? 'text-accent-contrast/85' : 'text-text-muted'"
        >
          {{ entry.primaryGloss }}
        </span>
      </button>
    </div>
  </section>
</template>
