# Research: Indicators Library, Pine Editor and Strategy Tester

History: `git log --format='%h %ad %s' --date=short -- client/src/{indicatorsData,indicatorsModal,indicatorSettingsModal,indicatorsFa,pineStudio,strategyTester,velaPanels,technicalRatingCard}.js PINE_SCRIPT_GUIDE.md`
— `ecdb389` (2026-09-17, initial modal, editor, tester, and guide), `267f359` (2026-09-18, library split into `indicatorsData.js`), `b1565ab` (settings modal), `c724bb4` (technical rating card), `707d863` (Strategy Tester polish), `7544e50` (2026-10-12, real Pine backtest, `indicatorsFa.js`, honest add feedback), `c22ef30` / `95eade6` / `48af625` (QA polish).

## R1. Execute Pine client-side with PineTS

- **Decision**: Parse, transpile, and execute all Pine Script code directly in the trader's web browser using `pinets` (`Indicator.from()` for syntax validation and metadata extraction, `PineTS` for strategy backtesting) and `@luxalgo/vela-pinets` (`PineEngine` bridge) for on-chart canvas plotting.
- **Rationale**: Eliminates server-side execution bottlenecks and compute overhead; user scripts remain private and never leave the device; complies with AGPL-3.0 network service isolation boundaries documented in `ARCHITECTURE.md` §2.2; strictly aligns with Chartivia Constitution Principle VIII ("scripting executed client-side only").
- **Alternatives considered**:
  - Server-side Node/Python sandboxed runner (rejected: excessive server compute costs, network round-trip latency, AGPL §13 exposure).
  - Custom handwritten subset interpreter (rejected: cannot maintain TradingView Pine v5 syntax parity and standard library functions).
- **Evidence**: `client/src/pineStudio.js:4`, `client/src/strategyTester.js:67`, `client/src/chartManager.js:364-375`.

## R2. Allow `'unsafe-eval'` in Content Security Policy

- **Decision**: Configure server-side Helmet CSP header to `script-src 'self' 'unsafe-eval'`, strictly forbidding `'unsafe-inline'`.
- **Rationale**: `pinets` operates by transpiling Pine Script source into equivalent JavaScript and executing it via `new Function()`. Without `'unsafe-eval'`, dynamic script compilation throws CSP violations in the browser.
- **Alternatives considered**:
  - Sandboxed iframe with relaxed CSP (rejected: complicates canvas rendering context and bi-directional message synchronization).
  - Offline pre-compilation (rejected: cannot support custom scripts written dynamically in Pine Studio).
- **Evidence**: `server/security.js:12-14` (`// PineTS transpiles Pine to JS and evaluates via new Function()`).

## R3. Backtest = run the user's exact `strategy()` on chart bars (commit 7544e50)

- **Decision**: `StrategyTester.runSimulation` takes the exact user-provided `strategy()` source, constructs a custom market data provider from `app.activeBars`, instantiates `new PineTS(provider, symbol, timeframe, bars.length)`, and executes `engine.run(new Indicator(code))`. All metrics (Net Profit, Profit Factor, Win Rate, Max Drawdown, Sharpe, trades list) are derived solely from the engine's `closedtrades` and `initial_capital`.
- **Rationale**: Chartivia Constitution Principle I ("A backtest MUST run the real Pine/PineTS engine on real bars"). Eliminates fabricated metrics and simulated trade guessing. Prior to commit `7544e50`, Strategy Tester generated synthetic trades; this commit rewrote the subsystem to enforce 100% mathematical honesty.
- **Alternatives considered**:
  - Synthetic trade generation based on indicator signals (rejected: violation of Constitution Principle I).
  - Remote cloud backtesting server (rejected: compute constraints and latency).
- **Evidence**: `client/src/strategyTester.js:49-88`, `tests/spike_pine_strategy.mjs:1-27`.

## R4. Undefined metrics render `null` → "—" (or "∞")

- **Decision**: When backtest mathematical formulas have undefined divisors (e.g. 0 loss trades for Profit Factor, standard deviation = 0 or <2 trades for Sharpe/Sortino, 0 loss trades for R-Multiple), the values are set to `null` (rendered as `" — "`) or `Infinity` (rendered as `"∞"` for Profit Factor with positive gross profit).
- **Rationale**: Prevents deceptive or placeholder figures (such as `0.00` or arbitrary defaults) from misleading traders regarding strategy performance.
- **Alternatives considered**:
  - Clamping to artificial bounds like 99.99 (rejected: mathematically false).
  - Displaying `0.00` (rejected: conflates zero performance with undefined statistical properties).
