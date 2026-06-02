<script setup lang="ts">
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from "@lucide/vue";
import { computed } from "vue";

import GraphCanvasGuidePopover from "./GraphCanvasGuidePopover.vue";
import IconButton from "../../uiComponents/IconButton.vue";

const props = defineProps<{
  zoomPercentage: number;
  expanded: boolean;
  usesDesktopLayout: boolean;
}>();

const emit = defineEmits<{
  "zoom-in": [];
  "zoom-out": [];
  reset: [];
  "toggle-expanded": [];
}>();

const isGraphGuideOpen = defineModel<boolean>("guideOpen", { required: true });
const graphControlsClass =
  "absolute right-3.5 top-3.5 z-10 flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/90 p-1.5 shadow-paper";
const graphControlsLabel = computed(() => (props.usesDesktopLayout ? "Graph controls" : "Touch graph controls"));
const resetButtonLabel = computed(() => (props.usesDesktopLayout ? "Reset graph layout" : "Reset term positions"));
const expandButtonLabel = computed(() => {
  if (props.expanded) {
    return props.usesDesktopLayout ? "Collapse graph" : "Close full-screen graph";
  }

  return props.usesDesktopLayout ? "Expand graph" : "Open full-screen graph";
});

/** Keeps toolbar clicks expressed as graph-level actions instead of viewport internals. */
function emitControlAction(action: "zoom-in" | "zoom-out" | "reset" | "toggle-expanded"): void {
  switch (action) {
    case "zoom-in":
      emit("zoom-in");
      return;
    case "zoom-out":
      emit("zoom-out");
      return;
    case "reset":
      emit("reset");
      return;
    case "toggle-expanded":
      emit("toggle-expanded");
      return;
  }
}
</script>

<template>
  <div :class="graphControlsClass" role="group" :aria-label="graphControlsLabel">
    <template v-if="usesDesktopLayout">
      <IconButton label="Zoom out" size="sm" @click="emitControlAction('zoom-out')">
        <Minus :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
      <output
        class="grid min-h-[34px] min-w-[54px] place-items-center font-label text-[13px] font-bold text-text-muted"
        aria-label="Current zoom"
        aria-live="polite"
      >
        {{ zoomPercentage }}%
      </output>
      <IconButton label="Zoom in" size="sm" @click="emitControlAction('zoom-in')">
        <Plus :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
    </template>
    <IconButton :label="resetButtonLabel" size="sm" @click="emitControlAction('reset')">
      <RotateCcw :size="16" stroke-width="2.75" aria-hidden="true" />
    </IconButton>
    <IconButton :label="expandButtonLabel" size="sm" :active="expanded" @click="emitControlAction('toggle-expanded')">
      <Minimize2 v-if="expanded" :size="16" stroke-width="2.75" aria-hidden="true" />
      <Maximize2 v-else :size="16" stroke-width="2.75" aria-hidden="true" />
    </IconButton>
    <GraphCanvasGuidePopover v-model:open="isGraphGuideOpen" :uses-desktop-layout="usesDesktopLayout" />
  </div>
</template>
