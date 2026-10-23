# Research: Drawing Tools

History: `git log --format='%h %ad %s' --date=short -- client/src/{drawingToolsLibrary,floatingDrawingToolbar,canvasContextMenu}.js client/src/chartManager.js`
— a94a611 (2026-10-22, Chartivia: production hardening + rebrand + TradingView-style routing),
7544e50 (2026-10-12, real-browser zero-defect cycle — per-symbol drawings, layout/app sync, fa localization, mobile fit),
c22ef30 (2026-09-27, zero-defect responsive fixes),
1e0c675 (2026-09-20, final wave evidence — all suites green on frozen build),
14f85d6 (2026-09-20, zero-defect elevation wave-2 — responsive header, FA i18n completion),
fc349fa (2026-09-19, full persian i18n, mobile panels parity, strict RTL alignment),
5ff5629 (2026-09-19, zero-defect parity across desktop, mobile, RTL Persian),
3c9c194 (2026-09-19, browser dogfooding, balance quick-trade, harmonize icons),
68f10d5 (2026-09-18, custom timeframe builder and context menu actions),
707d863 (2026-09-18, 100% zero-defect parity across Context Menu and Keyboard Engine),
8f408cb (2026-09-18, TradingView replacement with floating favorite drawings toolbar, canvas alerts overlay),
ecdb389 (2026-09-17, Initial release of TradingChart powered by LuxAlgo open ecosystem).

## R1. Floating Glassmorphic Favorites Toolbar with Clamped Dragging

