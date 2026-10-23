# Module API Contract: Drawing Tools Interfaces

Client-side programmatic interfaces, class methods, engine facade interactions, and DOM hooks governing drawing tools.

---

## 1. `DrawingToolsLibrary` Interface (`client/src/drawingToolsLibrary.js`)

Manages the modal catalog of all 83 drawing tools across 9 categories, handling search filtering, capability probing, and star favorite pinning.

### Constructor

```javascript
constructor(app)
```
- `app`: Reference to master `TradingChartApp` instance.
- Initializes: `activeTool = null`, `favorites = this.loadFavorites()`, `el = null`, `onToolSelected = null`.
- Mounts `#drawing-tools-modal` to DOM.

### Methods

#### `loadFavorites()`
- **Returns**: `string[]` - Array of favorite tool keys from `localStorage['tradingchart_drawing_favorites']`, or fallback default `['trendline', 'ray', 'fibretracement', 'box', 'text', 'longposition', 'datepricerange', 'hline']`.

#### `saveFavorites()`
- Persists `this.favorites` JSON string to `localStorage['tradingchart_drawing_favorites']`.

#### `supportedTypes()`
- **Returns**: `Set<string>` - Cached set of drawing tool keys verified via `chart.drawings.setTool(key)`. If chart engine is unmounted, falls back to all keys in `CATALOG`.

#### `render(filter = '')`
- **Parameters**: `filter` (string, optional) - Real-time query to filter tool names by English (`en`) or Persian (`fa`).
- Renders modal content with `dir="rtl"` in Persian mode or `dir="ltr"` in English mode into `#drawing-tools-modal`. Displays `.dtl-empty` ("No tools found" / "ابزاری یافت نشد") if no match is found.

#### `selectTool(tool)`
- **Parameters**: `tool` (string) - Tool key to arm.
- **Behavior**: Sets `this.activeTool = tool`, calls `app.chartManager.armDrawingTool(tool)`, invokes `this.onToolSelected(tool)` callback to synchronize floating toolbar, and closes modal.

#### `clearTool()`
- Sets `this.activeTool = null`, calls `app.chartManager.clearDrawingTool()`, and invokes `this.onToolSelected(null)`.

#### `open()`
- Clears `supportedCache` to re-probe active chart cell, renders dialog, adds `.open` class to `#drawing-tools-modal`, and focuses `#dtl-search` input after 50 ms.

#### `close()`
- Removes `.open` class from `#drawing-tools-modal`.

#### `get isOpen()`
- **Returns**: `boolean` indicating whether modal has `.open` class.

---

## 2. `FloatingDrawingToolbar` Interface (`client/src/floatingDrawingToolbar.js`)

Manages the draggable glassmorphic dock offering quick 1-click access to favorite tools, snap modes, lock, hide, clear, and minimize.

### Constructor

```javascript
constructor(app)
```
- `app`: Reference to master `TradingChartApp` instance.
- Initializes: `activeTool = null`, `magnetMode = false`, `isLocked = false`, `isHidden = false`, `isMinimized = false`.
- Loads favorites via `loadFavorites()` and position via `localStorage['tradingchart_fav_toolbar_pos']` (clamped to `SAFE_BOTTOM = 68`, `SAFE_LEFT = 52`).
- Mounts `#floating-drawing-toolbar` into `#chart-area`.

### Methods

#### `loadFavorites()`
- **Returns**: `string[]` - Array of tool keys from `localStorage['tradingchart_drawing_favorites']` filtered by `FAV_ICON_MAP[k]`, falling back to `DEFAULT_FAVORITES`.

#### `refreshFavorites(favs)`
- **Parameters**: `favs` (string[]) - Updated list of favorite tool keys.
- Updates `this.favorites` and re-renders the toolbar buttons.

