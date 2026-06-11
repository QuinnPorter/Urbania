import type { City } from "../model/city";
import type { ItemDef } from "../catalog/schema";
import { NO_OCCUPANT, ZONE_NONE, type Rotation } from "../model/types";

/** Footprint size with rotation applied (odd rotations swap w/h). */
export function rotatedFootprint(
  def: ItemDef,
  rot: Rotation,
): { w: number; h: number } {
  const { w, h } = def.footprint;
  return rot % 2 === 1 ? { w: h, h: w } : { w, h };
}

export type PlacementProblem =
  | "out-of-bounds"
  | "occupied"
  | "needs-road";

export function validatePlacement(
  city: City,
  def: ItemDef,
  x: number,
  y: number,
  rot: Rotation,
): PlacementProblem | null {
  const { w, h } = rotatedFootprint(def, rot);
  if (x < 0 || y < 0 || x + w > city.width || y + h > city.height) {
    return "out-of-bounds";
  }
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      const idx = city.index(tx, ty);
      // Buildings can't sit on roads or rail tracks; subway is underground.
      if (
        city.occupant[idx] !== NO_OCCUPANT ||
        city.road[idx] === 1 ||
        city.rail[idx] !== 0
      ) {
        return "occupied";
      }
    }
  }
  if (def.requiresRoadAdjacency && !hasAdjacentRoad(city, x, y, w, h)) {
    return "needs-road";
  }
  return null;
}

function hasAdjacentRoad(
  city: City,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  for (let tx = x; tx < x + w; tx++) {
    if (city.hasRoad(tx, y - 1) || city.hasRoad(tx, y + h)) return true;
  }
  for (let ty = y; ty < y + h; ty++) {
    if (city.hasRoad(x - 1, ty) || city.hasRoad(x + w, ty)) return true;
  }
  return false;
}

/**
 * Place a building. Returns the building index on success, or the problem.
 * Clears any zone paint under the footprint (building wins).
 */
export function placeBuilding(
  city: City,
  def: ItemDef,
  x: number,
  y: number,
  rot: Rotation,
): number | PlacementProblem {
  const problem = validatePlacement(city, def, x, y, rot);
  if (problem) return problem;

  const buildingIndex = city.buildings.length;
  city.buildings.push({ defId: def.id, x, y, rot });
  const { w, h } = rotatedFootprint(def, rot);
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      const idx = city.index(tx, ty);
      city.occupant[idx] = buildingIndex;
      city.zone[idx] = ZONE_NONE;
    }
  }
  city.notifyChanged();
  return buildingIndex;
}
