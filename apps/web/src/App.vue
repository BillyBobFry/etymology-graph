<script setup lang="ts">
import { Moon } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

import IconButton from "./uiComponents/IconButton.vue";

type ThemePreference = "light" | "dark";

const route = useRoute();
const themePreference = ref<ThemePreference>("light");

const isEtymologyRoute = computed(
  () => route.name === "etymology-search" || route.name === "etymology"
);

const isDoubletsRoute = computed(
  () => route.name === "doublets-search" || route.name === "doublet-groups" || route.name === "doublets"
);

const isAncestorLanguageRoute = computed(
  () => route.name === "ancestor-language-search" || route.name === "ancestor-language-results"
);

const sectionLinkBaseClass =
  "border-b-2 px-0.5 pb-1 font-label text-xs font-black uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background";

/** Gives primary section links a consistent selected state across search and detail routes. */
const sectionLinkClass = (active: boolean): string => {
  if (active) {
    return `${sectionLinkBaseClass} border-accent text-accent`;
  }

  return `${sectionLinkBaseClass} border-transparent text-text-muted hover:border-border-strong hover:text-text`;
};

onMounted(() => {
  applyThemePreference(readStoredThemePreference() ?? preferredSystemTheme(), false);
});

/** Applies the user-selected theme so semantic color tokens update across the app. */
function applyThemePreference(preference: ThemePreference, persist = true): void {
  themePreference.value = preference;
  document.documentElement.classList.toggle("dark", preference === "dark");
  document.documentElement.classList.toggle("light", preference === "light");

  if (persist) {
    window.localStorage.setItem("theme", preference);
  }
}

/** Switches between explicit light and dark modes instead of relying on ad hoc CSS overrides. */
function toggleTheme(): void {
  applyThemePreference(themePreference.value === "dark" ? "light" : "dark");
}

/** Restores a valid persisted theme while ignoring stale or hand-edited storage values. */
function readStoredThemePreference(): ThemePreference | null {
  const storedTheme = window.localStorage.getItem("theme");

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return null;
}

/** Uses the OS preference as the initial theme when the app has no saved choice. */
function preferredSystemTheme(): ThemePreference {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
</script>

<template>
  <div class="min-h-screen">
    <header class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 pt-6">
      <div class="flex flex-wrap items-baseline gap-x-7 gap-y-3">
        <RouterLink
          class="font-label text-base font-black uppercase tracking-[0.16em] text-text transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          :to="{ name: 'home' }"
        >
          Etymology Graph
        </RouterLink>
        <nav class="flex items-center gap-5" aria-label="Primary sections">
          <RouterLink
            :class="sectionLinkClass(isEtymologyRoute)"
            :to="{ name: 'etymology-search' }"
            :aria-current="isEtymologyRoute ? 'location' : undefined"
          >
            Etymology
          </RouterLink>
          <RouterLink
            :class="sectionLinkClass(isDoubletsRoute)"
            :to="{ name: 'doublets-search' }"
            :aria-current="isDoubletsRoute ? 'location' : undefined"
          >
            Doublets
          </RouterLink>
          <RouterLink
            :class="sectionLinkClass(isAncestorLanguageRoute)"
            :to="{ name: 'ancestor-language-search' }"
            :aria-current="isAncestorLanguageRoute ? 'location' : undefined"
          >
            Source Languages
          </RouterLink>
        </nav>
      </div>
      <IconButton
        label="Dark mode"
        class="shrink-0"
        variant="secondary"
        size="sm"
        :active="themePreference === 'dark'"
        :aria-pressed="themePreference === 'dark'"
        @click="toggleTheme"
      >
        <Moon :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
    </header>
    <RouterView />
  </div>
</template>
