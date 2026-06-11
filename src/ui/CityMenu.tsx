import { useEffect, useState } from "preact/hooks";
import type { Game } from "../app/game";
import type { SlotMeta } from "../app/saveManager";
import { CITY_SIZES, DEFAULT_CITY_SIZE } from "../core/model/city";
import { openModal } from "../state/uiState";

export function CityMenu({ game }: { game: Game }) {
  const [slots, setSlots] = useState<SlotMeta[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState<number>(DEFAULT_CITY_SIZE);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = () => {
    void game.listSlots().then(setSlots);
  };
  useEffect(refresh, [game]);

  const close = () => (openModal.value = null);

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal">
        <h2>🏙️ My Cities</h2>

        <div class="slot-list">
          {slots === null && <div class="hint">Loading…</div>}
          {slots?.length === 0 && (
            <div class="hint">No saved cities yet — start one below!</div>
          )}
          {slots?.map((slot) => (
            <div class="slot" key={slot.id}>
              <div class="info">
                <div class="name">{slot.name}</div>
                <div class="sub">
                  👥 {slot.population.toLocaleString()} ·{" "}
                  {new Date(slot.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div class="actions">
                {confirmDelete === slot.id ? (
                  <>
                    <button
                      class="danger"
                      style={{ background: "var(--bad)", color: "white" }}
                      onClick={() => {
                        void game.deleteSlot(slot.id).then(() => {
                          setConfirmDelete(null);
                          refresh();
                        });
                      }}
                    >
                      Sure?
                    </button>
                    <button onClick={() => setConfirmDelete(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <button
                      title="Open"
                      onClick={() => {
                        void game
                          .loadCity(slot.id)
                          .then(close)
                          .catch((err: Error) => setError(err.message));
                      }}
                    >
                      ▶️
                    </button>
                    <button
                      title="Duplicate"
                      onClick={() => void game.duplicateSlot(slot.id).then(refresh)}
                    >
                      📋
                    </button>
                    <button title="Delete" onClick={() => setConfirmDelete(slot.id)}>
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: "18px" }}>✨ New City</h2>
        <input
          type="text"
          placeholder="City name"
          maxLength={40}
          value={newName}
          onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
        />
        <div class="size-options">
          {CITY_SIZES.map((size) => (
            <button
              key={size}
              class={newSize === size ? "selected" : ""}
              onClick={() => setNewSize(size)}
            >
              {size}²
            </button>
          ))}
        </div>
        {error && <div class="error">{error}</div>}
        <div class="row">
          <button
            class="btn primary"
            onClick={() => {
              void game
                .newCity(newName.trim() || "New City", newSize)
                .then(close)
                .catch((err: Error) => setError(err.message));
            }}
          >
            Build it!
          </button>
          <button class="btn" onClick={() => (openModal.value = "name-city")}>
            ✏️ Rename
          </button>
          <button class="btn" onClick={() => (openModal.value = "share")}>
            📤 Share / Import
          </button>
          <button class="btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
