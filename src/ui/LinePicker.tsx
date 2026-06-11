import { useState } from "preact/hooks";
import type { Game } from "../app/game";
import { activeLineId, activeLineKind, openModal } from "../state/uiState";
import { hueToColor } from "../render/stage";

/** Pick an existing transit line to continue, or name a new one. */
export function LinePicker({ game }: { game: Game }) {
  const kind = activeLineKind.value ?? "rail";
  const registry =
    kind === "rail" ? game.currentCity.railLines : game.currentCity.subwayLines;
  const lines = [...registry.values()];
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const close = () => (openModal.value = null);

  const create = () => {
    if (game.startLine(kind, name)) close();
    else setError("This city already has the maximum number of lines.");
  };

  const swatch = (hue: number) =>
    `#${hueToColor(hue).toString(16).padStart(6, "0")}`;

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal">
        <h2>{kind === "rail" ? "🚆 Train lines" : "🚇 Subway lines"}</h2>

        {lines.length > 0 && (
          <div class="slot-list">
            {lines.map((line) => (
              <div class="slot" key={line.id}>
                <div class="info" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    class="swatch"
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "6px",
                      background: swatch(line.hue),
                    }}
                  />
                  <span class="name">{line.name}</span>
                  {activeLineId.value === line.id && (
                    <span class="sub">painting</span>
                  )}
                </div>
                <div class="actions">
                  <button
                    title="Continue this line"
                    onClick={() => {
                      game.selectLine(kind, line.id);
                      close();
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    title="Delete line"
                    onClick={() => {
                      game.dissolveLine(kind, line.id);
                      // Re-render the list by reopening the same modal.
                      openModal.value = null;
                      openModal.value = "line-picker";
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ marginTop: "16px", fontSize: "16px" }}>＋ New line</h2>
        <input
          type="text"
          placeholder={kind === "rail" ? "e.g. Red Line, Airport Express…" : "e.g. Circle Line…"}
          maxLength={28}
          value={name}
          onInput={(e) => {
            setName((e.target as HTMLInputElement).value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <div class="hint">After choosing a line, drag on the map to lay track.</div>
        {error && <div class="error">{error}</div>}
        <div class="row">
          <button class="btn primary" onClick={create}>
            Create &amp; paint
          </button>
          <button class="btn" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
