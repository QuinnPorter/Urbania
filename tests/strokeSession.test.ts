import { describe, expect, it } from "vitest";
import {
  chooseMode,
  strokeEnd,
  strokeStep,
  type StrokeContext,
} from "../src/input/strokeSession";

const railCtx: StrokeContext = {
  kind: "rail",
  gridLockActive: false,
  zoneMode: "brush",
};

describe("chooseMode", () => {
  it("routes kinds to the right modes", () => {
    expect(chooseMode({ kind: "road", gridLockActive: false, zoneMode: "brush" })).toBe("freehand");
    expect(chooseMode({ kind: "road", gridLockActive: true, zoneMode: "brush" })).toBe("lpath");
    expect(chooseMode({ kind: "rail", gridLockActive: false, zoneMode: "brush" })).toBe("line-freehand");
    expect(chooseMode({ kind: "subway", gridLockActive: true, zoneMode: "brush" })).toBe("lpath");
    expect(chooseMode({ kind: "zone", gridLockActive: false, zoneMode: "brush" })).toBe("zone-brush");
    expect(chooseMode({ kind: "zone", gridLockActive: true, zoneMode: "rect" })).toBe("rect");
  });
});

describe("tap-to-dismiss for line tools", () => {
  it("a tap (single stationary paint) dismisses without committing", () => {
    const { session, directive } = strokeStep(null, railCtx, 5, 5, 5, 5, true);
    expect(directive.type).toBe("hold"); // segment deferred, nothing painted
    expect(strokeEnd(session)).toEqual({ type: "dismiss-line" });
  });

  it("a drag flushes the held segment and does not dismiss", () => {
    // Drags start with differing screen coords → not a tap candidate.
    const step1 = strokeStep(null, railCtx, 5, 5, 6, 5, false);
    expect(step1.directive.type).toBe("commit-segments");
    const step2 = strokeStep(step1.session, railCtx, 6, 5, 7, 5, false);
    expect(step2.directive.type).toBe("commit-segments");
    expect(strokeEnd(step2.session)).toEqual({ type: "none" });
  });

  it("a tap with grid lock on a line tool still dismisses", () => {
    const ctx: StrokeContext = { ...railCtx, gridLockActive: true };
    const { session } = strokeStep(null, ctx, 5, 5, 5, 5, true);
    expect(strokeEnd(session)).toEqual({ type: "dismiss-line" });
  });

  it("a road tap with grid lock commits a single tile", () => {
    const ctx: StrokeContext = { kind: "road", gridLockActive: true, zoneMode: "brush" };
    const { session } = strokeStep(null, ctx, 5, 5, 5, 5, true);
    const end = strokeEnd(session);
    expect(end.type).toBe("commit-path");
    if (end.type === "commit-path") expect(end.tiles).toEqual([[5, 5]]);
  });
});

describe("lpath and rect sessions", () => {
  it("lpath previews then commits the anchored L path", () => {
    const ctx: StrokeContext = { kind: "road", gridLockActive: true, zoneMode: "brush" };
    const step1 = strokeStep(null, ctx, 2, 2, 5, 2, false);
    expect(step1.directive.type).toBe("preview-path");
    const step2 = strokeStep(step1.session, ctx, 5, 2, 8, 6, false);
    expect(step2.directive.type).toBe("preview-path");
    const end = strokeEnd(step2.session);
    expect(end.type).toBe("commit-path");
    if (end.type === "commit-path") {
      expect(end.tiles[0]).toEqual([2, 2]); // anchored at stroke start
      expect(end.tiles[end.tiles.length - 1]).toEqual([8, 6]);
    }
  });

  it("rect previews then commits anchor → last", () => {
    const ctx: StrokeContext = { kind: "zone", gridLockActive: false, zoneMode: "rect" };
    const step1 = strokeStep(null, ctx, 3, 3, 4, 4, false);
    expect(step1.directive.type).toBe("preview-rect");
    const step2 = strokeStep(step1.session, ctx, 4, 4, 9, 7, false);
    const end = strokeEnd(step2.session);
    expect(end).toEqual({ type: "commit-rect", x0: 3, y0: 3, x1: 9, y1: 7 });
  });

  it("mode is frozen at stroke start even if options change mid-drag", () => {
    const lockOn: StrokeContext = { kind: "road", gridLockActive: true, zoneMode: "brush" };
    const lockOff: StrokeContext = { kind: "road", gridLockActive: false, zoneMode: "brush" };
    const step1 = strokeStep(null, lockOn, 2, 2, 3, 2, false);
    const step2 = strokeStep(step1.session, lockOff, 3, 2, 6, 2, false);
    expect(step2.session.mode).toBe("lpath");
    expect(step2.directive.type).toBe("preview-path");
  });

  it("a null session ends as a no-op", () => {
    expect(strokeEnd(null)).toEqual({ type: "none" });
  });
});
