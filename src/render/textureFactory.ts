import { Graphics, Renderer, Texture } from "pixi.js";
import { ITEMS } from "../core/catalog/items";
import type { IconId, ItemDef } from "../core/catalog/schema";

/** World units per tile; textures are baked at 2x for crispness. */
export const TILE = 32;
const BAKE_SCALE = 2;

export interface TextureAtlas {
  grass: Texture[];
  /** 16 road variants indexed by autotile mask. */
  roads: Texture[];
  /** Per item id. */
  items: Map<string, Texture>;
  /** Zone overlay tints per zone id (1..3). */
  zones: Map<number, Texture>;
  car: Texture;
  citizen: Texture;
  /** 1x1 white rounded cell for overlays (tinted at runtime). */
  cell: Texture;
  /** 16 white rail variants (tinted per line at runtime). */
  rails: Texture[];
  /** 16 white subway variants (tinted per line, drawn translucent). */
  subways: Texture[];
}

/**
 * Bake all procedural art into textures once at startup (and again on WebGL
 * context restore — everything is code, nothing is fetched).
 */
export function buildAtlas(renderer: Renderer): TextureAtlas {
  const bake = (g: Graphics): Texture => {
    const tex = renderer.generateTexture({
      target: g,
      resolution: BAKE_SCALE,
    });
    g.destroy();
    return tex;
  };

  return {
    grass: [bakeGrass(bake, 0x8fd16e), bakeGrass(bake, 0x89cc67)],
    roads: bakeRoadVariants(bake),
    items: bakeItems(bake),
    zones: bakeZones(bake),
    car: bakeCar(bake),
    citizen: bakeCitizen(bake),
    cell: bakeCell(bake),
    rails: bakeLineVariants(bake, "rail"),
    subways: bakeLineVariants(bake, "subway"),
  };
}

type Baker = (g: Graphics) => Texture;

function bakeGrass(bake: Baker, color: number): Texture {
  const g = new Graphics();
  g.rect(0, 0, TILE, TILE).fill(color);
  // Tiny speckles for texture.
  g.circle(TILE * 0.25, TILE * 0.3, 1.2).fill({ color: 0xffffff, alpha: 0.1 });
  g.circle(TILE * 0.7, TILE * 0.65, 1.2).fill({ color: 0x000000, alpha: 0.05 });
  return bake(g);
}

function bakeCell(bake: Baker): Texture {
  const g = new Graphics();
  g.roundRect(1, 1, TILE - 2, TILE - 2, 6).fill(0xffffff);
  return bake(g);
}

function bakeZones(bake: Baker): Map<number, Texture> {
  const colors: Array<[number, number]> = [
    [1, 0x8fd14f], // residential
    [2, 0x5fb8e8], // commercial
    [3, 0xe8b75f], // industrial
  ];
  const map = new Map<number, Texture>();
  for (const [id, color] of colors) {
    const g = new Graphics();
    g.roundRect(1.5, 1.5, TILE - 3, TILE - 3, 5).fill({ color, alpha: 0.55 });
    g.roundRect(1.5, 1.5, TILE - 3, TILE - 3, 5).stroke({
      color,
      width: 2,
      alpha: 0.9,
    });
    map.set(id, bake(g));
  }
  return map;
}

