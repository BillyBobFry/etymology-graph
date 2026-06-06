<script setup lang="ts">
import { computed } from "vue";
import {
  normalizeWord,
  type ComparisonSetGroupResult,
  type ComparisonSetItemResult,
  type EtymologyGraph,
  type GraphTraversalNode
} from "@etymology-graph/graph";

import type { SoundChangeExampleSet, SoundChangeGraphAnnotation, SoundChangeLineage } from "./soundChanges";
import { comparisonSetQueryForSoundChangeExample } from "./soundChanges";
import { useComparisonSetQuery } from "./useComparisonSetQuery";
import GraphEvidencePanel from "../graph/GraphEvidencePanel.vue";
import type { GraphLayoutPreset } from "../graph/composables/useGraphLayout";
import { formatIpaPronunciation } from "../graph/graphNodeDisplay";
import type { GraphNodeAnnotation, GraphNodeAnnotationTarget } from "../graph/graphAnnotations";

type GraphEvidenceStatus = "idle" | "loading" | "success" | "empty" | "error";

const props = defineProps<{
  example: SoundChangeExampleSet;
}>();

const comparisonSetInput = computed(() => comparisonSetQueryForSoundChangeExample(props.example));
const comparisonSetQuery = useComparisonSetQuery(comparisonSetInput);

/** Keeps repeated lineage groups rendered through one accessible section structure. */
const lineageGroups = computed<Array<{ id: string; label: string; lineages: SoundChangeLineage[] }>>(() => [
  { id: "shifted", label: props.example.shiftedLabel, lineages: props.example.shifted },
  { id: "comparisons", label: props.example.comparisonLabel, lineages: props.example.comparisons }
]);
/** Summarizes the shared root once so each overview item can stay compact. */
const sourceSummary = computed(() => {
  const rootLineage = props.example.shifted[0] ?? props.example.comparisons[0];

  return rootLineage ? `${rootLineage.from.languageName} ${rootLineage.from.term}` : undefined;
});

const comparisonGraph = computed(() => comparisonSetQuery.data.value?.graph ?? null);
const comparisonGraphRootNodeId = computed(() => comparisonSetQuery.data.value?.root?.id);
const graphLayoutPreset = computed<GraphLayoutPreset>(() =>
  comparisonGraphRootNodeId.value
    ? { type: "doublet-arms", rootNodeId: comparisonGraphRootNodeId.value }
    : { type: "auto" }
);
const highlightedGraphNodeIds = computed(() => {
  const graph = comparisonGraph.value;

  if (!graph) {
    return [];
  }

  return [...props.example.shifted, ...props.example.comparisons].flatMap((lineage) => {
    const node = findGraphNode(graph, lineage.to.languageCode, lineage.to.term);

    return node ? [node.id] : [];
  });
});
/** Indexes imported IPA by editorial lineage so the overview can stay data-driven. */
const ipaByLineageId = computed(() => {
  const graph = comparisonGraph.value;
  const ipaById = new Map<string, string>();

  if (!graph) {
    return ipaById;
  }

  for (const lineage of [...props.example.shifted, ...props.example.comparisons]) {
    const node = findGraphNode(graph, lineage.to.languageCode, lineage.to.term);
    const ipa = node ? formatIpaPronunciation(node) : undefined;

    if (ipa) {
      ipaById.set(lineage.id, ipa);
    }
  }

  return ipaById;
});
const resolvedAnnotations = computed<GraphNodeAnnotation[]>(() =>
  props.example.annotations.map((annotation) => resolveAnnotationTarget(annotation))
);
const graphStatus = computed<GraphEvidenceStatus>(() => {
  if (comparisonSetQuery.isPending.value || (comparisonSetQuery.isFetching.value && !comparisonSetQuery.data.value)) {
    return "loading";
  }

  if (comparisonSetQuery.isError.value) {
    return "error";
  }

  return comparisonGraph.value ? "success" : "empty";
});

/** Targets group annotations at every branch-specific node below the shared root. */
function resolveAnnotationTarget(annotation: SoundChangeGraphAnnotation): GraphNodeAnnotation {
  const { targetGroupId: _targetGroupId, ...graphAnnotation } = annotation;
  const branchTargets = annotation.targetGroupId
    ? branchTargetsForGroup(annotation.targetGroupId)
    : undefined;
  const [primaryTarget, ...additionalTargets] = branchTargets ?? [];

  if (!primaryTarget) {
    return graphAnnotation;
  }

  return {
    ...graphAnnotation,
    target: primaryTarget,
    additionalTargets: [...additionalTargets, ...(graphAnnotation.additionalTargets ?? [])],
    fallbackTargets: [graphAnnotation.target, ...(graphAnnotation.fallbackTargets ?? [])]
  };
}

