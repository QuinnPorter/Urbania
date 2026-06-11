import type { City } from "../model/city";
import { placeNetTile, type NetworkPolicy } from "../model/network";
import { NO_OCCUPANT, ZONE_NONE } from "../model/types";
import { tileLineConnected } from "../model/grid";

/** Roads block on buildings and clear any zone paint underneath. */
export const ROAD_POLICY: NetworkPolicy = {
  blockOn: (city, idx) => city.occupant[idx] !== NO_OCCUPANT,
  onPlace: (city, idx) => {
    city.zone[idx] = ZONE_NONE;
  },
};

/** Place road on one tile. Returns true if the model changed. */
export function placeRoadTile(city: City, x: number, y: number): boolean {
  return placeNetTile(city, city.road, city.roadMask, x, y, 1, ROAD_POLICY);
}

/** Place road on every tile of a path; notifies once if anything changed. */
export function paintRoadPath(
  city: City,
  tiles: ReadonlyArray<readonly [number, number]>,
): boolean {
  let changed = false;
  for (const [x, y] of tiles) {
    if (placeRoadTile(city, x, y)) changed = true;
  }
  if (changed) city.notifyChanged();
  return changed;
}

/**
 * Paint road along a stroke segment, using a 4-connected path so corners
 * connect properly. Notifies once if anything changed.
 */
export function paintRoadStroke(
  city: City,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  return paintRoadPath(city, tileLineConnected(x0, y0, x1, y1));
}
