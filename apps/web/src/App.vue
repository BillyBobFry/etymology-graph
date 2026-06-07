<script setup lang="ts">
import { useTitle } from "@vueuse/core";
import { computed } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppFooter from "./AppFooter.vue";
import AppHeader from "./AppHeader.vue";
import CommandPalette from "./features/commandPalette/CommandPalette.vue";
import { useCommandPalette } from "./features/commandPalette/useCommandPalette";
import { useLanguagesQuery } from "./features/languages/useLanguagesQuery";
import { siteTitle, type RouteDocumentTitle, type RouteDocumentTitleContext } from "./router";

const route = useRoute();
const languagesQuery = useLanguagesQuery();
const { isCommandPaletteOpen, openCommandPalette, setCommandPaletteOpen } = useCommandPalette();
const languageNamesByCode = computed(
  () => new Map(languagesQuery.data.value?.languages.map((language) => [language.code, language.canonicalName]) ?? [])
);
const documentTitle = computed(() => formatDocumentTitle(resolveRouteDocumentTitle(route.meta.title)));

useTitle(documentTitle);

/** Resolves static and route-param-derived page titles from route metadata. */
function resolveRouteDocumentTitle(title: RouteDocumentTitle | undefined): string {
  if (typeof title === "function") {
    return title(route, routeDocumentTitleContext());
  }

  return title ?? siteTitle;
}

/** Provides route title resolvers with loaded language names and code fallbacks. */
function routeDocumentTitleContext(): RouteDocumentTitleContext {
  return {
    languageNameForCode: (langCode) => languageNamesByCode.value.get(langCode) ?? langCode
  };
}

/** Keeps the brand suffix consistent while leaving the home route clean. */
function formatDocumentTitle(pageTitle: string): string {
  return pageTitle === siteTitle ? siteTitle : `${pageTitle} | ${siteTitle}`;
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader :is-command-palette-open="isCommandPaletteOpen" :on-open-command-palette="openCommandPalette" />
    <RouterView />
    <AppFooter />
    <CommandPalette :open="isCommandPaletteOpen" @update:open="setCommandPaletteOpen" />
  </div>
</template>
