/** Index into the flat tile arrays: y * width + x. */
export type TileIndex = number;

export const ZONE_NONE = 0;
export const ZONE_RESIDENTIAL = 1;
export const ZONE_COMMERCIAL = 2;
export const ZONE_INDUSTRIAL = 3;
export type ZoneId =
  | typeof ZONE_NONE
  | typeof ZONE_RESIDENTIAL
  | typeof ZONE_COMMERCIAL
  | typeof ZONE_INDUSTRIAL;

export type Rotation = 0 | 1 | 2 | 3;

export interface Building {
  defId: string;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  rot: Rotation;
}

export interface Neighbourhood {
  id: number; // 1..255
  name: string;
  hue: number; // 0..359
}

/** A named, colored transit line (train or subway). */
export interface TransitLine {
  id: number; // 1..255
  name: string;
  hue: number; // 0..359
}

export type LineKind = "rail" | "subway";

export const NO_OCCUPANT = -1;
