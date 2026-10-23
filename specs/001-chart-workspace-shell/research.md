# Research: Chart Workspace Shell

History: `git log --format='%h %ad %s' --date=short -- client/src/{main,chartManager,scaleControls,chartStylePicker,timeframeManager,watchlistManager,commandPalette}.js`
— 4977283 (2026-09-21, initial layout management & user profiling), 1e3d322 (2026-09-21, topbar/statusline fixes),
06f1ff4 (2026-09-21, parity fixes), 3d03128 (2026-09-21, sync restore, escape-to-restore cell), ebd6c7d (2026-09-21, reactive theme),
95eade6 (2026-09-22, 44px mobile touch targets, language reactivity), c22ef30 (2026-09-27, responsive overflow, interval teardown),
7544e50 (2026-10-12, real-browser zero-defect cycle, honest data, Binance L2, resource-aware polling),
fb0ff94 (2026-10-15, platform admin console), a94a611 (2026-10-22, production hardening, rebrand to Chartivia, TV-style routing).

## R1. WebGL2 Chart Canvas Workspace via LuxAlgo Vela

- **Decision**: Orchestrate chart rendering via `@luxalgo/vela` WebGL2 canvas engine inside `ChartManager` (`client/src/chartManager.js:init`) mounted to `#vela-workspace-mount`.
- **Rationale**: WebGL2 hardware acceleration provides stable 60 FPS rendering when panning, zooming, and plotting up to 50,000 candles with multiple technical overlays. Directly adheres to the Performance Budget principle (Constitution VIII).
- **Alternatives considered**: Canvas 2D libraries (e.g. TradingView Lightweight Charts; rejected due to lack of deep PineTS engine integration and multi-pane orchestrator); SVG/D3 charts (rejected: unacceptable performance degradation beyond 1,000 data points).
- **Evidence**: `client/src/chartManager.js:20-65`, `client/src/main.js:129-133`.

## R2. Client-Side Synthetic Non-Time-Based Bar Construction

- **Decision**: Compute non-time-based synthetic chart types (Renko, Kagi, Line Break, Range Bars, Point & Figure, Hollow Candles, Volume Candles) on the client side from standard OHLCV candles (`client/src/syntheticChartTypes.js`), feeding computed bricks/columns into Vela as synthetic candlestick series.
- **Rationale**: The underlying Vela engine renders only time-indexed series natively. Client-side computation allows instantaneous style switching without requiring dedicated backend recalculation or stateful streaming sessions for synthetic types. Algorithms follow canonical TA formulas with a traditional ATR auto-box size (`defaultBoxSize`) and a 2000-iteration safety guard.
- **Alternatives considered**: Server-side synthetic candle resampler (rejected: unnecessary backend CPU load, latency, and session management); patching Vela engine internals (rejected: strictly prohibited by Constitution IX).
- **Evidence**: `client/src/syntheticChartTypes.js:9-205`, `client/src/chartStylePicker.js:231-254`.

## R3. Two-Tier Plan Entitlement Enforcement

- **Decision**: Enforce candle depth `histBars` strictly on the server in `GET /api/candles` with `X-History-Limit` response header (`server/index.js:93-97`); enforce UI capability gates (`secondIntervals`, `customIntervals`, `synthChartTypes`, `dataExport`, `watchlists`, `watchlistSymbols`, `flagColors`) on the client via `this.app.auth.enforce()` / `feature()` triggering `auth.openPlansModal()`.
- **Rationale**: Server resource consumption (database/memory/bandwidth for deep history) must be enforced at the API boundary; client UI gates provide instant feedback to the trader explaining the required tier without incurring network latency.
- **Alternatives considered**: Full server validation for every client modal action (rejected: unnecessary network overhead for local UI features); purely client-side without server candle limits (rejected: security vulnerability allowing unauthorized deep history scraping).
- **Evidence**: `server/index.js:93-97`, `client/src/timeframeManager.js:177,189`, `client/src/chartStylePicker.js:234`, `client/src/dataExport.js:138`, `client/src/watchlistManager.js:143,422,568`.

## R4. Zero-Dependency Web Audio API Sound Feedback

