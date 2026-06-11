import { useEffect, useState } from "preact/hooks";
import type { Game } from "../app/game";
import { getItem } from "../core/catalog/items";
import {
  activeLineId,
  activeLineKind,
  activeTool,
  cityName,
  openModal,
  pendingPlacement,
  selectedItem,
} from "../state/uiState";
import { hueToColor } from "../render/stage";
import { shiftHeld } from "../state/uiState";
import { StatsHud, CoverageRow } from "./StatsHud";
import { Toolbar, ItemTray } from "./Toolbar";
import { ToolOptions } from "./ToolOptions";
import { CityMenu } from "./CityMenu";
import { ShareModal } from "./ShareModal";
import { NameCityDialog, NameNeighbourhoodDialog } from "./NameDialog";
import { LinePicker } from "./LinePicker";

const FIRSTRUN_KEY = "urbania-seen-intro";

export function App({ game }: { game: Game }) {
  const [showIntro, setShowIntro] = useState(
    () => !localStorage.getItem(FIRSTRUN_KEY),
  );

  // Esc cancels pending placement / closes modals; Shift forces Grid Lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openModal.value) openModal.value = null;
        else game.tools.cancelPlacement();
      }
      if (e.key === "r" || e.key === "R") game.tools.rotateGhost();
      if (e.key === "Shift") shiftHeld.value = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeld.value = false;
    };
    const onBlur = () => (shiftHeld.value = false); // avoid stuck Shift on Alt-Tab
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [game]);

  const pending = pendingPlacement.value;
  const def = selectedItem.value ? getItem(selectedItem.value) : null;
  const showConfirm =
    pending !== null &&
    game.tools.isTouchDevice &&
    activeTool.value === "item" &&
    def?.kind === "building";

  // Active transit line indicator (when a line tool is selected).
  const lineKind = activeLineKind.value;
  const lineId = activeLineId.value;
  const activeLine =
    lineKind && lineId !== null && activeTool.value === "item"
      ? (lineKind === "rail"
          ? game.currentCity.railLines
          : game.currentCity.subwayLines
        ).get(lineId)
      : null;

  return (
    <>
      <div class="topbar">
        <button class="city-chip" onClick={() => (openModal.value = "city-menu")}>
          🏙️ {cityName.value || "Urbania"} <span style={{ opacity: 0.5 }}>▾</span>
        </button>
        <StatsHud />
      </div>
      <CoverageRow />

      <div class="toolbar-wrap">
        {activeLine && (
          <button
            class="line-chip"
            onClick={() => (openModal.value = "line-picker")}
            title="Change line"
          >
            <span
              class="swatch"
              style={{ background: `#${hueToColor(activeLine.hue).toString(16).padStart(6, "0")}` }}
            />
            {lineKind === "rail" ? "🚆" : "🚇"} {activeLine.name}
            <span style={{ opacity: 0.5 }}>▾</span>
          </button>
        )}
        <ToolOptions game={game} />
        <ItemTray />
        <Toolbar />
      </div>

      {showConfirm && (
        <div class="confirm-bar">
          {def?.rotatable && (
            <button class="rot" onClick={() => game.tools.rotateGhost()} title="Rotate">
              🔄
            </button>
          )}
          <button
            class="ok"
            disabled={!pending.valid}
            onClick={() => game.tools.confirmPlacement()}
            title="Place"
          >
            ✓
          </button>
          <button class="no" onClick={() => game.tools.cancelPlacement()} title="Cancel">
            ✕
          </button>
        </div>
      )}

      {openModal.value === "city-menu" && <CityMenu game={game} />}
      {openModal.value === "share" && <ShareModal game={game} />}
      {openModal.value === "name-city" && <NameCityDialog game={game} />}
      {openModal.value === "name-nhood" && <NameNeighbourhoodDialog game={game} />}
      {openModal.value === "line-picker" && <LinePicker game={game} />}

      {showIntro && (
        <div class="firstrun">
          <h2>Welcome to Urbania! 🏗️</h2>
          <p>🛣️ Pick a category below, then drag on the map to build.</p>
          <p>✌️ Two fingers always pan & zoom (mouse: drag / wheel).</p>
          <p>🏷️ Name your city and paint named districts.</p>
          <div class="row" style={{ justifyContent: "center" }}>
            <button
              class="btn primary"
              onClick={() => {
                localStorage.setItem(FIRSTRUN_KEY, "1");
                setShowIntro(false);
              }}
            >
              Let's build!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
