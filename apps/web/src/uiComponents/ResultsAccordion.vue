<script setup lang="ts">
import * as accordion from "@zag-js/accordion";
import { ChevronDown } from "@lucide/vue";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { computed, nextTick, onBeforeUnmount, useId, watch, type ComponentPublicInstance } from "vue";

const props = defineProps<{
  itemIds: string[];
  modelValue?: string;
  labelledBy?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
  "prefetch-item": [itemId: string];
}>();

defineSlots<{
  trigger: (props: { itemId: string }) => unknown;
  panel?: (props: { itemId: string }) => unknown;
}>();

const generatedId = useId();
const itemElements = new Map<string, HTMLElement>();
let scrollAfterExpansionTimeout: number | undefined;
const expandedValues = computed(() => (props.modelValue === undefined ? [] : [props.modelValue]));
const service = useMachine(
  accordion.machine,
  computed(() => ({
    id: `results-accordion-${generatedId}`,
    collapsible: true,
    multiple: false,
    value: expandedValues.value,
    onValueChange: handleValueChange
  }))
);

const api = computed(() => accordion.connect<PropTypes>(service, normalizeProps));

watch(
  () => props.modelValue,
  (itemId) => {
    if (itemId !== undefined) {
      void scrollExpandedItemIntoView(itemId);
    }
  }
);

onBeforeUnmount(() => {
  if (scrollAfterExpansionTimeout !== undefined) {
    window.clearTimeout(scrollAfterExpansionTimeout);
  }
});

/** Keeps accordion state controlled by the parent page so only one result panel is mounted. */
function handleValueChange(details: accordion.ValueChangeDetails): void {
  emit("update:modelValue", details.value[0]);
}

/** Tracks item containers so the expanded result can be scrolled without querying the DOM. */
function setItemElement(itemId: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    itemElements.set(itemId, element);
    return;
  }

  itemElements.delete(itemId);
}

/** Scrolls immediately and after the accordion transition exposes the full panel. */
async function scrollExpandedItemIntoView(itemId: string): Promise<void> {
  if (scrollAfterExpansionTimeout !== undefined) {
    window.clearTimeout(scrollAfterExpansionTimeout);
  }

  await nextTick();
  scrollItemIntoView(itemId);

  scrollAfterExpansionTimeout = window.setTimeout(() => {
    scrollItemIntoView(itemId);
    scrollAfterExpansionTimeout = undefined;
  }, 210);
}

/** Uses native nearest scrolling so already visible rows are not displaced unnecessarily. */
function scrollItemIntoView(itemId: string): void {
  itemElements.get(itemId)?.scrollIntoView({
    block: "nearest",
    behavior: "smooth"
  });
}
</script>

<template>
  <div v-bind="api.getRootProps()" class="grid gap-3" :aria-labelledby="labelledBy">
    <div
      v-for="itemId in itemIds"
      :key="itemId"
      :ref="(element: Element | ComponentPublicInstance | null) => setItemElement(itemId, element)"
      v-bind="api.getItemProps({ value: itemId })"
      class="overflow-hidden rounded-md border border-border bg-surface/80 shadow-paper"
    >
      <h2>
        <button
          v-bind="api.getItemTriggerProps({ value: itemId })"
          class="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          @pointerdown="emit('prefetch-item', itemId)"
          @focus="emit('prefetch-item', itemId)"
        >
          <slot name="trigger" :item-id="itemId" />
          <span
            v-bind="api.getItemIndicatorProps({ value: itemId })"
            class="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition data-[state=open]:rotate-180 data-[state=open]:text-accent"
            aria-hidden="true"
          >
            <ChevronDown :size="16" stroke-width="2.5" />
          </span>
        </button>
      </h2>

      <Transition name="accordion-panel">
        <div
          v-if="api.getItemState({ value: itemId }).expanded"
          v-bind="api.getItemContentProps({ value: itemId })"
          class="accordion-panel-grid border-t border-border bg-background/50"
        >
          <div class="overflow-hidden">
            <div class="p-4">
              <slot name="panel" :item-id="itemId" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.accordion-panel-grid {
  display: grid;
  grid-template-rows: 1fr;
}

.accordion-panel-enter-active,
.accordion-panel-leave-active {
  transition: grid-template-rows 180ms ease, opacity 180ms ease;
}

.accordion-panel-enter-from,
.accordion-panel-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.accordion-panel-enter-to,
.accordion-panel-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
}
</style>
