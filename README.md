# Urbania 🏙️

A freeplay city-design game. Place roads, transit, schools, parks, and stadiums on a birdseye grid; name your city and its districts; watch population, happiness, and service coverage react as you build. No money, no fail states — just design.

## Run it

```sh
npm install
npm run dev       # dev server on http://localhost:5173 (also exposed on LAN for phone testing)
npm test          # core unit tests (Vitest)
npm run build     # type-check + production build with PWA service worker → dist/
npm run preview   # serve the production build
```

Open it on your phone via the LAN URL Vite prints — the game is touch-first (one finger paints, two fingers always pan/zoom).

## How to play

- **Pick a category** in the bottom toolbar (Roads, Zones, Transit, Edu & Health, Culture & Parks, Services), then an item from the tray.
- **Roads & zones**: drag to paint. Roads auto-connect into corners, T-junctions, and crossroads.
- **Buildings**: tap to preview the ghost (green = valid, red = blocked), then ✓ to place (desktop: click places directly, `R` rotates). Most buildings must touch a road.
- **Districts**: tap 🏷️, name it, then paint its area — the name floats over the map when zoomed out.
- **Stats**: the top-right HUD shows population 👥, jobs 💼, and happiness. Tap a coverage pill (🎓 ❤️ 🚌 🛡️) to see that service's reach as a heatmap.
- **Cities menu** (tap the city name): multiple save slots, rename, duplicate, and share codes — export your city as a compact `URB1.…` string anyone can import.

Cities auto-save to your device every few seconds. Install it as a PWA (Add to Home Screen) to play offline.

## Architecture

| Layer | What lives there |
|---|---|
| `src/core/` | Pure TS, no Pixi/DOM imports — city model (typed arrays), data-driven item catalog, actions, road autotiling, stats, save/share-code serialization. Everything Vitest covers. |
| `src/render/` | PixiJS v8 — procedural texture atlas (all art is drawn in code, zero image assets), layered stage, ambient cars/citizens, tween helper. |
| `src/input/` | Camera (pan/zoom/clamp) and the pointer-event gesture state machine (tap vs drag vs pinch). |
| `src/ui/` | Preact + signals — toolbar, item tray, stats HUD, modals. DOM overlays the canvas. |
| `src/app/` | Orchestration: `game.ts` wires everything; `saveManager.ts` owns autosave + slots. |
| `src/platform/` | `StoragePort`/`ClipboardPort` seams — swap in Capacitor implementations to ship native apps without touching game code. |

Adding a new building = one object literal in [items.ts](src/core/catalog/items.ts) (and optionally a new icon glyph in [textureFactory.ts](src/render/textureFactory.ts)). The toolbar, placement rules, stats, and save format all pick it up automatically.

### Save format & share codes

Local saves are versioned JSON (RLE-compressed grids) in IndexedDB, with a migration chain for future format changes. Share codes are `URB1.` + base64url(deflate(binary)) — a busy 64×64 city is ~1–3 KB of text. Derived data (road masks, stats, ambient agents) is never serialized; it's recomputed on load.
