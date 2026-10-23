# Module API Contract: Chart Workspace Shell

Client architecture interfaces, coordinator hooks, lifecycle contracts, and DOM hooks.

---

## 1. `TradingChartApp` (`client/src/main.js`)

Central coordinator attached to `window.__TRADING_APP__`.

### Public Properties
- `currentSymbol`: Current active ticker string (e.g. `'BTCUSDT'`).
- `currentTimeframe`: Current interval string (e.g. `'60'`, `'D'`).
- `activeBars`: In-memory array of loaded Candle objects `[{ time, open, high, low, close, volume }]`.
- `activeWorkspaceView`: `'quant'` or `'journal'`.
- `seriesCache`: `Map<string, Candle[]>` storing fallback bars per `symbol_timeframe`.
- `chartManager`: Reference to `ChartManager` instance.
- `timeframeManager`: Reference to `TimeframeManager` instance.
- `scaleControls`: Reference to `ScaleControls` instance.
- `chartStylePicker`: Reference to `ChartStylePicker` instance.
- `commandPalette`: Reference to `CommandPalette` instance.
- `shortcutsModal`: Reference to `ShortcutsModal` instance.
- `goToDateModal`: Reference to `GoToDateModal` instance.
- `settingsModal`: Reference to `SettingsModal` instance.
- `screenshotModal`: Reference to `ScreenshotModal` instance.
- `dataExportModal`: Reference to `DataExportModal` instance.
- `compareModal`: Reference to `CompareModal` instance.
- `watchlist`: Reference to `WatchlistManager` instance.
- `soundEngine`: Reference to `SoundEngine` instance.

### Coordinator Methods
- `async switchSymbol(symbol: string): Promise<boolean>`: Validates symbol format, fetches candles through `fetchCandlesFor`, repoints chart via `chartManager.setSymbol`, updates topbar badges, paper trading, and depth of market. Returns false if no bars exist.
- `async setTimeframe(tf: string): Promise<boolean>`: Fetches candles for current symbol at interval `tf`, updates `currentTimeframe`, calls `chartManager.setTimeframe(tf)`, and applies new bars.
- `switchLanguage(lang: 'en' | 'fa'): void`: Updates document direction (`dir="rtl"` vs `"ltr"`), font classes, persists choice to `tradingchart_user_settings`, and calls `.render()` on all open modals and views. Emits `tc:languagechange`.
- `switchWorkspace(mode: 'quant' | 'journal'): void`: Toggles visibility between `#chart-area` and `#journal-workspace-view`. Triggers window resize event.
- `stepNextWatchlistSymbol(direction: 1 | -1): void`: Moves active chart to next or previous market in the active watchlist set. Triggered via Space / Shift+Space.
- `openSymbolSearch(): void`: Opens `#modal-symbol-search`, clears `#symbol-search-input`, focuses input, and populates initial catalogue.
- `showToast(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void`: Renders floating toast notification.

---

## 2. `ChartManager` (`client/src/chartManager.js`)

Manages the `@luxalgo/vela` WebGL2 workspace canvas and panel docking.

### Methods
- `constructor({ app, mountId, onSymbolChange })`: Initializes Vela workspace in `#vela-workspace-mount`.
- `setSymbol(symbol: string): void`: Informs active chart cell of symbol change.
- `setTimeframe(tf: string): void`: Informs active chart cell of interval change.
- `setPriceStyle(style: string): void`: Applies native style to active chart (`candles`, `bars`, `heikinashi`, `line`, `area`, `baseline`).
- `togglePanel(panelId: string, open?: boolean): void`: Opens or collapses a registered side dock panel.
- `countActiveIndicators(): number`: Returns the total number of running indicators on the active chart for plan quota checks.

### CSS Custom Properties
- `--dock-offset`: Set to `340px` when a side panel is open on desktop viewports; set to `0px` when collapsed. Adds `.has-side-panel` to `#chart-area`.

---

## 3. `TimeframeManager` (`client/src/timeframeManager.js`)

Manages standard interval selection and custom timeframe creation.

