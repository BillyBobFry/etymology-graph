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
        class="stroke-(--annotation-color) stroke-2 [stroke-linecap:round]"
        :x1="item.anchorX"
        :y1="item.anchorY"
        :x2="item.lineEndX"
        :y2="item.lineEndY"
      />
      <circle
        class="fill-(--annotation-color) stroke-surface stroke-2"
        :cx="item.lineEndX"
        :cy="item.lineEndY"
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
