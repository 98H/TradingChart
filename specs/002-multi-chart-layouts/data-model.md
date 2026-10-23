# Data Model: Multi-Chart Layouts (Layout Studio)

Entities supporting the Multi-Chart Layouts feature span client-side localStorage stores, active in-memory browser states, and server-side atomic JSON persistence files.

---

## 1. Grid Preset

Static catalog configuration representing one of the eight supported multi-chart window layout arrangements.

- **Storage**: In-memory static array `DEFAULT_LAYOUT_PRESETS` in `client/src/layoutManager.js`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `id` | string | Unique preset slug identifier: `'single'`, `'dual_h'`, `'dual_v'`, `'quad'`, `'triple_h'`, `'triple_v'`, `'six_pack'`, `'eight_pack'`. |
| `layoutId` | string | Engine layout key passed to Vela: `'1'`, `'2h'`, `'2v'`, `'4'`, `'g1x3'`, `'g3x1'`, `'g2x3'`, `'8'`. |
| `nameEn` | string | English canonical name (e.g. `'2x2 Quad Grid'`, `'1x1 Single Chart'`). |
| `nameFa` | string | Formal Persian name (e.g. `'چهار چارت مربعی (2x2)'`, `'تک‌چارت (1x1)'`). |
| `cols` | number | Number of grid columns (integer between 1 and 4). |
| `rows` | number | Number of grid rows (integer between 1 and 3). |
| `descEn` | string | English analytical use-case description. |
| `descFa` | string | Formal Persian analytical use-case description. |

- **Limits**: Fixed catalogue of exactly 8 presets. Maximum cell count is 8 (`cols * rows <= 8`). Selection is gated by the user's `chartsPerTab` plan entitlement.
- **Lifecycle**: Read-only static registry initialized at bundle execution; rendered dynamically in `openLayoutStudio()`.

---

## 2. Workspace Snapshot

Complete serialization of the active charting environment, capturing all open chart cells, indicator parameters, drawing layers, active cell pointer, and synchronization switches.

- **Storage**: Client `localStorage` under key `tradingchart_current_layout`, and server-side cloud state file `server/data/accounts/states/state_{userId}.json` under property `currentLayout`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `layoutId` | string | Active grid preset identifier (`'1'`, `'2h'`, `'2v'`, `'4'`, etc.). Defaults to `'1'`. |
| `name` | string | Display name of the active workspace. |
| `savedLayoutId` | string \| null | ID of the linked saved layout if currently bound to a saved setup (`'usr_...'`). |
| `state` | object | Rich workspace state envelope (Version 2). |
| `state.version` | number | Schema version integer, currently `2`. |
| `state.layoutId`| string | Redundant grid layout key matching outer `layoutId`. |
| `state.name` | string | Workspace title string. |
| `state.savedLayoutId` | string \| null | Linked saved layout ID. |
| `state.activeCellId` | string | Identifier of the focused cell (e.g. `'c1'`). |
| `state.sync` | SyncSettings | Snapshot of active 6-axis synchronization options. |
| `state.cells` | CellState[] | Ordered array of per-cell state objects. Length equals active grid cell count. |
| `state.velaState` | object \| null | Optional raw engine fallback document from `workspace.getState()`. |
| `state.timestamp` | number | Unix timestamp in milliseconds when state was captured. |
| `sync` | SyncSettings | Redundant outer synchronization options object. |
| `timestamp` | number | Unix timestamp in milliseconds of persistence. |

- **Limits**: Payload size bounded by server `STATE_MAX_BYTES` (2MB). Maximum 8 cells in `cells` array.
- **Lifecycle**: Captured via `captureWorkspaceState()` upon cell events, debounced to 600 ms (`schedulePersist()`), supplemented by a 15-second heartbeat timer and `beforeunload`/`pagehide` handlers. Restored during application startup in `restoreCurrentLayout()`.

---

## 3. Cell State

Discrete state configuration for a single chart window within a multi-chart grid.

- **Storage**: Nested within `WorkspaceSnapshot.state.cells` and `SavedLayout.state.cells`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `id` | string | Unique cell DOM/engine identifier (e.g. `'c1'`, `'c2'`, `'c3'`). |
| `symbol` | string | Market symbol prefixed with venue (e.g. `'universal:BTCUSDT'`). |
| `timeframe` | string | Bar interval code (e.g. `'1'`, `'15'`, `'60'`, `'240'`, `'D'`). |
| `priceStyle` | string | Candlestick style (e.g. `'candles'`, `'bars'`, `'heikinashi'`, `'renko'`). |
| `watermark` | boolean | Canvas asset watermark visibility flag. Default: `true`. |
| `drawings` | object \| null | Serialized drawings document from `chart.drawings.toJSON()`. |
| `indicators` | IndicatorEntry[] | Array of active indicators configured on this chart cell. |

- **Limits**: Indicators count per cell is clamped to user plan's `indicatorsPerChart` entitlement (2 to 50).
- **Lifecycle**: Constructed during `captureWorkspaceState()`; applied during `applyWorkspaceState()` after verifying that Vela cell orchestrators are initialized.

---

## 4. Indicator Entry

