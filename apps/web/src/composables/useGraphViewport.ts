import { computed, ref, type ComputedRef, type Ref } from "vue";

type ViewportPoint = {
  x: number;
  y: number;
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
};

type GraphViewportControls = {
  svgRef: Ref<SVGSVGElement | null>;
  panX: Ref<number>;
  panY: Ref<number>;
  zoom: Ref<number>;
  zoomPercentage: ComputedRef<number>;
  viewportTransform: ComputedRef<string>;
  isPanning: Ref<boolean>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
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

/** Coordinates graph pan and zoom interactions around one SVG viewport transform. */
export function useGraphViewport(options: GraphViewportOptions): GraphViewportControls {
  const svgRef = ref<SVGSVGElement | null>(null);
  const panX = ref(0);
  const panY = ref(0);
  const zoom = ref(1);
  const isPanning = ref(false);
  const pointers = new Map<number, ViewportPoint>();

  const minZoom = options.minZoom ?? defaultMinZoom;
  const maxZoom = options.maxZoom ?? defaultMaxZoom;
  const zoomStep = options.zoomStep ?? defaultZoomStep;
  const keyboardPanStep = options.keyboardPanStep ?? defaultKeyboardPanStep;
  let lastSinglePointer: ViewportPoint | null = null;
  let lastPinch: PinchSnapshot | null = null;

  const centerPoint = computed(() => ({
    x: options.width / 2,
    y: options.height / 2
  }));
  const zoomPercentage = computed(() => Math.round(zoom.value * 100));
  const viewportTransform = computed(() => `translate(${panX.value}, ${panY.value}) scale(${zoom.value})`);

  /** Moves the graph by a viewport-space delta so drag and wheel panning stay natural. */
  function panBy(deltaX: number, deltaY: number): void {
    panX.value += deltaX;
    panY.value += deltaY;
  }

  /** Changes zoom around an anchor point so the user's focus stays under the cursor. */
  function zoomTo(nextZoom: number, anchor: ViewportPoint = centerPoint.value): void {
    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    const worldAnchorX = (anchor.x - panX.value) / zoom.value;
    const worldAnchorY = (anchor.y - panY.value) / zoom.value;

    zoom.value = clampedZoom;
    panX.value = anchor.x - worldAnchorX * clampedZoom;
    panY.value = anchor.y - worldAnchorY * clampedZoom;
  }

  /** Applies relative zoom steps used by buttons, keyboard shortcuts, and wheels. */
  function zoomBy(factor: number, anchor: ViewportPoint = centerPoint.value): void {
    zoomTo(zoom.value * factor, anchor);
  }

  /** Gives pointer and keyboard users a quick way back to the original graph view. */
  function resetViewport(): void {
    panX.value = 0;
    panY.value = 0;
    zoom.value = 1;
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
    capturePointer(event.currentTarget, event.pointerId);

    if (pointers.size >= 2) {
      lastPinch = getPinchSnapshot();
      lastSinglePointer = null;
    } else {
      lastSinglePointer = point;
    }

    isPanning.value = true;
    event.preventDefault();
  }

  /** Updates active gestures, using one pointer for pan and two pointers for pinch zoom. */
  function handlePointerMove(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    const point = clientPointToViewportPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);

    if (pointers.size >= 2) {
      updatePinchGesture();
    } else {
      updatePanGesture(point);
    }

    event.preventDefault();
  }

  /** Ends pointer tracking and keeps any remaining touch ready to continue panning. */
  function handlePointerUp(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    pointers.delete(event.pointerId);
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
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, options.height);
    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, options.height);

    if (event.ctrlKey || event.metaKey) {
      const anchor = clientPointToViewportPoint(event.clientX, event.clientY);
      zoomBy(Math.exp(-deltaY * wheelZoomSensitivity), anchor);
    } else if (event.shiftKey && deltaX === 0) {
      panBy(-deltaY, 0);
    } else {
      panBy(-deltaX, -deltaY);
    }

    event.preventDefault();
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

    return {
      x: ((clientX - rect.left) / rect.width) * options.width,
      y: ((clientY - rect.top) / rect.height) * options.height
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

  return {
    svgRef,
    panX,
    panY,
    zoom,
    zoomPercentage,
    viewportTransform,
    isPanning,
    zoomIn,
    zoomOut,
    resetViewport,
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
