import type { City } from "../model/city";
import { computeCoverage, type CoverageMaps } from "./coverage";
import { computePopulation } from "./population";
import { computeHappiness } from "./happiness";

export interface CityStats {
  population: number;
  jobs: number;
  happiness: number;
  coverageShare: {
    education: number;
    health: number;
    transit: number;
    safety: number;
  };
  /** Raw maps, handed to the heatmap overlay. */
  coverage: CoverageMaps;
}

export type StatsListener = (stats: CityStats) => void;

const DEBOUNCE_MS = 120;

/**
 * Debounced full-recompute stats engine. Subscribes to city changes; emits
 * fresh CityStats ~120ms after the last mutation.
 */
export class StatsEngine {
  private city: City;
  private listeners = new Set<StatsListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: () => void;
  current: CityStats;

  constructor(city: City) {
    this.city = city;
    this.current = this.compute();
    this.unsubscribe = city.onChanged(() => this.schedule());
  }

  onStats(listener: StatsListener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  /** Swap to a different city (e.g. after loading a save). */
  setCity(city: City): void {
    this.unsubscribe();
    this.city = city;
    this.unsubscribe = city.onChanged(() => this.schedule());
    this.recomputeNow();
  }

  recomputeNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.current = this.compute();
    for (const l of this.listeners) l(this.current);
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.recomputeNow();
    }, DEBOUNCE_MS);
  }

  private compute(): CityStats {
    const coverage = computeCoverage(this.city);
    const pop = computePopulation(this.city);
    const hap = computeHappiness(this.city, coverage);
    return {
      population: pop.population,
      jobs: pop.jobs,
      happiness: hap.happiness,
      coverageShare: hap.coverageShare,
      coverage,
    };
  }

  destroy(): void {
    this.unsubscribe();
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
  }
}
