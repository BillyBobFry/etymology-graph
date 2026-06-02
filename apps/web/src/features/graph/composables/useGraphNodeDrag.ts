import { ref, type ComputedRef, type Ref } from "vue";

import { graphCanvasHeight, graphCanvasWidth } from "../graphCanvasConstants";
import type { GraphLayoutOrientation, PositionedGraphNode } from "./useGraphLayout";

const centerX = graphCanvasWidth / 2;
const centerY = graphCanvasHeight / 2;

type GraphPoint = {
  x: number;
  y: number;
};

type NodeDragState = {
  pointerId: number;
  nodeId: string;
  lastPoint: GraphPoint;
  hasMoved: boolean;
};

type GraphNodeDragOptions = {
  svgRef: Ref<SVGSVGElement | null>;
  panX: Ref<number>;
  panY: Ref<number>;
  zoom: Ref<number>;
  graphLayoutOrientation: ComputedRef<GraphLayoutOrientation>;
  isNodeDragEnabled?: Readonly<Ref<boolean>>;
  nodeX: (node: PositionedGraphNode) => number;
  nodeY: (node: PositionedGraphNode) => number;
  requestRenderTick: () => void;
  onNodeDrag?: (node: PositionedGraphNode, delta: GraphPoint) => void;
};

/** Keeps direct node dragging isolated from canvas pan and zoom gestures. */
export function useGraphNodeDrag(options: GraphNodeDragOptions) {
  const nodeDragState = ref<NodeDragState>();
  const suppressNextNodeClick = ref(false);

  /** Lets mobile preview graphs keep tap selection without trapping page scroll. */
  function isNodeDragEnabled(): boolean {
    return options.isNodeDragEnabled?.value ?? true;
  }

  /** Starts direct node movement while keeping the background viewport from panning. */
  function startNodeDrag(event: PointerEvent, node: PositionedGraphNode): void {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (!isNodeDragEnabled()) {
      return;
    }

    nodeDragState.value = {
      pointerId: event.pointerId,
      nodeId: node.id,
      lastPoint: clientPointToGraphPoint(event.clientX, event.clientY),
      hasMoved: false
    };
    node.fx = options.nodeX(node);
    node.fy = options.nodeY(node);
    captureNodePointer(event.currentTarget, event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  /** Moves the active node in graph coordinates so dragging stays accurate through pan and zoom. */
  function dragNode(event: PointerEvent, node: PositionedGraphNode): void {
    const dragState = nodeDragState.value;

    if (!dragState || dragState.pointerId !== event.pointerId || dragState.nodeId !== node.id) {
      return;
    }

    const point = clientPointToGraphPoint(event.clientX, event.clientY);
    const deltaX = point.x - dragState.lastPoint.x;
    const deltaY = point.y - dragState.lastPoint.y;
    const nextX = options.nodeX(node) + deltaX;
    const nextY = options.nodeY(node) + deltaY;

    node.x = nextX;
    node.y = nextY;
    node.fx = nextX;
    node.fy = nextY;
    node.preferredSiblingPosition = options.graphLayoutOrientation.value === "horizontal" ? nextY : nextX;
    options.onNodeDrag?.(node, { x: deltaX, y: deltaY });
    dragState.lastPoint = point;
    dragState.hasMoved = dragState.hasMoved || Math.hypot(deltaX, deltaY) > 1;
    options.requestRenderTick();
    event.preventDefault();
    event.stopPropagation();
  }

  /** Finishes node dragging and leaves the node pinned until this graph is rebuilt. */
  function endNodeDrag(event: PointerEvent, node: PositionedGraphNode): void {
    const dragState = nodeDragState.value;

    if (!dragState || dragState.pointerId !== event.pointerId || dragState.nodeId !== node.id) {
      return;
    }

    suppressNextNodeClick.value = dragState.hasMoved;
    nodeDragState.value = undefined;
    releaseNodePointer(event.currentTarget, event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  /** Checks whether a node is the one currently following the pointer. */
  function isNodeDragging(node: PositionedGraphNode): boolean {
    return nodeDragState.value?.nodeId === node.id;
  }

  /** Clears stale drag state when a new graph replaces the rendered layout. */
  function resetNodeDrag(): void {
    nodeDragState.value = undefined;
    suppressNextNodeClick.value = false;
  }

  /** Converts browser coordinates into the graph coordinate system inside the zoomed viewport. */
  function clientPointToGraphPoint(clientX: number, clientY: number): GraphPoint {
    const svg = options.svgRef.value;

    if (!svg) {
      return { x: centerX, y: centerY };
    }

    const rect = svg.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return { x: centerX, y: centerY };
    }

    const viewportX = ((clientX - rect.left) / rect.width) * graphCanvasWidth;
    const viewportY = ((clientY - rect.top) / rect.height) * graphCanvasHeight;

    return {
      x: (viewportX - options.panX.value) / options.zoom.value,
      y: (viewportY - options.panY.value) / options.zoom.value
    };
  }

  return {
    suppressNextNodeClick,
    startNodeDrag,
    dragNode,
    endNodeDrag,
    isNodeDragging,
    resetNodeDrag
  };
}

/** Keeps node drag events flowing after the pointer leaves the circle or label. */
function captureNodePointer(target: EventTarget | null, pointerId: number): void {
  if (!(target instanceof Element)) {
    return;
  }

  target.setPointerCapture(pointerId);
}

/** Releases capture once a node drag ends or is cancelled. */
function releaseNodePointer(target: EventTarget | null, pointerId: number): void {
  if (!(target instanceof Element) || !target.hasPointerCapture(pointerId)) {
    return;
  }

  target.releasePointerCapture(pointerId);
}
