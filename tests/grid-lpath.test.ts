import { describe, expect, it } from "vitest";
import { tileLinePathL } from "../src/core/model/grid";

function directionChanges(tiles: Array<[number, number]>): number {
  let changes = 0;
  let prevDir: string | null = null;
  for (let i = 1; i < tiles.length; i++) {
    const dir = `${tiles[i]![0] - tiles[i - 1]![0]},${tiles[i]![1] - tiles[i - 1]![1]}`;
    if (prevDir !== null && dir !== prevDir) changes++;
    prevDir = dir;
  }
  return changes;
}

function isFourConnected(tiles: Array<[number, number]>): boolean {
  for (let i = 1; i < tiles.length; i++) {
    const [px, py] = tiles[i - 1]!;
    const [x, y] = tiles[i]!;
    if (Math.abs(x - px) + Math.abs(y - py) !== 1) return false;
  }
  return true;
}

describe("tileLinePathL (Grid Lock routing)", () => {
  it("includes both endpoints and is 4-connected", () => {
    const tiles = tileLinePathL(2, 7, 9, 3);
    expect(tiles[0]).toEqual([2, 7]);
    expect(tiles[tiles.length - 1]).toEqual([9, 3]);
    expect(isFourConnected(tiles)).toBe(true);
    expect(tiles).toHaveLength(7 + 4 + 1); // |dx| + |dy| + 1
  });

  it("has at most one corner", () => {
    expect(directionChanges(tileLinePathL(0, 0, 5, 2))).toBe(1);
    expect(directionChanges(tileLinePathL(0, 0, 8, 0))).toBe(0); // pure straight
    expect(directionChanges(tileLinePathL(0, 0, 0, 6))).toBe(0);
  });

  it("walks the dominant axis first", () => {
    // |dx|=5 > |dy|=2 → x-run at y0; (5,0) must be on the path.
    const tiles = tileLinePathL(0, 0, 5, 2);
    expect(tiles).toContainEqual([5, 0]);
    expect(tiles).not.toContainEqual([0, 2]);
    // |dy| dominant → y-run at x0 first.
    const tall = tileLinePathL(0, 0, 2, 5);
    expect(tall).toContainEqual([0, 5]);
  });

  it("ties go horizontal first (stable previews)", () => {
    const tiles = tileLinePathL(0, 0, 3, 3);
    expect(tiles).toContainEqual([3, 0]);
  });

  it("zero length yields a single tile", () => {
    expect(tileLinePathL(4, 4, 4, 4)).toEqual([[4, 4]]);
  });

  it("works in negative directions", () => {
    const tiles = tileLinePathL(9, 8, 3, 2);
    expect(tiles[0]).toEqual([9, 8]);
    expect(tiles[tiles.length - 1]).toEqual([3, 2]);
    expect(isFourConnected(tiles)).toBe(true);
    expect(directionChanges(tiles)).toBeLessThanOrEqual(1);
  });
});
