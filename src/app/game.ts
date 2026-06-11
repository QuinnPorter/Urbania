import { Application, Renderer } from "pixi.js";
import { City, DEFAULT_CITY_SIZE } from "../core/model/city";
import { StatsEngine } from "../core/stats/engine";
import { encodeShareCode, decodeShareCode } from "../core/save/sharecode";
import {
  createNeighbourhood,
  dissolveNeighbourhood,
  renameNeighbourhood,
} from "../core/actions/paintNeighbourhood";
import { createLine, dissolveLine } from "../core/actions/paintLine";
import type { LineKind } from "../core/model/types";
import { buildAtlas, TILE, type TextureAtlas } from "../render/textureFactory";
import { Stage } from "../render/stage";
import { updateTweens } from "../render/tween";
import { CarSystem } from "../render/ambient/cars";
import { CitizenSystem } from "../render/ambient/citizens";
import { Camera } from "../input/camera";
import { GestureController } from "../input/gestures";
import { ToolController } from "../input/toolController";
import { IdbStorage } from "../platform/idbStorage";
import { WebClipboard } from "../platform/webClipboard";
import { SaveManager, type SlotMeta } from "./saveManager";
import {
  activeLineId,
  activeLineKind,
  activeNeighbourhoodId,
  cityName,
  cityRevision,
  heatmapLayer,
  selectTool,
  useLine,
} from "../state/uiState";
import * as stats from "../state/statsState";

/** Low-end heuristic: few cores → halve ambient counts, cap at 30fps. */
const LOW_END = (navigator.hardwareConcurrency ?? 8) <= 4;

export class Game {
  readonly app: Application;
  readonly camera = new Camera();
  readonly storage = new IdbStorage();
  readonly clipboard = new WebClipboard();

