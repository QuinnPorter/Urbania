import { tileIndex, inBounds } from "./grid";
import {
  NO_OCCUPANT,
  type Building,
  type Neighbourhood,
  type TileIndex,
  type TransitLine,
} from "./types";

export type CityListener = () => void;

/**
 * The whole city model. Dense typed-array layers indexed y * width + x.
 * Plain mutable TS — never reactive. All mutations go through core/actions/*,
 * which call notifyChanged() exactly once per user action.
 */
export class City {
  name: string;
  readonly width: number;
  readonly height: number;

  /** 0 = none, 1 = road. */
  readonly road: Uint8Array;
  /** Cached 4-bit autotile mask (N=1 E=2 S=4 W=8) for road tiles. */
  readonly roadMask: Uint8Array;
  /** 0 none, 1 residential, 2 commercial, 3 industrial. */
  readonly zone: Uint8Array;
  /** NO_OCCUPANT or index into buildings[]; set for every footprint tile. */
  readonly occupant: Int32Array;
  /** 0 none, 1..255 neighbourhood id. */
  readonly neighbourhood: Uint8Array;
  /** 0 none, else train-line id; value is the line, mask handles autotiling. */
  readonly rail: Uint8Array;
  readonly railMask: Uint8Array;
  /** 0 none, else subway-line id (underground network). */
  readonly subway: Uint8Array;
  readonly subwayMask: Uint8Array;

  /** Sparse list; bulldozed entries become null so occupant indices stay stable. */
  readonly buildings: Array<Building | null> = [];
  readonly neighbourhoods = new Map<number, Neighbourhood>();
  /** Named train lines, keyed by id 1..255. */
  readonly railLines = new Map<number, TransitLine>();
  /** Named subway lines, keyed by id 1..255 (independent namespace). */
  readonly subwayLines = new Map<number, TransitLine>();

  private listeners = new Set<CityListener>();

  constructor(name: string, width: number, height: number) {
    this.name = name;
    this.width = width;
    this.height = height;
    const n = width * height;
    this.road = new Uint8Array(n);
    this.roadMask = new Uint8Array(n);
    this.zone = new Uint8Array(n);
    this.occupant = new Int32Array(n).fill(NO_OCCUPANT);
    this.neighbourhood = new Uint8Array(n);
    this.rail = new Uint8Array(n);
    this.railMask = new Uint8Array(n);
    this.subway = new Uint8Array(n);
    this.subwayMask = new Uint8Array(n);
  }

  index(x: number, y: number): TileIndex {
    return tileIndex(x, y, this.width);
  }

  contains(x: number, y: number): boolean {
    return inBounds(x, y, this.width, this.height);
  }

  hasRoad(x: number, y: number): boolean {
    return this.contains(x, y) && this.road[this.index(x, y)] === 1;
  }

  hasRail(x: number, y: number): boolean {
    return this.contains(x, y) && this.rail[this.index(x, y)] !== 0;
  }

  hasSubway(x: number, y: number): boolean {
    return this.contains(x, y) && this.subway[this.index(x, y)] !== 0;
  }

  buildingAt(x: number, y: number): Building | null {
    if (!this.contains(x, y)) return null;
    const idx = this.occupant[this.index(x, y)]!;
    return idx === NO_OCCUPANT ? null : (this.buildings[idx] ?? null);
  }

  onChanged(listener: CityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called by action functions after a successful mutation. */
  notifyChanged(): void {
    for (const l of this.listeners) l();
  }

  nextNeighbourhoodId(): number | null {
    return nextFreeId(this.neighbourhoods);
  }
}

/** Lowest free id 1..255 in a registry, or null when full. */
export function nextFreeId(map: Map<number, unknown>): number | null {
  for (let id = 1; id <= 255; id++) {
    if (!map.has(id)) return id;
  }
  return null;
}

export const DEFAULT_CITY_SIZE = 64;
export const MAX_CITY_SIZE = 128;
export const CITY_SIZES = [48, 64, 96, 128] as const;
