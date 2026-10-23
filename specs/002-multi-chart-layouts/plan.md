# Implementation Plan: Multi-Chart Layouts (Layout Studio)

**Branch**: `002-multi-chart-layouts` | **Date**: 2026-10-23 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-multi-chart-layouts/spec.md`

## Summary

The Multi-Chart Layouts feature (Layout Studio) delivers institutional-grade multi-chart grid management, 6-axis chart synchronization, persistent workspace session recovery, and named layout management. Integrated directly with the `@luxalgo/vela` WebGL2 workspace orchestrator, the system enables traders to split their charting view into up to 8 concurrent chart cells (1x1, 2x1, 1x2, 2x2, 3x1, 1x3, 3x2, 4x2) with automated market diversification across liquid trading pairs. Six synchronization axes (Symbol, Timeframe/Interval, Crosshair, Time & Zoom/Viewport, Drawings, and Chart Style) maintain multi-chart coordination. The continuous auto-save engine debounces state captures (600 ms) across indicator edits, drawing updates, market navigation, and interval switches, while backing up every 15 seconds and on page hide/unload. Rich workspace states (v2) persist each cell's symbol, interval, price style, watermark visibility, drawings document, and active indicator stack (including custom inputs, Pine script sources, and visibility). Named layouts support full in-app lifecycle management (Save, Load, Rename, Duplicate, JSON Export/Import, Delete, Filter, Sort) guarded by plan entitlements (`chartsPerTab`, `savedLayouts`) and synchronized to user cloud state (`/api/user/state`). Deep links (`/chart?symbol=...&interval=...`) take precedence over autosaved workspaces, while an adaptive floating cell strip provides fast focus, Alt+Enter maximization, and mobile-optimized touch navigation.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser, Node.js v20+ ESM on server).

**Primary Dependencies**:
- `@luxalgo/vela`: `^0.7.5` (WebGL2 charting engine, workspace orchestrator, grid layout coordinator, synchronization subsystem `ws.sync`, cell maximize/restore).
- `@luxalgo/vela-pinets`: `^0.2.12` (PineTS integration for indicator evaluation).
- `pinets`: `^0.9.33` (Pine Script execution engine).
- `express`: `^4.21.2` (HTTP backend framework, REST API, state synchronization).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography for Layout Studio and RTL controls).
- `@fontsource/inter`: `^5.3.0` (Latin typography).
- `@fontsource/jetbrains-mono`: `^5.3.0` (Monospace numeral typography).
- `puppeteer-core`: `^24.3.1` (Headless browser testing).
- `vite`: `^6.4.5` (Client bundler and build system).

**Storage**:
- Client `localStorage`:
  - `tradingchart_current_layout`: Active workspace snapshot `{ layoutId, name, savedLayoutId, state: { version: 2, cells: [...], activeCellId, sync, velaState }, sync, timestamp }`.
  - `tradingchart_user_layouts`: Serialized array of saved layouts `[{ id, name, nameFa, layoutId, badge, badgeFa, sync, state, date }]`.
  - `tradingchart_layout_sync`: Serialized 6-axis synchronization options `{ symbol, timeframe, crosshair, viewport, drawings, style }`.
  - `tradingchart_layout_autosave`: Auto-save switch state (`"true"` | `"false"`).
  - `tradingchart_user_templates`: Serialized array of saved indicator setup templates `[{ id, name, date, scripts }]`.
- Server atomic JSON files:
  - `server/data/accounts/states/state_{userId}.json`: Per-user cloud state object containing `layouts`, `currentLayout`, `layoutSync`, `templates`, and `updatedAt`.
  - `server/data/accounts/plans.json`: Plan tier quotas for `chartsPerTab`, `savedLayouts`, and `savedTemplates`.

**Testing**:
- Puppeteer headless browser suites executed via `scripts/qa/qa_run.sh` or standalone Node:
  - `tests/qa_cycle_layout.cjs`: Layout studio open, 8 presets, 2h/2v/4 grids, quad loading, sync toggle, save/del layout.
  - `tests/qa_cycle_layout_pro.cjs`: 4-chart layout persistence across page reload, duplicate/export/import round-trip.
  - `tests/qa_layout_deep_audit.cjs`: Multi-chart session persistence, indicator input preservation across reload, mobile audit.
  - `tests/qa_layout_endless_perfection.cjs`: Multi-chart session restoration, rich state v2 persistence.
  - `tests/qa_cycle_layout_and_profile_endless.cjs`: Layout switching stress and persistent state sync across profile reloads.
  - `tests/qa_cycle_layout_and_profile_tv_parity.cjs`: TradingView parity checks for multi-grid and layout persistence.

**Target Platform**: Evergreen desktop and mobile web browsers (Chromium, Firefox, Safari, WebKit) on Linux, macOS, Windows, iOS, and Android; Node.js v20+ Linux server environment.

**Project Type**: Responsive web charting application (`client/`) backed by an Express.js server (`server/`).

**Performance Goals**:
- Grid re-tiling into any preset within 2000 ms.
- Continuous auto-save persistence debounced to 600 ms, avoiding I/O thrashing during frequent indicator adjustments.
- Smooth WebGL2 chart rendering maintaining 60 FPS across up to 8 active chart panes.
- Restore of multi-cell workspace with indicators and drawings completed within 3500 ms of page boot.

**Constraints**:
- Maximum payload size for cloud state sync capped at 2MB (`STATE_MAX_BYTES`).
- Cloud state storage access restricted to authenticated sessions (`tc_session`).
- Plan tier quotas enforced strictly on client and server boundaries.
- Minimum 44 px touch targets for mobile interactive elements; no horizontal overflow at 390 px viewport.

**Scale/Scope**:
- 8 grid layout configurations supporting 1 to 8 concurrent chart cells.
- 6 synchronization axes configured independently.
- 2 starter layouts shipped out-of-the-box (`usr_default`, `usr_macro`).
- 5 plan tiers (`basic`, `essential`, `plus`, `premium`, `ultimate`) governing cell counts (1 to 16) and saved layouts (1 to unlimited).

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | Every cell renders authentic market data from live exchange feeds or labelled demo feeds; indicators compute on real OHLCV data using Pine/PineTS or native engines; no fabricated or decorative candlestick metrics. |
| II | Spec Before Code | GAP | Built before SDD adoption (September–October 2026); this retrofit formalizes normative requirements (`spec.md`) and descriptive Spec Kit documentation. |
| III | Real-Browser Zero-Defect Verification | PASS (with GAP) | Verified via comprehensive Puppeteer browser suites (`tests/qa_cycle_layout.cjs`, `tests/qa_cycle_layout_pro.cjs`, `tests/qa_layout_deep_audit.cjs`, `tests/qa_layout_endless_perfection.cjs`) across desktop and mobile viewports, English and Persian locales, testing grid re-tiling, persistence, indicator inputs, and 6-axis synchronization. |
| IV | Bilingual Parity and RTL Correctness | PASS (with GAP) | Layout Studio, preset cards, cell strip, and modal dialogs are fully bilingual (EN/FA) using Vazirmatn typography and RTL-aware flex/grid layouts. Dynamic in-place re-localization updates labels on language toggle (`main.js:1834`). Gaps: fallback default layout name (`client/src/layoutManager.js:1321`) and badge (`client/src/layoutManager.js:1442`) default to English when Persian values are absent. |
| V | Mobile Fit and Interaction Safety | PASS | Floating cell strip adapts to viewports ≤ 768 px; tapping a cell pill activates and maximizes the cell for touch-first navigation (`layoutManager.js:1039-1041`); quick trade pill minimizes when entering multi-grid to preserve chart area (`layoutManager.js:864-868`). |
| VI | Security and Privacy by Default | PASS | Cloud state sync requires session authentication (`server/accounts.js:945,951`); state payloads capped at 2MB (`server/accounts.js:957`); HTML escaping applied to user-supplied layout names (`client/src/layoutManager.js:1431,1437`); destructive operations require in-app confirmation modal (`showConfirmDialog`). |
| VII | Single Source of Truth for Entitlements | GAP | Quotas `chartsPerTab`, `savedLayouts`, and `savedTemplates` are defined canonically in `server/featuresCatalog.js` and `server/data/accounts/plans.json`. `savedLayouts` is validated on server during `PUT /api/user/state`, but `chartsPerTab` is only gated in client UI (`client/src/layoutManager.js:1114-1117`). In addition, client excludes starter layouts while server counts all layouts. |
| VIII | Performance Budget | PASS | Autosave uses 600 ms debounce to prevent localStorage and network saturation; 15 s interval timer pauses when unneeded; unload listeners ensure state capture on exit; WebGL2 instances re-tile smoothly. |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Native DOM, WebGL2, and standard browser APIs; `@luxalgo/vela` workspace manipulated exclusively through public API methods (`ws.setLayout`, `ws.sync`, `ws.maximizeCell`, `ws.clearMaximized`) without modifying vendor packages in `node_modules`. |
| X | Hybrid SDD | PASS (with GAP) | Retrofit process adheres to Hybrid SDD governance rules: spec.md is normative and immutable; descriptive Spec Kit artifacts bridge existing code to formal contracts; zero-token machine gates validate artifact presence. |

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-chart-layouts/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-025, SC-001..SC-006)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R8, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server cloud state REST routes (/api/user/state)
│   └── module-api.md           # Client LayoutManager module interfaces, methods, events
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── tasks.md                    # Executed implementation task inventory mapped to FRs
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Topbar layout triggers (#btn-layout-manager, #btn-mobile-layout)
├── src/
│   ├── layoutManager.js        # Core Layout Studio, 8 presets, 6-axis sync, autosave, CRUD, cell strip
│   ├── chartManager.js         # Workspace bridge delegating setLayout to Vela WebGL2 engine
│   ├── templateManager.js      # Indicator templates panel (curated and custom indicator setups)
│   ├── main.js                 # Topbar triggers, Alt+Enter/Escape shortcuts, deep link application
│   ├── authManager.js          # Client-side plan enforcement (chartsPerTab, savedLayouts) & state sync
│   ├── uiDialog.js             # In-app prompt and confirm dialogs (showPromptDialog, showConfirmDialog)
│   └── i18n.js                 # Localization engine, translations, and Persian digit formatting
├── styles/
│   └── main.css                # Layout studio modal, preset cards, responsive grid, floating cell strip
server/
├── accounts.js                 # Cloud state sync endpoints (GET/PUT /api/user/state), plan enforcement
├── featuresCatalog.js          # Canonical quota definitions (chartsPerTab, savedLayouts, savedTemplates)
└── data/
    └── accounts/
        ├── plans.json          # Plan tier definitions (basic, essential, plus, premium, ultimate)
        └── states/             # Per-user cloud state JSON files (state_{userId}.json)
tests/
├── qa_cycle_layout.cjs         # Grid switching, sync toggles, and layout saving QA
├── qa_cycle_layout_pro.cjs     # Multi-chart reload persistence, duplicate/export/import round-trip
├── qa_layout_deep_audit.cjs    # Deep session persistence, indicator input preservation across reload
├── tests/qa_layout_endless_perfection.cjs # Endless perfection layout persistence test
├── qa_cycle_layout_and_profile_endless.cjs # Layout switching stress across profile reloads
└── qa_cycle_layout_and_profile_tv_parity.cjs # TradingView parity multi-grid test
```

