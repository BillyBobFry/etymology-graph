<script setup lang="ts">
import { RouterLink } from "vue-router";

import PageMain from "../uiComponents/PageMain.vue";
</script>

<template>
  <PageMain>
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Route not found
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        This path is not in the atlas.
      </h1>
      <p class="mb-6 max-w-3xl text-lg leading-8 text-text-page-muted">
        Return home to choose etymology, doublets, source languages, or sound changes.
      </p>
      <RouterLink
        class="inline-flex w-fit items-center justify-center rounded-md border border-accent bg-accent px-5 py-3 font-label font-bold leading-none text-accent-contrast shadow-paper transition duration-200 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
        :to="{ name: 'home' }"
      >
        Back to the atlas
      </RouterLink>
    </section>
  </PageMain>
</template>
