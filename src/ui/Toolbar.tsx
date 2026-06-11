import { CATEGORIES, itemsInCategory } from "../core/catalog/items";
import {
  activeCategory,
  activeLineKind,
  activeTool,
  openModal,
  selectItem,
  selectTool,
  selectedItem,
} from "../state/uiState";

/** Bottom bar: category buttons + global tools. */
export function Toolbar() {
  return (
    <div class="toolbar">
      <button
        class={activeTool.value === "inspect" ? "selected" : ""}
        onClick={() => {
          selectTool("inspect");
          activeCategory.value = null;
        }}
      >
        <span class="emoji">🖐️</span>
        Look
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          class={activeCategory.value === cat.id ? "selected" : ""}
          onClick={() => {
            if (activeCategory.value === cat.id) {
              activeCategory.value = null;
              selectTool("inspect");
            } else {
              activeCategory.value = cat.id;
              const first = itemsInCategory(cat.id)[0];
              if (first) selectItem(first.id, cat.id);
            }
          }}
        >
          <span class="emoji">{cat.emoji}</span>
          {cat.name}
        </button>
      ))}
      <button
        class={activeTool.value === "nhood" ? "selected" : ""}
        onClick={() => openModal.value = "name-nhood"}
      >
        <span class="emoji">🏷️</span>
        District
      </button>
      <button
        class={activeTool.value === "bulldoze" ? "selected" : ""}
        onClick={() => {
          selectTool("bulldoze");
          activeCategory.value = null;
        }}
      >
        <span class="emoji">🚜</span>
        Bulldoze
      </button>
    </div>
  );
}

/** Item swatches for the active category. */
export function ItemTray() {
  const category = activeCategory.value;
  if (!category) return null;
  const items = itemsInCategory(category);
  return (
    <div class="tray">
      {items.map((item) => (
        <button
          key={item.id}
          class={`tray-item ${selectedItem.value === item.id ? "selected" : ""}`}
          onClick={() => {
            // Line tools need a named line chosen first — open the picker.
            if (item.kind === "rail" || item.kind === "subway") {
              activeLineKind.value = item.kind;
              openModal.value = "line-picker";
            } else {
              selectItem(item.id, category);
            }
          }}
        >
          <span
            class="swatch"
            style={{ background: `#${item.art.base.toString(16).padStart(6, "0")}` }}
          />
          {item.name}
          <span class="size">
            {item.kind === "building"
              ? `${item.footprint.w}×${item.footprint.h}`
              : "paint"}
          </span>
        </button>
      ))}
    </div>
  );
}
