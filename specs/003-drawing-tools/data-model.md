# Data Model: Drawing Tools

Entities supporting the Drawing Tools feature encompass client-side in-memory catalogs, device-local `localStorage` records, and cloud-synced user account states.

---

## 1. Drawing Tool

Static catalog configuration representing one of the 83 technical drawing tools supported by TradingChart and the underlying `@luxalgo/vela` charting engine.

- **Storage**: In-memory static catalog `CATALOG` in `client/src/drawingToolsLibrary.js` and icon map `FAV_ICON_MAP` in `client/src/floatingDrawingToolbar.js`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `key` | string | Unique drawing type identifier matching Vela's `DrawingTypeKey` (e.g. `'trendline'`, `'hline'`, `'fibretracement'`, `'box'`, `'pitchfork'`, `'longposition'`). |
| `nameEn` | string | Canonical English tool name (e.g. `'Trend Line'`, `'Fib Retracement'`, `'Rectangle'`). |
| `nameFa` | string | Formal Persian tool name (e.g. `'خط روند'`, `'بازگشت فیبوناچی'`, `'مستطیل'`). |
| `path` | string | SVG path definition string rendered in tool icon (viewBox `0 0 24 24`). |
| `group.en` | string | English category grouping name (e.g. `'Trend Lines'`, `'Fibonacci'`). |
| `group.fa` | string | Formal Persian category grouping name (e.g. `'خطوط روند'`, `'فیبوناچی'`). |

- **Categories**:
  1. `Trend Lines` (`خطوط روند`): 9 tools (`trendline`, `ray`, `infoline`, `extendedline`, `trendangle`, `hline`, `hray`, `vline`, `crossline`).
  2. `Channels & Pitchforks` (`کانال‌ها و چنگال‌ها`): 8 tools (`parallelchannel`, `regressionchannel`, `flattopbottom`, `disjointchannel`, `pitchfork`, `schiffpitchfork`, `modifiedschiffpitchfork`, `insidepitchfork`).
  3. `Fibonacci` (`فیبوناچی`): 12 tools (`fibretracement`, `fibextensiontrend`, `fibfan`, `fibtimezones`, `fibchannel`, `fibspeedfan`, `trendfibtime`, `fibcircles`, `fibarcs`, `fibwedge`, `fibspiral`, `fibextension`).
  4. `Gann` (`گان`): 3 tools (`gannfan`, `gannbox`, `gannsquare`).
  5. `Geometric Shapes` (`اشکال هندسی`): 9 tools (`box`, `rotatedrect`, `path`, `circle`, `ellipse`, `triangle`, `arc`, `curve`, `polyline`).
  6. `Annotations & Text` (`حاشیه‌نویسی و متن`): 15 tools (`text`, `anchoredtext`, `note`, `anchorednote`, `callout`, `comment`, `pricelabel`, `pricenote`, `signpost`, `flagmark`, `arrowmarkup`, `arrowmarkdown`, `arrow`, `iconstamp`, `highlighter`).
  7. `Patterns` (`الگوها`): 14 tools (`xabcd`, `cypher`, `abcd`, `trianglepattern`, `threedrives`, `headshoulders`, `elliottimpulse`, `elliottcorrection`, `elliotttriangle`, `elliottdoublecombo`, `elliotttriplecombo`, `cycliclines`, `timecycles`, `sine`).
  8. `Forecast & Measurement` (`پیش‌بینی و اندازه‌گیری`): 11 tools (`longposition`, `shortposition`, `forecast`, `projection`, `datepricerange`, `daterange`, `pricerange`, `ghostfeed`, `bars`, `measure`, `magnifier`).
  9. `Volume Profile & VWAP` (`پروفایل حجم و VWAP`): 2 tools (`anchoredvwap`, `fixedrangevp`).
- **Capability Probe**: During `supportedTypes()`, the active chart's `chart.drawings.setTool(key)` is evaluated; tools failing verification are hidden. If the engine is unmounted, all catalog tools are retained as fallback.
- **Limits**: Fixed static registry of 83 tools in `CATALOG` and 52 tools in `FAV_ICON_MAP`.
- **Lifecycle**: Static constant loaded at bundle boot; dynamically queried on library modal open.

---

## 2. Favourites

Ordered list of drawing tool keys pinned by the trader for 1-click access on the floating drawing toolbar.

