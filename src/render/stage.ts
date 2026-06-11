import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { City } from "../core/model/city";
import { getItem } from "../core/catalog/items";
import { rotatedFootprint } from "../core/actions/placeBuilding";
import { TILE, type TextureAtlas } from "./textureFactory";
import { backOut, tween } from "./tween";
import type { CoverageMaps } from "../core/stats/coverage";
import type { CoverageLayer } from "../core/catalog/schema";

/**
 * Owns the world container (camera-transformed) and all map layers.
 * Reconciliation model: City mutations fire cityChanged → markAllDirty();
 * flush() runs once per ticker frame and rebuilds only dirty pieces.
 */
export class Stage {
  readonly world = new Container();

  private tileLayer = new Container();
  private zoneLayer = new Container();
  private nhoodLayer = new Container();
  private subwayLayer = new Container();
  private roadLayer = new Container();
  private railLayer = new Container();
  private buildingLayer = new Container();
  readonly ambientLayer = new Container();
  private heatmapLayer = new Container();
  private overlayLayer = new Container();
  private labelLayer = new Container();

  private city: City;
  private atlas: TextureAtlas;

  private groundDirty = true; // zones + roads + neighbourhood tint
  private buildingsDirty = true;
  private labelsDirty = true;
  private heatmapLayerShown: CoverageLayer | null = null;
  private latestCoverage: CoverageMaps | null = null;

  /** Building sprites by index into city.buildings. */
  private buildingSprites = new Map<number, Sprite>();
  /** Sprites that should "pop" on next flush (newly placed building indices). */
  private pendingPop = new Set<number>();

  /** Stroke-preview pool (Grid Lock path / zone rect). */
  private previewLayer = new Container();
  private previewPool: Sprite[] = [];
  private previewRect: Graphics | null = null;

  constructor(city: City, atlas: TextureAtlas) {
    this.city = city;
    this.atlas = atlas;
    this.world.addChild(
      this.tileLayer,
      this.zoneLayer,
      this.nhoodLayer,
      this.subwayLayer, // underground: below road
      this.roadLayer,
      this.railLayer, // surface tracks: above road
      this.buildingLayer,
      this.ambientLayer,
      this.heatmapLayer,
      this.overlayLayer,
      this.labelLayer,
    );
    // Stroke previews live under the ghost/puffs inside the overlay layer.
    this.overlayLayer.addChildAt(this.previewLayer, 0);
    this.buildGround();
  }

  get currentCity(): City {
    return this.city;
  }

  setCity(city: City): void {
    this.city = city;
    this.buildingSprites.clear();
    this.pendingPop.clear();
    this.buildGround();
    this.markAllDirty();
  }

  setAtlas(atlas: TextureAtlas): void {
    this.atlas = atlas;
    this.buildingSprites.clear();
    this.resetPreviewPool(); // pooled sprites hold textures from the old atlas
    this.buildGround();
    this.markAllDirty();
  }

  markAllDirty(): void {
    this.groundDirty = true;
    this.buildingsDirty = true;
    this.labelsDirty = true;
  }

  popBuilding(index: number): void {
    this.pendingPop.add(index);
  }

  setHeatmap(layer: CoverageLayer | null): void {
    this.heatmapLayerShown = layer;
    this.refreshHeatmap();
  }

  setCoverage(coverage: CoverageMaps): void {
    this.latestCoverage = coverage;
    if (this.heatmapLayerShown) this.refreshHeatmap();
  }

