<script setup lang="ts">
import * as collapsible from "@zag-js/collapsible";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { onClickOutside, useEventListener, useResizeObserver } from "@vueuse/core";
import { computed, nextTick, ref, useId, watch } from "vue";

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
const isTrayFloating = ref(false);
const normalFlowMarkerRef = ref<HTMLElement | null>(null);
const trayRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const generatedId = useId();
const relatedCount = computed(() => props.similarTerms.length + props.cognates.length);
const hasCognates = computed(() => props.cognates.length > 0);
const hasOnlySimilarTerms = computed(() => props.similarTerms.length > 0 && !hasCognates.value);
const triggerLabel = computed(() =>
  relatedCount.value > 0 ? `${relatedCount.value} related terms` : "Related terms"
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
useEventListener(window, "resize", updateTrayFloatingState);
useEventListener(window, "scroll", updateTrayFloatingState, { passive: true });
useResizeObserver(triggerRef, updateTrayFloatingState);

/** Hides the floating panel once the inline suggestions are visible again. */
watch(
  () => props.show,
  (show) => {
    if (!show) {
      isOpen.value = false;
      isTrayFloating.value = false;
      return;
    }

    void nextTick(updateTrayFloatingState);
  },
  { immediate: true }
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

/** Detects when sticky positioning has lifted the tray away from its normal slot. */
function updateTrayFloatingState(): void {
  const marker = normalFlowMarkerRef.value;
  const tray = trayRef.value;

  if (!props.show || !marker || !tray || hasOnlySimilarTerms.value) {
    isTrayFloating.value = false;
    return;
  }

  const triggerHeight = triggerRef.value?.getBoundingClientRect().height ?? tray.getBoundingClientRect().height;
  const markerTop = marker.getBoundingClientRect().top + window.scrollY;
  const normalTriggerBottom = markerTop + triggerHeight;
  const stickyBottomInset = Number.parseFloat(window.getComputedStyle(tray).bottom) || 0;
  const stickyBottomLimit = window.scrollY + window.innerHeight - stickyBottomInset;

  isTrayFloating.value = normalTriggerBottom > stickyBottomLimit + 1;
}
</script>

<template>
  <div ref="normalFlowMarkerRef" class="h-0" aria-hidden="true" />
  <div
    ref="trayRef"
    v-bind="api.getRootProps()"
    class="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-900 mx-3 flex overflow-hidden rounded-md border border-border-strong bg-surface-raised/95 shadow-overlay backdrop-blur-sm ease md:mx-0 md:ml-auto md:w-[min(430px,calc(100vw-2rem))]"
    :class="[
      isTrayFloating ? 'flex-col-reverse' : 'flex-col',
      show ? 'opacity-100' : 'pointer-events-none opacity-0'
    ]"
    :aria-hidden="!show"
    :inert="!show"
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
      ref="triggerRef"
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
        class="text-accent transition-[color,transform] duration-180 ease data-[state=open]:rotate-180 data-[state=open]:text-text-muted"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6L8 11L13 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <Transition name="explore-tray-panel">
      <div
        v-if="api.visible && !hasOnlySimilarTerms"
        id="floating-etymology-explore-panel"
        v-bind="api.getContentProps()"
        class="explore-tray-panel-grid bg-surface/80"
        :class="isTrayFloating ? 'border-b border-border' : 'border-t border-border'"
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
