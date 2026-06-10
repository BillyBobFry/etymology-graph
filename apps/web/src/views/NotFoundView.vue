<script setup lang="ts">
import Button from "../uiComponents/Button.vue";
import PageMain from "../uiComponents/PageMain.vue";
</script>

<template>
  <PageMain>
    <section class="pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Route not found
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Page not found.
      </h1>
      <p class="mb-6 max-w-3xl text-lg leading-8 text-text-page-muted">
        Return home to choose etymology, doublets, source languages, or sound changes.
      </p>
      <Button :to="{ name: 'home' }">
        Back home
      </Button>
    </section>
  </PageMain>
</template>