- **Evidence**: `client/src/strategyTester.js:126-141,192-205`.

## R5. Per-trade Sharpe and Sortino ratios, not annualized

- **Decision**: Sharpe and Sortino ratios are calculated using the mean and sample standard deviation of per-trade percentage returns (`profitPct / 100`), explicitly labelled in the UI as "Sharpe (per trade)" / "Sortino (per trade)".
- **Rationale**: Chart candle intervals vary, and strategies do not trade on daily fixed periods. Accurate annualization would require a continuous bar-by-bar portfolio equity curve time series, which the engine trade ledger does not directly export.
- **Alternatives considered**:
  - Standard annualization factor $\sqrt{252}$ or $\sqrt{365}$ (rejected: mathematically invalid when trades occur irregularly across multi-timeframe candles).
- **Evidence**: `client/src/strategyTester.js:134-141`.

## R6. Silent re-run of the last backtested script on new bars

- **Decision**: When candle data changes (e.g. symbol or timeframe switch), `setCandles(candles)` automatically re-runs the last backtested script (`this.lastCode`) in `{ silent: true }` mode if not currently running. If no strategy has been backtested yet (`lastCode === null`), no simulation is executed and the empty state remains intact.
- **Rationale**: Keeps backtest metrics synchronized with active chart price action without fabricating an unrequested default strategy.
- **Alternatives considered**:
  - Reset to empty state on symbol switch (rejected: loses user backtesting context).
  - Auto-run a default demo strategy (rejected: violates Constitution Principle I by presenting unsolicited backtests).
- **Evidence**: `client/src/strategyTester.js:18-23`.

## R7. Static catalogue of 114 Pine v5 indicator scripts with optional native engine shortcuts

- **Decision**: Maintain a comprehensive bundled library of 114 Pine Script v5 indicators in `client/src/indicatorsData.js`. 30 entries declare a `nativeName` property that attempts attachment via Vela's native WebGL indicator engine (`chart.addNativeIndicator`), falling back gracefully to the Pine Script compilation pipeline if the native call fails.
- **Rationale**: Guarantees that every indicator has a valid execution path while maximizing rendering performance on the 30 core indicators optimized in Vela.
- **Alternatives considered**:
  - Lazy-loading indicators from server REST endpoints (rejected: entire catalogue is ~66 KB compressed; bundling enables offline/instant availability).
  - Upgrading library scripts to Pine v6 (rejected: PineTS v5 syntax is mature and 100% validated across all 114 scripts).
- **Evidence**: `client/src/indicatorsData.js:1-1769`, `client/src/main.js:144-156`, `tests/validate-all-indicators.js:1-33`.

## R8. Persian translations isolated in a parallel lookup dictionary (`indicatorsFa.js`, commit 7544e50)

- **Decision**: Store Persian names and descriptions in a dedicated dictionary `INDICATORS_FA[id] = { name, description }` matching the 114 library IDs.
- **Rationale**: Separates script code from localization strings, keeping the 1,769-line catalogue clean and enabling easy reuse of localized names in toasts and settings modals.
- **Alternatives considered**:
  - Inline properties `nameFa` and `descriptionFa` in `INDICATORS_LIBRARY` (rejected: doubles metadata verbosity inside script definitions).
- **Evidence**: `client/src/indicatorsFa.js:1-117`, `client/src/indicatorsModal.js:133-140`.

## R9. Honest add feedback and busy debouncing in indicators modal (commit 7544e50)

- **Decision**: `IndicatorsModal` awaits the completion of `onAddIndicator` before updating button states. The button shows `"✓ Added"` / `"✓ افزوده شد"` (green) only on confirmed success (`undefined | true | { success: true }`), and shows `"✕ Not added"` / `"✕ افزوده نشد"` (red) on plan quota blocks, compile errors, or engine rejections. A 1.5 s `data-busy` attribute prevents duplicate additions from rapid clicking.
- **Rationale**: Prevents misleading visual confirmation when an indicator failed to plot on the canvas.
- **Alternatives considered**:
  - Immediate optimistic button state update (rejected: falsely claims success when plan quota is exceeded).
