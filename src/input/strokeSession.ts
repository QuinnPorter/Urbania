import { tileLinePathL } from "../core/model/grid";

/**
 * Pure per-stroke decision logic shared by the paint tools. The ToolController
 * feeds it gesture events; it returns directives describing what to commit or
 * preview. No DOM/Pixi imports — unit-testable.
 *
 * Modes (frozen at stroke start so toggling options mid-drag is safe):
 * - freehand:       live commit per segment (roads, classic behaviour)
 * - line-freehand:  rail/subway freehand; defers its first tap-candidate
 *                   segment so a plain tap can dismiss the line tool instead
 * - lpath:          Grid Lock — preview an L path, commit on release
 * - rect:           zone rectangle — preview, fill on release
 * - zone-brush:     live commit, size² stamp per stroke tile
 */
export type PaintKind = "road" | "rail" | "subway" | "zone";
export type StrokeMode =
  | "freehand"
  | "line-freehand"
  | "lpath"
  | "rect"
  | "zone-brush";

export interface StrokeContext {
  kind: PaintKind;
  gridLockActive: boolean;
  zoneMode: "brush" | "rect";
}

export interface StrokeSession {
  mode: StrokeMode;
  kind: PaintKind;
  /** Anchor = the stroke's first `from` tile. */
  anchorX: number;
  anchorY: number;
  /** Latest `to` tile. */
  lastX: number;
  lastY: number;
  paints: number;
  /** First onPaint had identical screen coords (the gesture TAP path). */
  tapCandidate: boolean;
  /** Deferred first segment (line-freehand only). */
  heldSegment: [number, number, number, number] | null;
}

export type StepDirective =
  | { type: "commit-segments"; segments: Array<[number, number, number, number]> }
  | { type: "preview-path"; tiles: Array<[number, number]> }
  | { type: "preview-rect"; x0: number; y0: number; x1: number; y1: number }
  | { type: "hold" };

export type EndDirective =
  | { type: "dismiss-line" }
  | { type: "commit-path"; tiles: Array<[number, number]> }
  | { type: "commit-rect"; x0: number; y0: number; x1: number; y1: number }
  | { type: "none" };

export function chooseMode(ctx: StrokeContext): StrokeMode {
  if (ctx.kind === "zone") {
    return ctx.zoneMode === "rect" ? "rect" : "zone-brush";
  }
  if (ctx.gridLockActive) return "lpath";
  return ctx.kind === "road" ? "freehand" : "line-freehand";
}

/** Advance the session by one onPaint(from→to) call (tile coords). */
export function strokeStep(
  session: StrokeSession | null,
  ctx: StrokeContext,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  screenStationary: boolean,
): { session: StrokeSession; directive: StepDirective } {
  const s: StrokeSession = session ?? {
    mode: chooseMode(ctx),
    kind: ctx.kind,
    anchorX: fromX,
    anchorY: fromY,
    lastX: toX,
    lastY: toY,
    paints: 0,
    tapCandidate: screenStationary,
    heldSegment: null,
  };
  s.paints++;
  s.lastX = toX;
  s.lastY = toY;

  switch (s.mode) {
    case "lpath":
      return {
        session: s,
        directive: {
          type: "preview-path",
          tiles: tileLinePathL(s.anchorX, s.anchorY, toX, toY),
        },
      };
    case "rect":
      return {
        session: s,
        directive: {
          type: "preview-rect",
          x0: s.anchorX,
          y0: s.anchorY,
          x1: toX,
          y1: toY,
        },
      };
    case "line-freehand": {
      if (s.paints === 1 && s.tapCandidate) {
        // Might be a dismissal tap — don't paint yet.
        s.heldSegment = [fromX, fromY, toX, toY];
        return { session: s, directive: { type: "hold" } };
      }
      const segments: Array<[number, number, number, number]> = [];
      if (s.heldSegment) {
        segments.push(s.heldSegment);
        s.heldSegment = null;
      }
      segments.push([fromX, fromY, toX, toY]);
      return { session: s, directive: { type: "commit-segments", segments } };
    }
    default:
      return {
        session: s,
        directive: {
          type: "commit-segments",
          segments: [[fromX, fromY, toX, toY]],
        },
      };
  }
}

/** Resolve the stroke on pointer-up. */
export function strokeEnd(session: StrokeSession | null): EndDirective {
  if (!session) return { type: "none" };
  const isLineTool = session.kind === "rail" || session.kind === "subway";
  if (isLineTool && session.paints === 1 && session.tapCandidate) {
    return { type: "dismiss-line" };
  }
  if (session.mode === "lpath") {
    return {
      type: "commit-path",
      tiles: tileLinePathL(
        session.anchorX,
        session.anchorY,
        session.lastX,
        session.lastY,
      ),
    };
  }
  if (session.mode === "rect") {
    return {
      type: "commit-rect",
      x0: session.anchorX,
      y0: session.anchorY,
      x1: session.lastX,
      y1: session.lastY,
    };
  }
  return { type: "none" };
}
