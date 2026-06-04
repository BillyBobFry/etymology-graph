<script setup lang="ts">
import * as combobox from "@zag-js/combobox";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { computed, nextTick, ref, useId, watch } from "vue";
import MenuItem from "./MenuItem.vue";
import Skeleton from "./Skeleton.vue";
import TextField from "./TextField.vue";


type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type VirtualizedOption = {
  option: ComboboxOption;
  index: number;
};

const defaultListMaxHeight = 288;
const virtualOverscan = 4;
const loadingSkeletonRows = [0, 1, 2] as const;

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    inputValue?: string;
    options: ComboboxOption[];
    label: string;
    id?: string;
    name?: string;
    placeholder?: string;
    autocomplete?: string;
    helpText?: string | null;
    error?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    emptyText?: string;
    loading?: boolean;
    loadingText?: string;
    filterOptions?: boolean;
    openOnClick?: boolean;
    allowCustomValue?: boolean;
    closeOnEmpty?: boolean;
    virtualizeOptions?: boolean;
    optionHeight?: number;
    listMaxHeight?: number;
    positioning?: combobox.Props['positioning'];
  }>(),
  {
    modelValue: undefined,
    inputValue: undefined,
    id: undefined,
    name: undefined,
    placeholder: undefined,
    autocomplete: "off",
    helpText: undefined,
    error: undefined,
    disabled: false,
    readonly: false,
    required: false,
    emptyText: "No matching terms",
    loading: false,
    loadingText: "Loading options",
    filterOptions: true,
    openOnClick: true,
    allowCustomValue: false,
    closeOnEmpty: false,
    virtualizeOptions: false,
    optionHeight: 44,
    listMaxHeight: defaultListMaxHeight,
    positioning: () => ({
      placement: "bottom-start",
      strategy: "fixed",
      sameWidth: true,
      gutter: 4
    })
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
  "update:inputValue": [value: string];
  select: [option: ComboboxOption | null];
}>();

defineSlots<{
  option?: (props: { option: ComboboxOption; selected: boolean; highlighted: boolean }) => unknown;
  empty?: () => unknown;
}>();

const generatedId = useId();
const inputId = computed(() => props.id ?? `combobox-${generatedId}`);
const internalInputValue = ref(resolveInitialInputValue());
const listboxRef = ref<HTMLUListElement | null>(null);
const listScrollTop = ref(0);
const inputValue = computed(() => props.inputValue ?? internalInputValue.value);
const resolvedHelpText = computed(() => props.helpText ?? undefined);
const filteredOptions = computed(buildFilteredOptions);
const optionCollection = computed(() => (combobox.collection<ComboboxOption>({
    items: filteredOptions.value,
    itemToValue: (option) => option.value,
    itemToString: (option) => option.label,
    isItemDisabled: (option) => Boolean(option.disabled)
  })));
const service = useMachine(combobox.machine, computed(() => ({
    id: inputId.value,
    ids: {
      input: inputId.value
    },
    name: props.name,
    placeholder: props.placeholder,
    disabled: props.disabled,
    readOnly: props.readonly,
    required: props.required,
    invalid: Boolean(props.error),
    collection: optionCollection.value,
    value: props.modelValue === undefined ? [] : [props.modelValue],
    inputValue: inputValue.value,
    openOnClick: props.openOnClick,
    allowCustomValue: props.allowCustomValue,
    inputBehavior: "autohighlight" as const,
    selectionBehavior: "replace" as const,
    positioning: props.positioning,
    onInputValueChange: handleInputValueChange,
    onValueChange: handleValueChange
  })));

const api = computed(() => combobox.connect<PropTypes, ComboboxOption>(service, normalizeProps));
const inputAttrs = computed(() => ({
    ...api.value.getInputProps(),
    autocomplete: props.autocomplete
  }));
