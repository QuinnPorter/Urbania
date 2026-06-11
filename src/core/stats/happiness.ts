import type { City } from "../model/city";
import { ZONE_RESIDENTIAL } from "../model/types";
import type { CoverageMaps } from "./coverage";

export interface HappinessResult {
  /** 0..100. */
  happiness: number;
  /** 0..1 share of residential tiles covered, per layer. */
  coverageShare: {
    education: number;
    health: number;
    transit: number;
    safety: number;
  };
}

/**
 * Happiness = 50 + 12·parks + 10·education + 10·health + 8·transit
 *           + 5·safety − penalty, where each term is the 0..1 average over
 * residential tiles. Empty city (no residential) reads as content: 72.
 */
export function computeHappiness(
  city: City,
  coverage: CoverageMaps,
): HappinessResult {
  let resTiles = 0;
  let eduCovered = 0;
  let healthCovered = 0;
  let transitCovered = 0;
  let safetyCovered = 0;
  let happinessSum = 0; // park/industrial deltas, each tile −10..10

  for (let i = 0; i < city.zone.length; i++) {
    if (city.zone[i] !== ZONE_RESIDENTIAL) continue;
    resTiles++;
    if (coverage.layers.education[i]) eduCovered++;
    if (coverage.layers.health[i]) healthCovered++;
    if (coverage.layers.transit[i]) transitCovered++;
    if (coverage.layers.safety[i]) safetyCovered++;
    happinessSum += coverage.happiness[i]!;
  }

  if (resTiles === 0) {
    return {
      happiness: 72,
      coverageShare: { education: 1, health: 1, transit: 1, safety: 1 },
    };
  }

  const education = eduCovered / resTiles;
  const health = healthCovered / resTiles;
  const transit = transitCovered / resTiles;
  const safety = safetyCovered / resTiles;
  // Average park/industrial delta per residential tile, −10..10 → −1..1.
  const ambience = happinessSum / resTiles / 10;

  const raw =
    50 +
    12 * Math.max(0, ambience) +
    10 * education +
    10 * health +
    8 * transit +
    5 * safety +
    15 * Math.min(0, ambience);

  return {
    happiness: Math.round(Math.max(0, Math.min(100, raw))),
    coverageShare: { education, health, transit, safety },
  };
}
