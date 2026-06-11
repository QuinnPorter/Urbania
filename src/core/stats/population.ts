import type { City } from "../model/city";
import {
  ZONE_COMMERCIAL,
  ZONE_INDUSTRIAL,
  ZONE_RESIDENTIAL,
} from "../model/types";
import { getItem } from "../catalog/items";

const POP_PER_TILE = getItem("zone-residential")?.effects.populationPerTile ?? 8;
const JOBS_COMMERCIAL = getItem("zone-commercial")?.effects.jobsPerTile ?? 6;
const JOBS_INDUSTRIAL = getItem("zone-industrial")?.effects.jobsPerTile ?? 10;

/** Road within Chebyshev distance 2 → full yield; else 25%. */
const NEAR_ROAD_RADIUS = 2;
const NO_ROAD_FACTOR = 0.25;

export interface PopulationResult {
  population: number;
  jobs: number;
  residentialTiles: number;
}

export function computePopulation(city: City): PopulationResult {
  // Precompute "near road" as a dilation of the road layer.
  const nearRoad = dilateRoads(city, NEAR_ROAD_RADIUS);

  let population = 0;
  let jobs = 0;
  let residentialTiles = 0;
  for (let i = 0; i < city.zone.length; i++) {
    const zone = city.zone[i];
    if (zone === 0) continue;
    const factor = nearRoad[i] === 1 ? 1 : NO_ROAD_FACTOR;
    if (zone === ZONE_RESIDENTIAL) {
      population += POP_PER_TILE * factor;
      residentialTiles++;
    } else if (zone === ZONE_COMMERCIAL) {
      jobs += JOBS_COMMERCIAL * factor;
    } else if (zone === ZONE_INDUSTRIAL) {
      jobs += JOBS_INDUSTRIAL * factor;
    }
  }
  return {
    population: Math.round(population),
    jobs: Math.round(jobs),
    residentialTiles,
  };
}

function dilateRoads(city: City, radius: number): Uint8Array {
  const out = new Uint8Array(city.width * city.height);
  for (let y = 0; y < city.height; y++) {
    const row = y * city.width;
    for (let x = 0; x < city.width; x++) {
      if (city.road[row + x] !== 1) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(city.width - 1, x + radius);
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(city.height - 1, y + radius);
      for (let yy = y0; yy <= y1; yy++) {
        const r2 = yy * city.width;
        for (let xx = x0; xx <= x1; xx++) out[r2 + xx] = 1;
      }
    }
  }
  return out;
}
