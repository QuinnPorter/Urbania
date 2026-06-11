import type { Camera } from "./camera";
import { Stage, hueToColor } from "../render/stage";
import type { City } from "../core/model/city";
import { getItem } from "../core/catalog/items";
import type { ItemDef } from "../core/catalog/schema";
import { paintRoadPath, paintRoadStroke } from "../core/actions/paintRoad";
import {
  paintZoneBrushStroke,
  paintZoneRect,
} from "../core/actions/paintZone";
import { paintLinePath, paintLineStroke } from "../core/actions/paintLine";
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
  isGridLockActive,
  pendingPlacement,
  selectTool,
  selectedItem,
  zoneBrushSize,
  zonePaintMode,
} from "../state/uiState";
import type { GestureCallbacks } from "./gestures";
import {
  strokeEnd,
  strokeStep,
  type PaintKind,
  type StrokeSession,
} from "./strokeSession";

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

  private session: StrokeSession | null = null;

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
    if (!def || def.kind === "building") return;

    const { session, directive } = strokeStep(
      this.session,
      {
        kind: def.kind as PaintKind,
        gridLockActive: isGridLockActive(),
        zoneMode: zonePaintMode.value,
      },
      from.x,
      from.y,
      to.x,
      to.y,
      fromX === toX && fromY === toY, // screen-stationary = the gesture TAP path
    );
    this.session = session;

    switch (directive.type) {
      case "commit-segments":
        for (const [x0, y0, x1, y1] of directive.segments) {
          this.commitSegment(def, x0, y0, x1, y1);
        }
        break;
      case "preview-path":
        this.stage.showTilePreview(directive.tiles, this.previewTint(def));
        break;
      case "preview-rect":
        this.stage.showRectPreview(
          directive.x0,
          directive.y0,
          directive.x1,
          directive.y1,
          this.previewTint(def),
        );
        break;
      case "hold":
        break;
    }
  }

  onPaintEnd(): void {
    const directive = strokeEnd(this.session);
    const def = this.def();
    this.session = null;
    this.stage.clearPreview();
    if (!def) return;
    const city = this.getCity();

    switch (directive.type) {
      case "dismiss-line":
        // A plain tap with a line tool puts the tool away (chip disappears).
        selectTool("inspect");
        break;
      case "commit-path":
        if (def.kind === "road") {
          paintRoadPath(city, directive.tiles);
        } else if (def.kind === "rail" || def.kind === "subway") {
          const id = activeLineId.value;
          if (id !== null) paintLinePath(city, def.kind, directive.tiles, id);
        }
        break;
      case "commit-rect": {
        const zone = ZONE_BY_ITEM[def.id];
        if (zone) {
          paintZoneRect(
            city,
            directive.x0,
            directive.y0,
            directive.x1,
            directive.y1,
            zone,
          );
        }
        break;
      }
      case "none":
        break;
    }
  }

  /** Interrupted stroke (pinch/pointercancel): discard, never commit. */
  onPaintCancel(): void {
    this.session = null;
    this.stage.clearPreview();
  }

  /** Live-commit one freehand segment for the given item kind. */
  private commitSegment(
    def: ItemDef,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): void {
    const city = this.getCity();
    if (def.kind === "road") {
      paintRoadStroke(city, x0, y0, x1, y1);
    } else if (def.kind === "rail" || def.kind === "subway") {
      const id = activeLineId.value;
      if (id !== null) paintLineStroke(city, def.kind, x0, y0, x1, y1, id);
    } else if (def.kind === "zone") {
      const zone = ZONE_BY_ITEM[def.id];
      if (zone) {
        paintZoneBrushStroke(city, x0, y0, x1, y1, zone, zoneBrushSize.value);
      }
    }
  }

  private previewTint(def: ItemDef): number {
    if (def.kind === "road") return 0x9aa0ab;
    if (def.kind === "zone") return def.art.base;
    const id = activeLineId.value;
    if (id === null) return 0xffffff;
    const city = this.getCity();
    const line = (def.kind === "rail" ? city.railLines : city.subwayLines).get(id);
    return line ? hueToColor(line.hue) : 0xffffff;
  }

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