#### `render()`
- Positions `#floating-drawing-toolbar` via CSS `style.left`, `style.top`, or `style.bottom`.
- Renders drag handle, favorite buttons (`[data-tool="..."]`), all-tools button (`#fav-btn-all-tools`), magnet toggle (`#fav-btn-magnet`), lock toggle (`#fav-btn-lock`), hide/show toggle (`#fav-btn-hide`), clear trash button (`#fav-btn-trash`), and minimize toggle (`#fav-btn-minimize`).

#### `setupDraggable()`
- Binds `mousedown`, `mousemove`, and `mouseup` to `.fav-tool-drag-handle`.
- Clamps left coordinate between `SAFE_LEFT` (52 px) and `areaW - w - 70`.
- Clamps top coordinate between 46 px and `areaH - SAFE_BOTTOM - h`.
- Persists final `{ top, left }` position to `localStorage['tradingchart_fav_toolbar_pos']` on mouse up.

---

## 3. `CanvasContextMenu` Interface (`client/src/canvasContextMenu.js`)

Manages the drawing object right-click context menu and price action interactions.

### Constructor

```javascript
constructor(app)
```
- Initializes `menuEl = null`, `activePrice = null`, `activeTime = null`.
- Mounts `#canvas-context-menu` to DOM and binds contextmenu listeners on `#chart-area`.

### Methods

#### `findSelectedDrawing()`
- **Returns**: `object | null` - Target drawing object. Identifies the newest unlocked drawing from `chart.drawings.all()`, falling back to newest drawing if all are locked. Returns `null` if no drawings exist.

#### `showDrawingMenu(e, drawing)`
- **Parameters**:
  - `e` (MouseEvent): Right-click mouse event.
  - `drawing` (object): Drawing object returned from `findSelectedDrawing()`.
- **Behavior**: Positions `#canvas-context-menu` at cursor (clamped within viewport). Displays items:
  - `#ctx-draw-settings`: Calls `chart.drawings.openSettings(drawing.id)`.
  - `#ctx-draw-duplicate`: Calls `chart.drawings.duplicate([drawing.id])` (or fallback `clone(id)`).
  - `#ctx-draw-lock`: Calls `(d.lock || d.setLocked).call(d, drawing.id, !drawing.locked)`.
  - `#ctx-draw-front`: Calls `chart.drawings.bringToFront(drawing.id)`.
  - `#ctx-draw-back`: Calls `chart.drawings.sendToBack(drawing.id)`.
  - `#ctx-draw-remove`: Calls `chart.drawings.remove(drawing.id)`.

#### `hideMenu()` / `close()`
- Sets `this.isOpen = false` and hides `#canvas-context-menu` (`display = 'none'`).

---

## 4. `ChartManager` Drawing Delegation (`client/src/chartManager.js`)

Bridge methods coordinating drawings with the `@luxalgo/vela` workspace.

### Methods

#### `armDrawingTool(toolType)`
- **Parameters**: `toolType` (string) - Tool key to arm.
- **Behavior**: Sets `workspace.globalTool = toolType` and invokes `workspace.active.chart.drawings.setTool(toolType)`.

#### `clearDrawingTool()`
- **Behavior**: Sets `workspace.globalTool = null` and invokes `workspace.active.chart.drawings.setTool(null)`.

#### `stashActiveDrawings()`
- Stashes active cell drawings into `localStorage['tc_drawings_by_symbol']` under active symbol ticker key.

#### `swapDrawingsForSymbol(newSym)`
- **Parameters**: `newSym` (string) - Target symbol clean ticker.
- **Behavior**: Stashes current drawings; clears canvas drawings via `d.removeMany(ids)`; restores target symbol drawings from `localStorage['tc_drawings_by_symbol']` via `d.fromJSON(saved)`.

---

## 5. Engine `DrawingsControl` Facade Contract (`@luxalgo/vela`)

