<script setup lang="ts">
import { CircleHelp, X } from "@lucide/vue";

import { edgeLegendItems, relationshipColorClass } from "./graphRelationshipDisplay";
import IconButton from "../../uiComponents/IconButton.vue";
import Popover from "../../uiComponents/Popover.vue";

const isOpen = defineModel<boolean>("open", { required: true });

const graphGuideCardClass = "relative w-[min(300px,calc(100vw_-_48px))]";
const graphGuideTitleClass =
  "mb-2 font-label text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted";
const graphGuideListClass = "grid gap-[7px]";
const graphGuideRowClass = "grid grid-cols-[84px_minmax(0,1fr)] gap-2.5";
const graphGuideTermClass = "font-label text-xs font-bold text-text";
const graphGuideDescriptionClass = "text-xs leading-[1.4] text-text-muted";
const relationshipKeyClass = "grid list-none gap-[5px] p-0";
const relationshipKeyMarkClass =
  "h-0 w-[26px] rounded-full border-t-[3px] border-[var(--relationship-color,var(--theme-graph-edge))]";
</script>

<template>
  <Popover v-model:open="isOpen" :close-on-interact-outside="false">
    <template #trigger="{ triggerProps, isOpen: isPopoverOpen }">
      <IconButton v-bind="triggerProps" label="Graph guide" size="sm" :active="isPopoverOpen">
        <CircleHelp :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
    </template>

    <template #default="{ titleProps, descriptionProps, api }">
      <div :class="graphGuideCardClass">
        <IconButton class="absolute -top-1.5 -right-1.5" label="Close" size="xs" v-bind="api.getCloseTriggerProps()">
          <X :size="16" stroke-width="2.75" aria-hidden="true" />
        </IconButton>
        <p v-bind="titleProps" :class="graphGuideTitleClass">Graph guide</p>
        <dl v-bind="descriptionProps" :class="graphGuideListClass">
          <div :class="graphGuideRowClass">
            <dt :class="graphGuideTermClass">Click</dt>
            <dd :class="graphGuideDescriptionClass">View term details.</dd>
          </div>
          <div :class="graphGuideRowClass">
            <dt :class="graphGuideTermClass">Drag node</dt>
            <dd :class="graphGuideDescriptionClass">Reposition it until the graph reloads.</dd>
          </div>
          <div :class="graphGuideRowClass">
            <dt :class="graphGuideTermClass">Right-click</dt>
            <dd :class="graphGuideDescriptionClass">Open node actions.</dd>
          </div>
          <div :class="graphGuideRowClass">
            <dt :class="graphGuideTermClass">Edges</dt>
            <dd :class="graphGuideDescriptionClass">Point from a term toward its source.</dd>
          </div>
          <div :class="graphGuideRowClass">
            <dt :class="graphGuideTermClass">Dashed edge</dt>
            <dd :class="graphGuideDescriptionClass">Marks an uncertain relationship.</dd>
          </div>
          <div :class="graphGuideRowClass">
            <dt :class="graphGuideTermClass">Relationships</dt>
            <dd :class="graphGuideDescriptionClass">
              <ul :class="relationshipKeyClass" aria-label="Relationship type legend">
                <li v-for="item in edgeLegendItems" :key="item.type" class="flex items-center gap-[7px]">
                  <span :class="[relationshipKeyMarkClass, relationshipColorClass(item.type)]" aria-hidden="true"></span>
                  <span>{{ item.label }}</span>
                </li>
              </ul>
            </dd>
          </div>
          <div :class="graphGuideRowClass">
            <dt :class="graphGuideTermClass">Pan and zoom</dt>
            <dd :class="graphGuideDescriptionClass">Drag, wheel, pinch, or use keyboard shortcuts.</dd>
          </div>
        </dl>
      </div>
    </template>
  </Popover>
</template>
