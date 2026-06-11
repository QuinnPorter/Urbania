import { describe, expect, it } from "vitest";
import { tileLineConnected, tileLine } from "../src/core/model/grid";
import { City } from "../src/core/model/city";
import { paintRoadStroke } from "../src/core/actions/paintRoad";

/** True if every consecutive pair is orthogonally adjacent (4-connected). */
function isFourConnected(tiles: Array<[number, number]>): boolean {
  for (let i = 1; i < tiles.length; i++) {
    const [px, py] = tiles[i - 1]!;
    const [x, y] = tiles[i]!;
    if (Math.abs(x - px) + Math.abs(y - py) !== 1) return false;
  }
  return true;
}

describe("tileLineConnected (cornering fix)", () => {
  it("a pure diagonal is 4-connected (no diagonal-only steps)", () => {
    const tiles = tileLineConnected(0, 0, 5, 5);
    expect(isFourConnected(tiles)).toBe(true);
    // Bresenham would have produced diagonal steps — confirm we differ.
    expect(tileLine(0, 0, 5, 5).length).toBeLessThan(tiles.length);
  });

  it("includes both endpoints", () => {
    const tiles = tileLineConnected(2, 7, 9, 3);
    expect(tiles[0]).toEqual([2, 7]);
    expect(tiles[tiles.length - 1]).toEqual([9, 3]);
    expect(isFourConnected(tiles)).toBe(true);
  });

  it("a straight horizontal line matches a simple range", () => {
    const tiles = tileLineConnected(3, 5, 6, 5);
    expect(tiles).toEqual([
      [3, 5],
      [4, 5],
      [5, 5],
      [6, 5],
    ]);
  });

  it("a single tile yields just that tile", () => {
    expect(tileLineConnected(4, 4, 4, 4)).toEqual([[4, 4]]);
  });

  it("works in every diagonal direction", () => {
    for (const [x1, y1] of [
      [10, 14],
      [10, 0],
      [0, 14],
      [0, 0],
    ] as const) {
      expect(isFourConnected(tileLineConnected(5, 7, x1, y1))).toBe(true);
    }
  });
});

describe("painting a diagonal drag connects (no dotted gaps)", () => {
  it("every road tile on a diagonal stroke has a non-isolated mask", () => {
    const city = new City("T", 32, 32);
    paintRoadStroke(city, 4, 4, 12, 12); // diagonal drag

    let roadTiles = 0;
    let isolated = 0;
    for (let i = 0; i < city.road.length; i++) {
      if (city.road[i] === 1) {
        roadTiles++;
        if (city.roadMask[i] === 0) isolated++;
      }
    }
    expect(roadTiles).toBeGreaterThan(8);
    // Only the two endpoints may be dead-ends; none should be isolated dots.
    expect(isolated).toBe(0);
  });
});