**Structure Decision**: Modular web application where client-side layout management is encapsulated within `LayoutManager` (`client/src/layoutManager.js`), coordinated through `TradingChartApp` (`client/src/main.js`), and bridged to `@luxalgo/vela` workspace in `ChartManager` (`client/src/chartManager.js`). Server-side persistence is mediated via atomic JSON storage under `server/data/accounts/states/` through Express endpoints in `server/accounts.js`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| II: Built prior to SDD specification | Implemented in September–October 2026 before adopting the Hybrid Spec-Driven Development methodology. | Retrofit procedure formalizes requirements and establishes locked acceptance tests without rewriting working production code. |
| IV: Fallback default name and badge English strings (`layoutManager.js:1321,1442`) | Developer convenience during initial layout prototyping. | Minor cosmetic fallback that will be unified in feature 011 (i18n & RTL polish). |
| VII: Client-only enforcement of `chartsPerTab` quota | Fast client UX feedback was prioritized; server validates state payload structure but lacks grid geometry parsing. | Parsing client grid cell structures on server adds unnecessary schema validation overhead; client gating is backed by client plan checks. |
| VII: Starter layouts counted on server but excluded on client | Client treats `usr_default` and `usr_macro` as bundled templates, while server counts all elements in `state.layouts`. | Server schema validator treats `layouts` as a generic array; aligning server logic requires migrating state validation (tracked in Converge phase / FR-025). |
