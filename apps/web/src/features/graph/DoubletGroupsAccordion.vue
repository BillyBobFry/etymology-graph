<script setup lang="ts">
import { computed } from "vue";

import type { DoubletGroup, TermEntrySummary } from "@etymology-graph/graph";

import Badge from "../../uiComponents/Badge.vue";
import ResultsAccordion from "../../uiComponents/ResultsAccordion.vue";
import { partOfSpeechLabel } from "../terms/utils/partOfSpeech";

const props = defineProps<{
  groups: DoubletGroup[];
  modelValue?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
  "prefetch-group": [group: DoubletGroup];
}>();

defineSlots<{
  panel?: (props: { group: DoubletGroup }) => unknown;
}>();

const groupIds = computed(() => props.groups.map((group) => group.sharedAncestor.id));
const groupsById = computed(() => new Map(props.groups.map((group) => [group.sharedAncestor.id, group])));

/** Finds a typed doublet group for the id-only shared accordion slot. */
function groupForId(groupId: string): DoubletGroup | undefined {
  return groupsById.value.get(groupId);
}

/** Emits typed prefetch intent after resolving the shared accordion item id. */
function prefetchGroup(groupId: string): void {
  const group = groupForId(groupId);

  if (group) {
    emit("prefetch-group", group);
  }
}

/** Resolves imported language names for compact shared ancestor labels. */
function languageLabel(term: { langCode: string; langName?: string }): string {
  return term.langName ?? term.langCode;
}

/** Shows the sampled target-language terms first because they are the doublet set users browse. */
function doubletSetLabel(group: DoubletGroup): string {
  const preview = group.entries.slice(0, 5).map((entry) => entry.word).join(", ");

  if (group.entryCount > group.entries.length) {
    return `${preview}, and ${group.entryCount - group.entries.length} more`;
  }

  return preview;
}

/** Labels the shared ancestor as supporting evidence rather than the primary row title. */
function sharedAncestorLabel(group: DoubletGroup): string {
  return `${languageLabel(group.sharedAncestor)}:${group.sharedAncestor.word}`;
}

/** Gives each sampled entry a concise lexical label for the expanded panel. */
function entryLabel(entry: TermEntrySummary): string {
  const suffixes = [
    entry.pos === undefined ? undefined : partOfSpeechLabel(entry.pos),
    entry.etymologyNumber === undefined ? undefined : `etymology ${entry.etymologyNumber}`
  ].filter((suffix) => suffix !== undefined);

  return suffixes.length > 0 ? `${entry.word}, ${suffixes.join(", ")}` : entry.word;
}
</script>

<template>
  <ResultsAccordion
    :item-ids="groupIds"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @prefetch-item="prefetchGroup"
  >
    <template #trigger="{ itemId }">
      <span v-if="groupForId(itemId)" class="grid min-w-0 gap-2">
        <span class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span class="grid min-w-0 gap-1">
            <span class="font-label text-[0.68rem] font-bold uppercase tracking-[0.12em] text-text-muted">
              Doublet group
            </span>
            <span class="truncate font-label text-sm font-black uppercase tracking-[0.12em] text-accent sm:text-base">
              {{ doubletSetLabel(groupForId(itemId)!) }}
            </span>
          </span>
          <span class="flex shrink-0 items-center gap-2 tabular-nums">
            <Badge>{{ groupForId(itemId)!.minDepth }} {{ groupForId(itemId)!.minDepth === 1 ? "step" : "steps" }}</Badge>
          </span>
        </span>
        <span class="text-sm leading-6 text-text-muted">
          Shared ancestor: <span class="font-label font-bold text-text">{{ sharedAncestorLabel(groupForId(itemId)!) }}</span>
        </span>
      </span>
    </template>

    <template #panel="{ itemId }">
      <div v-if="groupForId(itemId)" class="grid gap-4">
        <div class="grid gap-2">
          <p class="font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
            Sampled entries in this group
          </p>
          <div class="flex flex-wrap gap-2">
            <Badge v-for="entry in groupForId(itemId)!.entries" :key="entry.id">
              {{ entryLabel(entry) }}
            </Badge>
          </div>
        </div>
        <slot name="panel" :group="groupForId(itemId)!" />
      </div>
    </template>
  </ResultsAccordion>
</template>
