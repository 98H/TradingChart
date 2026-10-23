# Review checklist — specs/004-indicators-pine-strategy

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

## Behaviour beyond the tests
- [ ] Indicators modal "+ Add" button engages a 1.5 s `data-busy="1"` guard and transitions to green "✓ Added" / "✓ افزوده شد" only on confirmed chart attachment, or red "✕ Not added" / "✕ افزوده نشد" on quota block or compilation failure.
- [ ] Native library indicators with `nativeName` attempt attachment via `chart.addNativeIndicator()` first and fall back gracefully to the Pine Script compilation pipeline on exception.
- [ ] Pine Studio rewrites `\bcolor\.cyan\b` to `color.rgb(0, 229, 255)` before passing source to `Indicator.from()` or `addPineIndicator()`.
- [ ] Pine Studio "Backtest Strategy" verifies `strategy(` declaration and warns "This script is an indicator, not a strategy" without executing backtest if absent.
- [ ] Strategy Tester requires at least 30 historical candle bars and displays "Need at least 30 historical bars to run a backtest" when fewer bars are available.
- [ ] Strategy report metrics (Net Profit, Profit Factor, Win Rate, Max Drawdown, per-trade Sharpe/Sortino) are derived strictly from the engine's `closedtrades` and initial capital.
- [ ] Undefined metrics render as "—" and zero-loss positive profit factor renders as "∞"; no placeholder zeros or synthetic metrics are displayed.
- [ ] Strategy Tester silently re-runs the last backtested strategy on new candle bar updates (`setCandles`) without running if no strategy was previously tested or if currently executing.
- [ ] Indicator settings dialog populates active handles, binds typed inputs, applies changes, and schedules layout persistence on apply or removal.
- [ ] Trades CSV export downloads `tradingchart_strategy_trades.csv` with full closed trades ledger only when `auth.enforce('csvTradesExport')` passes.

## Architecture boundaries
- [ ] Catalogue data and Persian translations are strictly separated in `client/src/indicatorsData.js` and `client/src/indicatorsFa.js`.
- [ ] Indicator modal dialog logic is fully encapsulated in `client/src/indicatorsModal.js`.
- [ ] Active indicator settings and parameter tuning are encapsulated in `client/src/indicatorSettingsModal.js`.
- [ ] In-browser Pine IDE and diagnostics console are encapsulated in `client/src/pineStudio.js`.
- [ ] Quantitative backtesting analytics and equity curve rendering are encapsulated in `client/src/strategyTester.js`.
- [ ] Technical consensus speedometer and range sliders are encapsulated in `client/src/technicalRatingCard.js`.
- [ ] Chart canvas interactions interact with `@luxalgo/vela` and `@luxalgo/vela-pinets` strictly via public APIs; no files in `node_modules` are modified.
- [ ] Plan entitlements (`indicatorsPerChart`, `pineStudio`, `strategyTester`, `csvTradesExport`) are defined in `server/featuresCatalog.js` and `server/accounts.js`.

## Forbidden shortcuts
- [ ] No branches on test inputs, test environments, or user-agent sniffing in production indicator or backtest code.
- [ ] No synthetic, placeholder, or invented performance metrics shown to users; backtest numbers come exclusively from `PineTS` execution.
- [ ] No perpetual DOM timers faster than 1000 ms; screener auto-refresh enforces a minimum 5s guard and respects `screenerAutoRefreshSec`.
- [ ] No inline scripts in HTML templates; CSP maintains `script-src 'self' 'unsafe-eval'` solely for transpiled Pine evaluation via `new Function`.

## Copy and UX (only items tests cannot see)
- [ ] Persian copy follows formal respectful register, strict ZWNJ usage, and Persian numerals in FA mode (`دایره‌المعارف اندیکاتورها و استراتژی‌ها (۱۱۴+ ابزار)`, `بک‌تست استراتژی`, `افزودن به چارت`, `تنظیمات اندیکاتور`).
- [ ] Code editor textarea, numerical values, and SVG equity curve maintain LTR orientation (`dir="ltr"`, `num-ltr`) even in Persian RTL mode.
- [ ] Dialog headers, category selectors, and search empty states align correctly in RTL mode with Vazirmatn typography.
- [ ] Modal overlays and dialog containers expand to responsive widths without horizontal overflow on mobile viewports (<=768px).