Contractual methods consumed from the chart engine's `chart.drawings` object:

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `setTool(key)` | `key: string \| null` | `void` | Arms or disarms a drawing tool on canvas. |
| `getTool()` | none | `string \| null` | Returns the currently armed tool key. |
| `setMagnet(enabled)` | `enabled: boolean` | `void` | Toggles binary OHLC magnet mode. |
| `setSnapMode(mode)` | `mode: 'off'\|'weak'\|'strong'` | `void` | Sets magnet snapping sensitivity. |
| `setLocked(locked)` | `locked: boolean` | `void` | Toggles canvas-wide drawing locking. |
| `setVisible(visible)` | `visible: boolean` | `void` | Toggles canvas-wide drawing visibility. |
| `clear()` | none | `void` | Removes all drawings from active chart pane. |
| `undo()` | none | `void` | Rolls back the most recent drawing operation. |
| `redo()` | none | `void` | Reapplies the most recently undone drawing operation. |
| `all()` | none | `DrawingObject[]` | Returns array of all active drawing objects. |
| `remove(id)` | `id: string` | `void` | Deletes the specified drawing. |
| `removeMany(ids)` | `ids: string[]` | `void` | Batch deletes drawings by identifier. |
| `duplicate([id])` | `ids: string[]` | `void` | Clones the specified drawing. |
| `bringToFront(id)` | `id: string` | `void` | Moves drawing to top of z-stack. |
| `sendToBack(id)` | `id: string` | `void` | Moves drawing to bottom of z-stack. |
| `openSettings(id)` | `id: string` | `void` | Opens engine's native drawing properties modal. |
| `toJSON()` | none | `object` | Serializes active drawing document to JSON. |
| `fromJSON(doc)` | `doc: object` | `void` | Rehydrates drawings document onto canvas. |

---

## 6. DOM Elements, Triggers & Keyboard Shortcuts

| Selector / Shortcut | Context | Target Method / Action |
|---------------------|---------|------------------------|
| `[data-tool="<key>"]` | `#floating-drawing-toolbar` | Arms or disarms `<key>` via `chartManager.armDrawingTool(key)`. |
| `#fav-btn-all-tools` | `#floating-drawing-toolbar` | Opens library modal via `drawingToolsLibrary.open()`. |
| `#fav-btn-magnet` | `#floating-drawing-toolbar` | Toggles magnet via `chart.drawings.setMagnet(bool)`. |
| `#btn-magnet` | Topbar chrome | Cycles snap mode via `chart.drawings.setSnapMode('off'\|'weak'\|'strong')`. |
| `#fav-btn-lock` | `#floating-drawing-toolbar` | Toggles lock via `chart.drawings.setLocked(bool)`. |
| `#fav-btn-hide` | `#floating-drawing-toolbar` | Toggles visibility via `chart.drawings.setVisible(bool)`. |
| `#fav-btn-trash` | `#floating-drawing-toolbar` | Clears drawings via `chart.drawings.clear()`. |
| `#fav-btn-minimize` | `#floating-drawing-toolbar` | Toggles dock collapse/expand (`.fav-tools-list`). |
| `#btn-undo` / `Ctrl+Z` / `Cmd+Z` | Topbar & Keyboard | Calls `chart.drawings.undo()`. |
| `#btn-redo` / `Ctrl+Y` / `Cmd+Y` / `Ctrl+Shift+Z` | Topbar & Keyboard | Calls `chart.drawings.redo()`. |
| `Alt+T` | Keyboard | Arms `trendline`. |
| `Alt+H` | Keyboard | Arms `hline`. |
| `Alt+F` | Keyboard | Arms `fibretracement`. |
| `Alt+B` | Keyboard | Arms `box`. |
| `Alt+P` | Keyboard | Arms `position`. |
| `Alt+V` | Keyboard | Arms `vline`. |
| `Escape` | Keyboard | Closes `#drawing-tools-modal` and `#canvas-context-menu`. |
| `[data-dtool="<key>"]` | `#drawing-tools-modal` | Arms tool and closes modal via `selectTool(key)`. |
| `[data-star="<key>"]` | `#drawing-tools-modal` | Pins/unpins tool to floating favorites toolbar. |
| `#dtl-search` | `#drawing-tools-modal` | Real-time text filter over English and Persian tool names. |
| `#dtl-close` | `#drawing-tools-modal` | Closes modal via `close()`. |
