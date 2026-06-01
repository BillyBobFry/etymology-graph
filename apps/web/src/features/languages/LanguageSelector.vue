<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { Language } from "@etymology-graph/graph";

import Combobox from "../../uiComponents/Combobox.vue";
import { useLanguagesQuery } from "./useLanguagesQuery";

type LanguageOption = {
  value: string;
  label: string;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    id: string;
    label: string;
    name?: string;
    placeholder?: string;
    helpText?: string | null;
    disabled?: boolean;
    required?: boolean;
    autocomplete?: string;
  }>(),
  {
    modelValue: undefined,
    name: undefined,
    placeholder: "Choose a language",
    helpText: undefined,
    disabled: false,
    required: false,
    autocomplete: "off"
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
}>();

const languagesQuery = useLanguagesQuery();
const languageInput = ref("");
const languages = computed(() => languagesQuery.data.value?.languages ?? []);
const languageOptions = computed(() => sortLanguageOptions(languages.value.map(languageOptionFor)));
const selectedLanguageCode = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value)
});
const isUnavailable = computed(() => props.disabled || languagesQuery.isPending.value || languagesQuery.isError.value);
const resolvedHelpText = computed(() => {
  if (languagesQuery.isPending.value) {
    return "Loading imported languages...";
  }

  if (languagesQuery.isError.value) {
    return "Languages could not be loaded.";
  }

  return props.helpText;
});
const emptyText = computed(() => languagesQuery.isPending.value ? "Loading languages..." : "No languages found");

watch([() => props.modelValue, languages], syncInputToSelection, { immediate: true });

/** Converts imported language metadata into the shared combobox option contract. */
function languageOptionFor(language: Language): LanguageOption {
  return {
    value: language.code,
    label: language.canonicalName
  };
}

/** Orders filtered language choices by the strongest text match, then by display name. */
function sortLanguageOptions(options: LanguageOption[]): LanguageOption[] {
  const query = languageInput.value.trim().toLocaleLowerCase();

  return [...options].sort((firstOption, secondOption) => {
    const firstRank = languageMatchRank(firstOption, query);
    const secondRank = languageMatchRank(secondOption, query);

    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    return firstOption.label.localeCompare(secondOption.label, undefined, { sensitivity: "base" });
  });
}

/** Groups language matches into prefix, suffix, and remaining matches for easier scanning. */
function languageMatchRank(option: LanguageOption, query: string): number {
  if (!query) {
    return 0;
  }

  const searchableParts = [
    option.label.toLocaleLowerCase(),
    option.value.toLocaleLowerCase()
  ];

  if (searchableParts.some((part) => part.startsWith(query))) {
    return 0;
  }

  if (searchableParts.some((part) => part.endsWith(query))) {
    return 1;
  }

  return 2;
}

/** Keeps the controlled input aligned after selection and after async language loading. */
function syncInputToSelection(): void {
  languageInput.value = languages.value.find((language) => language.code === props.modelValue)?.canonicalName ?? "";
}
</script>

<template>
  <Combobox
    :id="id"
    v-model="selectedLanguageCode"
    v-model:input-value="languageInput"
    :name="name"
    :label="label"
    :options="languageOptions"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :help-text="resolvedHelpText"
    :disabled="isUnavailable"
    :required="required"
    :empty-text="emptyText"
    virtualize-options
  >
    <template #option="{ option }">
      <span class="font-label font-bold">{{ option.label }}</span>
    </template>
  </Combobox>
</template>
