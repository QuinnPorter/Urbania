import { useState } from "preact/hooks";
import type { Game } from "../app/game";
import { cityName, openModal } from "../state/uiState";

/** Rename the city. */
export function NameCityDialog({ game }: { game: Game }) {
  const [name, setName] = useState(cityName.value);
  const close = () => (openModal.value = null);
  const save = () => {
    game.renameCity(name);
    close();
  };
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal">
        <h2>✏️ Name your city</h2>
        <input
          type="text"
          maxLength={40}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <div class="row">
          <button class="btn primary" onClick={save}>
            Save
          </button>
          <button class="btn" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Name a brand-new neighbourhood, then start painting it. */
export function NameNeighbourhoodDialog({ game }: { game: Game }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const close = () => (openModal.value = null);
  const start = () => {
    if (game.startNeighbourhood(name)) {
      close();
    } else {
      setError("This city already has the maximum number of districts.");
    }
  };
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal">
        <h2>🏷️ Name a district</h2>
        <input
          type="text"
          placeholder="e.g. Old Town, Riverside…"
          maxLength={30}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
        />
        <div class="hint">
          After naming it, drag on the map to paint the district's area.
        </div>
        {error && <div class="error">{error}</div>}
        <div class="row">
          <button class="btn primary" onClick={start}>
            Start painting
          </button>
          <button class="btn" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
