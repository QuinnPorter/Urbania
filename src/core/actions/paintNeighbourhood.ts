import type { City } from "../model/city";
import { tileLine } from "../model/grid";

/** Paint tiles into a neighbourhood (id 1..255), or 0 to erase. */
export function paintNeighbourhoodStroke(
  city: City,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  id: number,
  /** Brush radius in tiles (Chebyshev); 1 = 3x3 brush. */
  brushRadius = 1,
): boolean {
  let changed = false;
  for (const [cx, cy] of tileLine(x0, y0, x1, y1)) {
    for (let dy = -brushRadius; dy <= brushRadius; dy++) {
      for (let dx = -brushRadius; dx <= brushRadius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (!city.contains(x, y)) continue;
        const idx = city.index(x, y);
        if (city.neighbourhood[idx] !== id) {
          city.neighbourhood[idx] = id;
          changed = true;
        }
      }
    }
  }
  if (changed) city.notifyChanged();
  return changed;
}

export function createNeighbourhood(
  city: City,
  name: string,
  hue: number,
): number | null {
  const id = city.nextNeighbourhoodId();
  if (id === null) return null;
  city.neighbourhoods.set(id, { id, name, hue });
  city.notifyChanged();
  return id;
}

export function renameNeighbourhood(
  city: City,
  id: number,
  name: string,
): boolean {
  const n = city.neighbourhoods.get(id);
  if (!n) return false;
  n.name = name;
  city.notifyChanged();
  return true;
}

/** Remove the neighbourhood and clear its painted tiles. */
export function dissolveNeighbourhood(city: City, id: number): boolean {
  if (!city.neighbourhoods.delete(id)) return false;
  for (let i = 0; i < city.neighbourhood.length; i++) {
    if (city.neighbourhood[i] === id) city.neighbourhood[i] = 0;
  }
  city.notifyChanged();
  return true;
}
