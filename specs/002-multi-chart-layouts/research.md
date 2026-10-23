# Research: Multi-Chart Layouts (Layout Studio)

History: `git log --format='%h %ad %s' --date=short -- client/src/{layoutManager,chartManager,templateManager}.js`
— e09b27a (2026-09-18, multi-chart layout studio initial commit), 703c314 (2026-09-18, 6-axis sync implementation),
ebfdcec (2026-09-19, rich workspace state v2 and indicator persistence), 4977283 (2026-09-21, layout manager QA v4 and user profiling),
3d03128 (2026-09-21, sync restore, escape-to-restore cell), 99761ed (2026-09-21, multi-chart mobile cell strip),
95eade6 (2026-09-22, 44px mobile touch targets, language reactivity), 7544e50 (2026-10-12, real-browser zero-defect cycle),
a94a611 (2026-10-22, production hardening, TV-style routing), e676f25 (2026-10-22, deep link precedence over autosaved workspace).

## R1. Eight Grid Geometry Presets with Automated Liquid Asset Seeding

- **Decision**: Provide exactly eight fixed grid presets (`1`, `2h`, `2v`, `4`, `g1x3`, `g3x1`, `g2x3`, `8`) in `DEFAULT_LAYOUT_PRESETS` (`client/src/layoutManager.js:9-90`). When switching into a multi-cell layout, seed cells 2 through 6 automatically with diversified liquid trading pairs (`universal:BTCUSDT`, `universal:ETHUSDT`, `universal:SOLUSDT`, `universal:BNBUSDT`, `universal:XAUUSD`, `universal:EURUSD`), leaving cell 1 on its current asset, and minimize the quick-trade pill when cells > 1.
- **Rationale**: Opening an unconfigured multi-chart grid with all cells set to the identical market requires tedious manual configuration. Automated seeding provides instant visual utility across major cryptocurrency, gold, and forex markets. Minimizing the quick-trade pill in multi-cell view maximizes valuable canvas drawing space.
- **Alternatives considered**: Arbitrary dynamic grid rows/columns builder (rejected: complex UX, prone to fragmented responsive viewports on financial monitors); leaving all cells on the primary symbol (rejected: fails user expectation of instant multi-market surveillance).
- **Evidence**: `client/src/layoutManager.js:9-90,864-868,896-921`.

## R2. Six-Axis Multi-Chart Synchronization via Engine Workspace Sync

- **Decision**: Implement six independent synchronization switches (`symbol`, `timeframe`, `crosshair`, `viewport`, `drawings`, `style`) in `LayoutManager.syncOpts`, defaulting `crosshair: true` and `viewport: true` (time & zoom), with the remaining four disabled (`client/src/layoutManager.js:105-112`). State changes propagate to the chart engine workspace via `ws.sync.set(kind, enabled)`.
- **Rationale**: Different trading workflows require distinct synchronization semantics. Multi-timeframe analysis requires synchronized crosshairs and viewports while keeping intervals separate; multi-asset correlation reading requires synchronized intervals and styles while keeping symbols separate.
- **Alternatives considered**: Single monolithic "Sync All" toggle (rejected: inflexible, breaks multi-timeframe analysis workflows); polling loop checking cell changes (rejected: high CPU churn, laggy crosshair synchronization).
- **Evidence**: `client/src/layoutManager.js:105-112,932-950,1136-1166`.

## R3. Continuous Debounced Auto-Save with Rich State v2 Architecture

- **Decision**: Persist the active workspace snapshot to `localStorage` under `tradingchart_current_layout` using a 600 ms debounce timer (`schedulePersist()`), supplemented by a 15-second heartbeat interval and window `beforeunload`/`pagehide` listeners. Capture rich state version 2 containing layout metadata, active cell identifier, sync options, ordered cell configurations, and Vela engine backup state (`client/src/layoutManager.js:289-404`).
- **Rationale**: Immediate synchronous writes on every indicator slider movement or drawing mousemove would freeze the main thread and exceed storage I/O budgets. A 600 ms debounce clusters rapid edits, while the 15-second timer and unload listeners protect against accidental browser tab closure.
- **Alternatives considered**: Saving only on explicit "Save" button press (rejected: severe data loss on sudden browser crash or reload); writing directly to remote server on every change (rejected: excessive network requests and API rate limit exhaustion).
- **Evidence**: `client/src/layoutManager.js:128-135,151-170,289-404,723-729`.

## R4. Resilient Multi-Cell Session Restoration and Legacy Script Cleansing

- **Decision**: On page boot, restore the saved workspace layout via `restoreCurrentLayout()` and `applyWorkspaceState()`, polling the workspace up to 35–60 attempts (100 ms interval) for cell orchestrators to mount. Before applying saved indicators, clear existing default handles to prevent duplicate plots. Automatically sanitize deprecated Pine Script constructs (e.g. replacing `color.cyan` with `color.rgb(0, 229, 255)`). Once restored, synchronize application-level market state (`currentSymbol`, `currentTimeframe`, paper trading, DOM, watchlist) to match the active cell.
- **Rationale**: WebGL2 canvas initialization is asynchronous; attempting to inject indicators before orchestrators initialize triggers runtime exceptions. Sanitizing legacy scripts prevents compilation errors in the PineTS engine. Synchronizing application state prevents dangerous discrepancies where orders or alerts execute against the wrong market.
- **Alternatives considered**: Synchronous blocking wait (rejected: freezes browser rendering during startup); wiping indicators on restore (rejected: unacceptable loss of user technical analysis setups).
- **Evidence**: `client/src/layoutManager.js:227-287,406-549`.