const visibleOptions = computed(() => api.value.collection.items);
const highlightedOptionIndex = computed(() => visibleOptions.value.findIndex((option) => api.value.getItemState({ item: option }).highlighted));
const virtualStartIndex = computed(() => {
  if (!props.virtualizeOptions) {
    return 0;
  }

  return Math.max(0, Math.floor(listScrollTop.value / props.optionHeight) - virtualOverscan);
});
const virtualEndIndex = computed(() => {
  if (!props.virtualizeOptions) {
    return visibleOptions.value.length;
  }

  const visibleRowCount = Math.ceil(props.listMaxHeight / props.optionHeight);

  return Math.min(visibleOptions.value.length, virtualStartIndex.value + visibleRowCount + (virtualOverscan * 2));
});
const renderedOptionEntries = computed<VirtualizedOption[]>(() => visibleOptions.value
  .slice(virtualStartIndex.value, virtualEndIndex.value)
  .map((option, offset) => ({
    option,
    index: virtualStartIndex.value + offset
  })));
const virtualPaddingTop = computed(() => props.virtualizeOptions ? virtualStartIndex.value * props.optionHeight : 0);
const virtualPaddingBottom = computed(() => {
  if (!props.virtualizeOptions) {
    return 0;
  }

  return Math.max(0, (visibleOptions.value.length - virtualEndIndex.value) * props.optionHeight);
});
const listboxStyle = computed(() => ({
  maxHeight: `${props.listMaxHeight}px`
}));

watch(() => props.modelValue, syncInputToSelectedValue);
watch(() => props.options, syncInputToSelectedValue);
watch(inputValue, resetVirtualScroll);
watch(() => api.value.open, (isOpen) => {
  if (isOpen) {
    void nextTick(() => scrollHighlightedOptionIntoView(highlightedOptionIndex.value));
  }
});
watch(highlightedOptionIndex, (index) => {
  void nextTick(() => scrollHighlightedOptionIntoView(index));
}, { flush: "post" });

/** Uses the selected option label as the initial typed value when possible. */
function resolveInitialInputValue(): string {
  return findOptionByValue(props.modelValue)?.label ?? "";
}

/** Keeps the visible input aligned when the selected value changes from outside. */
function syncInputToSelectedValue(): void {
  if (props.inputValue !== undefined) {
    return;
  }

  internalInputValue.value = resolveInitialInputValue();
}

/** Finds the option object that represents a selected serialized value. */
function findOptionByValue(value: string | undefined): ComboboxOption | undefined {
  if (value === undefined) {
    return undefined;
  }

  return props.options.find((option) => option.value === value);
}

/** Narrows the list to useful matches while letting callers opt into server-filtered lists. */
function buildFilteredOptions(): ComboboxOption[] {
  if (!props.filterOptions) {
    return [...props.options];
  }

  const query = inputValue.value.trim().toLocaleLowerCase();

  if (!query) {
    return [...props.options];
  }

  return props.options.filter((option) => {
    const label = option.label.toLocaleLowerCase();
    const value = option.value.toLocaleLowerCase();
    const description = option.description?.toLocaleLowerCase() ?? "";

    return label.includes(query) || value.includes(query) || description.includes(query);
  });
}


/** Records the listbox scroll position so virtualized option windows stay in sync. */
function handleListScroll(event: Event): void {
  listScrollTop.value = event.currentTarget instanceof HTMLUListElement ? event.currentTarget.scrollTop : 0;
}

/** Starts a new filtered result set at the top of the option list. */
function resetVirtualScroll(): void {
  if (!props.virtualizeOptions) {
    return;
  }

  listScrollTop.value = 0;

  if (listboxRef.value) {
    listboxRef.value.scrollTop = 0;
  }
}

/** Keeps keyboard navigation from moving the active option outside the scroll viewport. */
function scrollHighlightedOptionIntoView(index: number): void {
  if (!props.virtualizeOptions || index < 0 || !listboxRef.value) {
    return;
  }

  const optionTop = index * props.optionHeight;
  const optionBottom = optionTop + props.optionHeight;
  const viewportTop = listboxRef.value.scrollTop;
  const viewportBottom = viewportTop + listboxRef.value.clientHeight;

  if (optionTop < viewportTop) {
    listboxRef.value.scrollTop = optionTop;
    listScrollTop.value = optionTop;
    return;
  }

  if (optionBottom > viewportBottom) {
    const nextScrollTop = optionBottom - listboxRef.value.clientHeight;
    listboxRef.value.scrollTop = nextScrollTop;
    listScrollTop.value = nextScrollTop;
  }
}

