import type { City } from "../model/city";
import { nextFreeId } from "../model/city";
import {
  placeNetTile,
  recomputeAllMasks,
  type NetworkPolicy,
} from "../model/network";
import { tileLineConnected } from "../model/grid";
import {
  NO_OCCUPANT,
  ZONE_NONE,
  type LineKind,
  type TransitLine,
} from "../model/types";

/** Rail is surface: blocks on buildings, clears zone. Coexists with road (separate array). */
const RAIL_POLICY: NetworkPolicy = {
  blockOn: (city, idx) => city.occupant[idx] !== NO_OCCUPANT,
  onPlace: (city, idx) => {
    city.zone[idx] = ZONE_NONE;
  },
};

/** Subway is underground: never blocks, disturbs nothing on the surface. */
const SUBWAY_POLICY: NetworkPolicy = {
  blockOn: () => false,
};

interface LineLayer {
  cells: Uint8Array;
  mask: Uint8Array;
  registry: Map<number, TransitLine>;
  policy: NetworkPolicy;
}

function layerFor(city: City, kind: LineKind): LineLayer {
  return kind === "rail"
    ? {
        cells: city.rail,
        mask: city.railMask,
        registry: city.railLines,
        policy: RAIL_POLICY,
      }
    : {
        cells: city.subway,
        mask: city.subwayMask,
        registry: city.subwayLines,
        policy: SUBWAY_POLICY,
      };
}

/** Create a new named line; returns it, or null if the 255-line cap is hit. */
export function createLine(
  city: City,
  kind: LineKind,
  name: string,
  hue: number,
): TransitLine | null {
  const { registry } = layerFor(city, kind);
  const id = nextFreeId(registry);
  if (id === null) return null;
  const line: TransitLine = { id, name: name.trim() || "New Line", hue };
  registry.set(id, line);
  city.notifyChanged();
  return line;
}

export function renameLine(
  city: City,
  kind: LineKind,
  id: number,
  name: string,
): boolean {
  const line = layerFor(city, kind).registry.get(id);
  if (!line) return false;
  line.name = name.trim() || line.name;
  city.notifyChanged();
  return true;
}

/** Remove a line and clear all its painted tiles. */
export function dissolveLine(city: City, kind: LineKind, id: number): boolean {
  const { cells, mask, registry } = layerFor(city, kind);
  if (!registry.delete(id)) return false;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === id) cells[i] = 0;
  }
  recomputeAllMasks(city, cells, mask);
  city.notifyChanged();
  return true;
}

/**
 * Paint a line along a stroke (4-connected so corners connect like a road).
 * Painting over a different line on the same network overwrites it (last wins).
 */
export function paintLineStroke(
  city: City,
  kind: LineKind,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  lineId: number,
): boolean {
  const { cells, mask, policy } = layerFor(city, kind);
  let changed = false;
  for (const [x, y] of tileLineConnected(x0, y0, x1, y1)) {
    if (placeNetTile(city, cells, mask, x, y, lineId, policy)) changed = true;
  }
  if (changed) city.notifyChanged();
  return changed;
}
