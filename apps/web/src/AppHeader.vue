<script setup lang="ts">
import { Menu, Moon, Search } from "@lucide/vue";
import * as navigationMenu from "@zag-js/navigation-menu";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";

import LingraphicLogo from "./features/brand/LingraphicLogo.vue";
import IconButton from "./uiComponents/IconButton.vue";

type ThemePreference = "light" | "dark";
type SectionNavItem = {
  value: string;
  label: string;
  to: {
    name: string;
  };
  active: boolean;
};

const props = defineProps<{
  isCommandPaletteOpen: boolean;
  onOpenCommandPalette: () => void;
}>();

const route = useRoute();
const themePreference = ref<ThemePreference>("light");

const mobileSectionsItem = {
  value: "sections"
};

const isEtymologyRoute = computed(
  () => route.name === "etymology-search" || route.name === "etymology"
);

const isDoubletsRoute = computed(
  () => route.name === "doublets-search" || route.name === "doublet-groups" || route.name === "doublets"
);

const isAncestorLanguageRoute = computed(
  () => route.name === "ancestor-language-search" || route.name === "ancestor-language-results"
);

const isSoundChangesRoute = computed(
  () => route.name === "sound-changes" || route.name === "sound-change-article"
);

const sectionLinkBaseClass =
  "border-b-2 px-0.5 pb-1 font-label text-xs font-black uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background";

const mobileNavigationMenuMachine = navigationMenu.machine as unknown as Parameters<typeof useMachine>[0];
const mobileNavigationMenuService = useMachine(
  mobileNavigationMenuMachine,
  computed(() => ({
    id: "mobile-primary-sections",
    translations: {
      rootLabel: "Primary sections"
    },
    openDelay: 0,
    closeDelay: 120,
    disableHoverTrigger: true
  }))
) as unknown as navigationMenu.Service;

const mobileNavigationMenu = computed(() =>
  navigationMenu.connect<PropTypes>(mobileNavigationMenuService, normalizeProps)
);

const sectionNavItems = computed<SectionNavItem[]>(() => [
  {
    value: "etymology",
    label: "Etymology",
    to: { name: "etymology-search" },
    active: isEtymologyRoute.value
  },
  {
    value: "doublets",
    label: "Doublets",
    to: { name: "doublets-search" },
    active: isDoubletsRoute.value
  },
  {
    value: "word-lineages",
    label: "Source languages",
    to: { name: "ancestor-language-search" },
    active: isAncestorLanguageRoute.value
  },
  {
    value: "sound-changes",
    label: "Sound changes",
    to: { name: "sound-changes" },
    active: isSoundChangesRoute.value
  }
]);

/** Gives primary section links a consistent selected state across search and detail routes. */
const sectionLinkClass = (active: boolean): string => {
  if (active) {
    return `${sectionLinkBaseClass} border-accent text-accent`;
  }

  return `${sectionLinkBaseClass} border-transparent text-text-page-muted hover:border-border-strong hover:text-text`;
};

/** Styles the compact mobile menu links without losing the active section cue. */
const mobileSectionLinkClass = (active: boolean): string => {
  const baseClass =
    "block rounded-sm px-3 py-2 font-label text-xs font-black uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised";

  if (active) {
    return `${baseClass} bg-accent-soft text-accent`;
  }

  return `${baseClass} text-text-muted hover:bg-surface-muted hover:text-text`;
};

/** Lets Zag dispatch link selection while Vue Router owns the actual navigation. */
const handleMobileNavigationSelect = (): void => {};

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

onMounted(() => {
  applyThemePreference(readStoredThemePreference() ?? preferredSystemTheme(), false);
});
</script>

<template>
  <header class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pt-6">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <nav v-bind="mobileNavigationMenu.getRootProps()" class="relative md:hidden">
          <ul v-bind="mobileNavigationMenu.getListProps()" class="flex items-center">
            <li v-bind="mobileNavigationMenu.getItemProps(mobileSectionsItem)">
              <IconButton
                v-bind="mobileNavigationMenu.getTriggerProps(mobileSectionsItem)"
                label="Sections"
                variant="ghost"
                size="sm"
                :active="mobileNavigationMenu.open"
              >
                <Menu :size="16" stroke-width="2.75" aria-hidden="true" />
              </IconButton>
              <div
                v-bind="mobileNavigationMenu.getContentProps(mobileSectionsItem)"
                class="absolute left-0 top-full z-50 mt-2 w-56 rounded-md border border-border-strong bg-surface-raised p-1 shadow-overlay outline-none"
              >
                <RouterLink
                  v-for="item in sectionNavItems"
                  :key="item.value"
                  v-bind="
                    mobileNavigationMenu.getLinkProps({
                      value: item.value,
                      current: item.active,
                      onSelect: handleMobileNavigationSelect
                    })
                  "
                  :class="mobileSectionLinkClass(item.active)"
                  :to="item.to"
                >
                  {{ item.label }}
                </RouterLink>
              </div>
            </li>
          </ul>
        </nav>
        <RouterLink
          aria-label="Lingraphic home"
          class="inline-flex min-w-0 text-text transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          :to="{ name: 'home' }"
        >
          <LingraphicLogo />
        </RouterLink>
      </div>
      <IconButton
        label="Search pages and words"
        class="shrink-0"
        variant="secondary"
        size="sm"
        :active="props.isCommandPaletteOpen"
        @click="props.onOpenCommandPalette"
      >
        <Search :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
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
    </div>
    <nav class="hidden items-center gap-5 md:flex" aria-label="Primary sections">
      <RouterLink
        v-for="item in sectionNavItems"
        :key="item.value"
        :class="sectionLinkClass(item.active)"
        :to="item.to"
        :aria-current="item.active ? 'location' : undefined"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </header>
</template>
