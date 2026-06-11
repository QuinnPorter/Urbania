export type CategoryId =
  | "infrastructure"
  | "zones"
  | "transit"
  | "eduhealth"
  | "culture"
  | "services"
  | "government";

export type CoverageLayer = "education" | "health" | "transit" | "safety";

export type IconId =
  | "cross"
  | "book"
  | "grad-cap"
  | "tree"
  | "ball"
  | "mask"
  | "shield"
  | "flame"
  | "bus"
  | "train"
  | "subway"
  | "fountain"
  | "column"
  | "scales"
  | "dome"
  | "letter"
  | "bars"
  | "blocks"
  | "pill"
  | "heart"
  | "bed"
  | "tram"
  | "plane"
  | "film"
  | "recycle";

export interface ItemArt {
  /** Main fill color, 0xRRGGBB pastel. */
  base: number;
  /** Roof / stripe accent. */
  accent?: number;
  icon?: IconId;
  shape: "roundedRect" | "circle";
}

export interface ItemEffects {
  coverage?: { layer: CoverageLayer; radius: number };
  /** e.g. park +2 r4, industrial -2 r3. */
  happiness?: { radius: number; delta: number };
  /** Zones only. */
  populationPerTile?: number;
  jobsPerTile?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  category: CategoryId;
  /** building = placed sprite; road/rail/subway/zone = painted networks/areas. */
  kind: "building" | "road" | "rail" | "subway" | "zone";
  footprint: { w: number; h: number };
  /** Only meaningful when w !== h. */
  rotatable: boolean;
  requiresRoadAdjacency: boolean;
  art: ItemArt;
  effects: ItemEffects;
}

export interface CategoryDef {
  id: CategoryId;
  name: string;
  /** Emoji used on the toolbar button. */
  emoji: string;
}