- **Decision**: Generate synthetic sound chimes, clicks, and alarms dynamically in `SoundEngine` using the browser's native `AudioContext` and oscillator nodes (Alert: 880 Hz + 1760 Hz sine chime; Order: 520 Hz + 660 Hz chirp; Click: 1200 Hz to 800 Hz tick; Warning: 320 Hz + 240 Hz tone).
- **Rationale**: Completely eliminates dependencies on external MP3/WAV assets, operates reliably in offline mode, produces zero network latency, and prevents broken UI audio caused by asset 404s.
- **Alternatives considered**: Pre-rendered audio asset files (rejected: network fetch overhead, potential 404s, caching complexity); external audio library (rejected: violates minimal dependency rule).
- **Evidence**: `client/src/soundEngine.js:25-120`, `client/src/main.js:237-244`.

## R5. Multi-Layer Canvas Composite for Screenshots

- **Decision**: In `ScreenshotModal.captureCompositeCanvas()`, query all `<canvas>` nodes in `#vela-workspace-mount` / `#chart-area`, composite them sequentially onto an offscreen canvas with background `#0b0e14`, and export the composite as a PNG data URL.
- **Rationale**: Vela segments rendering across distinct canvas layers (grid, candles, volume, drawings, overlays). Capturing only the primary canvas leaves drawings, volume bars, and overlays missing from the exported snapshot.
- **Alternatives considered**: `html2canvas` library (rejected: heavy external dependency, unreliable WebGL2 canvas context capture); server-side headless browser screenshot service (rejected: high operational latency and resource consumption).
- **Evidence**: `client/src/screenshotModal.js:14-43`.

## R6. In-Memory Series Cache to Prevent Chart Engine Blanking

- **Decision**: Maintain an in-memory `seriesCache` Map (`symbol_timeframe` -> bars) in `TradingChartApp`. If `/api/candles` fails or returns 0 bars during a symbol/timeframe switch, reuse the last known-good candle series and alert the user via toast.
- **Rationale**: Vela clears its render state when repointed to an empty array. Feeding an empty array causes running Pine indicators to execute against undefined series, throwing unhandled exceptions and crashing the WebGL context.
- **Alternatives considered**: Blank chart state with error overlay (rejected: crashes running indicators and damages trader trust); infinite retry poll (rejected: violates performance and resource rules).
- **Evidence**: `client/src/main.js:110,664-674,692-714`.

## R7. Safe Parsing and Graceful Fallback for Shell State & Deep Links

- **Decision**: Wrap all `localStorage` reads (`tradingchart_user_profile`, `tradingchart_user_settings`) and `URLSearchParams` query parsing in `try/catch` blocks with regex sanity checking and safe defaults (default symbol: `BTCUSDT`, default interval: `60`).
- **Rationale**: Corrupted localStorage entries or malformed URL query parameters must never prevent the charting terminal from booting.
- **Alternatives considered**: Fatal error boundary (rejected: locks user out of platform until cookies/storage are manually cleared); wiping storage automatically on error (rejected: destructive to unrelated user preferences).
- **Evidence**: `client/src/main.js:67-79`.

## R8. Dynamic In-Place Re-Localization without Page Reload

- **Decision**: Language toggling (`#btn-toggle-lang`) switches `document.body.dir` (`rtl` vs `ltr`), updates typography fonts, and invokes `.render()` across all active modules (`platformBanner`, `indicatorsModal`, `timeframeManager`, `watchlist`, `settingsModal`, `shortcutsModal`, `commandPalette`, etc.).
- **Rationale**: Preserves the active chart canvas, loaded historical data, active Pine indicators, and custom drawing states without the disruption and state loss of a full browser reload.
- **Alternatives considered**: Full page reload with `?lang=fa` parameter (rejected: destroys active multi-chart layout state and resets WebGL buffers); pure CSS flip without string re-rendering (rejected: leaves dynamic English/Persian text mismatched).
- **Evidence**: `client/src/main.js:1794-1881`, `client/src/platformBanner.js:78`.

## R9. Revision-Controlled Platform Announcement Banner with Local Dismissal

