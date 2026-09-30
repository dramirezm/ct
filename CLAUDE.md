# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **Frontend:** HTML5 + vanilla JavaScript (ES6+, `'use strict'`), Canvas 2D API
- **Styling:** plain CSS3 (flexbox, `backdrop-filter`)
- **Backend / Database / Auth:** none
- **Build / Dependencies:** none — no `package.json`, bundler, transpiler, linter, or test suite

## Running

No build step. Serve the directory statically and open `http://localhost:8000`:

```bash
python3 -m http.server 8000
# or: npx serve .   |   open index.html
```

There are no automated tests or lint commands; verify changes by playing in the browser.

## Architecture

Classic Tetris in three files: `index.html` (DOM + two canvases + overlay), `style.css`, and `game.js` (all logic).

`game.js` is a single script with module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`) shared by plain functions — no classes or modules. `init()` resets all of it and is also the restart handler.

Key conventions:

- **Board model:** `ROWS × COLS` matrix; each cell is `0` (empty) or a piece type index `1–7`. The same index is stored in piece shape matrices and used to look up `COLORS[index]`, so `PIECES` and `COLORS` must stay index-aligned (index 0 is `null` in both).
- **Pieces:** `{ type, shape, x, y }`; `shape` is a square matrix copied from `PIECES`. Rotation (`rotateCW`) is transpose + row reverse; `tryRotate` applies simple horizontal wall kicks `[0, -1, 1, -2, 2]` (not SRS).
- **Collision:** `collide(shape, ox, oy)` is the single source of truth for movement, rotation, ghost projection (`ghostY`), and game-over detection in `spawn()`. Cells with `y < 0` are allowed.
- **Game loop:** `requestAnimationFrame(loop)` accumulates `dt` into `dropAccum`; when it exceeds `dropInterval` the piece falls or `lockPiece()` runs (`merge` → `clearLines` → `spawn`). Pause/game over cancel the frame via `animId`; resume calls `loop()` directly after resetting `lastTime`.
- **Scoring/levels:** `LINE_SCORES[cleared] * level`; hard drop +2/cell, soft drop +1/row. Level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)`.
- **HUD:** DOM elements are updated only via `updateHUD()`; the next-piece preview is drawn by `drawNext()` on a separate 120×120 canvas (4×4 cells of 30px).

## Gotchas

- Changing `COLS`, `ROWS`, or `BLOCK` requires updating the `<canvas id="board">` `width`/`height` in `index.html` (`COLS × BLOCK` by `ROWS × BLOCK`).
- User-facing strings (HTML, overlay text, README) are in Spanish; keep code and comments in English.
