# Implementation Plan: Drawing Tools

**Branch**: `003-drawing-tools` | **Date**: 2026-10-23 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-drawing-tools/spec.md`

## Summary

The Drawing Tools feature provides institutional technical analysis drawing capabilities on top of the `@luxalgo/vela` WebGL2 charting engine, matching TradingView's signature UX. Traders can arm drawing tools via a draggable glassmorphic floating toolbar, access all 83 categorized tools via a searchable Drawing Tools Library modal (`DrawingToolsLibrary`), use keyboard shortcuts (`Alt+T`, `Alt+H`, `Alt+F`, `Alt+B`, `Alt+P`, `Alt+V`, `Ctrl+Z`, `Ctrl+Y`), toggle magnet snap modes (`off`, `weak`, `strong`), lock, hide, or clear canvas drawings, and interact with drawings via a right-click object context menu (`CanvasContextMenu` — settings, duplicate, lock/unlock, z-order, remove). Drawings are persisted per symbol in `localStorage` under `tc_drawings_by_symbol` (swapping automatically when symbols change), saved per cell in multi-chart layouts (`LayoutManager`), mirrored across grid cells when drawing sync is enabled, and trader favorite tools are persisted locally (`tradingchart_drawing_favorites`) and synced to user cloud accounts (`drawingFavorites` via `/api/user/state`).

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser, Node.js v20+ ESM on server).

**Primary Dependencies**:
- `@luxalgo/vela`: `^0.7.5` (WebGL2 charting engine, `chart.drawings` DrawingsControl facade, drawing renderers, hit-testing, history undo/redo, snap modes).
- `express`: `^4.21.2` (HTTP backend framework, REST API, cloud state persistence).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography for library modal, floating toolbar, and context menus).
- `@fontsource/inter`: `^5.3.0` (Latin typography).
- `puppeteer-core`: `^24.3.1` (Headless browser testing).
- `vite`: `^6.4.5` (Client bundler and build system).

**Storage**:
- Client `localStorage`:
  - `tradingchart_drawing_favorites`: Serialized JSON array of favorite tool key strings (e.g. `["trendline","hline","ray","fibretracement","box","position","datepricerange","freehand","text"]`).
  - `tradingchart_fav_toolbar_pos`: Serialized JSON coordinate object `{ top?: number, bottom?: number, left?: number }` for floating dock placement.
  - `tc_drawings_by_symbol`: Serialized JSON map `{ [symbol: string]: SerializedDrawing[] }` storing per-symbol drawing documents.
  - `tradingchart_layout_sync`: Serialized 6-axis synchronization options including `drawings: boolean`.
  - `tradingchart_user_layouts` & `tradingchart_current_layout`: Serialized layout objects storing `drawings` per chart cell.
- Server atomic JSON files:
  - `server/data/accounts/states/state_{userId}.json`: Per-user cloud state object storing synced `drawingFavorites` and layout drawings.

**Testing**:
- Puppeteer browser suites executed via `node tests/<file>.cjs` or `scripts/qa/qa_run.sh`:
  - `tests/qa_cycle_dtl.cjs`: Verifies library modal opening, tool count (>=60), search filter ('fib'), tool arming and auto-close, star favorite pinning, desktop vs mobile, Persian RTL.
  - `tests/qa_cycle_ctx_depth.cjs`: Verifies drawing object context menu actions (settings, duplicate, remove) and history depth.
  - `tests/qa_parity_recon.cjs`: Probes DrawingsControl API with all 75+ Vela drawing types and inventories live DOM tools.
  - `tests/test_interactive_drawings.cjs`: Puppeteer canvas drag tests for trendline, hline, box, trash clear, and keyboard shortcuts.
  - `tests/qa_crusade_omni.cjs`: Verifies activation of favorite drawing buttons (`[data-tool="..."]`) and auxiliary buttons.
  - `tests/qa_cycleB.cjs`: Context menu right-click and drawing interaction verification.

**Target Platform**: Evergreen desktop and mobile web browsers (Chromium, Firefox, Safari, WebKit) on Linux, macOS, Windows, iOS, and Android; Node.js v20+ Linux server environment.

**Project Type**: Responsive web charting application (`client/`) backed by an Express.js server (`server/`).

**Performance Goals**:
- Instant tool arming (<16 ms) upon toolbar or shortcut interaction without UI frame drops.
- Smooth WebGL2 drawing rendering maintaining 60 FPS during line creation and drag repositioning.
- Debounced floating toolbar drag clamping updating position without lag.
- Library modal search filtering across 83 tools in <10 ms with instant DOM updates.

**Constraints**:
- Maximum payload size for cloud state sync capped at 2MB (`STATE_MAX_BYTES`).
- Floating toolbar must never obstruct axis labels or engine collapse controls (clamped >52px left, >46px top, >68px bottom).
- Mobile viewports (<=768px) hide floating toolbar (`display: none !important;`) to prevent viewport clutter.
- Touch targets must meet minimum 44px guidelines.

**Scale/Scope**:
- 83 categorized drawing tools across 9 groups in `CATALOG` (Trend Lines, Channels & Pitchforks, Fibonacci, Gann, Geometric Shapes, Annotations & Text, Patterns, Forecast & Measurement, Volume Profile & VWAP).
- 75+ underlying engine types supported by `@luxalgo/vela` DrawingsControl facade.
- 9 default pinned favorite tools in `DEFAULT_FAVORITES`.
- 6 dedicated keyboard shortcuts for primary drawing tools.

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | Drawing tools operate on user-defined geometric anchors placed at authentic price ticks and candle timestamps; no synthetic, fake, or decorative price levels are generated. |
| II | Spec Before Code | GAP | Built prior to SDD adoption (September–October 2026); this retrofit formalizes normative requirements (`spec.md`) and descriptive Spec Kit documentation. |
| III | Real-Browser Zero-Defect Verification | PASS (with GAP) | Verified through dedicated Puppeteer test suites (`tests/qa_cycle_dtl.cjs`, `tests/qa_cycle_ctx_depth.cjs`, `tests/qa_parity_recon.cjs`, `tests/test_interactive_drawings.cjs`, `tests/qa_crusade_omni.cjs`, `tests/qa_cycleB.cjs`) across desktop and mobile viewports, English and Persian locales. |
| IV | Bilingual Parity and RTL Correctness | PASS (with GAP) | Library modal (`#drawing-tools-modal`), toolbar tooltips, and context menu (`#canvas-context-menu`) support Persian RTL typography via Vazirmatn font, RTL attribute/direction, and translated strings (`client/src/i18nEngineFa.js`). Gap: `client/src/main.js:1824` references `this.floatingDrawingToolbar?.render?.()` instead of `this.floatingToolbar?.render?.()`, preventing floating toolbar re-rendering on language switch. |
| V | Mobile Fit and Interaction Safety | PASS | Floating toolbar is cleanly hidden on viewports <=768px via CSS `display: none !important;` (`styles/main.css:2043-2046`); mobile drawing relies on Vela's native drawer; library modal expands to full screen (`100vw` x `92vh`) on mobile. |
| VI | Security and Privacy by Default | PASS | Cloud state sync for `drawingFavorites` requires authenticated session `tc_session` (`server/accounts.js:945,951`); state payloads capped at 2MB (`server/accounts.js:957`); no client-side secret exposure. |
| VII | Single Source of Truth for Entitlements | PASS (with GAP) | `drawingTools` entitlement is declared in `server/featuresCatalog.js:202` and `server/accounts.js:54,78,102,126,150` across all plans (true). Gap: entitlement is never gated on client or server since all tiers include drawing tools. |
| VIII | Performance Budget | PASS | Drawing rendering is GPU-accelerated via `@luxalgo/vela` WebGL2 pipeline maintaining 60 FPS; dynamic tool capability probe is cached (`supportedCache`); dragging uses lightweight mouse event listeners. |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Native DOM, WebGL2, and standard browser APIs; `@luxalgo/vela` DrawingsControl manipulated exclusively through public API methods (`setTool`, `setMagnet`, `setLocked`, `setVisible`, `clear`, `undo`, `redo`, `toJSON`, `fromJSON`) without modifying vendor packages in `node_modules`. |
| X | Hybrid SDD | PASS (with GAP) | Retrofit process adheres to Hybrid SDD governance rules: `spec.md` is normative and immutable; descriptive Spec Kit artifacts bridge existing code to formal contracts; zero-token machine gates validate artifact presence. |

