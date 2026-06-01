<script setup lang="ts">
import {
  graphAnnotationCalloutHeight,
  graphAnnotationCalloutWidth,
  type PositionedGraphAnnotation
} from "./composables/useGraphLayout";
import type { GraphAnnotationTone } from "./graphAnnotations";
import FloatingSurface from "../../uiComponents/FloatingSurface.vue";

defineProps<{
  positionedAnnotations: PositionedGraphAnnotation[];
}>();

/** Maps semantic annotation roles to existing theme colors. */
function annotationToneClass(tone: GraphAnnotationTone): string {
  switch (tone) {
    case "shifted":
      return "[--annotation-color:var(--theme-accent)]";
    case "unchanged":
      return "[--annotation-color:var(--theme-descendant)]";
    case "context":
      return "[--annotation-color:var(--theme-text-muted)]";
    default: {
      const exhaustiveValue: never = tone;
      throw new Error(`Unhandled annotation tone: ${exhaustiveValue}`);
    }
  }
}

/** Keeps badge copy short while the body carries the actual sound-change explanation. */
function annotationToneLabel(tone: GraphAnnotationTone): string {
  switch (tone) {
    case "shifted":
      return "Shift took place";
    case "unchanged":
      return "No shift here";
    case "context":
      return "Context";
    default: {
      const exhaustiveValue: never = tone;
      throw new Error(`Unhandled annotation tone: ${exhaustiveValue}`);
    }
  }
}
</script>

<template>
  <g class="graph-annotations pointer-events-none">
    <g
      v-for="item in positionedAnnotations"
      :key="item.annotation.id"
      :class="annotationToneClass(item.annotation.tone)"
    >
      <line
        v-for="(line, lineIndex) in item.lines"
        :key="`${item.annotation.id}:line:${lineIndex}`"
        class="stroke-[color-mix(in_oklch,var(--theme-graph-edge)_72%,transparent)] stroke-2 [stroke-linecap:round]"
        :x1="line.anchorX"
        :y1="line.anchorY"
        :x2="line.lineEndX"
        :y2="line.lineEndY"
      />
      <circle
        v-for="(line, lineIndex) in item.lines"
        :key="`${item.annotation.id}:dot:${lineIndex}`"
        class="fill-[color-mix(in_oklch,var(--theme-graph-edge)_86%,var(--theme-surface))] stroke-surface stroke-2"
        :cx="line.lineEndX"
        :cy="line.lineEndY"
        r="4"
      />
      <foreignObject
        :x="item.calloutX"
        :y="item.calloutY"
        :width="graphAnnotationCalloutWidth"
        :height="graphAnnotationCalloutHeight"
      >
        <FloatingSurface
          xmlns="http://www.w3.org/1999/xhtml"
          class="grid h-full gap-1.5 border-(--annotation-color)/70 p-3 text-left"
        >
          <p class="font-label text-[10px] font-black uppercase tracking-[0.14em] text-(--annotation-color)">
            {{ annotationToneLabel(item.annotation.tone) }}
          </p>
          <h4 class="text-sm font-black leading-tight tracking-[-0.02em] text-text">
            {{ item.annotation.title }}
          </h4>
          <p class="text-xs leading-snug text-text-muted">
            {{ item.annotation.body }}
          </p>
        </FloatingSurface>
      </foreignObject>
    </g>
  </g>
</template>
