import { useState } from "preact/hooks";
import type { Game } from "../app/game";
import { openModal } from "../state/uiState";

export function ShareModal({ game }: { game: Game }) {
  const [code, setCode] = useState<string>("");
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const close = () => (openModal.value = null);

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal">
        <h2>📤 Share this city</h2>
        {code ? (
          <>
            <textarea readOnly value={code} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <div class="hint">{code.length.toLocaleString()} characters</div>
          </>
        ) : null}
        <div class="row">
          <button
            class="btn primary"
            onClick={() => {
              const next = game.exportCode();
              setCode(next);
              void game.clipboard
                .write(next)
                .then(() => setMessage("Copied to clipboard!"))
                .catch(() => setMessage("Copy the code above manually."));
            }}
          >
            {code ? "Copy again" : "Create share code"}
          </button>
          {message && <span class="hint">{message}</span>}
        </div>

        <h2 style={{ marginTop: "18px" }}>📥 Import a city</h2>
        <textarea
          placeholder="Paste a URB1. code here"
          value={importText}
          onInput={(e) => {
            setImportText((e.target as HTMLTextAreaElement).value);
            setError("");
          }}
        />
        {error && <div class="error">{error}</div>}
        <div class="row">
          <button
            class="btn primary"
            disabled={!importText.trim()}
            onClick={() => {
              void game
                .importCity(importText)
                .then(close)
                .catch((err: Error) => setError(err.message));
            }}
          >
            Import as new city
          </button>
          <button class="btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