## Project Structure

### Documentation (this feature)

```text
specs/003-drawing-tools/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-014, SC-001..SC-004)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R8, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server cloud state REST routes (/api/user/state)
│   └── module-api.md           # Client module interfaces, methods, and event bindings
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── tasks.md                    # Executed implementation task inventory mapped to FRs
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # HTML topbar triggers (#btn-undo, #btn-redo, #btn-magnet)
├── src/
│   ├── drawingToolsLibrary.js  # 83-tool catalog, 9 categories, search filter, star favorites, modal lifecycle
│   ├── floatingDrawingToolbar.js # Glassmorphic dock, favorite tools, magnet, lock, hide, clear, minimize, drag
│   ├── canvasContextMenu.js    # Canvas right-click object menu (settings, duplicate, lock, front/back, remove)
│   ├── chartManager.js         # Workspace bridge, per-symbol drawing stashing (tc_drawings_by_symbol), arm/clear
│   ├── layoutManager.js        # Multi-chart cell drawing serialization (toJSON/fromJSON), drawing sync (ws.sync)
│   ├── main.js                 # App bootstrap, drawing shortcuts (Ctrl+Z, Ctrl+Y, Alt+T/H/F/B/P/V), topbar buttons
│   ├── authManager.js          # Cloud state synchronization mapping drawing_favorites to drawingFavorites
│   ├── i18nEngineFa.js         # Persian translation dictionary for drawing tools, groups, and actions
│   └── i18n.js                 # Translation helper and DOM localizer
├── styles/
│   └── main.css                # Floating toolbar styling, library modal, glassmorphism, responsive @media
server/
├── accounts.js                 # Cloud state sync endpoints (GET/PUT /api/user/state), plan entitlements
├── featuresCatalog.js          # Canonical drawingTools feature flag definition
└── data/
    └── accounts/
        └── states/             # Per-user cloud state JSON files (state_{userId}.json)
tests/
├── qa_cycle_dtl.cjs            # Library modal, search, arming, favorites, mobile, RTL Puppeteer test
├── qa_cycle_ctx_depth.cjs      # Drawing context menu actions (duplicate, remove) Puppeteer test
├── qa_parity_recon.cjs         # Live DOM and DrawingsControl API probe for 75+ Vela drawing types
├── test_interactive_drawings.cjs # Canvas drag and keyboard shortcuts interactive test
├── qa_crusade_omni.cjs         # Surface validation for favorite drawing buttons and auxiliary controls
└── qa_cycleB.cjs               # Context menu right-click and drawing interaction verification
```

