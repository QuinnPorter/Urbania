import type { City } from "../model/city";
import type { CoverageLayer } from "../catalog/schema";
import { getItem } from "../catalog/items";
import { rotatedFootprint } from "../actions/placeBuilding";

export const COVERAGE_LAYERS: CoverageLayer[] = [
  "education",
  "health",
  "transit",
  "safety",
];

export interface CoverageMaps {
  /** Boolean-OR coverage per layer, 0/1 per tile. */
  layers: Record<CoverageLayer, Uint8Array>;
  /** Summed happiness deltas per tile, clamped ±10. */
  happiness: Int8Array;
}

/**
 * Stamp Chebyshev discs (square radius — reads as a friendly blob) for every
 * building with coverage/happiness effects. Full recompute; <5ms at 128².
 */
export function computeCoverage(city: City): CoverageMaps {
  const n = city.width * city.height;
  const layers = {
    education: new Uint8Array(n),
    health: new Uint8Array(n),
    transit: new Uint8Array(n),
    safety: new Uint8Array(n),
  };
  const happiness = new Int8Array(n);

  for (const building of city.buildings) {
    if (!building) continue;
    const def = getItem(building.defId);
    if (!def) continue;
    const { w, h } = rotatedFootprint(def, building.rot);
    const cx = building.x + Math.floor((w - 1) / 2);
    const cy = building.y + Math.floor((h - 1) / 2);

    const cov = def.effects.coverage;
    if (cov) stampDisc(layers[cov.layer], city, cx, cy, cov.radius, 1, "or");
    const hap = def.effects.happiness;
    if (hap) stampHappiness(happiness, city, cx, cy, hap.radius, hap.delta);
  }

  // Painted zones with happiness effects (industrial −2 r3) stamp per tile.
  const zoneEffects = new Map<number, { radius: number; delta: number }>();
  for (const [zoneId, itemId] of [
    [1, "zone-residential"],
    [2, "zone-commercial"],
    [3, "zone-industrial"],
  ] as Array<[number, string]>) {
    const hap = getItem(itemId)?.effects.happiness;
    if (hap) zoneEffects.set(zoneId, hap);
  }
  if (zoneEffects.size > 0) {
    for (let y = 0; y < city.height; y++) {
      const row = y * city.width;
      for (let x = 0; x < city.width; x++) {
        const effect = zoneEffects.get(city.zone[row + x]!);
        if (effect) {
          stampHappiness(happiness, city, x, y, effect.radius, effect.delta);
        }
      }
    }
  }

  // Transit lines extend transit coverage along their path (rail & subway).
  stampLineCoverage(layers.transit, city, city.rail, RAIL_COVERAGE_RADIUS);
  stampLineCoverage(layers.transit, city, city.subway, SUBWAY_COVERAGE_RADIUS);

  return { layers, happiness };
}

const RAIL_COVERAGE_RADIUS = 3;
const SUBWAY_COVERAGE_RADIUS = 3;

/** Stamp a transit-coverage disc around every non-empty tile of a line layer. */
function stampLineCoverage(
  target: Uint8Array,
  city: City,
  cells: Uint8Array,
  radius: number,
): void {
  for (let y = 0; y < city.height; y++) {
    const row = y * city.width;
    for (let x = 0; x < city.width; x++) {
      if (cells[row + x] !== 0) {
        stampDisc(target, city, x, y, radius, 1, "or");
      }
    }
  }
}

function stampDisc(
  target: Uint8Array,
  city: City,
  cx: number,
  cy: number,
  radius: number,
  value: number,
  _mode: "or",
): void {
  const x0 = Math.max(0, cx - radius);
  const x1 = Math.min(city.width - 1, cx + radius);
  const y0 = Math.max(0, cy - radius);
  const y1 = Math.min(city.height - 1, cy + radius);
  for (let y = y0; y <= y1; y++) {
    const row = y * city.width;
    for (let x = x0; x <= x1; x++) {
      target[row + x] = value;
    }
  }
}

function stampHappiness(
  target: Int8Array,
  city: City,
  cx: number,
  cy: number,
  radius: number,
  delta: number,
): void {
  const x0 = Math.max(0, cx - radius);
  const x1 = Math.min(city.width - 1, cx + radius);
  const y0 = Math.max(0, cy - radius);
  const y1 = Math.min(city.height - 1, cy + radius);
  for (let y = y0; y <= y1; y++) {
    const row = y * city.width;
    for (let x = x0; x <= x1; x++) {
      const idx = row + x;
      const next = target[idx]! + delta;
      target[idx] = Math.max(-10, Math.min(10, next));
    }
  }
}
