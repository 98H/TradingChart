# Data Model: Indicators Library, Pine Editor and Strategy Tester

All entities are client-side. Nothing in this feature has its own server store.

## LibraryIndicator — `INDICATORS_LIBRARY[]` (`client/src/indicatorsData.js`, static, bundled)

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique across the array (verified: 114 ids, 0 duplicates). Used as DOM `data-id` and as key into `INDICATORS_FA`. |
| `name` | string | English display name; searched case-insensitively. |
| `category` | `'smc' \| 'trend' \| 'oscillators' \| 'volatility' \| 'volume'` | Counts: 18 / 28 / 29 / 19 / 20. Unknown categories would render an upper-cased fallback badge. |
| `description` | string | English; searched case-insensitively. |
| `script` | string | Pine `//@version=5` source; must pass `Indicator.from()` after `color.cyan` rewrite (114/114 pass). None declare `strategy()`. |
| `nativeName` | string? | Present on 30 entries; name passed to `chart.addNativeIndicator()`. On failure the `script` path is used. |

## IndicatorFaText — `INDICATORS_FA[id]` (`client/src/indicatorsFa.js`, static)

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Persian name; matched with `includes()` against the raw query. |
| `description` | string | Persian description. |

Coverage invariant: key set equals the library id set (114/114, no orphans — checked 2026-10-22).

## PineTemplate — `PINE_TEMPLATES[key]` (`client/src/pineStudio.js`, static)

Keys: `smc_pro`, `supertrend`, `rsi_divergence`, `ma_cross` (indicators) and `rebalance_shannon` (strategy).
Fields: `name`, `description` (currently not rendered), `code`. `<select>` labels are localized inline in `render()`.

## SavedPineScript — `localStorage.tradingchart_pine_code`

- Raw string written on "Save" (`pineStudio.js:226`); read on every `render()` (`pineStudio.js:207`).
- Not written on edit, template change or "New" — unsaved edits are lost on re-render (language switch, view switch to `pine`).
- Exported as `pineCode` in the account cloud-state snapshot and restored from it (`userProfileModal.js:736,846-848`).

## AppliedIndicator — Vela orchestrator handle (`chart.orchestrator.handles: Map<id, handle>`)

Owned by `@luxalgo/vela`; this feature reads/writes it.

| Accessor | Use |
|----------|-----|
| `handle.title`, `handle.source` | Dialog title / dropdown label; source used for fallback length/factor regex and source rewriting. |
| `orch.inputValuesOf(id)` / `handle.inputValues()` | Live inputs → typed controls (number, source select for close/open/high/low/hl2/hlc3/ohlc4, `#rrggbb` color, boolean, text). |
| `orch.propValuesOf(id)` / `handle.propValues()` | Style: `color`/`upColor`, `downColor`, `linewidth` (1–4). |
| `handle.setInputs` / `orch.applyInputs`, `handle.setProps` / `orch.applyProps`, `handle.updateCode` | Apply path (all tried, errors swallowed). |
| `handle.remove()` / `orch.removeIndicator(id)` | Removal. |

Persistence: workspace state (`indicators.natives`, `indicators.manifest` per chart cell) saved by the layout
manager via `layoutManager.schedulePersist()` into `tradingchart_current_layout` (feature owned elsewhere).
Count for plan gating: `chartManager.countActiveIndicators()` = orchestrator handle count, else natives + manifest.

## BacktestResult — `StrategyTester.results` (in-memory, per instance)

Built in `runSimulation()` from `ctx.fullContext.strategy ?? ctx.strategy` returned by `PineTS.run()`.

