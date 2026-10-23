# Module API Contract: Indicators, Pine Editor, Strategy Tester

Client-only feature. No `tc:*` events are emitted or consumed by these modules; integration is by
constructor callbacks, `window.__TRADING_APP__` and DOM ids.

## Exports

### `client/src/indicatorsData.js`
- `export const INDICATORS_LIBRARY: LibraryIndicator[]` — 114 entries (see data-model.md).

### `client/src/indicatorsFa.js`
- `export const INDICATORS_FA: Record<id, { name, description }>` — consumed by `indicatorsModal.js` and `main.js` toasts.

### `client/src/indicatorsModal.js`
- Re-exports `INDICATORS_LIBRARY`.
- `class IndicatorsModal`
  - `constructor({ modalEl, onAddIndicator })` — renders immediately into `modalEl`.
  - `onAddIndicator(item) → undefined | true | { success: boolean, error?, handleId? } | Promise<…>` — success is `undefined`, `true` or `{success:true}`; anything else (or a throw) is shown as "Not added".
  - `open()` — adds `.open`, clears and focuses search, repopulates. `close()` — removes `.open`; clicking the overlay backdrop also closes.
  - `render()` — full re-render (called by `app.switchLanguage`). `populateList()` — re-filter.

### `client/src/indicatorSettingsModal.js`
- `class IndicatorSettingsModal`
  - `constructor(app)` — creates/reuses `#modal-indicator-settings` (`.modal-overlay`) on `document.body`.
  - `open(handleId?)` — toast and return if the active chart has no handles; else selects `handleId` or the first `ind-*` handle.
  - `close()`, `render()`, `applyChanges()`, `formatInputLabel(key, isFa)`.
  - Requires `app.chartManager.workspace.active.chart.orchestrator.handles`, `app.showToast`, `app.layoutManager.schedulePersist`.

### `client/src/pineStudio.js`
- `export const PINE_TEMPLATES` — keys `smc_pro`, `supertrend`, `rsi_divergence`, `ma_cross`, `rebalance_shannon`.
- `class PineStudio`
  - `constructor({ container, onAddToChart(code), onBacktest(code) })` — renders immediately.
  - `render()` — rebuilds editor; restores `localStorage.tradingchart_pine_code` or `activeCode`.
  - `compileAndAdd(source, diagEl)` — `Indicator.from()` validation, then `onAddToChart(sanitized)`.
  - `runBacktest(source, diagEl)` — validation + `strategy(` check, then `onBacktest(sanitized)`.

### `client/src/strategyTester.js`
- `class StrategyTester`
  - `constructor({ container, onExportToPropSim(profile) })` — renders empty state.
  - `setCandles(bars)` — stores bars; silently re-runs `lastCode` if set and not running.
  - `async runSimulation(code, bars = this.candles, { silent } = {})` — dynamic `import('pinets')`, `new PineTS(provider, sym, tf, n)`, `engine.run(new Indicator(code))`; sets `results`, renders.
  - `renderEmpty()`, `renderMessage(html, tone)`, `renderReport()`.
  - Public state read by `main.js`: `results`, `lastCode`, `candles`, `running`.
  - Reads `window.__TRADING_APP__.currentSymbol`, `.currentTimeframe`, `.auth.enforce`.
  - Bar shape in: `{ time, open, high, low, close, volume?, closeTime? }` (ms epoch); mapped to PineTS `{ openTime, …, closeTime }`.

### `client/src/velaPanels.js`
- `export function registerAllVelaPanels(app)` — called once from `chartManager.js:35`. Registers 14 icons and 14 side panels: `pine`, `templates`, `workspaces`, `screener`, `watchlist`, `paper`, `dom`, `alerts`, `strategy`, `propsim`, `journal`, `trackers`, `calendar`, `news`
  (the trailing console log says "13"; panel titles are English and localized by `i18n.js`). Each `mount` delegates to `app.mount<Name>(body)`.
  This feature owns `pine` → `app.mountPineEditor`, `templates` → `app.mountIndicatorTemplates`, `strategy` → `app.mountStrategyTester`.

### `client/src/technicalRatingCard.js`
- `class TechnicalRatingCard`
  - `constructor({ container, app?, symbol = 'BTCUSDT' })` — renders and fetches.
  - `setSymbol(symbol)` — strips `EXCHANGE:` prefix, upper-cases, refetches.
  - `fetchData()` — `GET /api/tickers?symbols=SYM`, `GET /api/screener?search=SYM`; `calculateGaugeMetrics()`, `updateUI()`.
  - Mounted by `watchlistManager.js:379` into `#wl-technical-rating-container`.

