import { Camera, MIN_ZOOM, MAX_ZOOM } from "./camera";

/**
 * Pointer-event gesture state machine.
 *
 * Grammar (the Mini Motorways pattern):
 * - Paint-mode off: 1-finger drag pans; tap → onTap.
 * - Paint-mode on:  1-finger drag paints (onPaint per move, with previous
 *   tile); 2-finger anything always pans/zooms; tap also paints one tile.
 * - Mouse: wheel zooms at cursor; middle-drag always pans; left behaves as
 *   the active mode dictates.
 */
export interface GestureCallbacks {
  /** Should one-finger drags paint instead of pan? */
  isPaintMode(): boolean;
  onTap(screenX: number, screenY: number): void;
  onPaint(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void;
  onPaintEnd?(): void;
}

type State = "idle" | "pending" | "panning" | "painting" | "pinching";

interface PointerInfo {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isMouse: boolean;
  isMiddle: boolean;
}

const TAP_MS = 350;
const SLOP_TOUCH = 10;
const SLOP_MOUSE = 4;
/** A second finger within this window converts a paint into a pinch. */
const PINCH_GRACE_MS = 150;

export class GestureController {
  private state: State = "idle";
  private pointers = new Map<number, PointerInfo>();
  private camera: Camera;
  private callbacks: GestureCallbacks;
  private downTime = 0;
  private paintCommitted = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;

  constructor(
    element: HTMLElement,
    camera: Camera,
    callbacks: GestureCallbacks,
  ) {
    this.camera = camera;
    this.callbacks = callbacks;

    element.style.touchAction = "none";
    element.addEventListener("pointerdown", this.onDown);
    element.addEventListener("pointermove", this.onMove);
    element.addEventListener("pointerup", this.onUp);
    element.addEventListener("pointercancel", this.onCancel);
    element.addEventListener("wheel", this.onWheel, { passive: false });
    // iOS Safari pinch-to-zoom hijack prevention.
    element.addEventListener("gesturestart", (e) => e.preventDefault());
    element.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onDown = (e: PointerEvent): void => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const info: PointerInfo = {
      id: e.pointerId,
      x: e.offsetX,
      y: e.offsetY,
      startX: e.offsetX,
      startY: e.offsetY,
      isMouse: e.pointerType === "mouse",
      isMiddle: e.pointerType === "mouse" && e.button === 1,
    };
    this.pointers.set(e.pointerId, info);

    if (this.pointers.size === 1) {
      this.state = "pending";
      this.downTime = performance.now();
      this.paintCommitted = false;
    } else if (this.pointers.size === 2) {
      // Second finger: always escalate to pinch. If a paint stroke had only
      // just begun (within grace, nothing committed), it was a false start.
      this.beginPinch();
    }
  };

  private onMove = (e: PointerEvent): void => {
    const info = this.pointers.get(e.pointerId);
    if (!info) return;
    const prevX = info.x;
    const prevY = info.y;
    info.x = e.offsetX;
    info.y = e.offsetY;

    if (this.state === "pending") {
      const slop = info.isMouse ? SLOP_MOUSE : SLOP_TOUCH;
      const moved = Math.hypot(info.x - info.startX, info.y - info.startY);
      if (moved > slop) {
        const paint =
          this.callbacks.isPaintMode() && !info.isMiddle;
        this.state = paint ? "painting" : "panning";
        if (paint) {
          this.callbacks.onPaint(info.startX, info.startY, info.x, info.y);
          this.paintCommitted = true;
        }
      }
      return;
    }

    if (this.state === "panning" && this.pointers.size === 1) {
      this.camera.panBy(info.x - prevX, info.y - prevY);
    } else if (this.state === "painting") {
      this.callbacks.onPaint(prevX, prevY, info.x, info.y);
      this.paintCommitted = true;
    } else if (this.state === "pinching" && this.pointers.size >= 2) {
      this.updatePinch();
    }
  };

  private onUp = (e: PointerEvent): void => {
    const info = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!info) return;

    if (this.state === "pending") {
      const elapsed = performance.now() - this.downTime;
      if (elapsed < TAP_MS) {
        if (this.callbacks.isPaintMode() && !info.isMiddle) {
          // A tap with a paint tool paints a single tile.
          this.callbacks.onPaint(info.x, info.y, info.x, info.y);
          this.callbacks.onPaintEnd?.();
        } else {
          this.callbacks.onTap(info.x, info.y);
        }
      }
      this.state = "idle";
    } else if (this.state === "painting") {
      if (this.pointers.size === 0) {
        this.callbacks.onPaintEnd?.();
        this.state = "idle";
      }
    } else if (this.state === "pinching") {
      if (this.pointers.size < 2) {
        // Drop to single-finger pan (never resume painting mid-gesture).
        this.state = this.pointers.size === 1 ? "panning" : "idle";
      }
    } else if (this.pointers.size === 0) {
      this.state = "idle";
    }
  };

  private onCancel = (e: PointerEvent): void => {
    // Browser stole the gesture (e.g. Android nav) — abort cleanly.
    this.pointers.delete(e.pointerId);
    if (this.state === "painting") this.callbacks.onPaintEnd?.();
    this.state = this.pointers.size >= 2 ? "pinching" : this.pointers.size === 1 ? "panning" : "idle";
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const next = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, this.camera.zoom * factor),
    );
    this.camera.zoomAt(e.offsetX, e.offsetY, next);
  };

  private beginPinch(): void {
    const wasEarlyPaint =
      this.state === "painting" &&
      !this.paintCommitted &&
      performance.now() - this.downTime < PINCH_GRACE_MS;
    if (this.state === "painting" && !wasEarlyPaint) {
      this.callbacks.onPaintEnd?.();
    }
    this.state = "pinching";
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    this.pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    this.pinchStartZoom = this.camera.zoom;
    this.pinchPrevMid = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }

  private pinchPrevMid = { x: 0, y: 0 };

  private updatePinch(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // Two-finger drag pans by midpoint delta…
    this.camera.panBy(mid.x - this.pinchPrevMid.x, mid.y - this.pinchPrevMid.y);
    // …and pinch zooms about the midpoint.
    const next = this.pinchStartZoom * (dist / this.pinchStartDist);
    this.camera.zoomAt(mid.x, mid.y, next);
    this.pinchPrevMid = mid;
  }
}
