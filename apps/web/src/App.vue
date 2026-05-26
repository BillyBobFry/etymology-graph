<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";

import Button from "./uiComponents/Button.vue";

type ThemePreference = "light" | "dark";

const themePreference = ref<ThemePreference>("light");

const themeToggleLabel = computed(() =>
  themePreference.value === "dark" ? "Use light mode" : "Use dark mode"
);

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
    <header class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 pt-6">
      <nav class="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Primary navigation">
        <RouterLink
          class="font-label text-sm font-black uppercase tracking-[0.12em] text-text-muted transition hover:text-accent"
          :to="{ name: 'home' }"
        >
          Etymology Graph
        </RouterLink>
        <RouterLink
          class="font-label text-xs font-black uppercase tracking-[0.12em] text-text-muted transition hover:text-accent"
          :to="{ name: 'doublets-search' }"
        >
          Doublets
        </RouterLink>
      </nav>
      <Button
        class="shrink-0 rounded-full"
        variant="secondary"
        size="sm"
        :aria-label="themeToggleLabel"
        @click="toggleTheme"
      >
        {{ themePreference === "dark" ? "Light mode" : "Dark mode" }}
      </Button>
    </header>
    <RouterView />
  </div>
</template>
