<script setup lang="ts">
import * as menu from "@zag-js/menu";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { computed, ref, useId } from "vue";

import MenuItem from "./MenuItem.vue";

type ContextMenuItem = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

const props = withDefaults(
  defineProps<{
    items: ContextMenuItem[];
    label: string;
    positioning?: menu.Props["positioning"];
  }>(),
  {
    positioning: () => ({
      placement: "bottom-start",
      strategy: "fixed",
      gutter: 4
    })
  }
);

const emit = defineEmits<{
  select: [item: ContextMenuItem];
}>();

const generatedId = useId();
const anchorPoint = ref<menu.Point | null>(null);
const isOpen = ref(false);
const positionerStyle = computed(() => {
  if (!anchorPoint.value) {
    return {};
  }

  return {
    position: "fixed",
    left: `${anchorPoint.value.x}px`,
    top: `${anchorPoint.value.y}px`
  };
});
const service = useMachine(
  menu.machine,
  computed(() => ({
    id: `context-menu-${generatedId}`,
    "aria-label": props.label,
    anchorPoint: anchorPoint.value,
    open: isOpen.value,
    positioning: props.positioning,
    loopFocus: true,
    onOpenChange: handleOpenChange,
    onSelect: handleSelect
  }))
);

const api = computed(() => menu.connect<PropTypes>(service, normalizeProps));

/** Opens the menu at the pointer location supplied by a contextmenu event. */
function openAt(point: menu.Point): void {
  anchorPoint.value = point;
  api.value.setOpen(true);
}

/** Closes the menu when callers need to dismiss it after outside state changes. */
function close(): void {
  api.value.setOpen(false);
}

/** Mirrors Zag's open state locally so external context-menu events can control it. */
function handleOpenChange(details: menu.OpenChangeDetails): void {
  isOpen.value = details.open;
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
  close,
  openAt
});
</script>

<template>
  <Teleport to="body">
    <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" :style="positionerStyle">
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
