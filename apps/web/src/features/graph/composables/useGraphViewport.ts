import { useElementSize } from "@vueuse/core";
import { computed, ref, watch, type ComputedRef, type Ref } from "vue";

type ViewportPoint = {
  x: number;
  y: number;
};

type ViewportState = {
  panX: number;
  panY: number;
  zoom: number;
};

export type GraphViewportFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GraphViewportContentBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type PinchSnapshot = {
  midpoint: ViewportPoint;
  distance: number;
};

type GraphViewportOptions = {
  width: number;
  height: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  keyboardPanStep?: number;
  contentVisibleBuffer?: number;
  contentBounds?: Readonly<Ref<GraphViewportContentBounds | null>>;
  isInlineScrollHandoffEnabled?: Readonly<Ref<boolean>>;
};

type GraphViewportControls = {
  svgRef: Ref<SVGSVGElement | null>;
  panX: Ref<number>;
  panY: Ref<number>;
  zoom: Ref<number>;
  viewportFrame: ComputedRef<GraphViewportFrame>;
  viewBox: ComputedRef<string>;
  zoomPercentage: ComputedRef<number>;
  viewportTransform: ComputedRef<string>;
  isPanning: Ref<boolean>;
  canUseNativeInlineTouchScroll: ComputedRef<boolean>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  setHomeViewport: (viewport: ViewportState) => void;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handleWheel: (event: WheelEvent) => void;
  handleDoubleClick: (event: MouseEvent) => void;
  handleKeydown: (event: KeyboardEvent) => void;
};

const defaultMinZoom = 0.35;
const defaultMaxZoom = 3;
const defaultZoomStep = 1.2;
const defaultKeyboardPanStep = 36;
const wheelZoomSensitivity = 0.002;
const lineWheelPixels = 16;
const defaultContentVisibleBuffer = 24;
const viewportChangeEpsilon = 0.01;
const verticalTouchIntentRatio = 1.15;

