# Facet

Facet is a browser puzzle about matching cut stones and spending the pressure they leave behind. Swap neighbors to make lines of three. Clears strain nearby gems; flawed stones join adjacent clears and score double. Longer lines earn brilliants, stars, and prisms. Reach each level’s target and continue until no productive move remains.

## Run

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. Everything runs in the browser; there is no backend or external runtime service.

```sh
npm run build
npm run preview
```

The build emits the complete static site into `dist/`. Serve that directory from any static server, including from a sub-path. All assets are page-relative and included locally.

## Controls

- Mouse, pen, or touch: press a gem, drag onto an orthogonal neighbor, and release. Alternatively tap one gem, then its neighbor. Returning to the original gem before release withdraws the offer.
- Menus: click or tap an item, or use ↑ / ↓ and Enter / Space.
- P or Escape: pause or resume. The on-screen PAUSE control also opens the menu.
- Escape: return from the instructions or final board.
- M: mute or unmute all music and effects.
- Backquote: the engine’s diagnostic overlay.

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests cover the simulation, control paths, debug poses, and complete engine frames over a native canvas. The engine’s debug API is returned by `initialize`, never exposed on the page. See `specs/instrumentation.md` for its contract.

## Art and sound

All gem sprites, fracture variants, cut overlays, break frames, prism frames, the board surround, four live particle systems, sound effects, and music were authored for this game. The one-time authoring script is `scripts/produce-assets.py`; it uses the six asset tools supplied in the production environment. Its output is committed under `public/assets/`. Neither installation nor building invokes those tools. Music scores are included as MIDI alongside the playable WAV files.

`showcase/` contains screenshots and a five-second recording made by the engine’s drawing recorder. `scripts/capture.mjs` recreates the showcase while the development server is running at port 5173.