  private city!: City;
  private atlas!: TextureAtlas;
  stage!: Stage;
  tools!: ToolController;
  statsEngine!: StatsEngine;
  saves!: SaveManager;
  private cars!: CarSystem;
  private citizens!: CitizenSystem;
  private untrack: (() => void) | null = null;
  private citizenRespawnTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.app = new Application();
  }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      background: 0x79bd5c,
      resizeTo: host,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.appendChild(this.app.canvas);

    this.atlas = buildAtlas(this.app.renderer as Renderer);
    this.saves = new SaveManager(this.storage, () => stats.population.value);

    // Open the last city, or start fresh.
    const lastId = await this.saves.lastOpenedId();
    let loaded: { city: City; createdAt: number } | null = null;
    if (lastId) {
      try {
        loaded = await this.saves.loadSlot(lastId);
      } catch (err) {
        console.error("Failed to load last city:", err);
      }
    }

    this.city = loaded?.city ?? new City("My First City", DEFAULT_CITY_SIZE, DEFAULT_CITY_SIZE);
    this.stage = new Stage(this.city, this.atlas);
    this.app.stage.addChild(this.stage.world);

    this.statsEngine = new StatsEngine(this.city);
    this.statsEngine.onStats((s) => {
      stats.population.value = s.population;
      stats.jobs.value = s.jobs;
      stats.happiness.value = s.happiness;
      stats.educationCoverage.value = s.coverageShare.education;
      stats.healthCoverage.value = s.coverageShare.health;
      stats.transitCoverage.value = s.coverageShare.transit;
      stats.safetyCoverage.value = s.coverageShare.safety;
      this.stage.setCoverage(s.coverage);
    });

    this.cars = new CarSystem(this.stage.ambientLayer, this.atlas, this.city);
    this.citizens = new CitizenSystem(this.stage.ambientLayer, this.atlas, this.city);

    this.tools = new ToolController(this.camera, this.stage, () => this.city);
    new GestureController(this.app.canvas, this.camera, this.tools);
    this.app.canvas.addEventListener("pointermove", (e) => {
      if (e.buttons === 0) this.tools.onHover(e.offsetX, e.offsetY);
    });

    this.camera.setViewport(host.clientWidth, host.clientHeight);
    this.camera.setWorldSize(this.city.width, this.city.height);
    this.camera.centerOnWorld();
    window.addEventListener("resize", () => {
      this.camera.setViewport(host.clientWidth, host.clientHeight);
    });

    this.wireCity(loaded ? lastId! : null, loaded?.createdAt ?? Date.now());

    // Heatmap toggle reactions.
    heatmapLayer.subscribe((layer) => this.stage.setHeatmap(layer));

    if (LOW_END) this.app.ticker.maxFPS = 30;
    this.app.ticker.add(() => {
      const dtMS = this.app.ticker.deltaMS;
      updateTweens(dtMS);
      this.stage.flush();
      this.cars.update(dtMS / 1000);
      this.citizens.update(dtMS / 1000);
      this.stage.world.position.set(this.camera.panX, this.camera.panY);
      this.stage.world.scale.set(this.camera.zoom);
      this.stage.updateLabelZoom(this.camera.zoom);
    });

    // Procedural art makes context loss cheap to recover from.
    this.app.canvas.addEventListener("webglcontextrestored", () => {
      this.atlas = buildAtlas(this.app.renderer as Renderer);
      this.stage.setAtlas(this.atlas);
    });
  }

  /** Hook model events for the (possibly new) city; manage autosave slot. */
  private wireCity(slotId: string | null, createdAt: number): void {
    this.untrack?.();
    cityName.value = this.city.name;
    cityRevision.value++;

    this.city.onChanged(() => {
      this.stage.markAllDirty();
      this.cars.refreshTarget(LOW_END ? 24 : 50);
      // Citizens re-anchor at most twice a second (cheap but not per-stroke).
      if (!this.citizenRespawnTimer) {
        this.citizenRespawnTimer = setTimeout(() => {
          this.citizenRespawnTimer = null;
          this.citizens.respawn(LOW_END ? 20 : 40);
        }, 500);
      }
    });

    if (slotId) {
      this.untrack = this.saves.trackCity(this.city, slotId, createdAt);
      void this.saves.setLastOpened(slotId);
    } else {
      // Brand-new unsaved city: create its slot, then track.
      void this.saves.createSlot(this.city).then((id) => {
        this.untrack = this.saves.trackCity(this.city, id, Date.now());
      });
    }
  }

  /** Swap the live city (new game / load / import). */
  private adoptCity(city: City, slotId: string | null, createdAt: number): void {
    this.city = city;
    this.stage.setCity(city);
    this.statsEngine.setCity(city);
    this.cars.setCity(city);
    this.cars.refreshTarget(LOW_END ? 24 : 50);
    this.citizens.setCity(city);
    this.camera.setWorldSize(city.width, city.height);
    this.camera.centerOnWorld();
    selectTool("inspect");
    this.wireCity(slotId, createdAt);
  }

  async newCity(name: string, size: number): Promise<void> {
    await this.flushActive();
    this.adoptCity(new City(name, size, size), null, Date.now());
  }

  async loadCity(id: string): Promise<void> {
    await this.flushActive();
    const loaded = await this.saves.loadSlot(id);
    if (!loaded) throw new Error("That city could not be found.");
    this.adoptCity(loaded.city, id, loaded.createdAt);
  }

  async importCity(code: string): Promise<void> {
    const city = decodeShareCode(code); // throws with a friendly message
    city.name = `${city.name} (import)`;
    await this.flushActive();
    this.adoptCity(city, null, Date.now());
  }

  exportCode(): string {
    return encodeShareCode(this.city);
  }

  renameCity(name: string): void {
    this.city.name = name.trim() || this.city.name;
    cityName.value = this.city.name;
    this.city.notifyChanged();
  }

  listSlots(): Promise<SlotMeta[]> {
    return this.saves.listSlots();
  }

  async deleteSlot(id: string): Promise<void> {
    await this.saves.deleteSlot(id);
  }

  async duplicateSlot(id: string): Promise<void> {
    await this.saves.duplicateSlot(id);
  }

  /** Start painting a brand-new named neighbourhood. */
  startNeighbourhood(name: string): boolean {
    const hue = Math.floor(Math.random() * 360);
    const id = createNeighbourhood(this.city, name.trim() || "New District", hue);
    if (id === null) return false;
    activeNeighbourhoodId.value = id;
    selectTool("nhood");
    return true;
  }

  renameNeighbourhood(id: number, name: string): void {
    renameNeighbourhood(this.city, id, name);
  }

  dissolveNeighbourhood(id: number): void {
    dissolveNeighbourhood(this.city, id);
  }

  /** Create a new named transit line and make it the active paint tool. */
  startLine(kind: LineKind, name: string): boolean {
    const hue = Math.floor(Math.random() * 360);
    const line = createLine(this.city, kind, name, hue);
    if (!line) return false;
    useLine(kind, line.id);
    return true;
  }

  /** Continue painting an existing line. */
  selectLine(kind: LineKind, id: number): void {
    useLine(kind, id);
  }

  dissolveLine(kind: LineKind, id: number): void {
    dissolveLine(this.city, kind, id);
    if (activeLineId.value === id && activeLineKind.value === kind) {
      activeLineId.value = null;
    }
  }

  get currentCity(): City {
    return this.city;
  }

  get tileSize(): number {
    return TILE;
  }

  private async flushActive(): Promise<void> {
    if (this.saves.activeSlotId) await this.saves.saveNow(this.city);
  }
}
