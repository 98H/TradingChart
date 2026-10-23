# Module API Contract: LayoutManager & Workspace Coordinators

Client-side programmatic interfaces, orchestrator event bindings, and DOM interaction hooks governing multi-chart layouts.

---

## 1. `LayoutManager` Class Interface (`client/src/layoutManager.js`)

Primary controller instantiated by `TradingChartApp` (`this.layoutManager = new LayoutManager(this)`).

### Constructor

```javascript
constructor(app)
```
- `app`: Reference to master `TradingChartApp` coordinator.
- Initializes properties: `activeLayoutId = '1'`, `activeLayoutName = '1x1 Single Chart'`, `activeSavedLayoutId = null`, `isMaximizedCell = false`, `searchQuery = ''`, `sortBy = 'date'`.
- Initializes `syncOpts` with defaults `{ symbol: false, timeframe: false, crosshair: true, viewport: true, drawings: false, style: false }`.
- Sets up auto-save engine, loads saved layouts from `tradingchart_user_layouts`, restores current layout, and binds unload handlers.

### Core Methods

#### `setLayout(layoutId, layoutName, opts = {})`
Applies a grid preset arrangement across the charting canvas.
- **Parameters**:
  - `layoutId` (string): Grid preset identifier (`'1'`, `'2h'`, `'2v'`, `'4'`, `'g1x3'`, `'g3x1'`, `'g2x3'`, `'8'`). Auto-normalizes `'2x2'` to `'4'` and `'1x1'` to `'1'`.
  - `layoutName` (string, optional): Display name for the layout.
  - `opts.state` (object, optional): Rich workspace state v2 to apply after grid re-tiles.
  - `opts.stateName` (string, optional): Setup name displayed in restoration success toast.
  - `opts.savedLayoutId` (string, optional): Associated saved layout identifier.
  - `opts.skipPersist` (boolean, optional): If `true`, suppresses immediate snapshot write.
- **Behavior**: Calls `app.chartManager.setLayout(layoutId)`. In multi-chart mode (`!= '1'`), minimizes the quick-trade pill via `app.minimizeQuickTrade()`; restores quick-trade in single-cell mode (`'1'`). When newly applying a multi-cell grid, seeds cells 2 through 6 with `['universal:BTCUSDT', 'universal:ETHUSDT', 'universal:SOLUSDT', 'universal:BNBUSDT', 'universal:XAUUSD', 'universal:EURUSD']`. Dispatches a `window.resize` event to reflow WebGL2 viewports.

#### `restoreCurrentLayout()`
Restores the last-active workspace from `tradingchart_current_layout`.
- **Behavior**: Evaluates deep link parameters (`app.deepLink`). If present, rewrites the active/primary cell symbol and interval *before* applying the workspace. Polls `ws.active.chart.orchestrator` up to 60 attempts (100 ms interval) before executing `setLayout()`. Applies synchronization options, attaches workspace cell listeners, and synchronizes the application market state via `syncAppToActiveCell()`.

#### `syncAppToActiveCell()`
- **Behavior**: Extracts the active cell's symbol and timeframe; synchronizes `app.currentSymbol`, `app.currentTimeframe`, `app.depthOfMarket`, `app.watchlist`, and paper trading to match the active chart window.

#### `persistCurrentLayout()`
- **Returns**: `boolean` indicating whether persistence succeeded.
- **Behavior**: If `autoSaveEnabled` is `true`, captures rich state v2 via `captureWorkspaceState()` and writes JSON payload to `localStorage.getItem('tradingchart_current_layout')`. If active layout matches an entry in `savedLayouts`, updates that saved layout's state, sync settings, and modification date.

#### `captureWorkspaceState()`
- **Returns**: Rich workspace state v2 object:
  ```javascript
  {
    version: 2,
    layoutId: this.activeLayoutId,
    name: this.activeLayoutName,
    savedLayoutId: this.activeSavedLayoutId,
    activeCellId: ws.active?.id || 'c1',
    sync: { ...this.syncOpts },
    cells: [ /* CellState objects */ ],
    velaState: object | null,
    timestamp: number
  }
  ```