- **Storage**:
  - Client `localStorage` under key `tradingchart_drawing_favorites`.
  - Server atomic JSON file `server/data/accounts/states/state_{userId}.json` under property `drawingFavorites` via `authManager`'s `SYNC_MAP`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `favorites` | string[] | Array of tool key strings matching `FAV_ICON_MAP`. Unknown keys are filtered out on load. |

- **Default Values**:
  - `FloatingDrawingToolbar.DEFAULT_FAVORITES`: `['trendline', 'hline', 'ray', 'fibretracement', 'box', 'position', 'datepricerange', 'freehand', 'text']`.
  - `DrawingToolsLibrary.loadFavorites()` fallback: `['trendline', 'ray', 'fibretracement', 'box', 'text', 'longposition', 'datepricerange', 'hline']`.
- **Limits**: No hard array length limit; practically bounded between 5 and 20 tools by UI dock width.
- **Lifecycle**: Read from `localStorage` on toolbar initialization; updated whenever star icon `[data-star]` is toggled in `DrawingToolsLibrary`; synced to cloud state upon `authManager.pushState()`; restored from cloud on profile login.

---

## 3. Serialized Drawing

Document representing a persisted drawing entity created on a chart canvas, retaining geometry, coordinates, style, and lock states.

- **Storage**:
  - Device-local `localStorage` under key `tc_drawings_by_symbol` as a dictionary `{ [symbol: string]: SerializedDrawing[] }`.
  - Nested in layout records under `tradingchart_user_layouts` and `tradingchart_current_layout` (`CellState.drawings`).
  - Server atomic JSON file `server/data/accounts/states/state_{userId}.json` under `layouts` and `currentLayout`.
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `id` | string | Unique drawing instance identifier assigned by the Vela engine. |
| `type` | string | Drawing tool key (e.g. `'trendline'`, `'box'`, `'fibretracement'`). |
| `points` | Array<{ time: number, price: number }> | Anchor coordinates containing UTC millisecond timestamp and price float. |
| `locked` | boolean | Locking flag preventing accidental movement or edits (`true` or `false`). |
| `visible` | boolean | Canvas visibility flag (`true` or `false`). |
| `props` | Record<string, any> | Visual parameters including line colors, line width, fill opacity, font size, and labels. |
| `createdAt` | number | Unix timestamp in milliseconds when the drawing was placed. |

- **Limits**: Bounded by available `localStorage` space (~5MB) and server `STATE_MAX_BYTES` (2MB).
- **Lifecycle**: Created via user mouse interactions on chart canvas; stashed to `tc_drawings_by_symbol` when instrument changes in `chartManager.swapDrawingsForSymbol()`; serialized via `chart.drawings.toJSON()` during layout auto-save; restored via `chart.drawings.fromJSON()` on symbol return or layout rehydration; removed via canvas context menu or trash bin.

---

## 4. Toolbar Position

Spatial coordinates defining the screen placement of the floating favorite drawing tools dock inside the charting container.

- **Storage**: Client `localStorage` under key `tradingchart_fav_toolbar_pos`. Not synced to cloud (device-specific display resolution).
- **Fields**:

| Field | Type | Rules & Validation |
|-------|------|--------------------|
| `top` | number? | Pixels from top of `#chart-area`. Clamped to minimum 46 px, maximum `areaH - SAFE_BOTTOM - height`. |
| `bottom` | number? | Pixels from bottom of `#chart-area`. Clamped to minimum `SAFE_BOTTOM` (68 px). Default: 68. |
| `left` | number | Pixels from left of `#chart-area`. Clamped to minimum `SAFE_LEFT` (52 px), maximum `areaW - width - 70`. Default: 52. |

- **Bounds Enforcement**:
  - `SAFE_BOTTOM = 68`: Prevents overlapping the 38 px bottom bar, the 22 px time axis, and breathing margin.
  - `SAFE_LEFT = 52`: Prevents overlapping the 44 px engine left rail.
  - Out-of-bounds or corrupted positions automatically reset to `{ bottom: 68, left: 52 }`.
- **Limits**: Clamped strictly within the bounding box of `#chart-area`.
- **Lifecycle**: Read from `localStorage` in `FloatingDrawingToolbar` constructor; updated continuously during dragging; saved to `localStorage` on `mouseup`.