/** Coordinates graph pan and zoom interactions around one SVG viewport transform. */
export function useGraphViewport(options: GraphViewportOptions): GraphViewportControls {
  const svgRef = ref<SVGSVGElement | null>(null);
  const { width: renderedWidth, height: renderedHeight } = useElementSize(svgRef);
  const panX = ref(0);
  const panY = ref(0);
  const zoom = ref(1);
  const isPanning = ref(false);
  const homeViewport = ref<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const pointers = new Map<number, ViewportPoint>();
  const clientPointers = new Map<number, ViewportPoint>();

  const minZoom = options.minZoom ?? defaultMinZoom;
  const maxZoom = options.maxZoom ?? defaultMaxZoom;
  const zoomStep = options.zoomStep ?? defaultZoomStep;
  const keyboardPanStep = options.keyboardPanStep ?? defaultKeyboardPanStep;
  const contentVisibleBuffer = options.contentVisibleBuffer ?? defaultContentVisibleBuffer;
  let lastSinglePointer: ViewportPoint | null = null;
  let lastPinch: PinchSnapshot | null = null;

  /** Enables inline graphs to pass scroll gestures to the page at graph edges. */
  function isInlineScrollHandoffEnabled(): boolean {
    return options.isInlineScrollHandoffEnabled?.value ?? false;
  }

  const viewportFrame = computed(() =>
    viewportFrameForRenderedSize(options.width, options.height, renderedWidth.value, renderedHeight.value)
  );
  const viewBox = computed(() => {
    const frame = viewportFrame.value;

    return `${frame.x} ${frame.y} ${frame.width} ${frame.height}`;
  });
  const centerPoint = computed(() => ({
    x: viewportFrame.value.x + viewportFrame.value.width / 2,
    y: viewportFrame.value.y + viewportFrame.value.height / 2
  }));
  const zoomPercentage = computed(() => Math.round(zoom.value * 100));
  const viewportTransform = computed(() => `translate(${panX.value}, ${panY.value}) scale(${zoom.value})`);
  const canUseNativeInlineTouchScroll = computed(
    () => isInlineScrollHandoffEnabled() && !hasInlineVerticalPanRoom()
  );

  watch(
    () => [
      viewportFrame.value.x,
      viewportFrame.value.y,
      viewportFrame.value.width,
      viewportFrame.value.height,
      options.contentBounds?.value?.minX,
      options.contentBounds?.value?.minY,
      options.contentBounds?.value?.maxX,
      options.contentBounds?.value?.maxY
    ],
    () => {
      constrainCurrentViewport();
    }
  );

  /** Moves the graph by a viewport-space delta so drag and wheel panning stay natural. */
  function panBy(deltaX: number, deltaY: number): boolean {
    return applyViewport({
      panX: panX.value + deltaX,
      panY: panY.value + deltaY,
      zoom: zoom.value
    });
  }

  /** Changes zoom around an anchor point so the user's focus stays under the cursor. */
  function zoomTo(nextZoom: number, anchor: ViewportPoint = centerPoint.value): void {
    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    const worldAnchorX = (anchor.x - panX.value) / zoom.value;
    const worldAnchorY = (anchor.y - panY.value) / zoom.value;

    applyViewport({
      panX: anchor.x - worldAnchorX * clampedZoom,
      panY: anchor.y - worldAnchorY * clampedZoom,
      zoom: clampedZoom
    });
  }

  /** Applies relative zoom steps used by buttons, keyboard shortcuts, and wheels. */
  function zoomBy(factor: number, anchor: ViewportPoint = centerPoint.value): void {
    zoomTo(zoom.value * factor, anchor);
  }

  /** Sets the absolute viewport transform, used for graph-aware home positions. */
  function setViewport(viewport: ViewportState): void {
    applyViewport({
      ...viewport,
      zoom: clamp(viewport.zoom, minZoom, maxZoom)
    });
  }

  /** Gives pointer and keyboard users a quick way back to the original graph view. */
  function resetViewport(): void {
    setViewport(homeViewport.value);
  }

  /** Updates the home transform and immediately moves the viewport there. */
  function setHomeViewport(viewport: ViewportState): void {
    homeViewport.value = viewport;
    setViewport(viewport);
  }

  /** Zooms toward the graph center for the visible plus control and keyboard shortcut. */
  function zoomIn(): void {
    zoomBy(zoomStep);
  }

  /** Zooms away from the graph center for the visible minus control and keyboard shortcut. */
  function zoomOut(): void {
    zoomBy(1 / zoomStep);
  }

  /** Starts pointer tracking so drag and pinch gestures can share the same viewport state. */
  function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const point = clientPointToViewportPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    clientPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capturePointer(event.currentTarget, event.pointerId);

    if (pointers.size >= 2) {
      lastPinch = getPinchSnapshot();
      lastSinglePointer = null;
    } else {
      lastSinglePointer = point;
    }

    isPanning.value = true;
  }

  /** Updates active gestures, using one pointer for pan and two pointers for pinch zoom. */
  function handlePointerMove(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    const previousClientPoint = clientPointers.get(event.pointerId) ?? { x: event.clientX, y: event.clientY };
    const clientDelta = {
      x: event.clientX - previousClientPoint.x,
      y: event.clientY - previousClientPoint.y
    };
    const point = clientPointToViewportPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    clientPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      updatePinchGesture();
      event.preventDefault();
      return;
    }

    if (event.pointerType === "touch" && isInlineScrollHandoffEnabled()) {
      updateTouchPanOrScrollGesture(point, clientDelta);
      if (!canUseNativeInlineTouchScroll.value) {
        event.preventDefault();
      }
    } else {
      updatePanGesture(point);
      event.preventDefault();
    }
  }

  /** Ends pointer tracking and keeps any remaining touch ready to continue panning. */
  function handlePointerUp(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    pointers.delete(event.pointerId);
    clientPointers.delete(event.pointerId);
    releasePointer(event.currentTarget, event.pointerId);

    if (pointers.size === 1) {
      lastSinglePointer = pointers.values().next().value ?? null;
      lastPinch = null;
      isPanning.value = true;
    } else if (pointers.size === 0) {
      lastSinglePointer = null;
      lastPinch = null;
      isPanning.value = false;
    } else {
      lastPinch = getPinchSnapshot();
    }

    event.preventDefault();
  }

  /** Supports trackpad pan, trackpad pinch, mouse-wheel zoom, and horizontal wheel gestures. */
  function handleWheel(event: WheelEvent): void {
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, viewportFrame.value.height);
    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, viewportFrame.value.height);

    if (event.ctrlKey || event.metaKey) {
      const anchor = clientPointToViewportPoint(event.clientX, event.clientY);
      zoomBy(Math.exp(-deltaY * wheelZoomSensitivity), anchor);
      event.preventDefault();
      return;
    } else if (event.shiftKey && deltaX === 0) {
      const didPan = isInlineScrollHandoffEnabled() ? panInlineScrollBy(-deltaY, 0) : panBy(-deltaY, 0);

      if (didPan) {
        event.preventDefault();
      }
      return;
    }

    const didPan = isInlineScrollHandoffEnabled() ? panInlineScrollBy(-deltaX, -deltaY) : panBy(-deltaX, -deltaY);

    if (didPan) {
      event.preventDefault();
    }
  }

  /** Treats double-click as a familiar map-style zoom gesture around the clicked point. */
  function handleDoubleClick(event: MouseEvent): void {
    const anchor = clientPointToViewportPoint(event.clientX, event.clientY);
    zoomBy(event.shiftKey ? 1 / zoomStep : zoomStep, anchor);
    event.preventDefault();
  }

  /** Adds expected keyboard alternatives for users who focus the graph region. */
  function handleKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case "+":
      case "=":
        zoomIn();
        event.preventDefault();
        return;
      case "-":
      case "_":
        zoomOut();
        event.preventDefault();
        return;
      case "0":
      case "Home":
        resetViewport();
        event.preventDefault();
        return;
      case "ArrowUp":
        panBy(0, keyboardPanStep);
        event.preventDefault();
        return;
      case "ArrowDown":
        panBy(0, -keyboardPanStep);
        event.preventDefault();
        return;
      case "ArrowLeft":
        panBy(keyboardPanStep, 0);
        event.preventDefault();
        return;
      case "ArrowRight":
        panBy(-keyboardPanStep, 0);
        event.preventDefault();
        return;
      default:
        return;
    }
  }

  /** Converts browser client coordinates into the SVG viewBox coordinate space. */
  function clientPointToViewportPoint(clientX: number, clientY: number): ViewportPoint {
    const svg = svgRef.value;

    if (!svg) {
      return centerPoint.value;
    }

    const rect = svg.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return centerPoint.value;
    }

    const frame = viewportFrame.value;

    return {
      x: frame.x + ((clientX - rect.left) / rect.width) * frame.width,
      y: frame.y + ((clientY - rect.top) / rect.height) * frame.height
    };
  }

  /** Applies the distance and midpoint changes that make two-finger pinch feel anchored. */
  function updatePinchGesture(): void {
    const snapshot = getPinchSnapshot();

    if (!snapshot) {
      return;
    }

    if (lastPinch) {
      panBy(snapshot.midpoint.x - lastPinch.midpoint.x, snapshot.midpoint.y - lastPinch.midpoint.y);

      if (lastPinch.distance > 0 && snapshot.distance > 0) {
        zoomBy(snapshot.distance / lastPinch.distance, snapshot.midpoint);
      }
    }

    lastPinch = snapshot;
    lastSinglePointer = null;
  }

  /** Applies single-pointer movement as direct panning of the graph surface. */
  function updatePanGesture(point: ViewportPoint): void {
    if (lastSinglePointer) {
      panBy(point.x - lastSinglePointer.x, point.y - lastSinglePointer.y);
    }

    lastSinglePointer = point;
  }

  /** Pans inline mobile graphs until the vertical gesture reaches an edge, then scrolls the page. */
  function updateTouchPanOrScrollGesture(point: ViewportPoint, clientDelta: ViewportPoint): void {
    if (!lastSinglePointer) {
      lastSinglePointer = point;
      return;
    }

    const deltaX = point.x - lastSinglePointer.x;
    const deltaY = point.y - lastSinglePointer.y;
    const isVerticalScrollIntent = Math.abs(clientDelta.y) > Math.abs(clientDelta.x) * verticalTouchIntentRatio;

    if (isVerticalScrollIntent && canUseNativeInlineTouchScroll.value) {
      stopTrackingPointerGesture();
      return;
    }

    const didPan = isVerticalScrollIntent ? panInlineScrollBy(0, deltaY) : panBy(deltaX, deltaY);

    if (didPan) {
      isPanning.value = true;
      lastSinglePointer = point;
    } else if (isVerticalScrollIntent) {
      window.scrollBy(0, -clientDelta.y);
      isPanning.value = false;
      lastSinglePointer = null;
    } else {
      lastSinglePointer = point;
    }
  }

  /** Detects when native mobile scrolling can preserve momentum without losing graph pan affordance. */
  function hasInlineVerticalPanRoom(): boolean {
    const bounds = options.contentBounds?.value;

    if (!hasUsableContentBounds(bounds)) {
      return true;
    }

    const frame = viewportFrame.value;
    const frameBottom = frame.y + frame.height;
    const currentTop = bounds.minY * zoom.value + panY.value;
    const currentBottom = bounds.maxY * zoom.value + panY.value;

    return currentTop < frame.y - viewportChangeEpsilon || currentBottom > frameBottom + viewportChangeEpsilon;
  }

  /** Gives a native scroll gesture back to the browser once the graph has no vertical pan work. */
  function stopTrackingPointerGesture(): void {
    for (const pointerId of pointers.keys()) {
      releasePointer(svgRef.value, pointerId);
    }

    pointers.clear();
    clientPointers.clear();
    lastSinglePointer = null;
    lastPinch = null;
    isPanning.value = false;
  }

  /** Keeps scroll gestures from pushing currently visible graph content past the canvas edge. */
  function panInlineScrollBy(deltaX: number, deltaY: number): boolean {
    const bounds = options.contentBounds?.value;

    if (!hasUsableContentBounds(bounds)) {
      return panBy(deltaX, deltaY);
    }

    const frame = viewportFrame.value;
    const frameRight = frame.x + frame.width;
    const frameBottom = frame.y + frame.height;
    const currentLeft = bounds.minX * zoom.value + panX.value;
    const currentRight = bounds.maxX * zoom.value + panX.value;
    const currentTop = bounds.minY * zoom.value + panY.value;
    const currentBottom = bounds.maxY * zoom.value + panY.value;
    let nextPanX = panX.value;
    let nextPanY = panY.value;

    if (deltaX < 0 && currentRight > frameRight + viewportChangeEpsilon) {
      nextPanX = Math.max(nextPanX + deltaX, frameRight - bounds.maxX * zoom.value);
    } else if (deltaX > 0 && currentLeft < frame.x - viewportChangeEpsilon) {
      nextPanX = Math.min(nextPanX + deltaX, frame.x - bounds.minX * zoom.value);
    }

    if (deltaY < 0 && currentBottom > frameBottom + viewportChangeEpsilon) {
      nextPanY = Math.max(nextPanY + deltaY, frameBottom - bounds.maxY * zoom.value);
    } else if (deltaY > 0 && currentTop < frame.y - viewportChangeEpsilon) {
      nextPanY = Math.min(nextPanY + deltaY, frame.y - bounds.minY * zoom.value);
    }

    return applyViewport({
      panX: nextPanX,
      panY: nextPanY,
      zoom: zoom.value
    });
  }

  /** Captures the active two-pointer pinch geometry if enough pointers are present. */
  function getPinchSnapshot(): PinchSnapshot | null {
    const activePointers = Array.from(pointers.values());
    const firstPointer = activePointers[0];
    const secondPointer = activePointers[1];

    if (!firstPointer || !secondPointer) {
      return null;
    }

    return {
      midpoint: {
        x: (firstPointer.x + secondPointer.x) / 2,
        y: (firstPointer.y + secondPointer.y) / 2
      },
      distance: Math.hypot(secondPointer.x - firstPointer.x, secondPointer.y - firstPointer.y)
    };
  }

  /** Applies viewport changes through the content bounds so panning cannot lose every node. */
  function applyViewport(viewport: ViewportState): boolean {
    const constrainedViewport = constrainedViewportForContent(viewport);
    const didChange =
      hasViewportValueChanged(panX.value, constrainedViewport.panX) ||
      hasViewportValueChanged(panY.value, constrainedViewport.panY) ||
      hasViewportValueChanged(zoom.value, constrainedViewport.zoom);

    panX.value = constrainedViewport.panX;
    panY.value = constrainedViewport.panY;
    zoom.value = constrainedViewport.zoom;

    return didChange;
  }

  /** Rechecks the current transform after content bounds or rendered frame dimensions change. */
  function constrainCurrentViewport(): void {
    applyViewport({
      panX: panX.value,
      panY: panY.value,
      zoom: zoom.value
    });
  }

  /** Clamps pan so a small strip of graph content remains visible at the viewport edge. */
  function constrainedViewportForContent(viewport: ViewportState): ViewportState {
    const bounds = options.contentBounds?.value;

    if (!hasUsableContentBounds(bounds)) {
      return viewport;
    }

    const frame = viewportFrame.value;
    const horizontalBuffer = Math.min(contentVisibleBuffer, frame.width / 2);
    const verticalBuffer = Math.min(contentVisibleBuffer, frame.height / 2);
    const minPanX = frame.x + horizontalBuffer - bounds.maxX * viewport.zoom;
    const maxPanX = frame.x + frame.width - horizontalBuffer - bounds.minX * viewport.zoom;
    const minPanY = frame.y + verticalBuffer - bounds.maxY * viewport.zoom;
    const maxPanY = frame.y + frame.height - verticalBuffer - bounds.minY * viewport.zoom;

    return {
      panX: clamp(viewport.panX, minPanX, maxPanX),
      panY: clamp(viewport.panY, minPanY, maxPanY),
      zoom: viewport.zoom
    };
  }

  return {
    svgRef,
    panX,
    panY,
    zoom,
    viewportFrame,
    viewBox,
    zoomPercentage,
    viewportTransform,
    isPanning,
    canUseNativeInlineTouchScroll,
    zoomIn,
    zoomOut,
    resetViewport,
    setHomeViewport,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleDoubleClick,
    handleKeydown
  };
}