### Exports
- `STANDARD_TIMEFRAMES`: Array of 13 interval objects `{ id, label, name, nameFa, category, favorite }`.
- `class TimeframeManager`
  - `constructor(app)`: Reads `localStorage.tradingchart_custom_timeframes`.
  - `open()`: Renders `#modal-timeframes` and adds `.open`.
  - `close()`: Removes `.open`.
  - `setTimeframe(id: string)`: Enforces `secondIntervals` plan check if category is `'seconds'`. Calls `app.setTimeframe(id)`.
  - `loadCustomTimeframes(): object[]`: Reads stored custom intervals.
  - `saveCustomTimeframes(): void`: Serializes array to `localStorage`.

---

## 4. `ScaleControls` (`client/src/scaleControls.js`)

Controls price scale display modes and bar-close countdown.

### Methods
- `constructor(app)`: Docks dock into chart bottom bar or `#chart-area`.
- `dockIntoBottomBar()`: Homes dock inside `.vela-widget-bottombar` on desktop; floats above time axis on mobile.
- `syncActiveStates()`: Syncs `.active` classes on buttons `#btn-scale-auto`, `#btn-scale-log`, `#btn-scale-percent`, `#btn-scale-invert` based on active renderer properties (`autoScale`, `logScale`, `scaleMode`, `invertScale`).
- `startCountdownLoop()`: Starts 1-second interval loop updating `#countdown-timer-val`. Pauses when `document.hidden` is true.

---

## 5. `ChartStylePicker` (`client/src/chartStylePicker.js`)

Topbar style dropdown component.

### Exports
- `CHART_STYLES`: Array of 13 style entries `{ id, nameEn, nameFa, icon }`.
- `class ChartStylePicker`
  - `constructor(app)`: Initializes `#popover-chart-style`.
  - `open()`: Displays dropdown popover anchored beneath `#btn-topbar-chart-style`.
  - `close()`: Hides popover.
  - `setStyle(styleId: string)`: Enforces `synthChartTypes` plan check for synthetic types. Updates `localStorage.tradingchart_price_style`, calls `chartManager.setPriceStyle`, and updates topbar icon/label.

---

## 6. `SyntheticChartEngine` (`client/src/syntheticChartTypes.js`)

Client-side calculation algorithms for non-time-based charts.

### Exports
- `toRenko(bars, boxSize)`: Generates classic brick candles anchored to absolute round grid.
- `toKagi(bars, reversalAmount)`: Generates trend reversal lines based on swing breaks.
- `toLineBreak(bars, lineCount)`: Generates Three-Line Break style series.
- `toRangeBars(bars, rangeSize)`: Generates price-range bars.
- `toPnF(bars, boxSize, reversal)`: Generates Point and Figure X/O columns.
- `toHollow(bars)`: Annotates bars with `_hollow` and `_upBar` metadata.
- `toVolumeCandles(bars)`: Normalizes volume to `_volWidth` (0–1).
- `SYNTHETIC_TYPES`: Record mapping keys to generator functions and bilingual names.

---

## 7. `CommandPalette` (`client/src/commandPalette.js`)

Fuzzy-search quick launcher (Ctrl+K).

### Methods
- `constructor(app)`: Creates `#command-palette` overlay.
- `buildIndex()`: Indexes > 45 commands across symbols, timeframes, styles, drawing tools, side panels, layouts, and actions.
- `open()`: Builds index, focuses `#cp-input`, and lists items.
- `close()`: Removes `.open`.
- `toggle()`: Toggles open state.
- `renderList(query: string)`: Filters items using lowercase substring match against English and Persian names.
- `run(index: number)`: Executes command at `index` and closes palette.

---

## 8. `ShortcutsModal` (`client/src/shortcutsModal.js`)

Keyboard shortcuts reference sheet.

### Methods
- `constructor()`: Creates `#modal-shortcuts`.
- `open()`: Renders 3 categorized shortcut columns (Navigation & Discovery, Analysis & Charting, Tools & Management) and displays modal.
- `close()`: Hides modal.
- `render()`: Re-renders localized shortcut labels and keys.

---

## 9. `GoToDateModal` (`client/src/goToDate.js`)

Direct date-navigation utility (Alt+G).

### Methods
- `constructor(app)`: Creates `#goto-date-modal`.
- `open()`: Opens dialog with pre-filled default date (7 days ago) and quick offset buttons (`1h ago`, `1d ago`, `1w ago`, `1M ago`, `YTD`).
- `close()`: Hides modal.
- `apply()`: Pans active chart visible range to selected epoch timestamp via `chart.setVisibleRange(startMs, endMs)`.