  /** Static grass checkerboard — built once per city. */
  private buildGround(): void {
    this.tileLayer.removeChildren();
    const { width, height } = this.city;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sprite = new Sprite(this.atlas.grass[(x + y) % 2]);
        sprite.position.set(x * TILE, y * TILE);
        this.tileLayer.addChild(sprite);
      }
    }
  }

  /** Called once per ticker frame. */
  flush(): void {
    if (this.groundDirty) {
      this.rebuildZones();
      this.rebuildRoads();
      this.rebuildSubways();
      this.rebuildRails();
      this.rebuildNeighbourhoodTint();
      this.groundDirty = false;
    }
    if (this.buildingsDirty) {
      this.reconcileBuildings();
      this.buildingsDirty = false;
    }
    if (this.labelsDirty) {
      this.rebuildLabels();
      this.labelsDirty = false;
    }
  }

  private rebuildZones(): void {
    this.zoneLayer.removeChildren();
    const { width, height, zone } = this.city;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const z = zone[row + x]!;
        if (z === 0) continue;
        const tex = this.atlas.zones.get(z);
        if (!tex) continue;
        const sprite = new Sprite(tex);
        sprite.position.set(x * TILE, y * TILE);
        this.zoneLayer.addChild(sprite);
      }
    }
  }

  private rebuildRoads(): void {
    this.roadLayer.removeChildren();
    const { width, height, road, roadMask } = this.city;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        if (road[row + x] !== 1) continue;
        const sprite = new Sprite(this.atlas.roads[roadMask[row + x]!]);
        sprite.position.set(x * TILE, y * TILE);
        this.roadLayer.addChild(sprite);
      }
    }
  }

  private rebuildRails(): void {
    this.rebuildNetwork(
      this.railLayer,
      this.city.rail,
      this.city.railMask,
      this.atlas.rails,
      this.city.railLines,
      1,
    );
  }

  private rebuildSubways(): void {
    this.rebuildNetwork(
      this.subwayLayer,
      this.city.subway,
      this.city.subwayMask,
      this.atlas.subways,
      this.city.subwayLines,
      0.7, // translucent — reads as underground
    );
  }

  /** Render a named-line network, tinting each tile by its line's hue. */
  private rebuildNetwork(
    layer: Container,
    cells: Uint8Array,
    maskLayer: Uint8Array,
    variants: Texture[],
    registry: Map<number, { hue: number }>,
    alpha: number,
  ): void {
    layer.removeChildren();
    const { width, height } = this.city;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const lineId = cells[row + x]!;
        if (lineId === 0) continue;
        const tex = variants[maskLayer[row + x]!];
        if (!tex) continue;
        const sprite = new Sprite(tex);
        sprite.position.set(x * TILE, y * TILE);
        const line = registry.get(lineId);
        sprite.tint = line ? hueToColor(line.hue) : 0xffffff;
        sprite.alpha = alpha;
        layer.addChild(sprite);
      }
    }
  }

  private rebuildNeighbourhoodTint(): void {
    this.nhoodLayer.removeChildren();
    const { width, height, neighbourhood } = this.city;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const id = neighbourhood[row + x]!;
        if (id === 0) continue;
        const info = this.city.neighbourhoods.get(id);
        if (!info) continue;
        const sprite = new Sprite(this.atlas.cell);
        sprite.position.set(x * TILE, y * TILE);
        sprite.tint = hueToColor(info.hue);
        sprite.alpha = 0.16;
        this.nhoodLayer.addChild(sprite);
      }
    }
    this.labelsDirty = true;
  }

  /** Diff building sprites against the model; pop new ones. */
  private reconcileBuildings(): void {
    const buildings = this.city.buildings;
    for (const [index, sprite] of this.buildingSprites) {
      if (!buildings[index]) {
        sprite.destroy();
        this.buildingSprites.delete(index);
      }
    }
    for (let index = 0; index < buildings.length; index++) {
      const building = buildings[index];
      if (!building || this.buildingSprites.has(index)) continue;
      const def = getItem(building.defId);
      if (!def) continue;
      const tex = this.atlas.items.get(def.id);
      if (!tex) continue;
      const { w, h } = rotatedFootprint(def, building.rot);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      // Odd rotations rotate the baked (unrotated) texture by 90°.
      sprite.rotation = building.rot % 2 === 1 ? Math.PI / 2 : 0;
      if (building.rot === 2) sprite.rotation = 0; // 180° looks identical for our art
      sprite.position.set(
        building.x * TILE + (w * TILE) / 2,
        building.y * TILE + (h * TILE) / 2,
      );
      this.buildingLayer.addChild(sprite);
      this.buildingSprites.set(index, sprite);

      if (this.pendingPop.has(index)) {
        this.pendingPop.delete(index);
        tween(280, (t) => {
          sprite.scale.set(Math.max(0.0001, backOut(t)));
        });
        this.spawnPuffs(sprite.x, sprite.y);
      }
    }
    // y-sort so lower buildings draw in front.
    this.buildingLayer.children.sort((a, b) => a.y - b.y);
  }

  private spawnPuffs(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const puff = new Sprite(this.atlas.cell);
      puff.anchor.set(0.5);
      const angle = (i / 5) * Math.PI * 2 + 0.4;
      puff.position.set(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10);
      puff.scale.set(0.18);
      puff.alpha = 0.8;
      this.overlayLayer.addChild(puff);
      const dx = Math.cos(angle) * 18;
      const dy = Math.sin(angle) * 18 - 8;
      const sx = puff.x;
      const sy = puff.y;
      tween(
        380,
        (t) => {
          puff.position.set(sx + dx * t, sy + dy * t);
          puff.alpha = 0.8 * (1 - t);
          puff.scale.set(0.18 * (1 - t * 0.5));
        },
        () => puff.destroy(),
      );
    }
  }

  private refreshHeatmap(): void {
    this.heatmapLayer.removeChildren();
    const layer = this.heatmapLayerShown;
    if (!layer || !this.latestCoverage) return;
    const map = this.latestCoverage.layers[layer];
    const { width, height } = this.city;
    const colors: Record<CoverageLayer, number> = {
      education: 0xf8c64b,
      health: 0xe05c5c,
      transit: 0xf2a65a,
      safety: 0x7d9fd1,
    };
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        if (!map[row + x]) continue;
        const sprite = new Sprite(this.atlas.cell);
        sprite.position.set(x * TILE, y * TILE);
        sprite.tint = colors[layer];
        sprite.alpha = 0.3;
        this.heatmapLayer.addChild(sprite);
      }
    }
  }

  /** Neighbourhood + line name labels at their tile centroids; counter-scaled. */
  private rebuildLabels(): void {
    this.labelLayer.removeChildren();
    this.addCentroidLabels(this.city.neighbourhood, this.city.neighbourhoods, 26);
    this.addCentroidLabels(this.city.rail, this.city.railLines, 17);
    this.addCentroidLabels(this.city.subway, this.city.subwayLines, 17);
  }

  /** Place one label per id in `registry` at the centroid of its tiles. */
  private addCentroidLabels(
    idLayer: Uint8Array,
    registry: Map<number, { name: string; hue: number }>,
    fontSize: number,
  ): void {
    const { width, height } = this.city;
    const sums = new Map<number, { sx: number; sy: number; n: number }>();
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const id = idLayer[row + x]!;
        if (id === 0) continue;
        let s = sums.get(id);
        if (!s) sums.set(id, (s = { sx: 0, sy: 0, n: 0 }));
        s.sx += x;
        s.sy += y;
        s.n++;
      }
    }
    for (const [id, s] of sums) {
      const info = registry.get(id);
      if (!info) continue;
      const label = new Text({
        text: info.name,
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize,
          fontWeight: "800",
          fill: 0xffffff,
          stroke: { color: hueToColor(info.hue, 38), width: 6, join: "round" },
        },
      });
      label.anchor.set(0.5);
      label.position.set((s.sx / s.n + 0.5) * TILE, (s.sy / s.n + 0.5) * TILE);
      this.labelLayer.addChild(label);
    }
  }

  /** Fade and counter-scale labels by zoom; called every frame by main. */
  updateLabelZoom(zoom: number): void {
    const visible = zoom < 1.1;
    const alpha = visible ? Math.min(1, (1.1 - zoom) * 3) : 0;
    for (const child of this.labelLayer.children) {
      child.alpha = alpha;
      const inv = 1 / Math.max(zoom, 0.25);
      child.scale.set(Math.min(inv, 2.4));
    }
  }

  /** Preview a path of tiles (Grid Lock) with pooled, tinted cell sprites. */
  showTilePreview(
    tiles: ReadonlyArray<readonly [number, number]>,
    tint: number,
    alpha = 0.55,
  ): void {
    if (this.previewRect) this.previewRect.visible = false;
    while (this.previewPool.length < tiles.length) {
      const sprite = new Sprite(this.atlas.cell);
      this.previewLayer.addChild(sprite);
      this.previewPool.push(sprite);
    }
    for (let i = 0; i < this.previewPool.length; i++) {
      const sprite = this.previewPool[i]!;
      const tile = tiles[i];
      if (tile) {
        sprite.visible = true;
        sprite.position.set(tile[0] * TILE, tile[1] * TILE);
        sprite.tint = tint;
        sprite.alpha = alpha;
      } else {
        sprite.visible = false;
      }
    }
  }

  /** Preview a zone rectangle as a single translucent Graphics. */
  showRectPreview(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    tint: number,
  ): void {
    for (const sprite of this.previewPool) sprite.visible = false;
    if (!this.previewRect) {
      this.previewRect = new Graphics();
      this.previewLayer.addChild(this.previewRect);
    }
    const minX = Math.min(x0, x1) * TILE;
    const minY = Math.min(y0, y1) * TILE;
    const w = (Math.abs(x1 - x0) + 1) * TILE;
    const h = (Math.abs(y1 - y0) + 1) * TILE;
    this.previewRect.clear();
    this.previewRect
      .rect(minX, minY, w, h)
      .fill({ color: tint, alpha: 0.25 })
      .stroke({ color: tint, width: 2, alpha: 0.85 });
    this.previewRect.visible = true;
  }

  clearPreview(): void {
    for (const sprite of this.previewPool) sprite.visible = false;
    if (this.previewRect) this.previewRect.visible = false;
  }

  private resetPreviewPool(): void {
    for (const child of this.previewLayer.removeChildren()) child.destroy();
    this.previewPool = [];
    this.previewRect = null;
  }

  /** Ghost preview sprite management (building tool). */
  private ghost: Sprite | null = null;

  showGhost(defId: string, x: number, y: number, rot: number, valid: boolean): void {
    const def = getItem(defId);
    if (!def) return;
    const tex = this.atlas.items.get(defId);
    if (!tex) return;
    if (!this.ghost || this.ghost.texture !== tex) {
      this.ghost?.destroy();
      this.ghost = new Sprite(tex);
      this.ghost.anchor.set(0.5);
      this.overlayLayer.addChild(this.ghost);
    }
    const { w, h } = rotatedFootprint(def, rot as 0 | 1 | 2 | 3);
    this.ghost.rotation = rot % 2 === 1 ? Math.PI / 2 : 0;
    this.ghost.position.set(
      x * TILE + (w * TILE) / 2,
      y * TILE + (h * TILE) / 2,
    );
    this.ghost.alpha = 0.75;
    this.ghost.tint = valid ? 0xa8ffb0 : 0xff9a9a;
  }

  hideGhost(): void {
    this.ghost?.destroy();
    this.ghost = null;
  }
}

export function hueToColor(hue: number, lightness = 55): number {
  // HSL → RGB, s=70%.
  const s = 0.7;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((hue % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to255 = (v: number) => Math.round((v + m) * 255);
  return (to255(r) << 16) | (to255(g) << 8) | to255(b);
}

/** Convenience: track which textures exist (for tests/debug). */
export type { Texture };
