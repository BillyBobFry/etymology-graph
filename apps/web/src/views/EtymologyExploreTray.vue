<script setup lang="ts">
import * as collapsible from "@zag-js/collapsible";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { onClickOutside } from "@vueuse/core";
import { computed, ref, useId, watch } from "vue";

import type { GraphNode, SimilarTerm } from "@etymology-graph/graph";

import EtymologyExploreSuggestions from "./EtymologyExploreSuggestions.vue";
import Button from "../uiComponents/Button.vue";

const props = defineProps<{
  show: boolean;
  similarTerms: SimilarTerm[];
  cognates: GraphNode[];
  selectedCognateIds: string[];
  similarTermsLoading: boolean;
  similarTermsError: boolean;
  cognatesLoading: boolean;
  cognatesChecking: boolean;
  cognatesError: boolean;
  cognateExpansionError: string | null;
}>();

const emit = defineEmits<{
  "toggle-cognate": [cognate: GraphNode];
}>();

const isOpen = ref(false);
const trayRef = ref<HTMLElement | null>(null);
const generatedId = useId();
const relatedCount = computed(() => props.similarTerms.length + props.cognates.length);
const hasCognates = computed(() => props.cognates.length > 0);
const hasOnlySimilarTerms = computed(() => props.similarTerms.length > 0 && !hasCognates.value);
const triggerLabel = computed(() =>
  relatedCount.value > 0 ? `Explore ${relatedCount.value} related terms` : "Explore related terms"
);
const statusLabel = computed(() => {
  const parts: string[] = [];

  if (props.similarTerms.length > 0) {
    parts.push(`${props.similarTerms.length} similar`);
  }

  if (props.cognates.length > 0) {
    parts.push(`${props.cognates.length} cognates`);
  }

  return parts.join(" · ");
});
const service = useMachine(
  collapsible.machine,
  computed(() => ({
    id: `etymology-explore-tray-${generatedId}`,
    open: isOpen.value,
    ids: {
      content: "floating-etymology-explore-panel"
    },
    onOpenChange: handleOpenChange
  }))
);
const api = computed(() => collapsible.connect<PropTypes>(service, normalizeProps));

onClickOutside(trayRef, handleOutsideTrayClick);

/** Hides the floating panel once the inline suggestions are visible again. */
watch(
  () => props.show,
  (show) => {
    if (!show) {
      isOpen.value = false;
    }
  }
);

/** Keeps Zag's collapsible state in sync with local close-on-hide behavior. */
function handleOpenChange(details: collapsible.OpenChangeDetails): void {
  isOpen.value = details.open;
}

/** Collapses the expanded tray when mobile users tap back into the graph or page. */
function handleOutsideTrayClick(): void {
  if (!isOpen.value) {
    return;
  }

  api.value.setOpen(false);
}
</script>

<template>
  <div
    v-if="show"
    ref="trayRef"
    v-bind="api.getRootProps()"
    class="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-900 overflow-hidden rounded-md border border-border-strong bg-surface-raised/95 shadow-overlay backdrop-blur-sm md:inset-x-auto md:right-4 md:w-[min(430px,calc(100vw-2rem))]"
  >
    <div
      v-if="hasOnlySimilarTerms"
      class="grid gap-3 px-4 py-3"
    >
      <p class="font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
        Similar terms
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="similarTerm in similarTerms"
          :key="similarTerm.node.id"
          variant="secondary"
          size="sm"
          :to="{
            name: 'etymology',
            params: {
              langCode: similarTerm.node.langCode,
              term: similarTerm.node.word
            }
          }"
        >
          {{ similarTerm.node.word }}
        </Button>
      </div>
    </div>

    <button
      v-else
      v-bind="api.getTriggerProps()"
      type="button"
      class="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
    >
      <span class="grid gap-1">
        <span class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text">
          {{ triggerLabel }}
        </span>
        <span v-if="statusLabel" class="text-sm leading-5 text-text-muted">
          {{ statusLabel }}
        </span>
      </span>
      <span
        v-bind="api.getIndicatorProps()"
        class="font-label text-sm font-bold text-accent transition data-[state=open]:text-text-muted"
        aria-hidden="true"
      >
        {{ api.open ? "Hide" : "Open" }}
      </span>
    </button>

    <Transition name="explore-tray-panel">
      <div
        v-if="api.visible && !hasOnlySimilarTerms"
        id="floating-etymology-explore-panel"
        v-bind="api.getContentProps()"
        class="explore-tray-panel-grid border-t border-border bg-surface/80"
      >
        <div class="overflow-hidden">
          <div class="max-h-[min(68dvh,520px)] overflow-y-auto p-4">
            <EtymologyExploreSuggestions
              id-prefix="floating-etymology-explore"
              compact
              :similar-terms="similarTerms"
              :cognates="cognates"
              :selected-cognate-ids="selectedCognateIds"
              :similar-terms-loading="similarTermsLoading"
              :similar-terms-error="similarTermsError"
              :cognates-loading="cognatesLoading"
              :cognates-checking="cognatesChecking"
              :cognates-error="cognatesError"
              :cognate-expansion-error="cognateExpansionError"
              @toggle-cognate="emit('toggle-cognate', $event)"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.explore-tray-panel-grid {
  display: grid;
  grid-template-rows: 1fr;
}

.explore-tray-panel-enter-active,
.explore-tray-panel-leave-active {
  transition: grid-template-rows 180ms ease, opacity 180ms ease;
}

.explore-tray-panel-enter-from,
.explore-tray-panel-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.explore-tray-panel-enter-to,
.explore-tray-panel-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
}
</style>
