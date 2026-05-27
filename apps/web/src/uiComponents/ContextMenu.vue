<script setup lang="ts">
import * as menu from "@zag-js/menu";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import type { HTMLAttributes } from "vue";
import { computed, ref, useId } from "vue";

import MenuItem from "./MenuItem.vue";

type ContextMenuItem = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type ContextTriggerPropsGetter = (props?: menu.TriggerProps) => HTMLAttributes;

const props = withDefaults(
  defineProps<{
    items: ContextMenuItem[];
    label: string;
    open?: boolean;
    defaultOpen?: boolean;
    positioning?: menu.Props["positioning"];
  }>(),
  {
    open: undefined,
    defaultOpen: false,
    positioning: () => ({
      placement: "bottom-start",
      strategy: "fixed",
      gutter: 4
    })
  }
);

const emit = defineEmits<{
  select: [item: ContextMenuItem];
  "trigger-value-change": [value: string | null];
  "update:open": [open: boolean];
}>();

defineSlots<{
  trigger(props: {
    getContextTriggerProps: ContextTriggerPropsGetter;
    triggerProps: HTMLAttributes;
    isOpen: boolean;
  }): unknown;
}>();

const generatedId = useId();
const internalOpen = ref(props.defaultOpen);
const isOpen = computed(() => props.open ?? internalOpen.value);
const service = useMachine(
  menu.machine,
  computed(() => ({
    id: `context-menu-${generatedId}`,
    "aria-label": props.label,
    open: isOpen.value,
    positioning: props.positioning,
    loopFocus: true,
    onOpenChange: handleOpenChange,
    onTriggerValueChange: handleTriggerValueChange,
    onSelect: handleSelect
  }))
);

const api = computed(() => menu.connect<PropTypes>(service, normalizeProps));

/** Closes the menu when callers need to dismiss it after outside state changes. */
function close(): void {
  api.value.setOpen(false);
}

/** Mirrors Zag's open state locally so external context-menu events can control it. */
function handleOpenChange(details: menu.OpenChangeDetails): void {
  if (props.open === undefined) {
    internalOpen.value = details.open;
  }

  emit("update:open", details.open);
}

/** Mirrors Zag's trigger value so callers know which contextual target opened the menu. */
function handleTriggerValueChange(details: menu.TriggerValueChangeDetails): void {
  emit("trigger-value-change", details.value);
}

/** Emits the selected menu item unless it has become disabled. */
function handleSelect(details: menu.SelectionDetails): void {
  const selectedItem = props.items.find((item) => item.value === details.value);

  if (!selectedItem || selectedItem.disabled) {
    return;
  }

  emit("select", selectedItem);
}

defineExpose({
  close
});
</script>

<template>
  <slot
    name="trigger"
    :get-context-trigger-props="api.getContextTriggerProps"
    :trigger-props="api.getContextTriggerProps()"
    :is-open="api.open"
  />

  <Teleport to="body">
    <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" style="z-index: 1000">
      <ul
        v-bind="api.getContentProps()"
        class="min-w-56 overflow-hidden rounded-md border border-border-strong bg-surface-raised p-1 shadow-overlay"
      >
        <MenuItem
          v-for="item in items"
          :key="item.value"
          :label="item.label"
          :description="item.description"
          :highlighted="api.getItemState({ value: item.value, disabled: item.disabled }).highlighted"
          v-bind="api.getItemProps({ value: item.value, disabled: item.disabled, valueText: item.label })"
        />
      </ul>
    </div>
  </Teleport>
</template>