## R5. Deep Link Symbol and Interval Precedence over Autosaved State

- **Decision**: Parse URL parameters `?symbol=...&interval=...` (or `?tf=...`) during startup. If valid, rewrite the primary/active cell of the autosaved snapshot in `restoreCurrentLayout()` before applying the workspace, and schedule a deferred re-check in `main.js:applyDeepLink()` once restore settles. Strict regex validation discards malformed inputs.
- **Rationale**: Users clicking shared links from Telegram, alerts, or landing pages expect to view the specified instrument and timeframe immediately. Rewriting the snapshot prior to application eliminates race conditions and unsightly visual flashing between the saved workspace and the target market.
- **Alternatives considered**: Discarding the autosaved workspace entirely on deep link (rejected: destroys the user's multi-chart grid and configured indicators); applying deep link before layout restore (rejected: layout restore subsequently overwrites the deep link).
- **Evidence**: `client/src/main.js:72-79,730-743`, `client/src/layoutManager.js:231-241,261`.

## R6. Full Lifecycle Named Layout Management with Zero-Window Dialogs

- **Decision**: Support complete named layout management (Save Current, Load, Rename, Duplicate, JSON Export/Import, Delete, Search, and Sort) in `LayoutManager`. Seed two out-of-the-box institutional starter layouts (`usr_default`: "Institutional SMC Master", `usr_macro`: "Macro Confluence (BTC+Gold)"). Use custom in-app glassmorphic dialogs (`showPromptDialog`, `showConfirmDialog`) rather than blocking `window.prompt` or `window.confirm`.
- **Rationale**: Named layouts turn one-off analysis configurations into reusable workspaces. In-app dialogs preserve visual fidelity, support Persian RTL typography, and prevent headless automation suites from hanging on native browser alerts.
- **Alternatives considered**: Native browser `window.prompt` / `confirm` (rejected: blocks JavaScript thread, unstylable, breaks automated Puppeteer QA); storing only one global layout (rejected: insufficient for multi-strategy traders).
- **Evidence**: `client/src/layoutManager.js:551-675,1168-1581`, `client/src/uiDialog.js:10-85`.

## R7. Adaptive Floating Cell Strip with Mobile-First Auto-Maximization

- **Decision**: Mount a floating pill strip (`#multi-chart-cell-strip`) inside `#chart-area` when more than one chart cell is active (hidden in 1x1). The strip features an "All Grid" overview button, indexed cell pills showing asset ticker and timeframe, and a "Maximize" / "Restore" toggle (also bound to `Alt+Enter` and `Escape`). On viewports ≤ 768 px (mobile), tapping any cell pill activates AND maximizes that cell.
- **Rationale**: On dense multi-grid displays (such as 2x2 or 4x2), cells become visually compact. Quick cell focusing and maximization allow in-depth inspection without altering the underlying grid structure. On mobile screens, multi-chart grids are unusable without instant full-screen cell zooming.
- **Alternatives considered**: Requiring users to open the Layout Studio to maximize cells (rejected: too many clicks); disabling multi-chart layouts on mobile entirely (rejected: prevents mobile traders from managing their workspaces).
- **Evidence**: `client/src/layoutManager.js:967-1046`, `client/src/main.js:1218-1225,1255-1257`.

## R8. Entitlement Gating Across Preset Cards and Cloud Sync Endpoints

- **Decision**: Gate grid preset cards based on `chartsPerTab` entitlement (`basic: 1`, `essential: 2`, `plus: 4`, `premium: 8`, `ultimate: 16`), rendering locked cards with reduced opacity (0.55), a `🔒 PRO` / `🔒 ارتقا` badge, and routing clicks to `auth.enforce()` to open the Plans modal. Enforce `savedLayouts` limit on client operations (save new name, duplicate, import) and validate on the server during `PUT /api/user/state` via `validateStateAgainstPlan`, returning HTTP 403 `limit_exceeded`.
- **Rationale**: Tiered capabilities incentivize platform upgrades while protecting server resources and maintaining fair monetization boundaries.
- **Alternatives considered**: Allowing free unlimited multi-chart grids (rejected: violates product monetization model); gating only on the client without server validation (rejected: vulnerable to client-side entitlement tampering).
- **Evidence**: `client/src/layoutManager.js:574,598,1114-1119,1286-1292,1323`, `server/accounts.js:512-538,961-964`, `server/featuresCatalog.js:8-28`.

## Spec/code mismatches

- FR-025: In `server/accounts.js:522`, `countOf(state.layouts)` counts all items in the array (including starter layouts `usr_default` and `usr_macro`), whereas `client/src/layoutManager.js:570` (`getUserSavedLayoutsCount()`) excludes them; consequently, a Basic plan user (quota 1) who retains the 2 starter layouts is rejected by the server with HTTP 403 `limit_exceeded` on cloud sync (`server/accounts.js:536`, `client/src/layoutManager.js:570`).
- FR-004: Server does not validate `chartsPerTab` cell count in `currentLayout` during `PUT /api/user/state`; enforcement is handled exclusively on the client when clicking preset cards (`client/src/layoutManager.js:1114-1117,1286-1292` vs `server/accounts.js:512`).
- FR-023: Default fallback layout name generates English template string `"Layout ${this.activeLayoutId.toUpperCase()}"` when the save-new input is empty, even in Persian locale mode (`client/src/layoutManager.js:1321`).
- FR-023: Saved layout card badge in `renderSavedLayoutsList()` falls back to English `l.badge` (e.g. `"4 Charts"`) when `l.badgeFa` is undefined in Persian locale mode (`client/src/layoutManager.js:1442`).
