# Module API Contract: Indicators, Pine Editor, Strategy Tester

Client-side ES module contracts governing the indicators library, settings dialog, Pine Studio, Strategy Tester, technical rating card, and technical screener.

---

## 1. `client/src/indicatorsData.js`

Provides the immutable catalogue of pre-built indicators.

- **`INDICATORS_LIBRARY`** (`Array<LibraryIndicator>`):
  Array of 114 indicator descriptor objects. Each item contains:
  - `id`: unique string slug.
  - `name`: English display title.
  - `category`: `'smc' | 'trend' | 'oscillators' | 'volatility' | 'volume'`.
  - `description`: English functional summary.
  - `script`: Pine Script v5 source code (`//@version=5 ...`).
  - `nativeName`: Optional string specifying Vela native indicator name (present on 30 items).

---

## 2. `client/src/indicatorsFa.js`

Dictionary supplying Persian translations for all 114 library indicators.

- **`INDICATORS_FA`** (`Record<string, { name: string, description: string }>`):
  Keyed by `LibraryIndicator.id`. Consumed by `IndicatorsModal`, `IndicatorSettingsModal`, and app toasts.

---

## 3. `client/src/indicatorsModal.js`

Manages the Indicators Library modal dialog, live search, and add actions.

- **`class IndicatorsModal`**
  - **`constructor({ modalEl: HTMLElement, onAddIndicator: Function })`**:
    Initializes modal DOM events and renders the initial indicator list into `modalEl`.
  - **`onAddIndicator(item: LibraryIndicator): Promise<AddResult> | AddResult`**:
    Callback triggered on row or button click. Must return `{ success: true, handleId?: string }` (or `undefined | true`) for success; any rejection, error property, or throw renders "✕ Not added" (`✕ افزوده نشد`) and keeps the button disabled for 1.5 s.
  - **`open(): void`**:
    Adds `.open` CSS class to modal element, clears `#ind-search-input`, resets category selector to `'all'`, focuses search input, and populates the list.
  - **`close(): void`**:
    Removes `.open` class and dismisses dialog.
  - **`render(): void`**:
    Performs full DOM template re-render (invoked on language changes).
  - **`populateList(query?: string, category?: string): void`**:
    Filters `INDICATORS_LIBRARY` matching search query and category, updating `#ind-items-container` and `#ind-count-label`.

---

## 4. `client/src/indicatorSettingsModal.js`

Manages the settings tuning dialog for active chart indicators.

- **`class IndicatorSettingsModal`**
  - **`constructor(app: TradingChartApp)`**:
    Creates or reuses `#modal-indicator-settings` on `document.body` and binds tab and form actions.
  - **`open(handleId?: string): void`**:
    Opens settings modal. If active chart has no indicator handles, shows warning toast and exits. Otherwise selects specified `handleId` (or first indicator handle) and renders form.
  - **`close(): void`**:
    Dismisses modal dialog.
  - **`render(): void`**:
    Builds tabs (`inputs`, `style`), indicator handle switcher dropdown, dynamic typed input fields, and action buttons.
  - **`applyChanges(): void`**:
    Extracts form values, applies inputs and style properties to indicator handle and orchestrator, schedules layout persistence via `layoutManager.schedulePersist()`, shows toast, and closes modal.
  - **`formatInputLabel(key: string, isFa: boolean): string`**:
    Converts camelCase / snake_case input keys to human-readable English or Persian parameter labels.

---

## 5. `client/src/pineStudio.js`

In-browser Pine Script v5/v6 code editor, templates, and compilation console.

- **`PINE_TEMPLATES`** (`Record<string, PineTemplate>`):
  Starter scripts: `smc_pro`, `supertrend`, `rsi_divergence`, `ma_cross`, `rebalance_shannon`.
- **`class PineStudio`**
  - **`constructor({ container: HTMLElement, onAddToChart: Function, onBacktest: Function })`**:
    Mounts editor interface into `container`.
  - **`render(): void`**:
    Builds top toolbar, template selector, line gutter, code editor textarea, action buttons, and diagnostics console. Restores saved code from `localStorage.tradingchart_pine_code` if available.
  - **`compileAndAdd(source: string, diagEl: HTMLElement): void`**:
    Rewrites `color.cyan`, validates script via `pinets.Indicator.from()`. If valid, updates diagnostics with declaration type and input count, then invokes `onAddToChart(sanitized)`. If invalid, renders HTML-escaped compilation error in red.
  - **`runBacktest(source: string, diagEl: HTMLElement): void`**:
    Rewrites `color.cyan`, pre-checks syntax via `Indicator.from()`. If script lacks `strategy(`, displays gold warning. If valid strategy, updates diagnostics and invokes `onBacktest(sanitized)`.

---

## 6. `client/src/strategyTester.js`

Quantitative backtesting execution engine and performance dashboard.

- **`class StrategyTester`**
  - **`constructor({ container: HTMLElement, onExportToPropSim: Function })`**:
    Initializes instance properties (`candles = []`, `results = null`, `lastCode = null`, `running = false`) and displays empty state.
  - **`setCandles(candles: Array<CandleBar>): void`**:
    Updates historical bars. If `this.lastCode` exists and `!this.running`, re-executes simulation silently (`{ silent: true }`).
  - **`async runSimulation(strategyCode: string, bars?: Array<CandleBar>, opts?: { silent?: boolean }): Promise<void>`**:
    Validates `strategyCode` contains `strategy(`. Requires `bars.length >= 30`. Runs `new PineTS(...)` on bars data. Computes equity, drawdowns, win rate, profit factor, Sharpe/Sortino ratios, and closed trades ledger. Stores output in `this.results` and calls `renderReport()`.
  - **`renderEmpty(): void`**:
    Renders informational empty state explaining that backtests derive from running `strategy()` code.
  - **`renderMessage(msg: string, tone?: 'error' | 'info'): void`**:
    Renders diagnostic or error status message.
  - **`renderReport(): void`**:
    Renders summary metric cards, SVG equity curve, and closed trades table. Binds `#btn-export-propsim` and `#btn-export-csv` (gated by `auth.enforce('csvTradesExport')`).

