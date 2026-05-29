import { defineStore } from "pinia";
import { ref } from "vue";

export const fallbackSearchLanguage = "en";

export const useSearchLanguageStore = defineStore("searchLanguage", createSearchLanguageStore);

/** Creates shared search language state outside any one search form instance. */
function createSearchLanguageStore() {
  const selectedSearchLanguage = ref<string | undefined>(readNavigatorLanguage() ?? fallbackSearchLanguage);

  /** Centralizes language changes so search forms and starter suggestions share one selection. */
  function setSelectedSearchLanguage(langCode: string | undefined): void {
    selectedSearchLanguage.value = langCode;
  }

  return {
    selectedSearchLanguage,
    setSelectedSearchLanguage
  };
}

/** Converts browser locale values such as en-US into Wiktionary language codes. */
function readNavigatorLanguage(): string | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.language.split("-")[0]?.toLocaleLowerCase() ?? null;
}
