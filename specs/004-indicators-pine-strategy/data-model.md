# Data Model: Indicators Library, Pine Editor and Strategy Tester

Entities defined by `specs/004-indicators-pine-strategy/spec.md` (Key Entities) and their realization in the codebase. All entities reside in client memory, browser `localStorage`, or read-only bundled assets. No entities in this feature own dedicated server database tables.

---

## 1. Library Indicator (`LibraryIndicator`)

Catalogue definition of pre-packaged indicators available for plotting.

- **Storage**: In-memory static JavaScript bundle (`client/src/indicatorsData.js`, array `INDICATORS_LIBRARY`).
- **Fields**:
  - `id` (`string`, required): Unique slug identifier (e.g. `'smc_order_blocks'`, `'rsi'`, `'supertrend'`). Primary key linking to `INDICATORS_FA`.
  - `name` (`string`, required): Canonical English display name (e.g. `'Order Blocks & Liquidity'`).
  - `category` (`string`, required): Categorical classification enum: `'smc' | 'trend' | 'oscillators' | 'volatility' | 'volume'`.
  - `description` (`string`, required): English operational description of indicator logic.
  - `script` (`string`, required): Valid Pine Script v5 source code starting with `//@version=5` and `indicator(...)`.
  - `nativeName` (`string`, optional): Corresponding native indicator identifier in `@luxalgo/vela` engine (e.g. `'Relative Strength Index'`).
- **Validation**:
  - `id` must be unique across all 114 entries (114 unique IDs verified, 0 collisions).
  - `script` must compile without error in `pinets` `Indicator.from()` after `color.cyan` rewrite (114/114 passing).
  - `script` must declare `indicator(...)`, not `strategy(...)`.
- **Limits**: Fixed bundled array of exactly 114 entries (18 SMC, 28 Trend, 29 Oscillators, 19 Volatility, 20 Volume; 30 with `nativeName`).
- **Lifecycle**: Loaded at application initialization; immutable throughout session lifecycle.

---

## 2. Persian Indicator Text (`PersianIndicatorText`)

Persian localization records matching library indicators.

- **Storage**: In-memory static dictionary (`client/src/indicatorsFa.js`, object `INDICATORS_FA`).
- **Fields**:
  - `[id: string]` (key): Must match a valid `LibraryIndicator.id`.
  - `name` (`string`, required): Formal Persian name with proper ZWNJ (e.g. `'اوردر بلاک‌ها و نقدینگی (Order Blocks)'`).
  - `description` (`string`, required): Persian explanatory description.
- **Validation**: Strict 1:1 key parity with `INDICATORS_LIBRARY` (114 keys present, 0 missing, 0 orphans).
- **Limits**: Exactly 114 dictionary entries.
- **Lifecycle**: Bundled statically; queried dynamically on modal render, search query matching, and toast notifications.

---

## 3. Pine Template (`PineTemplate`)

Curated starter templates for custom Pine Script development.

- **Storage**: In-memory static map (`client/src/pineStudio.js`, object `PINE_TEMPLATES`).
- **Fields**:
  - `[key: string]` (key): Template identifier (`'smc_pro'`, `'supertrend'`, `'rsi_divergence'`, `'ma_cross'`, `'rebalance_shannon'`).
  - `name` (`string`, required): Display title of template.
  - `description` (`string`, required): Brief summary of template concept.
  - `code` (`string`, required): Full Pine Script source code.
- **Validation**: Source code must compile successfully in `Indicator.from()`. Strategy templates must declare `strategy(...)`.
- **Limits**: Exactly 5 templates (4 indicators, 1 strategy).
- **Lifecycle**: Static constant loaded with `PineStudio`; inserted into editor on `<select>` change.

---

## 4. Saved Pine Script (`SavedPineScript`)

The user's local working script in Pine Studio.

- **Storage**: Client `localStorage` key `'tradingchart_pine_code'`. Synced to server cloud state as `pineCode` inside `state_{userId}.json` via `/api/user/state`.
- **Fields**:
  - `code` (`string`): Raw text content of the editor textarea.
