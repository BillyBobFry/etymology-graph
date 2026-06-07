<script setup lang="ts">
defineProps<{
  keys: string[];
}>();
</script>

<template>
  <span class="inline-flex items-center gap-1" aria-label="Keyboard shortcut">
    <kbd
      v-for="key in keys"
      :key="key"
      class="min-w-5 rounded-[3px] border border-border bg-surface/70 px-1.5 py-1 text-center font-label text-[0.68rem] font-bold leading-none text-text-muted shadow-paper"
    >
      {{ key }}
    </kbd>
  </span>
</template>
