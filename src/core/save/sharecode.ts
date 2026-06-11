import { deflateSync, inflateSync } from "fflate";
import { City } from "../model/city";
import { getItem } from "../catalog/items";
import { recomputeAllMasks } from "../model/network";
import { NO_OCCUPANT, type Rotation, type TransitLine } from "../model/types";
import { rotatedFootprint } from "../actions/placeBuilding";
import { BinaryReader, BinaryWriter } from "./binary";

// The URB1. prefix is a permanent magic marker — it must NOT change across
// format versions, or existing shared links break. Versioning is the leading
// byte of the payload instead.
const PREFIX = "URB1.";
const FORMAT_VERSION = 2;

/** Encode a city as a compact shareable code: URB1.<base64url(deflate(binary))>. */
export function encodeShareCode(city: City): string {
  const w = new BinaryWriter();
  w.u8(FORMAT_VERSION);
  w.string(city.name);
  w.u8(city.width);
  w.u8(city.height);

  writeLines(w, city.neighbourhoods);
  writeLines(w, city.railLines);
  writeLines(w, city.subwayLines);

  writeRLE(w, city.road);
  writeRLE(w, city.zone);
  writeRLE(w, city.neighbourhood);
  writeRLE(w, city.rail);
  writeRLE(w, city.subway);

  // String table of defIds, then buildings referencing it by index.
  const live = city.buildings.filter((b) => b !== null);
  const defIds = [...new Set(live.map((b) => b.defId))];
  w.varint(defIds.length);
  for (const id of defIds) w.string(id);
  const defIndex = new Map(defIds.map((id, i) => [id, i]));
  w.varint(live.length);
  for (const b of live) {
    w.varint(defIndex.get(b.defId)!);
    w.varint(b.x);
    w.varint(b.y);
    w.u8(b.rot);
  }

  const compressed = deflateSync(w.bytes(), { level: 9 });
  return PREFIX + base64UrlEncode(compressed);
}

export function decodeShareCode(code: string): City {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error("Not an Urbania share code (should start with URB1.)");
  }
  let payload: Uint8Array;
  try {
    payload = inflateSync(base64UrlDecode(trimmed.slice(PREFIX.length)));
  } catch {
    throw new Error("Share code is damaged or incomplete");
  }

  const r = new BinaryReader(payload);
  const version = r.u8();
  if (version !== 1 && version !== 2) {
    throw new Error(`Unsupported share code version (${version})`);
  }
  const name = r.string();
  const width = r.u8();
  const height = r.u8();
  if (width < 8 || height < 8 || width > 128 || height > 128) {
    throw new Error("Share code has an invalid city size");
  }
  const city = new City(name || "Imported City", width, height);

  readLines(r, city.neighbourhoods);
  if (version >= 2) {
    readLines(r, city.railLines);
    readLines(r, city.subwayLines);
  }

  readRLE(r, city.road);
  readRLE(r, city.zone);
  readRLE(r, city.neighbourhood);
  if (version >= 2) {
    readRLE(r, city.rail);
    readRLE(r, city.subway);
  }

  const defCount = r.varint();
  const defIds: string[] = [];
  for (let i = 0; i < defCount; i++) defIds.push(r.string());
  const buildingCount = r.varint();
  for (let i = 0; i < buildingCount; i++) {
    const defId = defIds[r.varint()];
    const x = r.varint();
    const y = r.varint();
    const rot = (r.u8() % 4) as Rotation;
    if (defId === undefined) throw new Error("Share code is damaged");
    const def = getItem(defId);
    if (!def) {
      console.warn(`Share code references unknown item "${defId}" — dropped.`);
      continue;
    }
    const fp = rotatedFootprint(def, rot);
    if (x + fp.w > width || y + fp.h > height) continue;
    const index = city.buildings.length;
    city.buildings.push({ defId, x, y, rot });
    for (let ty = y; ty < y + fp.h; ty++) {
      for (let tx = x; tx < x + fp.w; tx++) {
        const idx = city.index(tx, ty);
        if (city.occupant[idx] === NO_OCCUPANT) city.occupant[idx] = index;
      }
    }
  }

  recomputeAllMasks(city, city.road, city.roadMask);
  recomputeAllMasks(city, city.rail, city.railMask);
  recomputeAllMasks(city, city.subway, city.subwayMask);
  return city;
}

/** Write a line/neighbourhood registry: count, then id + hue + name each. */
function writeLines(
  w: BinaryWriter,
  registry: Map<number, { id: number; name: string; hue: number }>,
): void {
  w.u8(registry.size);
  for (const line of registry.values()) {
    w.u8(line.id);
    w.varint(line.hue);
    w.string(line.name);
  }
}

function readLines(r: BinaryReader, target: Map<number, TransitLine>): void {
  const count = r.u8();
  for (let i = 0; i < count; i++) {
    const id = r.u8();
    const hue = r.varint();
    const name = r.string();
    if (id >= 1 && id <= 255) target.set(id, { id, name, hue });
  }
}

function writeRLE(w: BinaryWriter, arr: Uint8Array): void {
  let i = 0;
  while (i < arr.length) {
    const value = arr[i]!;
    let run = 1;
    while (i + run < arr.length && arr[i + run] === value) run++;
    w.u8(value);
    w.varint(run);
    i += run;
  }
}

function readRLE(r: BinaryReader, target: Uint8Array): void {
  let pos = 0;
  while (pos < target.length) {
    const value = r.u8();
    const run = r.varint();
    if (run <= 0 || pos + run > target.length) {
      throw new Error("Share code is damaged");
    }
    target.fill(value, pos, pos + run);
    pos += run;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