| Field | Derivation |
|-------|-----------|
| `initialCapital` | `Number(st.initial_capital) \|\| 100000` |
| `trades[]` | `st.closedtrades` filtered to finite `exit_price` and non-zero `size`, sorted by `exit_time` |
| `finalEquity`, `netProfit`, `netProfitPct` | initial capital + Σ profit |
| `grossProfit`, `grossLoss` | Σ positive / |Σ negative| profits |
| `profitFactor` | gross P / gross L; `Infinity` if no losses and P>0; `null` if neither |
| `winRate`, `winTradesCount`, `lossTradesCount`, `totalTrades` | counts over `trades` (profit exactly 0 counts as neither) |
| `openTrades` | `st.opentrades.length` |
| `maxDrawdown`, `maxDrawdownPct` | peak-to-trough on closed-trade equity |
| `sharpeRatio`, `sortinoRatio` | per-trade mean / sd of `profitPct/100` (sample sd); `null` when sd = 0 or <2 samples |
| `expectancy` | winRate·avgWin − (1−winRate)·avgLoss |
| `avgWinR` | avgWin / avgLoss or `null` |
| `tradesPerDay` | n / (last bar time − first bar time in days) or `null` |
| `barsTested` | `bars.length` |

Trade fields: `id` (1-based), `side` (`long` if size>0), `entryTime`, `entryPrice`, `exitTime`, `exitPrice`,
`qty` (|size|, 6 dp), `profit` (engine `profit` or (exit−entry)·size, 2 dp), `profitPct` (side-signed, 2 dp),
`equity` (running), `barsHeld` (exit − entry bar index).

### State transitions (StrategyTester)

```text
empty ──runSimulation(non-strategy)──▶ message "not a strategy" (results unchanged)
empty ──runSimulation(<30 bars)──────▶ message "need 30 bars"
empty ──runSimulation(ok)──▶ running ──engine throws──▶ message "runtime error"
                               │──no strategy state──▶ message "no strategy state"
                               └──ok──▶ results set ──totalTrades=0──▶ message "no closed trades"
                                                    └──totalTrades>0──▶ report
report ──setCandles(new bars) [lastCode && !running]──▶ running (silent) ──▶ report
any ──language switch──▶ renderReport() (no re-run)
```

`lastCode` is set before execution, so a failing script is retried on every candle update.

## PropSimProfile — argument to `onExportToPropSim`

`{ winRate: results.winRate / 100, avgWinR: results.avgWinR, tradesPerDay: results.tradesPerDay }`
(`avgWinR` and `tradesPerDay` may be `null`).

## TradesCsv — download `tradingchart_strategy_trades.csv`

Header: `Trade ID,Side,Entry Time,Entry Price,Exit Time,Exit Price,Size,P&L ($),P&L (%)`; one row per trade,
ISO-8601 times, side upper-case, `%` suffix on the last column. No quoting (fields contain no commas).

## TechnicalRating — inputs to `TechnicalRatingCard`

From `GET /api/tickers?symbols=SYM` (first element: `lastPrice`, `priceChange`, `priceChangePercent`,
`highPrice`, `lowPrice`) and `GET /api/screener?search=SYM` (`items[0]`: `rsi14`, `trend` `'Bullish'|'Bearish'`,
`technicalRating` `'Strong Buy'|'Buy'|'Neutral'|'Sell'|'Strong Sell'`, computed in `server/technicalScreener.js:47-99`).
Derived in the card (not from data): oscillator/MA vote counts, gauge angle, 52-week range — see plan GAP I.

## Entitlement keys read by this feature (`server/featuresCatalog.js`, values in `server/accounts.js` PLANS)

| Key | Type | Where checked |
|-----|------|---------------|
| `indicatorsPerChart` | numeric (basic 2, essential 5, plus 10, premium 25, ultimate 50) | `main.js:141` (dialog add only) |
| `pineStudio` | boolean | `main.js:435` (side panel only) |
| `strategyTester` | boolean | `main.js:452` (side panel only) |
| `csvTradesExport` | boolean | `strategyTester.js:313` |
| `pineTimeLimitSec`, `advancedReport`, `deepBacktest`, `indicatorsOnIndicator` | defined | not enforced in this feature |