**Structure Decision**: Modular web application where client-side drawing tools are partitioned into `DrawingToolsLibrary` (`client/src/drawingToolsLibrary.js`) for catalog modal interactions, `FloatingDrawingToolbar` (`client/src/floatingDrawingToolbar.js`) for quick desktop access, and `CanvasContextMenu` (`client/src/canvasContextMenu.js`) for drawing object manipulation. Engine coordination is mediated via `ChartManager` (`client/src/chartManager.js`) and `TradingChartApp` (`client/src/main.js`). Per-symbol drawings are stored locally in `localStorage`, layout cell drawings are embedded in layout state, and favorite tool configurations are synced to server-side JSON storage under `server/data/accounts/states/` through Express endpoints in `server/accounts.js`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| II: Built prior to SDD specification | Implemented in September–October 2026 before adopting the Hybrid Spec-Driven Development methodology. | Retrofit procedure formalizes requirements and establishes locked acceptance tests without rewriting working production code. |
| IV: Language re-render variable name mismatch (`main.js:1824`) | Dead call to `this.floatingDrawingToolbar?.render?.()` where instance is `this.floatingToolbar`. | Non-fatal bug discovered during retrofit audit; logged for Converge phase resolution. |
| VII: Feature flag `drawingTools` not actively enforced | Feature is entitled across all plan tiers (standard, essential, plus, premium, ultimate). | Gating checks would add unnecessary runtime branches for a feature available to all tiers. |