- **Decision**: Provide a glassmorphic floating toolbar `#floating-drawing-toolbar` on desktop containing favorite drawing tool buttons (`.fav-tool-btn[data-tool]`), an all-tools library trigger (`#fav-btn-all-tools`), magnet toggle (`#fav-btn-magnet`), lock all toggle (`#fav-btn-lock`), hide/show all toggle (`#fav-btn-hide`), clear all trash bin (`#fav-btn-trash`), and minimize toggle (`#fav-btn-minimize`). The toolbar is draggable by `.fav-tool-drag-handle` and clamped within chart bounds (`SAFE_LEFT = 52`, `SAFE_BOTTOM = 68`, top min 46, right margin 70) with coords persisted to `localStorage['tradingchart_fav_toolbar_pos']`.
- **Rationale**: Traders require instant 1-click access to their primary drawing instruments without navigating multi-tiered side menus. Clamping guarantees the toolbar never covers the left drawing rail (44px), the bottom time axis (22px), the bottom bar (38px), or the right price scale.
- **Alternatives considered**: Fixed left sidebar only (rejected: duplicates Vela's built-in left toolbar and consumes chart area); modal-only access (rejected: too disruptive for active analysis workflows).
- **Evidence**: `client/src/floatingDrawingToolbar.js:84-116,143-215,297-348`.

## R2. Comprehensive 83-Tool Library Catalog with Capability Probe and Live Search

- **Decision**: Catalog 83 drawing tools across 9 categories (`Trend Lines`, `Channels & Pitchforks`, `Fibonacci`, `Gann`, `Geometric Shapes`, `Annotations & Text`, `Patterns`, `Forecast & Measurement`, `Volume Profile & VWAP`) in `CATALOG` (`client/src/drawingToolsLibrary.js`). On modal open, dynamically probe the active cell's `DrawingsControl` via `setTool(key)` and `getTool() === key` to cache supported types (`supportedCache`), falling back to the full static catalog if engine is unmounted. Provide real-time bilingual search filtering by English and Persian name.
- **Rationale**: The LuxAlgo Vela charting engine supports over 75 specialized drawing types (Harmonics, Gann, Pitchforks, Elliott waves) that cannot fit simultaneously on a floating dock. Dynamic probing guarantees that only tools executable by the underlying engine build are presented, preventing inert UI options.
- **Alternatives considered**: Hardcoding a static list of 10 basic tools (rejected: loses parity with TradingView for advanced institutional traders); un-probed static UI (rejected: risk of broken tools when underlying engine versions vary).
- **Evidence**: `client/src/drawingToolsLibrary.js:8-115,140-154,173-211`.

## R3. Bidirectional Favorite Pinning with Local and Cloud Synchronization

- **Decision**: In the library modal, provide star toggles (`[data-star="<key>"]`) allowing traders to pin or unpin any tool to/from the floating toolbar. Persist the updated favorites list to `localStorage['tradingchart_drawing_favorites']`, immediately re-render the floating toolbar via `refreshFavorites()`, and map the key via `authManager`'s `SYNC_MAP` (`drawing_favorites` -> `drawingFavorites`) to user cloud state `/api/user/state`.
- **Rationale**: Personalized tool docks are essential for professional traders who focus on specific technical methodologies (e.g. SMC traders prefer boxes and rays; harmonic traders prefer XABCD and Cypher).
- **Alternatives considered**: Read-only static favorite toolbar (rejected: prevents user customization); server-only favorites without local storage (rejected: breaks guest and offline experience).
- **Evidence**: `client/src/drawingToolsLibrary.js:127-138,231-245`, `client/src/floatingDrawingToolbar.js:120-131`, `client/src/authManager.js:48`.

## R4. Dedicated Global Keyboard Shortcuts for High-Frequency Tools and History Navigation

- **Decision**: Wire global keyboard shortcuts: `Alt+T` (trendline), `Alt+H` (hline), `Alt+F` (fibretracement), `Alt+B` (box), `Alt+P` (position), `Alt+V` (vline) to arm tools directly via `chartManager.armDrawingTool(tool)`. Wire `Ctrl+Z` / `Meta+Z` (undo) and `Ctrl+Y` / `Meta+Y` or `Ctrl+Shift+Z` (redo) to call `chart.drawings.undo()` and `chart.drawings.redo()`, supplemented by topbar buttons `#btn-undo` and `#btn-redo`.
- **Rationale**: High-frequency chartists rely on muscle memory shortcuts to annotate market structure rapidly without cursor travel.
- **Alternatives considered**: Single-key shortcuts without modifiers (rejected: conflicts with watchlist symbol search, quick-trade inputs, and note editing); mouse-only buttons (rejected: slower interaction speed).
- **Evidence**: `client/src/main.js:928-933,1244-1249,1263-1284`.

## R5. Dual Magnet Snap Modes Across Topbar and Floating Toolbar

- **Decision**: Implement two complementary magnet controls: topbar `#btn-magnet` cycling snap mode `off` -> `weak` -> `strong` -> `off` via `chart.drawings.setSnapMode(mode)` with bilingual toast notifications (`مگنت: خاموش|ضعیف|قوی` / `Magnet: off|weak|strong`); floating toolbar `#fav-btn-magnet` toggling boolean magnet mode via `chart.drawings.setMagnet(bool)`.
- **Rationale**: Accommodates both quick binary snapping toggling on the floating toolbar and fine-grained 3-state sensitivity adjustments from the main chrome.
- **Alternatives considered**: Binary toggle only (rejected: fails to expose Vela's strong OHLC candle attraction mode); topbar-only control (rejected: requires cursor movement away from drawing zone).
- **Evidence**: `client/src/main.js:936-946`, `client/src/floatingDrawingToolbar.js:187-190,241-249`.

## R6. Drawing Object Right-Click Context Menu with Fallback Selection Target

- **Decision**: On canvas right-click, detect whether a drawing is present via `findSelectedDrawing()`. If found (targeting the newest unlocked drawing from `chart.drawings.all()`), open a specialized drawing context menu `#canvas-context-menu` offering Drawing Settings (`openSettings`), Duplicate (`duplicate` / `clone`), Lock/Unlock (`lock` / `setLocked`), Bring to Front (`bringToFront`), Send to Back (`sendToBack`), and Remove Drawing (`remove`). If no drawing exists, show the standard price context menu.
- **Rationale**: Contextual object management allows traders to inspect parameters, duplicate patterns, adjust z-stack ordering, or delete drawings directly at cursor position.
- **Alternatives considered**: Monolithic context menu combining price alerts, orders, and drawing actions (rejected: excessive visual noise); hovering action bars on drawings (rejected: prone to misclicks on thin canvas paths).
- **Evidence**: `client/src/canvasContextMenu.js:47-54,98-157`.

## R7. Per-Symbol Drawing Stashing and Restoration on Instrument Navigation

- **Decision**: Isolate drawings per instrument ticker. In `chartManager.setSymbol(symbol)`, invoke `swapDrawingsForSymbol(newSym)` which stashes current drawings into `localStorage['tc_drawings_by_symbol']` under the clean ticker key, clears canvas drawings via `d.removeMany(ids)`, and restores any stored drawings for the new symbol via `d.fromJSON(saved)`.
- **Rationale**: Geometric drawings are anchored to specific price levels and timestamps. Retaining BTC drawings on ETH or Gold produces misleading and unreadable technical artifacts.
- **Alternatives considered**: Shared global drawings across all symbols (rejected: mathematically invalid on disparate price scales); discarding drawings on symbol change (rejected: severe data loss).
- **Evidence**: `client/src/chartManager.js:185-225`.

## R8. Multi-Chart Layout Cell Drawing Serialization and Sync

- **Decision**: Capture each grid cell's drawing layer via `chart.drawings.toJSON()` into `CellState.drawings` during layout snapshot persistence (`captureWorkspaceState()`). On layout restoration, rehydrate drawings via `chart.drawings.fromJSON()`. When 6-axis synchronization option `drawings` is enabled (`toggleSync('drawings', enabled)`), mirror drawings across grid cells displaying the same symbol via `ws.sync.set('drawings', enabled)`. Listen to drawing events (`drawing:created`, `drawing:edited`, `drawing:removed`) to trigger debounced auto-save (`schedulePersist()`).
- **Rationale**: Multi-chart workspaces require drawings to survive grid switching, layout loading, and browser reloads without loss of multi-timeframe annotations.
- **Alternatives considered**: Storing drawings separately from layout states (rejected: breaks layout isolation and cell-specific timeframe drawings); polling canvas for drawing updates (rejected: causes unnecessary CPU usage).
- **Evidence**: `client/src/layoutManager.js:105-112,161-171,368-381,486-490,620,1152`.

## Spec/code mismatches

- FR-004: In `client/src/drawingToolsLibrary.js:9-111`, `CATALOG` defines 83 tools in 9 categories, whereas `spec.md:FR-004` specifies a static catalogue of 76 tools in 7 categories (`client/src/drawingToolsLibrary.js:9-111`).
- FR-014: In `client/src/main.js:1824`, `this.floatingDrawingToolbar?.render?.()` targets an undefined property name (instance was assigned to `this.floatingToolbar` at `client/src/main.js:223`), so the floating toolbar is not re-rendered when the application language toggles (`client/src/main.js:1824`).
- FR-002: In `client/src/floatingDrawingToolbar.js:15,89` and `client/src/main.js:1280`, tool `'position'` is registered in `DEFAULT_FAVORITES` and shortcut `Alt+P`, but does not exist in `CATALOG` (`client/src/drawingToolsLibrary.js:95-96`), which has separate `'longposition'` and `'shortposition'` tools (`client/src/floatingDrawingToolbar.js:15`, `client/src/drawingToolsLibrary.js:95-96`).
- FR-010: In `client/src/chartManager.js:204`, per-symbol drawings store `tc_drawings_by_symbol` is not included in `client/src/authManager.js:35` (`SYNC_MAP`), leaving per-symbol drawings device-local and unbacked by server cloud sync (`client/src/chartManager.js:204`, `client/src/authManager.js:35`).
- FR-007: In `client/src/floatingDrawingToolbar.js:247` and `client/src/main.js:942`, floating toolbar `#fav-btn-magnet` calls `chart.drawings.setMagnet(bool)` while topbar `#btn-magnet` calls `chart.drawings.setSnapMode('off'|'weak'|'strong')`, maintaining two independent unsynchronized magnet states (`client/src/floatingDrawingToolbar.js:247`, `client/src/main.js:942`).
- FR-009: In `client/src/canvasContextMenu.js:98-107`, `findSelectedDrawing()` falls back to the newest unlocked drawing in `d.all()` due to missing selection/hit-test getter in the Vela facade, causing right-clicks anywhere on canvas to target that drawing (`client/src/canvasContextMenu.js:98-107`).
- FR-009: In `client/src/canvasContextMenu.js:153`, context menu lock toggle calls `(d.lock || d.setLocked).call(d, id, !isLocked)` due to inconsistent Vela facade method naming (`client/src/canvasContextMenu.js:153`).
- FR-013: In `client/styles/main.css:2043-2046`, `#floating-drawing-toolbar` is hidden at `<=768px` with `display: none !important;`, leaving no custom UI entry point to `drawingToolsLibrary.open()` on mobile (`client/styles/main.css:2043-2046`).
- FR-007: In `client/src/floatingDrawingToolbar.js:98,292`, minimized state `this.isMinimized` is not persisted to `localStorage`, resetting to expanded on reload (`client/src/floatingDrawingToolbar.js:98,292`).
- FR-001: In `server/featuresCatalog.js:202` and `server/accounts.js:54`, feature key `drawingTools` is enabled across all plans but has zero enforcement checks on client or server (`server/featuresCatalog.js:202`, `server/accounts.js:54`).