/** Keeps zoom within usable limits so the graph cannot disappear or become unusably large. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Treats sub-pixel pan differences as no movement so wheel overscroll can bubble naturally. */
function hasViewportValueChanged(previousValue: number, nextValue: number): boolean {
  return Math.abs(previousValue - nextValue) > viewportChangeEpsilon;
}

/** Checks whether layout bounds are finite before they influence user panning. */
function hasUsableContentBounds(bounds: GraphViewportContentBounds | null | undefined): bounds is GraphViewportContentBounds {
  return Boolean(
    bounds &&
      Number.isFinite(bounds.minX) &&
      Number.isFinite(bounds.minY) &&
      Number.isFinite(bounds.maxX) &&
      Number.isFinite(bounds.maxY) &&
      bounds.minX <= bounds.maxX &&
      bounds.minY <= bounds.maxY
  );
}

/** Expands the SVG coordinate frame to match the rendered aspect ratio without stretching graph marks. */
function viewportFrameForRenderedSize(
  baseWidth: number,
  baseHeight: number,
  renderedWidth: number,
  renderedHeight: number
): GraphViewportFrame {
  if (renderedWidth <= 0 || renderedHeight <= 0) {
    return { x: 0, y: 0, width: baseWidth, height: baseHeight };
  }

  const baseCenterX = baseWidth / 2;
  const baseCenterY = baseHeight / 2;
  const baseAspect = baseWidth / baseHeight;
  const renderedAspect = renderedWidth / renderedHeight;
  const width = renderedAspect > baseAspect ? baseHeight * renderedAspect : baseWidth;
  const height = renderedAspect > baseAspect ? baseHeight : baseWidth / renderedAspect;

  return {
    x: baseCenterX - width / 2,
    y: baseCenterY - height / 2,
    width,
    height
  };
}

/** Normalizes wheel units so line-mode mouse wheels and pixel-mode trackpads behave similarly. */
function normalizeWheelDelta(delta: number, deltaMode: number, viewportHeight: number): number {
  switch (deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return delta * lineWheelPixels;
    case WheelEvent.DOM_DELTA_PAGE:
      return delta * viewportHeight;
    case WheelEvent.DOM_DELTA_PIXEL:
      return delta;
    default:
      return delta;
  }
}

/** Asks the browser to keep sending move/up events after a pointer leaves the SVG bounds. */
function capturePointer(target: EventTarget | null, pointerId: number): void {
  if (!(target instanceof Element)) {
    return;
  }

  target.setPointerCapture(pointerId);
}

/** Releases pointer capture when a pan or pinch gesture finishes. */
function releasePointer(target: EventTarget | null, pointerId: number): void {
  if (!(target instanceof Element) || !target.hasPointerCapture(pointerId)) {
    return;
  }

  target.releasePointerCapture(pointerId);
}
