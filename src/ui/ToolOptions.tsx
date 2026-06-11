import type { Game } from "../app/game";
import { getItem } from "../core/catalog/items";
import {
  activeTool,
  gridLock,
  selectedItem,
  shiftHeld,
  zoneBrushSize,
  zonePaintMode,
} from "../state/uiState";

const BRUSH_SIZES: Array<1 | 3 | 5> = [1, 3, 5];

/** Context options shown above the tray: Grid Lock for networks, brush/rect for zones. */
export function ToolOptions({ game }: { game: Game }) {
  if (activeTool.value !== "item") return null;
  const def = selectedItem.value ? getItem(selectedItem.value) : null;
  if (!def) return null;

  if (def.kind === "road" || def.kind === "rail" || def.kind === "subway") {
    const locked = gridLock.value || shiftHeld.value;
    return (
      <div class="tool-options">
        <button
          class={locked ? "selected" : ""}
          onClick={() => (gridLock.value = !gridLock.value)}
          title="Drags draw a straight run with one clean corner"
        >
          📐 Grid Lock
          {!game.tools.isTouchDevice && <span class="key-hint">Shift</span>}
        </button>
      </div>
    );
  }

  if (def.kind === "zone") {
    const rect = zonePaintMode.value === "rect";
    return (
      <div class="tool-options">
        {BRUSH_SIZES.map((size) => (
          <button
            key={size}
            class={!rect && zoneBrushSize.value === size ? "selected" : ""}
            onClick={() => {
              zonePaintMode.value = "brush";
              zoneBrushSize.value = size;
            }}
            title={`Paint with a ${size}×${size} brush`}
          >
            {size}×{size}
          </button>
        ))}
        <button
          class={rect ? "selected" : ""}
          onClick={() => (zonePaintMode.value = rect ? "brush" : "rect")}
          title="Drag corner-to-corner to fill a rectangle"
        >
          ⬛ Rect
        </button>
      </div>
    );
  }

  return null;
}
