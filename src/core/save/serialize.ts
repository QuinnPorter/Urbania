import { City } from "../model/city";
import { getItem } from "../catalog/items";
import { recomputeAllMasks } from "../model/network";
import { NO_OCCUPANT, type Rotation } from "../model/types";
import { rotatedFootprint } from "../actions/placeBuilding";

export const SAVE_VERSION = 2;

type LineRecord = { id: number; name: string; hue: number };

export interface SaveV1 {
  v: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  size: { w: number; h: number };
  /** RLE "value:run,value:run,..." */
  road: string;
  zone: string;
  nhood: string;
  buildings: Array<[string, number, number, number]>;
  neighbourhoods: LineRecord[];
  terrain?: string; // reserved for water/bridges
}

export interface SaveV2 extends Omit<SaveV1, "v"> {
  v: 2;
  /** RLE of per-tile line ids. */
  rail: string;
  subway: string;
  railLines: LineRecord[];
  subwayLines: LineRecord[];
}

/** The current save shape. */
export type SaveCurrent = SaveV2;

export function encodeRLE(arr: Uint8Array): string {
  if (arr.length === 0) return "";
  const parts: string[] = [];
  let value = arr[0]!;
  let run = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === value) {
      run++;
    } else {
      parts.push(`${value}:${run}`);
      value = arr[i]!;
      run = 1;
    }
  }
  parts.push(`${value}:${run}`);
  return parts.join(",");
}

export function decodeRLE(rle: string, expectedLength: number): Uint8Array {
  const out = new Uint8Array(expectedLength);
  if (rle === "") return out;
  let pos = 0;
  for (const part of rle.split(",")) {
    const sep = part.indexOf(":");
    const value = Number(part.slice(0, sep));
    const run = Number(part.slice(sep + 1));
    if (
      !Number.isInteger(value) ||
      !Number.isInteger(run) ||
      value < 0 ||
      value > 255 ||
      run <= 0 ||
      pos + run > expectedLength
    ) {
      throw new Error("Corrupt RLE data");
    }
    out.fill(value, pos, pos + run);
    pos += run;
  }
  if (pos !== expectedLength) throw new Error("RLE length mismatch");
  return out;
}

export function serializeCity(
  city: City,
  id: string,
  createdAt: number,
  updatedAt: number,
): SaveCurrent {
  const buildings: Array<[string, number, number, number]> = [];
  for (const b of city.buildings) {
    if (b) buildings.push([b.defId, b.x, b.y, b.rot]);
  }
  return {
    v: 2,
    id,
    name: city.name,
    createdAt,
    updatedAt,
    size: { w: city.width, h: city.height },
    road: encodeRLE(city.road),
    zone: encodeRLE(city.zone),
    nhood: encodeRLE(city.neighbourhood),
    rail: encodeRLE(city.rail),
    subway: encodeRLE(city.subway),
    buildings,
    neighbourhoods: [...city.neighbourhoods.values()].map((n) => ({ ...n })),
    railLines: [...city.railLines.values()].map((l) => ({ ...l })),
    subwayLines: [...city.subwayLines.values()].map((l) => ({ ...l })),
  };
}

/**
 * Rebuild a City from a (current-version) save. Unknown defIds are dropped
 * with a warning, never a crash. Derived state (roadMask, occupant) is
 * recomputed here.
 */
export function deserializeCity(save: SaveCurrent): City {
  const { w, h } = save.size;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 8 || h < 8 || w > 128 || h > 128) {
    throw new Error("Invalid city size");
  }
  const city = new City(save.name, w, h);
  const n = w * h;
  city.road.set(decodeRLE(save.road, n));
  city.zone.set(decodeRLE(save.zone, n));
  city.neighbourhood.set(decodeRLE(save.nhood, n));
  city.rail.set(decodeRLE(save.rail ?? "", n));
  city.subway.set(decodeRLE(save.subway ?? "", n));

  for (const nb of save.neighbourhoods) {
    if (nb.id >= 1 && nb.id <= 255) {
      city.neighbourhoods.set(nb.id, { id: nb.id, name: nb.name, hue: nb.hue });
    }
  }
  registerLines(city.railLines, save.railLines);
  registerLines(city.subwayLines, save.subwayLines);

  for (const [defId, x, y, rot] of save.buildings) {
    const def = getItem(defId);
    if (!def) {
      console.warn(`Save references unknown item "${defId}" — dropped.`);
      continue;
    }
    const r = (rot % 4) as Rotation;
    const fp = rotatedFootprint(def, r);
    if (x < 0 || y < 0 || x + fp.w > w || y + fp.h > h) {
      console.warn(`Building "${defId}" out of bounds — dropped.`);
      continue;
    }
    const index = city.buildings.length;
    city.buildings.push({ defId, x, y, rot: r });
    for (let ty = y; ty < y + fp.h; ty++) {
      for (let tx = x; tx < x + fp.w; tx++) {
        const idx = city.index(tx, ty);
        if (city.occupant[idx] !== NO_OCCUPANT) continue; // overlap: first wins
        city.occupant[idx] = index;
      }
    }
  }

  // Recompute all derived masks for the whole grid.
  recomputeAllMasks(city, city.road, city.roadMask);
  recomputeAllMasks(city, city.rail, city.railMask);
  recomputeAllMasks(city, city.subway, city.subwayMask);
  return city;
}

function registerLines(
  target: Map<number, LineRecord>,
  records: LineRecord[] | undefined,
): void {
  if (!records) return;
  for (const l of records) {
    if (l.id >= 1 && l.id <= 255) {
      target.set(l.id, { id: l.id, name: l.name, hue: l.hue });
    }
  }
}
