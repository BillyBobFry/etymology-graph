<script setup lang="ts">
import type { InputHTMLAttributes } from "vue";

type TextFieldBaseType = "email" | "password" | "search" | "tel" | "text" | "url";
type TextFieldBaseInputAttrs = InputHTMLAttributes & Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    id?: string;
    type?: TextFieldBaseType;
    name?: string;
    placeholder?: string;
    autocomplete?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    ariaInvalid?: boolean;
    ariaDescribedby?: string;
    inputAttrs?: TextFieldBaseInputAttrs;
  }>(),
  {
    id: undefined,
    type: "text",
    name: undefined,
    placeholder: undefined,
    autocomplete: undefined,
    disabled: false,
    readonly: false,
    required: false,
    ariaInvalid: false,
    ariaDescribedby: undefined,
    inputAttrs: () => ({})
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

/** Sends typed input changes through Vue's v-model contract. */
function updateModel(event: Event): void {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  emit("update:modelValue", target.value);
}
</script>

<template>
  <input
    v-bind="props.inputAttrs"
    :id="id"
    :value="modelValue"
    :type="type"
    :name="name"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :aria-invalid="ariaInvalid"
    :aria-describedby="ariaDescribedby"
    class="min-w-0 rounded-2xl border border-border-strong bg-surface-raised px-4 py-3 font-sans text-base font-normal text-text outline-none transition placeholder:text-text-muted/70 hover:border-accent focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted disabled:opacity-75 read-only:bg-surface-muted"
    @input="updateModel"
  />
</template>