Serialized representation of an active technical indicator attached to a specific chart cell.

- **Storage**: Nested within `CellState.indicators`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `id` | string | Unique indicator handle identifier. |
| `title` | string? | Display label of the indicator. |
| `nativeType` | string \| null | Built-in indicator identifier (e.g. `'volume'`, `'rsi'`, `'macd'`) or `null` if custom Pine. |
| `source` | string \| null | Raw Pine Script source code if script-based indicator. Sanitized on load. |
| `language` | string \| null | Scripting language identifier (`'pine'` or `null`). |
| `visible` | boolean | Visibility toggle state (`true` if plotted, `false` if hidden). |
| `inputs` | Record<string, any> | Key-value dictionary of user-configured numerical/boolean inputs. |
| `props` | Record<string, any> | Visual properties (line colors, plot styles, linewidths). |

- **Limits**: Script length bounded by general state size constraints; input fields validated against indicator metadata.
- **Lifecycle**: Captured via orchestrator inspection (`orch.inputValuesOf(id)`, `orch.propValuesOf(id)`); restored on chart cell by removing current handles and re-adding via `addNativeIndicator` or `addIndicator`. Deprecated syntax (such as `color.cyan`) is rewritten to `color.rgb(0, 229, 255)` prior to compilation.

---

## 5. Saved Layout

Named, reusable workspace configuration created, imported, or duplicated by the trader.

- **Storage**: Client `localStorage` under key `tradingchart_user_layouts`, and server-side cloud state file `server/data/accounts/states/state_{userId}.json` under array `layouts`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `id` | string | Unique layout identifier (`'usr_default'`, `'usr_macro'`, or `'usr_' + timestamp`). |
| `name` | string | English display name (e.g. `'Institutional SMC Master'`). Escaped for HTML safety. |
| `nameFa` | string? | Formal Persian display name (e.g. `'طرح تحلیلی نهادی اسمارت مانی'`). |
| `layoutId` | string | Grid preset key (`'1'`, `'2h'`, `'2v'`, `'4'`, etc.). |
| `badge` | string | English chart cell count label (e.g. `'4 Charts'`, `'1 Chart'`). |
| `badgeFa` | string? | Persian chart cell count label (e.g. `'۴ چارت'`, `'۱ چارت'`). |
| `sync` | SyncSettings | Saved 6-axis synchronization configuration. |
| `state` | object | Complete rich workspace state envelope (Version 2). |
| `date` | string | Creation or last modification date formatted as `YYYY-MM-DD`. |
| `isSystemTemplate`| boolean? | Optional flag denoting pre-seeded factory template. |

- **Limits**: Total user custom layouts count (excluding starter templates `'usr_default'` and `'usr_macro'`) is bounded by `savedLayouts` plan entitlement (Basic: 1, Essential: 5, Plus: 10, Premium/Ultimate: unlimited).
- **Lifecycle**: Seeded initially with two institutional defaults (`usr_default`, `usr_macro`); created via "Save Current" or JSON import; updated in-place via Quick Save or Auto-save when active; deleted via confirm dialog.

---

## 6. Sync Settings

Six-axis synchronization matrix governing how multi-chart cells coordinate interactions and property changes.

- **Storage**: Client `localStorage` under key `tradingchart_layout_sync`, and nested within `WorkspaceSnapshot.sync` and `SavedLayout.sync`.
- **Fields**:

| Field | Type | Default | Rules & Description |
|-------|------|---------|---------------------|
| `symbol` | boolean | `false` | Synchronize asset switching across all cells. |
| `timeframe` | boolean | `false` | Synchronize interval adjustments across all cells. |
| `crosshair` | boolean | `true` | Synchronize mouse cursor crosshair position across all cells. |
| `viewport` | boolean | `true` | Synchronize time axis pan and zoom across all cells. |
| `drawings` | boolean | `false` | Mirror drawing tools across cells showing the same instrument. |
| `style` | boolean | `false` | Synchronize candlestick visualization style across all cells. |

- **Limits**: Fixed schema of 6 boolean properties.
- **Lifecycle**: Loaded in `LayoutManager` constructor; updated via switch buttons in Layout Studio or Workspaces side panel; dispatched to Vela workspace via `workspace.sync.set(kind, enabled)`.

---

## 7. Deep Link

Ephemeral navigation instructions parsed from the browser URL address bar to open a specific symbol and timeframe.

- **Storage**: Read from `window.location.search`, parsed into memory as `TradingChartApp.deepLink` object `{ symbol: string, interval?: string }`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `symbol` | string | Instrument ticker. Must match `^[A-Z0-9][A-Z0-9_.\-]{0,23}$` after stripping venue prefix (`^[A-Za-z0-9_]{1,16}:`). |
| `interval` | string? | Optional timeframe code. Must match `^[0-9]{1,4}[smhdwSMHDW]?$|^[DWM]$`. |

- **Limits**: Single symbol/interval pair per page load.
- **Lifecycle**: Extracted at page load (`main.js:72-79`); applied directly to rewrite primary cell of restored layout in `layoutManager.js:234-241`; re-verified once layout restore settles via `main.js:applyDeepLink()`.