- **Evidence**: `client/src/indicatorsModal.js:173-199`.

## R10. Plan entitlement gating mirrored on client

- **Decision**: Check `auth.enforce('indicatorsPerChart', countActiveIndicators())` upon library indicator addition, `auth.feature('pineStudio')` and `auth.feature('strategyTester')` on side panel mounting, and `auth.enforce('csvTradesExport')` on trades CSV export.
- **Rationale**: Canvas indicators are maintained in client memory; the client is where active indicators are enumerated.
- **Alternatives considered**:
  - Server-only gating (rejected: canvas indicators do not hit server endpoints during real-time interaction).
- **Evidence**: `client/src/main.js:141,435,452`, `client/src/strategyTester.js:313`.

## R11. `color.cyan` engine incompatibility handled via source rewriting

- **Decision**: Intercept and rewrite any occurrence of `\bcolor\.cyan\b` to `color.rgb(0, 229, 255)` in `compileAndAdd`, `runBacktest`, `testScript`, and `addPineIndicator`.
- **Rationale**: PineTS v0.9.33 lacks the built-in `color.cyan` constant. Rewriting the source string before parsing avoids modifying vendor code in `node_modules` (complying with Constitution Principle IX).
- **Alternatives considered**:
  - Patching `node_modules/pinets` (rejected: strictly forbidden by Constitution Principle IX).
- **Evidence**: `client/src/pineStudio.js:241,260`, `client/src/chartManager.js:371`, `tests/test-indicator-syntax.js:6`.

## R12. Technical rating card derived from institutional screener and ticker feeds (commit c724bb4)

- **Decision**: `TechnicalRatingCard` queries `GET /api/tickers?symbols=SYM` and `GET /api/screener?search=SYM` to populate price, 24 h change, day range, and a consensus speedometer gauge.
- **Rationale**: Replicates TradingView's symbol details widget to provide traders with a quick technical overview.
- **Assessment**: The rating score (Strong Buy/Buy/Neutral/Sell/Strong Sell) and RSI-14 are authentic server calculations. However, moving average vote counts, 52-week bounds, and fallback constants are synthetic, representing a violation of Constitution Principle I. Documented in `spec.md` FR-024 for architect resolution in Converge phase.
- **Evidence**: `client/src/technicalRatingCard.js:26-75,243-247`.

---

## Spec/code mismatches

- FR-004: Desktop bottom Pine Studio "Add to Chart" (`#btn-pine-compile`) adds custom indicator directly via `this.chartManager.addPineIndicator(code)` without checking `indicatorsPerChart` plan quota (`client/src/main.js:280-285`).
- FR-007: Template `description` fields defined in `PINE_TEMPLATES` (`smc_pro`, `supertrend`, `rsi_divergence`, `ma_cross`, `rebalance_shannon`) are not rendered or displayed anywhere in the UI (`client/src/pineStudio.js:10,44,63,81,96`).
- FR-018: Desktop bottom dock suite mounts Pine Studio and Strategy Tester instances unconditionally without enforcing `pineStudio` or `strategyTester` plan feature entitlements (`client/src/main.js:278,295`).
- FR-019: Language switch invokes `this.pineStudioSide?.render?.()` but `this.pineStudioSide` is never assigned in `mountPineEditor`, leaving the side Pine editor un-localized on switch (`client/src/main.js:439,1864`).
- FR-021: Indicator settings modal displays a success toast unconditionally at line 373 even when all calls to `handle.setInputs`, `orch.applyInputs`, `handle.setProps`, `orch.applyProps`, or `handle.updateCode` throw exceptions swallowed in empty catch blocks (`client/src/indicatorSettingsModal.js:337-373`).
- FR-024: Technical rating card synthesizes 52-week range (`high * 1.35`, `low * 0.65`), hardcodes moving average vote counts (`maBuy = 12 : 2`, `maSell = 12 : 1`), hardcodes `"BINANCE"` / `"Perpetual Contract · USDⓈ-M"`, and uses fallback constants `price = 84000`, `rsi = 56`, `trend = 'Bullish'`, `rating = 'Buy'` on fetch error (`client/src/technicalRatingCard.js:53-56,65-68,107-109,244-245`).