/** Updates local and parent typing state when Zag processes keyboard input. */
function handleInputValueChange(details: combobox.InputValueChangeDetails): void {
  if (props.inputValue === undefined) {
    internalInputValue.value = details.inputValue;
  }

  emit("update:inputValue", details.inputValue);
}

/** Emits the selected option through the component's selected-value model. */
function handleValueChange(details: combobox.ValueChangeDetails<ComboboxOption>): void {
  const selectedOption = details.items[0] ?? null;
  const selectedValue = selectedOption?.value ?? details.value[0];

  if (props.inputValue === undefined) {
    internalInputValue.value = selectedOption?.label ?? "";
  }

  emit("update:modelValue", selectedValue);
  emit("select", selectedOption);
}

watch(() => props.closeOnEmpty && !inputValue.value.trim(), (shouldClose) => {
  if (shouldClose && api.value.open) {
    api.value.setOpen(false);
  }
});

</script>

<template>
  <div v-bind="api.getRootProps()" class="relative">
    <div v-bind="api.getControlProps()">
      <TextField
        :id="inputId"
        :model-value="api.inputValue"
        :label="label"
        type="search"
        :name="name"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :help-text="resolvedHelpText"
        :error="error"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :input-attrs="inputAttrs"
      />
    </div>

    <Teleport to="body">
      <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" style="z-index: 1000">
        <div
          v-bind="api.getContentProps()"
          class="overflow-hidden rounded-2xl border border-border-strong bg-surface-raised shadow-overlay"
        >
          <ul
            v-bind="api.getListProps()"
            ref="listboxRef"
            class="overflow-y-auto p-1 overscroll-contain"
            :style="listboxStyle"
            :aria-busy="loading ? 'true' : undefined"
            @scroll.passive="handleListScroll"
          >
            <li
              v-if="loading"
              class="grid gap-2 px-3 py-3"
              role="status"
              aria-live="polite"
            >
              <span class="sr-only">{{ loadingText }}</span>
              <span
                v-for="row in loadingSkeletonRows"
                :key="row"
                class="flex h-[86px] items-center rounded-md px-3"
                aria-hidden="true"
              >
                <Skeleton tone="raised" class="h-10 w-2/3" />
              </span>
            </li>

            <li
              v-else-if="visibleOptions.length === 0"
              class="px-4 py-3 font-sans text-sm text-text-muted"
            >
              <slot name="empty">{{ emptyText }}</slot>
            </li>

            <li
              v-if="!loading && virtualizeOptions && virtualPaddingTop > 0"
              role="presentation"
              aria-hidden="true"
              :style="{ height: `${virtualPaddingTop}px` }"
            />

            <MenuItem
              v-for="entry in loading ? [] : renderedOptionEntries"
              :key="entry.option.value"
              :label="entry.option.label"
              :description="entry.option.description"
              :selected="api.getItemState({ item: entry.option }).selected"
              :highlighted="api.getItemState({ item: entry.option }).highlighted"
              :style="virtualizeOptions ? { height: `${optionHeight}px` } : undefined"
              v-bind="api.getItemProps({ item: entry.option })"
            >
              <template v-if="$slots.option" #default="{ selected, highlighted }">
                <slot
                  name="option"
                  :option="entry.option"
                  :selected="selected"
                  :highlighted="highlighted"
                />
              </template>
            </MenuItem>

            <li
              v-if="!loading && virtualizeOptions && virtualPaddingBottom > 0"
              role="presentation"
              aria-hidden="true"
              :style="{ height: `${virtualPaddingBottom}px` }"
            />
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>
