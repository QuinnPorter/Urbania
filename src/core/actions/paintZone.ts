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
  return paintZoneBrushStroke(city, x0, y0, x1, y1, zone, 1);
}

/**
 * Paint a zone stroke with a square brush: a size×size stamp centred on every
 * tile of the stroke line. size 1 is the classic single-tile stroke.
 */
export function paintZoneBrushStroke(
  city: City,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zone: ZoneId,
  size: 1 | 3 | 5,
): boolean {
  const half = (size - 1) / 2;
  let changed = false;
  for (const [cx, cy] of tileLine(x0, y0, x1, y1)) {
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        if (paintZoneTile(city, cx + dx, cy + dy, zone)) changed = true;
      }
    }
  }
  if (changed) city.notifyChanged();
  return changed;
}

/**
 * Fill an axis-aligned rectangle (any two opposite corners) with a zone.
 * Clamped to the city bounds; occupied/road tiles are skipped individually.
 */
export function paintZoneRect(
  city: City,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zone: ZoneId,
): boolean {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(city.width - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(city.height - 1, Math.max(y0, y1));
  let changed = false;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (paintZoneTile(city, x, y, zone)) changed = true;
    }
  }
  if (changed) city.notifyChanged();
  return changed;
}
