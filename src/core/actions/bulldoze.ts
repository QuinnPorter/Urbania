import type { City } from "../model/city";
import { getItem } from "../catalog/items";
import { refreshRoadMasks } from "../roads/autotile";
import { refreshMasks } from "../model/network";
import { NO_OCCUPANT, ZONE_NONE } from "../model/types";
import { rotatedFootprint } from "./placeBuilding";
import { tileLine } from "../model/grid";

/**
 * Remove the topmost thing on one tile. Precedence:
 * building → road → rail → subway → zone. A road/rail level crossing loses
 * the road first, leaving the track.
 */
export function bulldozeTile(city: City, x: number, y: number): boolean {
  if (!city.contains(x, y)) return false;
  const idx = city.index(x, y);

  const buildingIndex = city.occupant[idx]!;
  if (buildingIndex !== NO_OCCUPANT) {
    const building = city.buildings[buildingIndex];
    if (building) {
      const def = getItem(building.defId);
      const { w, h } = def
        ? rotatedFootprint(def, building.rot)
        : { w: 1, h: 1 };
      for (let ty = building.y; ty < building.y + h; ty++) {
        for (let tx = building.x; tx < building.x + w; tx++) {
          city.occupant[city.index(tx, ty)] = NO_OCCUPANT;
        }
      }
      city.buildings[buildingIndex] = null;
    } else {
      city.occupant[idx] = NO_OCCUPANT;
    }
    return true;
  }

  if (city.road[idx] === 1) {
    city.road[idx] = 0;
    refreshRoadMasks(city, x, y);
    return true;
  }

  if (city.rail[idx] !== 0) {
    city.rail[idx] = 0;
    refreshMasks(city, city.rail, city.railMask, x, y);
    return true;
  }

  if (city.subway[idx] !== 0) {
    city.subway[idx] = 0;
    refreshMasks(city, city.subway, city.subwayMask, x, y);
    return true;
  }

  if (city.zone[idx] !== ZONE_NONE) {
    city.zone[idx] = ZONE_NONE;
    return true;
  }
  return false;
}

export function bulldozeStroke(
  city: City,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  let changed = false;
  for (const [x, y] of tileLine(x0, y0, x1, y1)) {
    if (bulldozeTile(city, x, y)) changed = true;
  }
  if (changed) city.notifyChanged();
  return changed;
}
