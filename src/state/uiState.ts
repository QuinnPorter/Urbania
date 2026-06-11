import { signal } from "@preact/signals";
import type { CategoryId, CoverageLayer } from "../core/catalog/schema";
import type { LineKind } from "../core/model/types";

export type ToolId =
  | "inspect"
  | "item" // place selectedItem
  | "bulldoze"
  | "nhood";

export const activeTool = signal<ToolId>("inspect");
export const activeCategory = signal<CategoryId | null>(null);
/** Item id from the catalog when activeTool === "item". */
export const selectedItem = signal<string | null>(null);
export const ghostRotation = signal<0 | 1 | 2 | 3>(0);

/** Pending mobile building placement awaiting ✓ confirm. */
export const pendingPlacement = signal<{
  x: number;
  y: number;
  valid: boolean;
} | null>(null);

/** Neighbourhood id currently being painted (nhood tool). */
export const activeNeighbourhoodId = signal<number | null>(null);

/** The transit line currently being painted, when a line tool is active. */
export const activeLineKind = signal<LineKind | null>(null);
export const activeLineId = signal<number | null>(null);

/** Grid Lock: drags draw a straight/L path instead of freehand. */
export const gridLock = signal(false);
/** Shift held (desktop) temporarily forces Grid Lock. */
export const shiftHeld = signal(false);
export function isGridLockActive(): boolean {
  return gridLock.value || shiftHeld.value;
}

/** Zone painting options. */
export const zoneBrushSize = signal<1 | 3 | 5>(1);
export const zonePaintMode = signal<"brush" | "rect">("brush");

export const heatmapLayer = signal<CoverageLayer | null>(null);

export type ModalId =
  | "city-menu"
  | "name-city"
  | "name-nhood"
  | "line-picker"
  | "share"
  | null;
export const openModal = signal<ModalId>(null);

export const cityName = signal<string>("");

/** Bump to force UI refresh after loading a different city. */
export const cityRevision = signal(0);

export function selectItem(id: string, category: CategoryId): void {
  selectedItem.value = id;
  activeCategory.value = category;
  activeTool.value = "item";
  ghostRotation.value = 0;
  pendingPlacement.value = null;
  // Picking a regular item drops any active transit line (chip disappears).
  activeLineKind.value = null;
  activeLineId.value = null;
}

export function selectTool(tool: ToolId): void {
  activeTool.value = tool;
  if (tool !== "item") {
    selectedItem.value = null;
    pendingPlacement.value = null;
    activeLineId.value = null;
    activeLineKind.value = null;
  }
}

/** Make a transit line the active paint tool (from the line picker). */
export function useLine(kind: LineKind, id: number): void {
  activeLineKind.value = kind;
  activeLineId.value = id;
  selectedItem.value = kind === "rail" ? "train-line" : "subway-line";
  activeCategory.value = "infrastructure";
  activeTool.value = "item";
  ghostRotation.value = 0;
  pendingPlacement.value = null;
}
