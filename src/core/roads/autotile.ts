import type { City } from "../model/city";
import { computeMask, refreshMasks } from "../model/network";

// Re-export the bit constants from the generic network layer so existing
// imports (tests, render) keep working.
export { BIT_N, BIT_E, BIT_S, BIT_W } from "../model/network";

/** Compute the 4-bit connectivity mask for a road tile. Map edge = unconnected. */
export function computeRoadMask(city: City, x: number, y: number): number {
  return computeMask(city, city.road, x, y);
}

/**
 * Refresh the cached mask for (x, y) and its 4 orthogonal neighbours.
 * Call after placing or removing a road at (x, y). Returns affected indices.
 */
export function refreshRoadMasks(city: City, x: number, y: number): number[] {
  return refreshMasks(city, city.road, city.roadMask, x, y);
}