- **Validation**: Stored as unparsed string; validated on-demand via `Indicator.from()` when user clicks "Add to Chart" or "Backtest Strategy".
- **Limits**: Standard browser `localStorage` per-domain budget (~5 MB total). Cloud sync payload capped at 2MB (`STATE_MAX_BYTES`).
- **Lifecycle**:
  - Read from `localStorage` during `PineStudio.render()`.
  - Written when user clicks `#btn-pine-save`.
  - Persisted indefinitely across sessions until cleared by user or browser cache reset.

---

## 5. Applied Indicator (`AppliedIndicator`)

An active indicator instance currently plotted on the chart canvas.

- **Storage**: Canvas runtime memory managed by `@luxalgo/vela` workspace orchestrator (`chart.orchestrator.handles: Map<string, Handle>`). Persisted to `localStorage` key `'tradingchart_current_layout'` via `layoutManager.schedulePersist()`.
- **Fields**:
  - `id` (`string`, required): Unique runtime instance identifier (e.g. `'ind-1729600000000'`, `'rsi-1'`).
  - `title` (`string`, required): Display name in chart legend and settings header.
  - `source` (`string`, optional): Raw Pine source code for custom Pine indicators.
  - `inputs` (`Record<string, number | string | boolean>`): User-configurable parameters (e.g. `length: 14`, `src: "close"`).
  - `props` (`Record<string, string | number>`): Visual styling parameters:
    - `color` / `upColor` (`string`): Hex `#rrggbb` or `rgb(...)` color.
    - `downColor` (`string`, optional): Bearish color.
    - `linewidth` (`number`): Integer 1 to 4.
- **Validation**: Numerical inputs clamped to minimums (e.g. `step=0.1`, `min=0.01` for floats; `step=1`, `min=1` for ints). Color values match hex regex `/^#[0-9a-fA-F]{6}$/`.
- **Limits**: Maximum active indicators per chart capped by user plan entitlement `indicatorsPerChart` (Basic: 2, Essential: 5, Plus: 10, Premium: 25, Ultimate: 50).
- **Lifecycle**: Created via `IndicatorsModal` or `PineStudio` compile; modified or removed via `IndicatorSettingsModal`; restored on layout load.

---

## 6. Backtest Result (`BacktestResult`)

Quantitative performance metrics and closed trade logs computed from strategy execution.

- **Storage**: In-memory instance property `StrategyTester.results`. Not persisted across browser reloads.
- **Fields**:
  - `initialCapital` (`number`): Starting equity specified in `strategy(..., initial_capital)` (default `100000`).
  - `finalEquity` (`number`): Ending equity after all closed trades.
  - `netProfit` (`number`): Total monetary return (`finalEquity - initialCapital`).
  - `netProfitPct` (`number`): Percentage return (`(netProfit / initialCapital) * 100`).
  - `grossProfit` (`number`): Sum of profits from all winning trades.
  - `grossLoss` (`number`): Absolute sum of losses from all losing trades.
  - `profitFactor` (`number | null | Infinity`): `grossProfit / grossLoss`. `Infinity` if grossLoss is 0 and grossProfit > 0; `null` if undefined.
  - `winRate` (`number`): Percentage of winning trades (`(winTradesCount / totalTrades) * 100`).
  - `totalTrades` (`number`): Total count of closed trades.
  - `openTrades` (`number`): Count of still-open positions at simulation end.
  - `winTradesCount` (`number`): Count of closed trades with profit > 0.
  - `lossTradesCount` (`number`): Count of closed trades with profit < 0.
  - `maxDrawdown` (`number`): Maximum peak-to-trough monetary equity decline.
  - `maxDrawdownPct` (`number`): Maximum peak-to-trough percentage decline.
  - `sharpeRatio` (`number | null`): Per-trade Sharpe ratio (`mean / sd`); `null` if sample count < 2 or sd = 0.
  - `sortinoRatio` (`number | null`): Per-trade Sortino ratio (`mean / downside_sd`); `null` if downside_sd = 0.
  - `expectancy` (`number`): Mathematical expectation per trade in currency units.
  - `avgWinR` (`number | null`): Average win / average loss ratio.
  - `tradesPerDay` (`number | null`): Average frequency of trades per 24 hours over the candle history span.
  - `barsTested` (`number`): Number of historical candle bars evaluated.
  - `trades` (`Array<ClosedTrade>`):
    - `id` (`number`): 1-indexed trade sequence number.
    - `side` (`'long' | 'short'`): Trade direction based on position size sign.
    - `entryTime` (`number`): Epoch timestamp ms of entry fill.
    - `entryPrice` (`number`): Price at entry fill.
    - `exitTime` (`number`): Epoch timestamp ms of exit fill.
    - `exitPrice` (`number`): Price at exit fill.
    - `qty` (`number`): Absolute position size (rounded to 6 decimals).
    - `profit` (`number`): Realized P&L in currency units (rounded to 2 decimals).
    - `profitPct` (`number`): Percentage return on trade (rounded to 2 decimals).
    - `equity` (`number`): Cumulative account equity after trade close.
    - `barsHeld` (`number`): Number of candle bars elapsed between entry and exit.