## App wiring (`client/src/main.js`)

| Call site | Behaviour |
|-----------|-----------|
| `:137-167` `IndicatorsModal.onAddIndicator` | `auth.enforce('indicatorsPerChart', chartManager.countActiveIndicators(), …)` → native add (if `nativeName`) → `chartManager.addPineIndicator(script, name)`; toasts. |
| `:274-302` `initDesktopBottomSuite` | `PineStudio` in `#view-pine`, `StrategyTester` in `#view-strategy`; backtest → `switchBottomView('strategy')` + `runSimulation(code, activeBars)`. No plan gate. |
| `:434-448` `mountPineEditor(body)` | `feature('pineStudio')` gate → locked placeholder; else new `PineStudio` (not stored). |
| `:451-468` `mountStrategyTester(body)` | `feature('strategyTester')` gate; mirrors `this.strategyTester.results`; stored as `strategyTesterSide`. |
| `:717-720` `applyCandles(bars)` | `strategyTester.setCandles(activeBars)` (bottom tester only). |
| `:1118-1125`, `:1243` | `.vela-widget-indicators`, `.vela-mb-indicators`, `[aria-label="Indicators"]`, `[data-tool="indicators"]` clicks and `/` key open the indicators dialog. |
| `:1153-1172` | Vela legend settings controls open `indicatorSettingsModal.open(handleId)`. |
| `:1822,1857,1863-1864` `switchLanguage` | re-renders `indicatorsModal`, `pineStudio`, `pineStudioSide` (never set), `strategyTester(Side).renderReport()`. |

`chartManager.addPineIndicator(source, title) → { success, handleId? , error? }` — rewrites `color.cyan`,
calls `chart.addIndicator(src, { language: 'pine', title })`, schedules persist.

## DOM ids other code and tests rely on

| Id / selector | Owner | Used by |
|---------------|-------|---------|
| `#modal-indicators` | `client/chart/index.html:583` | `main.js`, `qa_indicators_unified.cjs` |
| `#ind-search-input`, `#ind-cat-select`, `#ind-count-label`, `#ind-clear-search`, `#modal-close-ind`, `#ind-items-container` | indicatorsModal | tests |
| `.ind-card-row` / `.ind-card[data-id]`, `.add-ind-btn[data-id]` | indicatorsModal | tests |
| `#modal-indicator-settings`, `#ind-select-handle`, `.modal-tab[data-tab]`, `.dynamic-input[data-key]`, `#input-ind-length/-factor/-source`, `#style-ind-upcolor/-downcolor/-linewidth`, `#btn-ind-apply/-cancel/-remove`, `#modal-close-ind-settings` | indicatorSettingsModal | — |
| `#view-pine`, `#view-strategy` | `client/chart/index.html:312-313` | `main.js` |
| `#pine-template-select`, `#pine-code-editor`, `#pine-line-gutter`, `#btn-pine-new/-save/-compile/-backtest`, `#pine-diagnostics-pane`, `#pine-diag-content`, `.pine-top-toolbar`, `.pine-split-view` | pineStudio | `main.css:2463-2472`, `qa_lib.cjs:237`, `qa_r1_sweep.cjs:43`, `qa_functional_dogfood.cjs`, `dogfood_cycle9_zero_defect.cjs` |
| `#strat-net-profit`, `#strat-profit-factor`, `#strat-win-rate`, `#strat-max-drawdown`, `#strat-sharpe`, `#strat-trades-tbody`, `.strat-kpi-card`, `#btn-export-propsim`, `#btn-export-csv` | strategyTester | `qa_functional_dogfood.cjs` |
| `#trc-price`, `#trc-chg`, `#trc-day-*`, `#trc-52w-*`, `#trc-rating-badge`, `#trc-needle-group`, `#trc-breakdown-summary/-osc/-ma` | technicalRatingCard | — |

Note: ids inside `PineStudio` and `StrategyTester` are duplicated in the document when both the bottom-dock
and side-panel instances are mounted; `querySelector` scoping is per container, but tests using
`document.querySelector('#btn-pine-backtest')` hit only the first instance.

## Server dependencies (owned by other features)

- `GET /api/candles?symbol&timeframe&limit` (bars for `activeBars`), `GET /api/tickers?symbols`, `GET /api/screener?search` (`server/index.js:85-177`).
- `GET /api/plans` (entitlements used by `auth.enforce/feature`).
- CSP `script-src 'self' 'unsafe-eval'` (`server/security.js:12-14`) — required by PineTS runtime compilation.
