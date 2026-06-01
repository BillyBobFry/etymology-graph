<script setup lang="ts">
import GlossaryTerm from "./GlossaryTerm.vue";
import type { GlossaryTermSegment, GlossaryTextSegment } from "./linguisticGlossary";

defineProps<{
  segments: GlossaryTextSegment[];
}>();

/** Distinguishes author-marked glossary terms from plain prose fragments. */
function isGlossaryTermSegment(segment: GlossaryTextSegment): segment is GlossaryTermSegment {
  return typeof segment !== "string";
}
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <GlossaryTerm
      v-if="isGlossaryTermSegment(segment)"
      :term-id="segment.termId"
      :text="segment.text"
    />
    <template v-else>{{ segment }}</template>
  </template>
</template>