---

## 7. `client/src/technicalRatingCard.js`

Symbol summary and consensus speedometer rating card.

- **`class TechnicalRatingCard`**
  - **`constructor({ container: HTMLElement, app?: TradingChartApp, symbol?: string })`**:
    Mounts card and triggers initial data fetch.
  - **`setSymbol(symbol: string): void`**:
    Updates target instrument and triggers `fetchData()`.
  - **`async fetchData(): Promise<void>`**:
    Fetches `/api/tickers?symbols=SYM` and `/api/screener?search=SYM`. Updates internal `tickerData` and `screenerData`, then calls `updateUI()`.
  - **`calculateGaugeMetrics(): GaugeMetrics`**:
    Calculates consensus needle angle (-90 to +90 degrees) and oscillator/MA breakdown.
  - **`updateUI(): void`**:
    Renders price, 24h change, day range slider, 52-week slider, and rating badge.

---

## 8. `client/src/technicalScreener.js`

Institutional technical screening table view.

- **`class TechnicalScreenerView`**
  - **`constructor(options: { container: HTMLElement, app?: TradingChartApp })`**:
    Mounts screener layout, fetches initial screener dataset, and starts plan-gated auto-refresh timer (`auth.entitlements.screenerAutoRefreshSec`, min 5s guard).
  - **`destroy(): void`**:
    Clears active background refresh timer.
  - **`async fetchData(): Promise<void>`**:
    Queries `GET /api/screener?category=...&rating=...&search=...` and renders table rows in `#screener-tbody`.

---

## 9. DOM IDs & Selectors Contract

| Selector | Component | Description |
|----------|-----------|-------------|
| `#modal-indicators` | `IndicatorsModal` | Container element for library modal (`.open` toggled). |
| `#ind-search-input` | `IndicatorsModal` | Live filter input box. |
| `#ind-cat-select` | `IndicatorsModal` | Category dropdown filter. |
| `#ind-count-label` | `IndicatorsModal` | "Showing X of Y indicators" status label. |
| `#ind-clear-search` | `IndicatorsModal` | Clear search query button. |
| `.ind-card-row[data-id]` | `IndicatorsModal` | Indicator list item row. |
| `.add-ind-btn[data-id]` | `IndicatorsModal` | "+ Add" action button. |
| `#modal-indicator-settings` | `IndicatorSettingsModal` | Active indicator settings modal dialog. |
| `#ind-select-handle` | `IndicatorSettingsModal` | Handle selector dropdown. |
| `.modal-tab[data-tab]` | `IndicatorSettingsModal` | Tab switchers (`inputs`, `style`). |
| `#btn-ind-apply` | `IndicatorSettingsModal` | Apply and save button. |
| `#btn-ind-remove` | `IndicatorSettingsModal` | Remove indicator from chart button. |
| `#view-pine` | `PineStudio` | Desktop bottom dock container for Pine IDE. |
| `#pine-template-select` | `PineStudio` | Template starter dropdown. |
| `#pine-code-editor` | `PineStudio` | Textarea for Pine script source. |
| `#pine-line-gutter` | `PineStudio` | Line number gutter synchronized with editor scrolling. |
| `#btn-pine-new` | `PineStudio` | Create new skeleton script button. |
| `#btn-pine-save` | `PineStudio` | Save script to `localStorage` button. |
| `#btn-pine-compile` | `PineStudio` | Validate and "Add to Chart" button. |
| `#btn-pine-backtest` | `PineStudio` | "Backtest Strategy" button. |
| `#pine-diag-content` | `PineStudio` | Output pane for compiler diagnostics and errors. |
| `#view-strategy` | `StrategyTester` | Desktop bottom dock container for Strategy Tester. |
| `#strat-net-profit` | `StrategyTester` | Net profit KPI metric card. |
| `#strat-profit-factor` | `StrategyTester` | Profit factor KPI card. |
| `#strat-win-rate` | `StrategyTester` | Win rate KPI card. |
| `#strat-max-drawdown` | `StrategyTester` | Maximum drawdown KPI card. |
| `#strat-sharpe` | `StrategyTester` | Per-trade Sharpe ratio KPI card. |
| `#strat-trades-tbody` | `StrategyTester` | Table body for recent closed trades ledger. |
| `#btn-export-propsim` | `StrategyTester` | Button forwarding backtest metrics to Prop-Sim. |
| `#btn-export-csv` | `StrategyTester` | Button downloading closed trades CSV. |
| `#trc-price` | `TechnicalRatingCard` | Current price display. |
| `#trc-chg` | `TechnicalRatingCard` | 24-hour price change display. |
| `#trc-rating-badge` | `TechnicalRatingCard` | Consensus rating badge (Strong Buy/Buy/Neutral/Sell/Strong Sell). |
| `#trc-needle-group` | `TechnicalRatingCard` | SVG speedometer needle group rotated by consensus score. |