/** Chunky rounded "pill" road segments meeting at a rounded center. */
function bakeRoadVariants(bake: Baker): Texture[] {
  const ROAD = 0x9aa0ab;
  const EDGE = 0x868c99;
  const half = TILE / 2;
  const lane = TILE * 0.62; // road width
  const r = lane / 2;

  const variants: Texture[] = [];
  for (let mask = 0; mask < 16; mask++) {
    const g = new Graphics();
    const arm = (dx: number, dy: number) => {
      // Rectangle from center to the tile edge in direction (dx, dy).
      if (dx === 0) {
        const y0 = dy < 0 ? 0 : half;
        g.rect(half - r, y0, lane, half).fill(ROAD);
      } else {
        const x0 = dx < 0 ? 0 : half;
        g.rect(x0, half - r, half, lane).fill(ROAD);
      }
    };
    // Rounded center pad (also covers the isolated-dot case).
    g.roundRect(half - r, half - r, lane, lane, r * 0.9).fill(ROAD);
    if (mask & 1) arm(0, -1);
    if (mask & 2) arm(1, 0);
    if (mask & 4) arm(0, 1);
    if (mask & 8) arm(-1, 0);

    // Center dot detail; dashes on straight segments.
    if (mask === 5) {
      g.rect(half - 1.2, 5, 2.4, 6).fill(0xf5f0e6);
      g.rect(half - 1.2, TILE - 11, 2.4, 6).fill(0xf5f0e6);
    } else if (mask === 10) {
      g.rect(5, half - 1.2, 6, 2.4).fill(0xf5f0e6);
      g.rect(TILE - 11, half - 1.2, 6, 2.4).fill(0xf5f0e6);
    } else {
      g.circle(half, half, 1.6).fill({ color: 0xf5f0e6, alpha: 0.7 });
    }
    g.circle(half, half, r * 0.35).fill({ color: EDGE, alpha: 0.15 });
    variants.push(bake(g));
  }
  return variants;
}

/**
 * 16 transit-line variants drawn in WHITE so they can be tinted to each line's
 * hue at runtime. Detail (cross-ties / dashes) is alpha-black so it survives
 * the tint as shading. Same arm geometry as roads, but thinner.
 */
function bakeLineVariants(bake: Baker, style: "rail" | "subway"): Texture[] {
  const half = TILE / 2;
  const lane = TILE * (style === "rail" ? 0.4 : 0.34);
  const r = lane / 2;
  const detail = { color: 0x000000, alpha: style === "rail" ? 0.3 : 0.4 };

  const variants: Texture[] = [];
  for (let mask = 0; mask < 16; mask++) {
    const g = new Graphics();
    const arm = (dx: number, dy: number) => {
      if (dx === 0) {
        const y0 = dy < 0 ? 0 : half;
        g.rect(half - r, y0, lane, half).fill(0xffffff);
      } else {
        const x0 = dx < 0 ? 0 : half;
        g.rect(x0, half - r, half, lane).fill(0xffffff);
      }
    };
    g.roundRect(half - r, half - r, lane, lane, r * 0.9).fill(0xffffff);
    if (mask & 1) arm(0, -1);
    if (mask & 2) arm(1, 0);
    if (mask & 4) arm(0, 1);
    if (mask & 8) arm(-1, 0);

    // Per-arm detail along each present direction.
    const dirs: Array<[number, number, number]> = [
      [1, 0, -1],
      [2, 1, 0],
      [4, 0, 1],
      [8, -1, 0],
    ];
    for (const [bit, dx, dy] of dirs) {
      if (!(mask & bit)) continue;
      lineDetail(g, style, detail, half, lane, dx, dy);
    }
    variants.push(bake(g));
  }
  return variants;
}

/** Rail cross-ties (perpendicular ticks) or subway dashes along one arm. */
function lineDetail(
  g: Graphics,
  style: "rail" | "subway",
  detail: { color: number; alpha: number },
  half: number,
  lane: number,
  dx: number,
  dy: number,
): void {
  const positions = [0.4, 0.7]; // fraction from centre toward the edge
  for (const f of positions) {
    // Distance from tile centre along the arm.
    const cx = half + dx * half * f;
    const cy = half + dy * half * f;
    if (style === "rail") {
      // Tie: short bar perpendicular to travel direction.
      if (dx === 0) g.rect(cx - lane * 0.7, cy - 1.2, lane * 1.4, 2.4).fill(detail);
      else g.rect(cx - 1.2, cy - lane * 0.7, 2.4, lane * 1.4).fill(detail);
    } else {
      // Dash: short bar along travel direction (dashed-line look).
      if (dx === 0) g.rect(cx - 1.3, cy - lane * 0.35, 2.6, lane * 0.7).fill(detail);
      else g.rect(cx - lane * 0.35, cy - 1.3, lane * 0.7, 2.6).fill(detail);
    }
  }
}

