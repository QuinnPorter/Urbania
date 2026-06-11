import type { TileIndex } from "./types";

export function tileIndex(x: number, y: number, width: number): TileIndex {
  return y * width + x;
}

export function tileX(index: TileIndex, width: number): number {
  return index % width;
}

export function tileY(index: TileIndex, width: number): number {
  return Math.floor(index / width);
}

export function inBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/** Orthogonal neighbour offsets: N, E, S, W (matches autotile bit order). */
export const ORTHO_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Rasterize the line of tiles between two tile coords (inclusive) using
 * Bresenham, so fast paint strokes don't leave gaps.
 */
export function tileLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<[number, number]> {
  const tiles: Array<[number, number]> = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    tiles.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return tiles;
}

/**
 * Rasterize a 4-connected (orthogonal) path between two tile coords. Unlike
 * Bresenham, every consecutive tile is orthogonally adjacent — never just
 * diagonal — so painted networks (roads, rail, subway) actually connect and
 * auto-tile into real corners on diagonal strokes. Uses a supercover-style
 * walk that steps whichever axis is currently behind its ideal progress.
 */
export function tileLineConnected(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<[number, number]> {
  const tiles: Array<[number, number]> = [[x0, y0]];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  // ix/iy count steps taken on each axis; compare (ix+0.5)/dx vs (iy+0.5)/dy
  // via cross-multiplication to decide which axis to advance next.
  let ix = 0;
  let iy = 0;
  while (ix < dx || iy < dy) {
    if (iy >= dy || (ix < dx && (2 * ix + 1) * dy < (2 * iy + 1) * dx)) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    tiles.push([x, y]);
  }
  return tiles;
}
