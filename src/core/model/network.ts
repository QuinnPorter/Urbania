import type { City } from "./city";

/** Connectivity bits: N=1, E=2, S=4, W=8 → mask 0..15. */
export const BIT_N = 1;
export const BIT_E = 2;
export const BIT_S = 4;
export const BIT_W = 8;

/**
 * Policy controlling whether a tile can take a network value and what happens
 * when it does. Lets road/rail/subway share one placement routine while
 * keeping their differences (road blocks on buildings + clears zone; subway is
 * underground and disturbs nothing).
 */
export interface NetworkPolicy {
  /** Return true to refuse placement on this tile index. */
  blockOn(city: City, idx: number): boolean;
  /** Side effects on successful placement (e.g. clear zone). */
  onPlace?(city: City, idx: number): void;
}

/**
 * 4-bit connectivity mask for a network cell. Connection is presence-based:
 * a tile connects to any non-empty orthogonal neighbour — exactly like roads.
 * (Road cells are always 1, so this reduces to the original road behaviour.)
 * Returns 0 for an empty cell.
 */
export function computeMask(
  city: City,
  cells: Uint8Array,
  x: number,
  y: number,
): number {
  const idx = city.index(x, y);
  if (cells[idx] === 0) return 0;
  let mask = 0;
  if (present(city, cells, x, y - 1)) mask |= BIT_N;
  if (present(city, cells, x + 1, y)) mask |= BIT_E;
  if (present(city, cells, x, y + 1)) mask |= BIT_S;
  if (present(city, cells, x - 1, y)) mask |= BIT_W;
  return mask;
}

function present(
  city: City,
  cells: Uint8Array,
  x: number,
  y: number,
): boolean {
  return city.contains(x, y) && cells[city.index(x, y)] !== 0;
}

/**
 * Refresh the cached mask for (x, y) and its 4 orthogonal neighbours after a
 * cell changed. Returns the affected tile indices.
 */
export function refreshMasks(
  city: City,
  cells: Uint8Array,
  maskLayer: Uint8Array,
  x: number,
  y: number,
): number[] {
  const affected: number[] = [];
  const coords: Array<[number, number]> = [
    [x, y],
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ];
  for (const [cx, cy] of coords) {
    if (!city.contains(cx, cy)) continue;
    const idx = city.index(cx, cy);
    maskLayer[idx] = cells[idx] !== 0 ? computeMask(city, cells, cx, cy) : 0;
    affected.push(idx);
  }
  return affected;
}

/** Recompute every mask in a layer — used after loading/importing a city. */
export function recomputeAllMasks(
  city: City,
  cells: Uint8Array,
  maskLayer: Uint8Array,
): void {
  for (let y = 0; y < city.height; y++) {
    for (let x = 0; x < city.width; x++) {
      const idx = city.index(x, y);
      maskLayer[idx] = cells[idx] !== 0 ? computeMask(city, cells, x, y) : 0;
    }
  }
}

/**
 * Place a network value on one tile, honouring the policy. Returns true if the
 * model changed (caller refreshes masks / notifies).
 */
export function placeNetTile(
  city: City,
  cells: Uint8Array,
  maskLayer: Uint8Array,
  x: number,
  y: number,
  value: number,
  policy: NetworkPolicy,
): boolean {
  if (!city.contains(x, y)) return false;
  const idx = city.index(x, y);
  if (cells[idx] === value) return false;
  if (policy.blockOn(city, idx)) return false;
  cells[idx] = value;
  policy.onPlace?.(city, idx);
  refreshMasks(city, cells, maskLayer, x, y);
  return true;
}