function bakeItems(bake: Baker): Map<string, Texture> {
  const map = new Map<string, Texture>();
  for (const def of ITEMS) {
    if (def.kind !== "building") continue;
    map.set(def.id, bakeBuilding(bake, def));
  }
  return map;
}

function bakeBuilding(bake: Baker, def: ItemDef): Texture {
  const w = def.footprint.w * TILE;
  const h = def.footprint.h * TILE;
  const g = new Graphics();
  const pad = 2.5;
  const radius = Math.min(10, Math.min(w, h) * 0.22);

  // Drop shadow baked in (cheap depth cue).
  g.roundRect(pad + 2, pad + 3, w - pad * 2, h - pad * 2, radius).fill({
    color: 0x000000,
    alpha: 0.18,
  });
  // Body.
  g.roundRect(pad, pad, w - pad * 2, h - pad * 2, radius).fill(def.art.base);
  // Accent "roof" stripe across the top third.
  if (def.art.accent !== undefined) {
    g.roundRect(pad + 3, pad + 3, w - pad * 2 - 6, (h - pad * 2) * 0.3, radius * 0.7)
      .fill({ color: def.art.accent, alpha: 0.85 });
  }
  // Soft top-light edge.
  g.roundRect(pad, pad, w - pad * 2, h - pad * 2, radius).stroke({
    color: 0xffffff,
    width: 1.5,
    alpha: 0.35,
  });

  if (def.art.icon) {
    drawIcon(g, def.art.icon, w / 2, h * 0.62, Math.min(w, h) * 0.3);
  }
  return bake(g);
}