/** Finds every unique earliest branch node after the root for a comparison group. */
function branchTargetsForGroup(groupId: string): GraphNodeAnnotationTarget[] {
  const graph = comparisonGraph.value;
  const rootNodeId = comparisonGraphRootNodeId.value;
  const group = comparisonSetQuery.data.value?.groups.find((group) => group.id === groupId);

  if (!graph || !rootNodeId || !group) {
    return [];
  }

  return branchNodeIdsForGroup(graph, rootNodeId, group).flatMap((branchNodeId) => {
    const branchNode = graph.nodes.find((node) => node.id === branchNodeId);

    return branchNode ? [{ langCode: branchNode.langCode, word: branchNode.word }] : [];
  });
}

/** Collects unique branch nodes in the same order as the group's visible target paths. */
function branchNodeIdsForGroup(
  graph: EtymologyGraph,
  rootNodeId: string,
  group: ComparisonSetGroupResult
): string[] {
  const nodeIds = new Set<string>();

  for (const item of group.items) {
    const branchNodeId = firstBranchNodeIdForItem(graph, rootNodeId, item);

    if (!branchNodeId) {
      continue;
    }

    nodeIds.add(branchNodeId);
  }

  return [...nodeIds];
}

/** Walks one endpoint path back to the root and returns the node immediately below the root. */
function firstBranchNodeIdForItem(
  graph: EtymologyGraph,
  rootNodeId: string,
  item: ComparisonSetItemResult
): string | undefined {
  const endpointNode = findGraphNode(graph, item.langCode, item.word);

  if (!endpointNode) {
    return undefined;
  }

  const pathToRoot = pathFromNodeToRoot(graph, endpointNode.id, rootNodeId);

  if (pathToRoot.length < 2) {
    return undefined;
  }

  return pathToRoot[pathToRoot.length - 2];
}

/** Finds a graph node using the same normalized word semantics as graph lookup. */
function findGraphNode(graph: EtymologyGraph, langCode: string, word: string): GraphTraversalNode | undefined {
  const normalizedTargetWord = normalizeWord(word);

  return graph.nodes.find((node) => node.langCode === langCode && node.normalizedWord === normalizedTargetWord);
}

/** Follows source-directed ancestry edges from a descendant endpoint back to the shared root. */
function pathFromNodeToRoot(graph: EtymologyGraph, startNodeId: string, rootNodeId: string): string[] {
  const parentNodeIdsByChildId = new Map<string, string[]>();

  for (const edge of graph.edges) {
    parentNodeIdsByChildId.set(edge.fromNodeId, [...(parentNodeIdsByChildId.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  }

  const pendingPaths = [[startNodeId]];
  const visitedNodeIds = new Set<string>();

  while (pendingPaths.length > 0) {
    const path = pendingPaths.shift() ?? [];
    const nodeId = path[path.length - 1];

    if (!nodeId || visitedNodeIds.has(nodeId)) {
      continue;
    }

    if (nodeId === rootNodeId) {
      return path;
    }

    visitedNodeIds.add(nodeId);

    for (const parentNodeId of parentNodeIdsByChildId.get(nodeId) ?? []) {
      pendingPaths.push([...path, parentNodeId]);
    }
  }

  return [];
}
</script>

<template>
  <article class="grid gap-5 rounded-md border border-border bg-surface/80 p-5 shadow-paper">
    <div class="grid gap-3">
      <p class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
        {{ example.pattern }}
      </p>
      <div class="grid gap-3 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)] lg:items-start">
        <h3 class="text-3xl font-black leading-tight tracking-tighter text-text">
          {{ example.title }}
        </h3>
        <p class="leading-7 text-text-muted">
          {{ example.explanation }}
        </p>
      </div>
      <p v-if="sourceSummary" class="text-sm leading-6 text-text-muted">
        From
        <span class="font-semibold text-text">{{ sourceSummary }}</span>
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <section
        v-for="group in lineageGroups"
        :key="group.id"
        class="grid gap-3 rounded-md border border-border bg-surface-muted/70 p-4"
      >
        <h4 class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
          {{ group.label }}
        </h4>
        <dl class="grid gap-2">
          <div
            v-for="lineage in group.lineages"
            :key="lineage.id"
            class="border-t border-border pt-2 first:border-t-0 first:pt-0"
          >
            <dt class="sr-only">
              {{ group.label }}
            </dt>
            <dd class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
                {{ lineage.to.languageName }}
              </span>
              <span class="text-lg font-bold tracking-[-0.02em] text-text">
                {{ lineage.to.term }}
              </span>
              <template v-if="ipaByLineageId.get(lineage.id)">
                <span class="text-sm text-text-muted">
                  {{ ipaByLineageId.get(lineage.id) }}
                </span>
              </template>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <GraphEvidencePanel
      :status="graphStatus"
      :graph="comparisonGraph"
      :layout-preset="graphLayoutPreset"
      :highlighted-node-ids="highlightedGraphNodeIds"
      :show-controls="false"
      :annotations="resolvedAnnotations"
      :loading-label="`Loading ${example.title} comparison graph...`"
      :error-text="`Could not load the ${example.title} comparison graph.`"
      empty-text="No comparison examples are in the index for this pattern yet."
    />
  </article>
</template>