- **Validation**: Requires >= 30 candle bars. Closed trades must have finite `exit_price` and non-zero `size`.
- **Limits**: Stored in memory; trades table renders last 8 trades; CSV export outputs 100% of closed trades.
- **Lifecycle**: Generated when user triggers `#btn-pine-backtest` or silently updated via `setCandles()` on bar stream changes. Re-rendered on language switch without re-execution.

---

## 7. Prop-Sim Profile (`PropSimProfile`)

Export payload passed from Strategy Tester to the Prop-Firm Challenge Simulator.

- **Storage**: Transient JavaScript object transferred via callback `onExportToPropSim(profile)`.
- **Fields**:
  - `winRate` (`number`): Decimal ratio between 0.0 and 1.0 (`results.winRate / 100`).
  - `avgWinR` (`number | null`): Average win to loss ratio (`results.avgWinR`).
  - `tradesPerDay` (`number | null`): Daily trade frequency (`results.tradesPerDay`).
- **Validation**: Values derived directly from `BacktestResult`; `null` values accepted and handled by PropFirmSimulator.
- **Limits**: Unbounded numerical ratios.
- **Lifecycle**: Transferred when user clicks `#btn-export-propsim`; loads into `PropFirmSimulator.setProfileParams()`.

---

## 8. Technical Rating (`TechnicalRating`)

Multi-metric consensus score and price change summary for the active watchlist symbol.

- **Storage**: In-memory instance state (`TechnicalRatingCard.tickerData`, `TechnicalRatingCard.screenerData`).
- **Fields**:
  - `symbol` (`string`, required): Uppercase asset ticker (e.g. `'BTCUSDT'`).
  - `price` (`number`): Current spot/contract price from `/api/tickers`.
  - `priceChangePercent` (`number`): 24-hour percentage price change.
  - `dayLow` (`number`): 24-hour low price.
  - `dayHigh` (`number`): 24-hour high price.
  - `rsi14` (`number | null`): 14-period RSI computed by `/api/screener`.
  - `trend` (`'Bullish' | 'Bearish' | 'Neutral'`): Screener trend direction based on SMA20 vs SMA50.
  - `technicalRating` (`'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell'`): Screener consensus rating.
  - `technicalScore` (`number`): Normalized technical score from -2 to +2.
- **Validation**: Values populated from Express API endpoints; missing data triggers fallback constants (`price=84000`, `rsi=56`).
- **Limits**: Evaluated for single active symbol at a time.
- **Lifecycle**: Fetched on initial card mount and refetched whenever `watchlistManager` or chart changes active symbol.

---

## 9. Trades CSV Export (`TradesCsv`)

Downloadable file containing the full closed trade ledger.

- **Storage**: Ephemeral browser `Blob` (`text/csv`) downloaded as file `tradingchart_strategy_trades.csv`.
- **Fields / Columns**:
  1. `Trade ID` (`number`): Sequential integer.
  2. `Side` (`string`): `'LONG'` or `'SHORT'`.
  3. `Entry Time` (`string`): ISO-8601 formatted UTC timestamp.
  4. `Entry Price` (`number`): Fill price.
  5. `Exit Time` (`string`): ISO-8601 formatted UTC timestamp.
  6. `Exit Price` (`number`): Exit price.
  7. `Size` (`number`): Trade quantity.
  8. `P&L ($)` (`number`): Profit/loss in currency units.
  9. `P&L (%)` (`string`): Return percentage with `%` suffix.
- **Validation**: Requires `auth.enforce('csvTradesExport')` permission.
- **Limits**: All closed trades included without row truncation.
- **Lifecycle**: Generated in memory on `#btn-export-csv` click, downloaded via temporary object URL, and immediately revoked.