/** Tiny glyphs, all simple shapes — keeps the infantile look. */
function drawIcon(g: Graphics, icon: IconId, cx: number, cy: number, size: number): void {
  const s = size;
  switch (icon) {
    case "cross": {
      const t = s * 0.36;
      g.roundRect(cx - t / 2, cy - s / 2, t, s, t * 0.4).fill(0xe05c5c);
      g.roundRect(cx - s / 2, cy - t / 2, s, t, t * 0.4).fill(0xe05c5c);
      break;
    }
    case "book":
      g.roundRect(cx - s * 0.55, cy - s * 0.4, s * 1.1, s * 0.8, 3).fill(0xffffff);
      g.rect(cx - 1, cy - s * 0.4, 2, s * 0.8).fill(0xc9c2b4);
      break;
    case "grad-cap":
      g.poly([cx - s * 0.7, cy, cx, cy - s * 0.45, cx + s * 0.7, cy, cx, cy + s * 0.45])
        .fill(0x333344);
      g.rect(cx + s * 0.45, cy, 2, s * 0.5).fill(0xf8c64b);
      break;
    case "tree":
      g.rect(cx - s * 0.1, cy, s * 0.2, s * 0.5).fill(0x8a5a33);
      g.circle(cx, cy - s * 0.25, s * 0.5).fill(0x2f7a3a);
      g.circle(cx - s * 0.3, cy, s * 0.35).fill(0x3e8a3e);
      g.circle(cx + s * 0.3, cy, s * 0.35).fill(0x3e8a3e);
      break;
    case "ball":
      g.circle(cx, cy, s * 0.5).fill(0xffffff);
      g.circle(cx, cy, s * 0.5).stroke({ color: 0x3a8a78, width: 2 });
      g.rect(cx - s * 0.5, cy - 1, s, 2).fill(0x3a8a78);
      break;
    case "mask":
      g.circle(cx - s * 0.25, cy, s * 0.35).fill(0xffffff);
      g.circle(cx + s * 0.25, cy, s * 0.35).fill(0xfff2cc);
      break;
    case "shield":
      g.poly([cx - s * 0.45, cy - s * 0.4, cx + s * 0.45, cy - s * 0.4, cx + s * 0.35, cy + s * 0.2, cx, cy + s * 0.5, cx - s * 0.35, cy + s * 0.2])
        .fill(0xfdfdfd);
      g.circle(cx, cy, s * 0.16).fill(0x2f4a7a);
      break;
    case "flame":
      g.circle(cx, cy + s * 0.1, s * 0.4).fill(0xffb030);
      g.poly([cx - s * 0.4, cy + s * 0.1, cx, cy - s * 0.55, cx + s * 0.4, cy + s * 0.1])
        .fill(0xffb030);
      g.circle(cx, cy + s * 0.12, s * 0.2).fill(0xffe08a);
      break;
    case "bus":
      g.roundRect(cx - s * 0.55, cy - s * 0.35, s * 1.1, s * 0.6, 4).fill(0xffffff);
      g.rect(cx - s * 0.4, cy - s * 0.22, s * 0.8, s * 0.2).fill(0x9adcf0);
      g.circle(cx - s * 0.3, cy + s * 0.3, s * 0.12).fill(0x333344);
      g.circle(cx + s * 0.3, cy + s * 0.3, s * 0.12).fill(0x333344);
      break;
    case "train":
      g.roundRect(cx - s * 0.55, cy - s * 0.4, s * 1.1, s * 0.7, 5).fill(0xffffff);
      g.rect(cx - s * 0.38, cy - s * 0.25, s * 0.3, s * 0.25).fill(0x9adcf0);
      g.rect(cx + s * 0.08, cy - s * 0.25, s * 0.3, s * 0.25).fill(0x9adcf0);
      g.circle(cx, cy + s * 0.42, s * 0.1).fill(0x333344);
      break;
    case "subway":
      // Roundel: white disc with a colored bar through it (metro mark).
      g.circle(cx, cy, s * 0.52).fill(0xffffff);
      g.circle(cx, cy, s * 0.52).stroke({ color: 0x4a3585, width: 2 });
      g.rect(cx - s * 0.62, cy - s * 0.13, s * 1.24, s * 0.26).fill(0x7b5bd1);
      break;
    case "fountain":
      g.circle(cx, cy + s * 0.15, s * 0.45).fill(0x5fa8d3);
      g.circle(cx, cy + s * 0.15, s * 0.45).stroke({ color: 0xffffff, width: 1.5 });
      g.rect(cx - 1.5, cy - s * 0.4, 3, s * 0.5).fill(0x9adcf0);
      g.circle(cx, cy - s * 0.45, s * 0.14).fill(0x9adcf0);
      break;
    case "column":
      for (let i = -1; i <= 1; i++) {
        g.rect(cx + i * s * 0.35 - s * 0.08, cy - s * 0.3, s * 0.16, s * 0.6).fill(0xffffff);
      }
      g.poly([cx - s * 0.6, cy - s * 0.3, cx, cy - s * 0.65, cx + s * 0.6, cy - s * 0.3])
        .fill(0xffffff);
      g.rect(cx - s * 0.6, cy + s * 0.3, s * 1.2, s * 0.14).fill(0xffffff);
      break;
  }
}

function bakeCar(bake: Baker): Texture {
  const g = new Graphics();
  // 12x7 chunky car pointing +x.
  g.roundRect(0, 0, 12, 7, 3).fill(0xffffff);
  g.roundRect(2.5, 1.2, 5, 4.6, 2).fill(0x9adcf0);
  return bake(g);
}

function bakeCitizen(bake: Baker): Texture {
  const g = new Graphics();
  g.circle(3, 5, 2.6).fill(0xffffff); // body
  g.circle(3, 1.8, 1.6).fill(0xffd9b3); // head
  return bake(g);
}
