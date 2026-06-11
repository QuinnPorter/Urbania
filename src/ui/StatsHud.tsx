import type { CoverageLayer } from "../core/catalog/schema";
import { heatmapLayer } from "../state/uiState";
import {
  educationCoverage,
  happiness,
  healthCoverage,
  jobs,
  population,
  safetyCoverage,
  transitCoverage,
} from "../state/statsState";

function face(h: number): string {
  if (h >= 80) return "😄";
  if (h >= 60) return "🙂";
  if (h >= 40) return "😐";
  if (h >= 20) return "🙁";
  return "😢";
}

export function StatsHud() {
  return (
    <div class="stats">
      <div class="stat" title="Population">
        <span class="label">👥</span>
        {population.value.toLocaleString()}
      </div>
      <div class="stat" title="Jobs">
        <span class="label">💼</span>
        {jobs.value.toLocaleString()}
      </div>
      <div class="stat" title={`Happiness ${happiness.value}/100`}>
        <span class="label">{face(happiness.value)}</span>
        {happiness.value}
      </div>
    </div>
  );
}

const COVERAGE_DEFS: Array<{
  layer: CoverageLayer;
  emoji: string;
  signal: { value: number };
}> = [
  { layer: "education", emoji: "🎓", signal: educationCoverage },
  { layer: "health", emoji: "❤️", signal: healthCoverage },
  { layer: "transit", emoji: "🚌", signal: transitCoverage },
  { layer: "safety", emoji: "🛡️", signal: safetyCoverage },
];

/** Tap a pill to toggle that layer's heatmap on the map. */
export function CoverageRow() {
  return (
    <div class="coverage-row">
      {COVERAGE_DEFS.map(({ layer, emoji, signal }) => (
        <button
          key={layer}
          class={`coverage-pill ${heatmapLayer.value === layer ? "active" : ""}`}
          onClick={() => {
            heatmapLayer.value = heatmapLayer.value === layer ? null : layer;
          }}
        >
          <span>{emoji}</span>
          <span class="bar">
            <div style={{ width: `${Math.round(signal.value * 100)}%` }} />
          </span>
          {Math.round(signal.value * 100)}%
        </button>
      ))}
    </div>
  );
}
