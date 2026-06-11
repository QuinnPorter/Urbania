import type { Camera } from "./camera";
import type { Stage } from "../render/stage";
import type { City } from "../core/model/city";
import { getItem } from "../core/catalog/items";
import { paintRoadStroke } from "../core/actions/paintRoad";
import { paintZoneStroke } from "../core/actions/paintZone";
import { paintLineStroke } from "../core/actions/paintLine";
import { bulldozeStroke } from "../core/actions/bulldoze";
import { paintNeighbourhoodStroke } from "../core/actions/paintNeighbourhood";
import {
  placeBuilding,
  validatePlacement,
  rotatedFootprint,
} from "../core/actions/placeBuilding";
import type { ZoneId } from "../core/model/types";
import {
  activeLineId,
  activeNeighbourhoodId,
  activeTool,
  ghostRotation,
  pendingPlacement,
  selectedItem,
} from "../state/uiState";
import type { GestureCallbacks } from "./gestures";

const ZONE_BY_ITEM: Record<string, ZoneId> = {
  "zone-residential": 1,
  "zone-commercial": 2,
  "zone-industrial": 3,
};

/**
 * Routes gestures to model actions based on the active tool, and keeps the
 * ghost preview in sync. The city reference is swappable (load/new).
 */
export class ToolController implements GestureCallbacks {
  private camera: Camera;
  private stage: Stage;
  private getCity: () => City;
  /** True on devices whose primary pointer is coarse (confirm-button flow). */
  readonly isTouchDevice: boolean;

  constructor(camera: Camera, stage: Stage, getCity: () => City) {
    this.camera = camera;
    this.stage = stage;
    this.getCity = getCity;
    this.isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  }

  /** One-finger drags paint for stroke tools; buildings use tap + ghost. */
  isPaintMode(): boolean {
    const tool = activeTool.value;
    if (tool === "bulldoze" || tool === "nhood") return true;
    if (tool === "item") {
      const def = this.def();
      return def !== null && def.kind !== "building";
    }
    return false;
  }

  onTap(screenX: number, screenY: number): void {
    const tool = activeTool.value;
    const def = this.def();
    if (tool === "item" && def?.kind === "building") {
      const { x, y } = this.camera.screenToTile(screenX, screenY);
      this.moveGhost(x, y);
      if (!this.isTouchDevice) this.confirmPlacement();
    }
    // inspect taps are a no-op for now (M5+: tap a neighbourhood to rename)
  }

  onPaint(fromX: number, fromY: number, toX: number, toY: number): void {
    const city = this.getCity();
    const from = this.camera.screenToTile(fromX, fromY);
    const to = this.camera.screenToTile(toX, toY);
    const tool = activeTool.value;

    if (tool === "bulldoze") {
      bulldozeStroke(city, from.x, from.y, to.x, to.y);
      return;
    }
    if (tool === "nhood") {
      const id = activeNeighbourhoodId.value;
      if (id !== null) {
        paintNeighbourhoodStroke(city, from.x, from.y, to.x, to.y, id);
      }
      return;
    }
    const def = this.def();
    if (!def) return;
    if (def.kind === "road") {
      paintRoadStroke(city, from.x, from.y, to.x, to.y);
    } else if (def.kind === "rail" || def.kind === "subway") {
      const id = activeLineId.value;
      if (id !== null) {
        paintLineStroke(city, def.kind, from.x, from.y, to.x, to.y, id);
      }
    } else if (def.kind === "zone") {
      const zone = ZONE_BY_ITEM[def.id];
      if (zone) paintZoneStroke(city, from.x, from.y, to.x, to.y, zone);
    }
  }

  onPaintEnd(): void {}

  /** Desktop hover: live ghost under the mouse. */
  onHover(screenX: number, screenY: number): void {
    const def = this.def();
    if (activeTool.value !== "item" || def?.kind !== "building") return;
    if (this.isTouchDevice) return; // mobile ghost is tap-anchored
    const { x, y } = this.camera.screenToTile(screenX, screenY);
    this.showGhostAt(x, y);
  }

  /** Anchor the ghost at a tile (mobile flow) and open the confirm UI. */
  moveGhost(x: number, y: number): void {
    const def = this.def();
    if (!def) return;
    const valid = this.showGhostAt(x, y);
    pendingPlacement.value = { x, y, valid };
  }

  private showGhostAt(x: number, y: number): boolean {
    const def = this.def();
    if (!def) return false;
    const rot = ghostRotation.value;
    // Center the footprint on the tapped tile for friendlier placement.
    const fp = rotatedFootprint(def, rot);
    const gx = x - Math.floor((fp.w - 1) / 2);
    const gy = y - Math.floor((fp.h - 1) / 2);
    const valid =
      validatePlacement(this.getCity(), def, gx, gy, rot) === null;
    this.stage.showGhost(def.id, gx, gy, rot, valid);
    this.anchoredGhost = { x: gx, y: gy };
    return valid;
  }

  private anchoredGhost: { x: number; y: number } | null = null;

  rotateGhost(): void {
    const def = this.def();
    if (!def?.rotatable) return;
    ghostRotation.value = ((ghostRotation.value + 1) % 4) as 0 | 1 | 2 | 3;
    const pending = pendingPlacement.value;
    if (pending && this.anchoredGhost) {
      // Re-center on the original tap tile.
      this.moveGhost(pending.x, pending.y);
    }
  }

  confirmPlacement(): void {
    const def = this.def();
    if (!def || !this.anchoredGhost) return;
    const { x, y } = this.anchoredGhost;
    const result = placeBuilding(this.getCity(), def, x, y, ghostRotation.value);
    if (typeof result === "number") {
      this.stage.popBuilding(result);
      pendingPlacement.value = null;
      if (this.isTouchDevice) this.stage.hideGhost();
    }
  }

  cancelPlacement(): void {
    pendingPlacement.value = null;
    this.anchoredGhost = null;
    this.stage.hideGhost();
  }

  private def() {
    const id = selectedItem.value;
    return id ? (getItem(id) ?? null) : null;
  }
}
