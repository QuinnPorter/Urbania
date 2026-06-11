import type { City } from "../model/city";
import { NO_OCCUPANT, type ZoneId } from "../model/types";
import { tileLine } from "../model/grid";

/** Zones can only be painted on empty tiles (no road, no building). */
export function paintZoneTile(
  city: City,
  x: number,
  y: number,
  zone: ZoneId,
): boolean {
  if (!city.contains(x, y)) return false;
  const idx = city.index(x, y);
  if (city.road[idx] === 1 || city.occupant[idx] !== NO_OCCUPANT) return false;
  if (city.zone[idx] === zone) return false;
  city.zone[idx] = zone;
  return true;
}

export function paintZoneStroke(
  city: City,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zone: ZoneId,
): boolean {
  let changed = false;
  for (const [x, y] of tileLine(x0, y0, x1, y1)) {
    if (paintZoneTile(city, x, y, zone)) changed = true;
  }
  if (changed) city.notifyChanged();
  return changed;
}