---

## 10. `SettingsModal` (`client/src/settingsModal.js`)

Visual preferences and workspace options dialog.

### Methods
- `constructor(options)`: Loads `tradingchart_user_settings` from localStorage.
- `open(tab?: string)`: Opens `#modal-settings` focused on given tab (`appearance`, `scales`, `trading`, `system`).
- `close()`: Hides modal.
- `setTab(tab: string)`: Saves current tab form inputs and renders target tab.
- `saveCurrentTabInputs()`: Extracts values from active DOM inputs into `this.settings`.
- Applying: Saves JSON to `localStorage.tradingchart_user_settings` and invokes `onApplySettings`.

---

## 11. `ScreenshotModal` (`client/src/screenshotModal.js`)

Composite canvas snapshot and sharing studio.

### Methods
- `captureCompositeCanvas(): string | null`: Composites all chart layers into a single PNG data URL.
- `open(imageSrc?: string)`: Opens `#modal-screenshot-preview` with preview image, metadata badges, and export actions.
- `close()`: Hides modal.
- Export Actions:
  - Download PNG (`#btn-dl-screenshot`)
  - Print Chart (`#btn-print-chart`)
  - Embed iframe code (`#btn-embed-code`)
  - Copy Share Link (`#btn-copy-screenshot-link`)
  - Copy Social Post Text (`#btn-copy-social-text`)

---

## 12. `DataExportModal` (`client/src/dataExport.js`)

Historical OHLCV data export engine.

### Methods
- `constructor(app)`: Creates `#modal-data-export`.
- `open()`: Opens dialog showing symbol, timeframe, loaded candle count, and format picker.
- `close()`: Hides modal.
- `executeExport()`: Enforces `dataExport` plan gate. Serializes `app.activeBars` to CSV or JSON Blob and triggers browser file download.

---

## 13. `CanvasContextMenu` (`client/src/canvasContextMenu.js`)

Context menu triggered by right-clicking on chart canvas or scale.

### Methods
- `showMenu(e)`: Opens price pane menu at mouse coordinates. Projects price via `calculatePriceAtY(clientY)`. Renders dynamic actions:
  - Add Alert at price (Alt+A)
  - Buy Limit / Buy Stop at price
  - Sell Limit / Sell Stop at price
  - Add Indicator (/)
  - Change Timeframe (,)
  - Compare Symbol (Alt+C)
  - Reset Price Scale (Alt+R)
  - Logarithmic Scale
  - Invert Price Scale (Alt+I)
  - Take Screenshot (Alt+S)
  - Go to Date (Alt+G)
  - Chart Settings
- `showPriceScaleMenu(e)`: Opens dedicated price scale menu when clicking right axis zone.
- `showDrawingMenu(e, drawing)`: Opens drawing options menu (Settings, Duplicate, Lock, Remove) when right-clicking a drawing.
- `calculatePriceAtY(clientY: number): number | null`: Uses `R.coords.yToPrice(y, pane.scale, pane.bounds)` snapped to instrument tick.

---

## 14. `SoundEngine` (`client/src/soundEngine.js`)

Synthetic audio generator.

### Methods
- `playAlert()`: Plays two-tone chime (880 Hz + 1760 Hz).
- `playOrder()`: Plays order fill chirp (520 Hz + 660 Hz).
- `playClick()`: Plays tactile button tick (1200 Hz down to 800 Hz).
- `playWarning()`: Plays warning tone (320 Hz down to 240 Hz).
- `toggleMute(): boolean`: Toggles mute state, persists to `tradingchart_sound_muted`, and returns boolean.

---

## 15. `CompareModal` (`client/src/compareModal.js`)

Multi-symbol comparison and PineTS benchmark overlay manager.

### Methods
- `open()`: Enforces `compareSymbol` plan gate. Opens `#modal-compare`.
- `addOverlay(symbol: string, color?: string, mode?: 'percent' | 'price')`: Compiles and mounts a PineTS comparative overlay series onto active chart.
- `removeOverlay(symbol: string)`: Removes overlay handle from chart and updates floating legend `#compare-legend-badges`.

