import { TILE } from "../render/textureFactory";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

/**
 * Camera state: world is scaled by `zoom` and translated by `pan` (screen px).
 * screen = world * zoom + pan.
 */
export class Camera {
  panX = 0;
  panY = 0;
  zoom = 1;

  private viewW = 1;
  private viewH = 1;
  private worldW = 1;
  private worldH = 1;

  setViewport(width: number, height: number): void {
    this.viewW = width;
    this.viewH = height;
    this.clamp();
  }

  setWorldSize(tilesW: number, tilesH: number): void {
    this.worldW = tilesW * TILE;
    this.worldH = tilesH * TILE;
    this.clamp();
  }

  centerOnWorld(): void {
    this.panX = this.viewW / 2 - (this.worldW / 2) * this.zoom;
    this.panY = this.viewH / 2 - (this.worldH / 2) * this.zoom;
    this.clamp();
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.clamp();
  }

  /** Zoom keeping the world point under (screenX, screenY) fixed. */
  zoomAt(screenX: number, screenY: number, nextZoom: number): void {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    const worldX = (screenX - this.panX) / this.zoom;
    const worldY = (screenY - this.panY) / this.zoom;
    this.zoom = z;
    this.panX = screenX - worldX * z;
    this.panY = screenY - worldY * z;
    this.clamp();
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom,
    };
  }

  screenToTile(screenX: number, screenY: number): { x: number; y: number } {
    const w = this.screenToWorld(screenX, screenY);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }

  /** Keep at least some city on screen; allow a soft margin around it. */
  private clamp(): void {
    const margin = 80;
    const minPanX = this.viewW - this.worldW * this.zoom - margin;
    const maxPanX = margin;
    const minPanY = this.viewH - this.worldH * this.zoom - margin;
    const maxPanY = margin;
    // When the world is smaller than the view, center-clamp instead.
    if (minPanX > maxPanX) {
      this.panX = (minPanX + maxPanX) / 2;
    } else {
      this.panX = Math.max(minPanX, Math.min(maxPanX, this.panX));
    }
    if (minPanY > maxPanY) {
      this.panY = (minPanY + maxPanY) / 2;
    } else {
      this.panY = Math.max(minPanY, Math.min(maxPanY, this.panY));
    }
  }
}