- **Decision**: Server serves announcement metadata with an `updatedAt` epoch ms. Client compares `updatedAt` against `localStorage.getItem('tc_announcement_dismissed')`. When dismissed, the banner remains hidden until an administrator modifies the message or severity in the admin console (updating `updatedAt`). Copy is injected strictly via `textContent`.
- **Rationale**: Informs traders of critical maintenance or platform events without badgering them on every reload, while guaranteeing that new announcements or revisions immediately resurface. Prevents XSS via administrator input.
- **Alternatives considered**: Session-only dismissal in memory (rejected: banner reappears on every page navigation); global boolean dismissal (rejected: users miss subsequent announcements).
- **Evidence**: `server/platformSettings.js:72-84`, `client/src/platformBanner.js:23-57`.

## R10. Exact Inverse Coordinate Projection for Context Menus

- **Decision**: Map mouse cursor client coordinates to exact financial price in `CanvasContextMenu.calculatePriceAtY(clientY)` via Vela's `R.coords.yToPrice(y, pane.scale, pane.bounds)` and round to the instrument's significant tick size.
- **Rationale**: Context menu actions ("Add Alert at X", "Buy Limit at X") require mathematically exact prices that respect active Logarithmic or Inverted price scales.
- **Alternatives considered**: Linear pixel-to-price interpolation (rejected: mathematically incorrect on logarithmic or inverted price scales); manual price input popup (rejected: poor UX).
- **Evidence**: `client/src/canvasContextMenu.js:73-92`.

## R11. Multi-Watchlist Set with Tombstone Sync & Color-Flag Cycling

- **Decision**: Store named watchlists in `tradingchart_user_watchlists`, record deletions with tombstone timestamps in `tradingchart_watchlist_deleted`, and provide a 7-color cyclic tagging system (`none`, `red`, `green`, `blue`, `yellow`, `purple`) gated to 1 color on the Basic plan.
- **Rationale**: Supports institutional multi-list management; tombstone records prevent deleted lists from being resurrected by background cloud synchronization.
- **Alternatives considered**: Single global symbol array (rejected: insufficient for multi-market traders); per-list flag associations (rejected: flag color is an asset-wide property).
- **Evidence**: `client/src/watchlistManager.js:55-80,142-179,564-585`.

## R12. Fuzzy Command Palette Launcher Across All Application Surfaces

- **Decision**: Implement a Ctrl+K / Cmd+K launcher in `CommandPalette` indexing > 45 discrete commands across symbols, intervals, chart styles, drawing tools, side panels, multi-chart layouts, and shell actions, searching across both English and Persian names.
- **Rationale**: Enables frictionless keyboard-driven terminal control matching TradingView parity, allowing traders to execute actions without searching through complex menus.
- **Alternatives considered**: Traditional nested hierarchical menus (rejected: cumbersome, slow, consumes excessive vertical space); native browser search (rejected: cannot invoke application functions).
- **Evidence**: `client/src/commandPalette.js:38-80,109-130`.

## Spec/code mismatches

- FR-008: Scale dock UI does not render `#countdown-timer-val` inside `ScaleControls.render()`; countdown to next candle close is handled by the chart engine/price axis and `main.js:972`, while `scaleControls.js:206-239` has a no-op countdown display helper when element is absent (`client/src/scaleControls.js:105,206-208`).
- FR-014: Context menu for price under cursor dynamically labels orders as "Buy Stop" / "Sell Limit" when price is above market, and "Buy Limit" / "Sell Stop" when price is below market, rather than static "Buy Limit" / "Sell Limit" (`client/src/canvasContextMenu.js:231-236,265,273`).
- FR-015: Export filename formats timeframes ending with unit or numbers as `Chartivia_${symbol}_${tf}m_${dateStr}.${format}`, which produces `Dm` for daily interval export rather than clean `1D` (`client/src/dataExport.js:151`).
- FR-021: `GET /api/platform` returns `{ ok: true, registrationOpen: boolean, maintenanceMode: boolean, announcement: { level, fa, en, updatedAt } | null, emailDelivery: boolean }` containing additional `maintenanceMode` and announcement without an `id` field (`server/platformSettings.js:80-84`, `server/accounts.js:1039`).