---

## 16. `WatchlistManager` (`client/src/watchlistManager.js`)

Multi-watchlist manager in side dock.

### Methods
- `createList(name?: string): object | null`: Enforces `watchlists` plan limit. Creates new list in `tradingchart_user_watchlists`.
- `renameList(listId: string, name: string)`: Updates watchlist title.
- `deleteList(listId: string): boolean`: Removes list, saves tombstone in `tradingchart_watchlist_deleted`.
- `switchList(listId: string)`: Switches active displayed list.
- `addSymbol(symbol: string)`: Enforces `watchlistSymbols` plan limit. Appends symbol to active list.
- `removeSymbol(symbol: string)`: Deletes symbol from active list.
- `setFlag(symbol: string, color: string)`: Sets flag color for symbol in `tradingchart_watchlist_flags`.
- Flag cycling: Cycles `none` -> `red` -> `green` -> `blue` -> `yellow` -> `purple`. Basic plan restricts selection to `red` via `flagColors` quota check.

---

## 17. `PlatformBanner` (`client/src/platformBanner.js`)

Administrative platform announcement component.

### Exports
- `initPlatformBanner()`: Fetches `GET /api/platform`, listens to visibility change, and sets 5-minute refresh timer.
- `relocalizePlatformBanner()`: Re-evaluates active language and updates banner copy in-place.
- Renders into `#tc-platform-banner` with dismiss button `.tc-pb-close`. Dismissal persists revision timestamp to `localStorage.tc_announcement_dismissed`.

---

## 18. DOM Identifiers & Selectors Contract

| Selector | Component | Description |
|----------|-----------|-------------|
| `#modal-symbol-search` | `main.js` | Symbol search modal container overlay |
| `#symbol-search-input` | `main.js` | Symbol search text input |
| `#sym-count-badge` | `main.js` | Symbol catalogue match count label |
| `.sym-search-row` | `main.js` | Individual symbol result entry row |
| `#modal-timeframes` | `timeframeManager.js` | Timeframe selection and builder modal |
| `.btn-select-tf` | `timeframeManager.js` | Standard timeframe selection button |
| `#btn-add-custom-tf` | `timeframeManager.js` | Button to create custom interval |
| `#btn-topbar-chart-style` | `chartStylePicker.js` | Topbar style dropdown toggle button |
| `#popover-chart-style` | `chartStylePicker.js` | Floating style picker dropdown menu |
| `#scale-controls-bar` | `scaleControls.js` | Price scale controls dock container |
| `#btn-scale-auto` | `scaleControls.js` | Auto-fit scale toggle button (Alt+R) |
| `#btn-scale-log` | `scaleControls.js` | Logarithmic scale toggle button |
| `#btn-scale-percent` | `scaleControls.js` | Percentage scale toggle button |
| `#btn-scale-invert` | `scaleControls.js` | Invert scale toggle button (Alt+I) |
| `#countdown-timer-val`| `scaleControls.js` | Candle countdown timer text display |
| `#command-palette` | `commandPalette.js` | Command palette modal container (Ctrl+K) |
| `#cp-input` | `commandPalette.js` | Command palette search input |
| `#modal-shortcuts` | `shortcutsModal.js` | Keyboard shortcuts reference modal (?) |
| `#goto-date-modal` | `goToDate.js` | Date jump modal container (Alt+G) |
| `#modal-settings` | `settingsModal.js` | Chart settings modal container |
| `#modal-screenshot-preview` | `screenshotModal.js` | Screenshot preview and export modal (Alt+S) |
| `#modal-data-export` | `dataExport.js` | OHLCV data export modal (Alt+E) |
| `#canvas-context-menu` | `canvasContextMenu.js` | Canvas right-click context menu |
| `#btn-toggle-panels-dock` | `main.js` | Toggle side dock visibility button |
| `#nav-btn-quant` | `main.js` | Switch to Quant chart workspace button |
| `#nav-btn-journal` | `main.js` | Switch to Journal workspace button |
| `#btn-toggle-lang` | `main.js` | Toggle interface language FA/EN button |
| `#btn-toggle-sound` | `main.js` | Toggle audio synthesizer mute button |
| `#tc-platform-banner` | `platformBanner.js` | Global platform announcement banner bar |
