# Research: Indicators Library, Pine Editor and Strategy Tester

History: `git log --format='%h %ad %s' --date=short -- client/src/{indicatorsData,indicatorsModal,indicatorSettingsModal,indicatorsFa,pineStudio,strategyTester,velaPanels,technicalRatingCard}.js PINE_SCRIPT_GUIDE.md`
— ecdb389 (2026-09-17, initial modal/editor/tester/guide), 267f359 (2026-09-18, library split into `indicatorsData.js`),
b1565ab (settings modal), c724bb4 (technical rating card), 707d863 (Strategy Tester polish), 7544e50 (2026-10-12, real
Pine backtest, `indicatorsFa.js`, honest add feedback), c22ef30 / 95eade6 / 48af625 (QA polish).

## R1. Execute Pine client-side with PineTS

- **Decision**: Parse and run all Pine code in the browser with `pinets` (`Indicator.from` for validation, `PineTS` for backtests) and `@luxalgo/vela-pinets` `PineEngine` for on-chart plotting.
- **Rationale**: No per-user server compute; scripts never leave the device; `ARCHITECTURE.md` §2.2 records the AGPL-3.0 reasoning (keep the AGPL engine out of a network service). Matches Constitution "scripting executed client-side only".
- **Alternatives considered**: Server-side execution (rejected: compute cost, AGPL §13 exposure, latency); a hand-written subset interpreter (rejected: parity with TradingView syntax).

## R2. Allow `'unsafe-eval'` in CSP

- **Decision**: `script-src 'self' 'unsafe-eval'`, no `'unsafe-inline'` (`server/security.js:12-14`).
- **Rationale**: PineTS transpiles Pine to JS and instantiates it with `new Function`; without `unsafe-eval` neither the editor nor the library would run.
- **Alternatives considered**: Running PineTS in a sandboxed worker/iframe with its own CSP (not attempted; would isolate eval from the app origin — candidate hardening); precompiling library scripts at build time (would cover the library but not user scripts).

## R3. Backtest = run the user's exact `strategy()` on chart bars (7544e50)

- **Decision**: `StrategyTester.runSimulation` maps `app.activeBars` into a PineTS provider, runs `new Indicator(code)`, and reads `ctx.fullContext.strategy.closedtrades` / `opentrades` / `initial_capital`. All metrics are derived from those trades. No result exists until the user clicks "Backtest Strategy".
- **Rationale**: Constitution I ("A backtest MUST run the real Pine/PineTS engine on real bars"). The commit message calls this "honest data (real Pine backtest … no fake metrics)". Before 7544e50 the tester produced its own simulated report (236-line rewrite in that commit).
- **Evidence of feasibility**: `tests/spike_pine_strategy.mjs` ("can PineTS run a user strategy() and return its real closed trades?"). Re-checked during retrofit with a side-effect-free node snippet on 300 synthetic bars: PineTS 0.9.33 returned `initial_capital=100000`, 6 closed + 1 open trades with fields `entry_price, exit_price, size, profit, entry_time, exit_time, entry_bar_index, exit_bar_index`.
- **Alternatives considered**: Own JS simulator over indicator signals (rejected: diverges from script semantics, was the "fake metrics" source); server backtests (see R1).

## R4. Undefined metrics are `null` → "—"

- **Decision**: Profit factor, Sharpe, Sortino, avg-win/loss and trades/day are `null` when mathematically undefined; profit factor is `Infinity` ("∞") with gains and no losses.
- **Rationale**: Avoids invented placeholders (comment at `strategyTester.js:126`).
- **Alternatives considered**: 0 or a capped value (rejected: misleading).

## R5. Per-trade Sharpe/Sortino, not annualised

- **Decision**: Mean/sd of per-trade return (`profitPct/100`), sample sd, labelled "Sharpe (per trade)".
- **Rationale**: Trades are not daily returns; annualising would need an equity time series per bar.
- **Alternatives considered**: Daily-equity Sharpe (deferred; would require bar-level equity from the engine).

## R6. Silent re-run of the last backtested script on new bars

- **Decision**: `setCandles()` re-runs `lastCode` with `{ silent: true }` when present and not already running; never runs anything otherwise.
- **Rationale**: Keeps the report consistent with the visible symbol/timeframe without fabricating a default strategy (comment `strategyTester.js:18-19`).
- **Alternatives considered**: Clear the report on symbol change (loses context); auto-run a demo strategy (rejected as invented output).

## R7. Static library of Pine v5 scripts + optional native engine indicators

- **Decision**: One array of 114 Pine v5 scripts; 30 entries also carry `nativeName` and are added via Vela's native indicator API first, falling back to the script.
- **Rationale**: Every entry is guaranteed to have a working Pine path (validated by `tests/validate-all-indicators.js`), while native ones get Vela's faster renderer and settings.
- **Alternatives considered**: Loading scripts on demand from the server (unnecessary for ~1.8k lines); Pine v6 scripts (PineTS 0.9.33 parses `//@version=6` — verified during retrofit — but the library is v5 throughout).

## R8. Persian text in a parallel map (7544e50)

- **Decision**: `INDICATORS_FA[id] = { name, description }` separate from the library.
- **Rationale**: Keeps the library diff-friendly and lets the modal and toasts share Persian names.
- **Alternatives considered**: Inline `nameFa`/`descriptionFa` fields (equivalent; would have doubled the size of the 1.8k-line file).

## R9. Honest add feedback in the indicators dialog (7544e50)

- **Decision**: The dialog awaits `onAddIndicator` and only shows "✓ Added" for `undefined | true | {success:true}`; plan gate, compile and engine failures show "✕ Not added". A `data-busy` guard drops repeat clicks for 1.5 s.
- **Rationale**: Comment `indicatorsModal.js:179-180` — "plan gate, compile errors and engine failures must not show a green tick".
- **Alternatives considered**: Optimistic tick (previous behaviour).

## R10. Plan gating mirrored on the client

- **Decision**: `auth.enforce('indicatorsPerChart', countActiveIndicators())` on dialog add; `auth.feature('pineStudio'|'strategyTester')` on side-panel mount; `enforce('csvTradesExport')` on CSV.
- **Rationale**: Indicators exist only in client chart state, so the client is where the count is known.
- **Alternatives considered**: Server enforcement on saved layouts — not implemented; Constitution VII requires it (see plan GAP VII and Converge tasks).

## R11. `color.cyan` source rewrite

- **Decision**: Replace `\bcolor.cyan\b` with `color.rgb(0, 229, 255)` before every compile path.
- **Rationale**: The engine lacks that constant (PINE_SCRIPT_GUIDE §4.2); rewriting avoids patching `node_modules` (Constitution IX).
- **Alternatives considered**: Vendor patch (forbidden).

## R12. Technical rating card derived from screener row (c724bb4)

- **Decision**: Card reads `/api/tickers` and `/api/screener` and synthesises a TradingView-style gauge.
- **Rationale**: Visual parity with TradingView's symbol details card.
- **Assessment**: The rating badge is real (server RSI-14 / SMA20-vs-50 rules); vote counts, 52-week range, venue label and fallback constants are not — conflicts with Constitution I. Logged as `[NEEDS CLARIFICATION]` in FR-024 and as Converge tasks.