#### `applyWorkspaceState(state)`
- **Parameters**: `state` (object) - Rich workspace state v2.
- **Returns**: Promise resolving to `boolean`.
- **Behavior**: Restores sync options via `applyAllSyncOptions()`; waits for workspace cells count to match `state.cells.length` (up to 35 attempts, 100 ms); iterates over cells applying `symbol`, `timeframe`, `priceStyle`, `watermark`, drawings via `fromJSON()`, and indicators. Indicator restoration clears existing handles to prevent duplicates and rewrites deprecated `color.cyan` to `color.rgb(0, 229, 255)`.

#### `schedulePersist()`
- Debounces persistence calls with a 600 ms timer (`_persistDebounceTimer`) to avoid disk thrashing during continuous slider or drawing interactions.

#### `toggleSync(kind, enabled)`
- **Parameters**:
  - `kind` (string): One of `'symbol'`, `'timeframe'`, `'crosshair'`, `'viewport'`, `'drawings'`, `'style'`.
  - `enabled` (boolean): Next on/off state.
- **Behavior**: Updates `this.syncOpts[kind]`, writes JSON to `tradingchart_layout_sync`, and calls `ws.sync.set(kind, enabled)`.

#### `toggleMaximizeActiveCell()`
- **Behavior**: If `ws.maximizedId` is truthy, calls `ws.clearMaximized()`. Otherwise, identifies active cell ID (`ws.active?.id`) and calls `ws.maximizeCell(targetId)`. Updates floating cell strip.

#### `updateCellStrip()`
- **Behavior**: Renders floating `#multi-chart-cell-strip` when `activeLayoutId !== '1'`; hides strip in 1x1 mode. Emits `#btn-strip-overview` ("All Grid" / "گرید کامل"), cell pills with index, symbol, and timeframe, and `#btn-strip-toggle-max` ("Maximize" / "Restore"). On viewports ≤ 768 px, clicking a cell pill activates AND maximizes that cell.

#### `openLayoutStudio()`
- **Behavior**: Mounts and opens `#modal-layout-studio` glassmorphic modal with RTL/LTR support. Renders 8 visual preset cards (gating with `🔒 PRO` if cells > `chartsPerTab` entitlement), 6 synchronization switch controls, saved user layouts list with in-place text filtering and sorting (by date or name), "Save Current" action, and JSON file import.

#### `renameLayout(id, newName)`
- **Parameters**: `id` (string), `newName` (string).
- **Behavior**: Updates layout name in `savedLayouts`, updates topbar label if active, and persists to `tradingchart_user_layouts`.

#### `duplicateLayout(id, opts = {})`
- **Parameters**: `id` (string), `opts.enforcePlan` (boolean).
- **Behavior**: Enforces `savedLayouts` plan limit via `auth.enforce()`. Creates deep copy with `id = 'usr_' + Date.now()`, appending ` (Copy)` / ` (کپی)` to name. Prepends copy to `savedLayouts`.

#### `exportLayout(id)`
- **Returns**: Serialized JSON string containing envelope marker `{ __tradingchart_layout: true, ... }`.

#### `importLayout(json, opts = {})`
- **Parameters**: `json` (string | object), `opts.enforcePlan` (boolean).
- **Behavior**: Validates `__tradingchart_layout === true` and `layoutId`; enforces `savedLayouts` limit; assigns fresh ID `'usr_' + Date.now()`; prepends to `savedLayouts`.

#### `getUserSavedLayoutsCount()`
- **Returns**: `number` - Count of custom user saved layouts, strictly excluding starter templates (`usr_default` and `usr_macro`) and `isSystemTemplate`.

---

## 2. Workspace & Engine Event Bindings

`LayoutManager` attaches reactive event listeners to `@luxalgo/vela` workspace and cell orchestrators:

| Source | Event Name | Handler Action |
|--------|------------|----------------|
| `cell.chart.orchestrator.events` | `indicator:inputs` | Calls `schedulePersist()` (debounced 600 ms). |
| `cell.chart.orchestrator.events` | `indicator:visibility` | Calls `schedulePersist()`. |
| `cell.chart.orchestrator.events` | `indicator:removed` | Calls `schedulePersist()`. |
| `cell.chart.orchestrator.events` | `indicator:added` | Calls `schedulePersist()`. |
| `cell.chart.orchestrator.events` | `indicator:moved` | Calls `schedulePersist()`. |
| `cell.chart.orchestrator.events` | `market:changed` | Calls `schedulePersist()`. |
| `cell.chart.orchestrator.events` | `timeframe:changed` | Calls `schedulePersist()`. |
| `cell.chart.orchestrator.events` | `style:changed` | Calls `schedulePersist()`. |
| `cell.chart.drawings.events` | `drawing:created` | Calls `schedulePersist()`. |
| `cell.chart.drawings.events` | `drawing:edited` | Calls `schedulePersist()`. |
| `cell.chart.drawings.events` | `drawing:removed` | Calls `schedulePersist()`. |
| `ws.events` | `cell:created` | Wires cell listeners, updates cell strip, calls `schedulePersist()`. |
| `ws.events` | `cell:destroyed`| Updates cell strip, calls `schedulePersist()`. |
| `ws.events` | `layout:changed` | Wires newly created cells, updates cell strip. |
| `ws.events` | `cell:active` | Syncs `app.currentSymbol` and `app.currentTimeframe`, updates cell strip, calls `schedulePersist()`. |
| `window` | `beforeunload` | Calls `persistCurrentLayout()` synchronously. |
| `window` | `pagehide` | Calls `persistCurrentLayout()` synchronously. |

---

## 3. DOM Elements & Triggers

| Selector | Element Type | Role / Interaction |
|----------|--------------|-------------------|
| `#btn-layout-manager` | `<button>` | Desktop topbar button; triggers `openLayoutStudio()`. |
| `#btn-mobile-layout` | `<button>` | Mobile header button; triggers `openLayoutStudio()`. |
| `.panel-menu-item[data-panel="layouts"]` | `<div>` | Panels drawer item; triggers `openLayoutStudio()`. |
| `#vela-topbar-layout, .vela-widget-topbar button[aria-label*="Layout"]` | `<button>` | Vela engine topbar layout widget; triggers `openLayoutStudio()`. |
| `#btn-layout-save` | `<button>` | Quick save button; flashes "Saved ✓" / "ذخیره شد ✓" for 2.5s and persists state. |
| `#active-layout-name` | `<span>` | Displays active layout or preset name in topbar. |
| `#modal-layout-studio` | `<div>` | Glassmorphic modal overlay containing Layout Studio. |
| `.layout-preset-card[data-layout]` | `<button>` | Preset card; applies layout preset (e.g. `'2h'`, `'4'`). |
| `.layout-preset-card[data-locked="1"]`| `<button>` | Locked preset; invokes `auth.enforce('chartsPerTab')` and opens Plans modal. |
| `.sync-switch-btn[data-sync]` | `<button>` | Toggles 6-axis synchronization options in place. |
| `#btn-toggle-autosave` | `<button>` | Toggles auto-save engine on/off. |
| `#layout-search-input` | `<input>` | In-place text filter for saved layouts list without input blur. |
| `#btn-sort-date`, `#btn-sort-name` | `<button>` | Sorts saved layouts by date or name. |
| `#new-layout-name-input` | `<input>` | Text input for new saved layout name. |
| `#btn-save-as-new-layout` | `<button>` | Saves current workspace under new layout name. |
| `#btn-import-layout` | `<button>` | Triggers `#import-layout-file` file selector. |
| `#import-layout-file` | `<input type="file">` | Hidden file input accepting `.json`. |
| `.btn-load-layout[data-id]` | `<button>` | Loads specified saved layout into canvas. |
| `.btn-rename-layout[data-id]` | `<button>` | Launches in-app rename prompt dialog (`showPromptDialog`). |
| `.btn-dup-layout[data-id]` | `<button>` | Duplicates specified layout setup. |
| `.btn-export-layout[data-id]` | `<button>` | Downloads JSON file `tradingchart_layout_${id}.json`. |
| `.btn-del-layout[data-id]` | `<button>` | Launches in-app destructive confirm dialog (`showConfirmDialog`). |
| `#multi-chart-cell-strip` | `<div>` | Floating container for cell navigation pills. |
| `#btn-strip-overview` | `<button>` | "All Grid" / "گرید کامل" overview button. |
| `.cell-strip-pill[data-cell-id]` | `<button>` | Cell focus pill; activates cell (and maximizes on mobile ≤ 768 px). |
| `#btn-strip-toggle-max` | `<button>` | Maximize / Restore cell toggle button. |

---

## 4. Keyboard Shortcuts

- `Alt + Enter`: Toggles maximization on the currently active chart cell (`toggleMaximizeActiveCell()`).
- `Escape`: When the active chart cell is maximized and no modal or text input is active, restores the grid arrangement (`ws.clearMaximized()`).
