# Implementation Plan: Indicators Library, Pine Editor and Strategy Tester

**Branch**: `004-indicators-pine-strategy` | **Date**: 2026-10-22 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-indicators-pine-strategy/spec.md`

## Summary

A 114-entry Pine v5 indicator catalogue with Persian text, a searchable/filterable add dialog gated by the
`indicatorsPerChart` quota, an in-browser Pine editor (templates, validation via `Indicator.from`, local save),
an indicator settings dialog driven by the Vela orchestrator's live inputs/props, and a Strategy Tester that
runs the user's exact `strategy()` script through `PineTS` on `app.activeBars` and derives every metric from
the engine's `closedtrades`. Everything executes client-side; the server only supplies bars, tickers,
screener rows, plan entitlements and the CSP that permits `new Function`.

## Technical Context

**Language/Version**: JavaScript (ES modules, browser), Node.js ESM for the offline validator

**Primary Dependencies**: `pinets` ^0.9.33 (parser + runtime; `Indicator`, `PineTS`), `@luxalgo/vela` ^0.7.5 (chart, `registerSidePanel`, `registerIcon`), `@luxalgo/vela-pinets` ^0.2.12 (`PineEngine`, used by `chartManager.js` to plot Pine on the chart). No new dependency introduced by this feature.

**Storage**: `localStorage.tradingchart_pine_code` (editor), applied indicators live in the Vela workspace state persisted by the layout manager (`tradingchart_current_layout`); `pineCode` is included in the cloud-state snapshot (`userProfileModal.js:736,847`). Backtest results are in-memory only.

**Testing**: `node tests/validate-all-indicators.js` (pure node, 114/114 pass as of 2026-10-22); browser suites `tests/qa_indicators_unified.cjs`, `tests/qa_functional_dogfood.cjs` (D09/D10), `tests/dogfood_cycle9_zero_defect.cjs`; probe `tests/probe_indicator_ledger.cjs`; spike `tests/spike_pine_strategy.mjs`.

**Target Platform**: Chart app `/chart` (desktop bottom dock + Vela side dock; mobile Vela drawer), EN/FA.

**Project Type**: Web application (client modules in `client/src/`, Express server in `server/`).

**Performance Goals**: No polling in this feature's modules; backtest is one engine run per request on ≤2,000 loaded bars (`fetchCandlesFor` default limit, `main.js:693`). No measured budget exists for backtest duration.

**Constraints**: Engine needs `'unsafe-eval'` in `script-src` (`server/security.js:12-14`); `color.cyan` is rewritten to `color.rgb(0, 229, 255)` before every compile (`pineStudio.js:241,260`, `chartManager.js:371`, validator).

**Scale/Scope**: 114 indicators (smc 18, trend 28, oscillators 29, volatility 19, volume 20; 30 with `nativeName`), 5 Pine templates, 3 Vela side panels owned by this feature (`pine`, `templates`, `strategy`) inside a 14-panel registration file.

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Honest Data | GAP | Strategy tester is honest: real `PineTS` run, `null`→"—", no auto-run (`strategyTester.js:18-23,49-88,126-141`). But `technicalRatingCard.js:53-75,240-242,107-109` invents 52W range (×1.35/×0.65), fixed MA/oscillator vote counts, fallback price 84000 / RSI 56 / "Buy", and a fixed "BINANCE · Perpetual" label. Settings dialog toasts success even when every apply call threw (`indicatorSettingsModal.js:335-373`). |
| II | Spec Before Code | GAP | Built without spec (first commit ecdb389, 2026-09-17); this retrofit restores the artefacts. |
| III | Real-Browser Verification | GAP | `qa_indicators_unified.cjs` uses `btn.click()`/`dispatchEvent` (lines 38,72,133,143) and only a 390px mobile viewport (EN + FA), no desktop cell; `qa_functional_dogfood.cjs` D10 passes on `kpisCount > 0` without checking numbers; no suite asserts backtest figures against the engine. |
| IV | Bilingual Parity / RTL | GAP | Pine editor strings are EN-only: "Diagnostics Console", "Ready. Click 'Add to Chart'…", "✓ Script saved to local storage" (`pineStudio.js:173,175,227`); template `description`s unused. Side Pine editor never re-localizes: `pineStudioSide` is referenced (`main.js:1864`) but never assigned (`main.js:439`). Code editor, prices and equity chart stay LTR correctly. |
| V | Mobile Fit / Interaction Safety | GAP | Editor buttons `padding: 4px 8px; font-size: 11px` (`pineStudio.js:142-153`), tester buttons `min-height: 32px` (`strategyTester.js:231,234`), settings inputs `height: 32px` (`indicatorSettingsModal.js:128-182`) — all below 44px. Narrow-width toolbar/split stacking exists (`client/styles/main.css:2463-2472`). |
| VI | Security & Privacy | GAP | CSP keeps `'unsafe-eval'` with a written reason and no inline scripts (`server/security.js:12-14`); engine/compile errors escaped (`strategyTester.js:51`, `pineStudio.js:253,269`). But `handle.title` and input `val` are interpolated unescaped into `innerHTML` (`indicatorSettingsModal.js:90,102,128,164`) — a script titled with HTML injects markup (self-XSS, also via shared layouts). |
| VII | Single Source of Entitlements | GAP | Keys exist in `server/featuresCatalog.js:32,462,498,522`. `indicatorsPerChart` is checked only in the dialog path (`main.js:141`); Pine editor "Add to Chart" (`main.js:281,442`), templates and compare bypass it, and the server's `STATE_LIMITS` (`server/accounts.js:512-515`) does not cap indicators. `pineStudio`/`strategyTester` gate only the side panels (`main.js:435,452`); the desktop bottom suite mounts both ungated (`main.js:274-302`). `pineTimeLimitSec`, `advancedReport`, `deepBacktest` are defined but not enforced (Sharpe shown to all plans). |
| VIII | Performance Budget | PASS | No intervals/loops in these modules; card fetches only on symbol change (`technicalRatingCard.js:21-24`); backtest runs once per request and is skipped while `running` (`strategyTester.js:22`). |
| IX | Minimal Deps / No Vendor Edits | PASS | Uses existing `pinets`/Vela packages; `color.cyan` handled by source rewrite, not by patching `node_modules`. |

## Project Structure

### Documentation (this feature)

```text
specs/004-indicators-pine-strategy/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── module-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
client/src/
├── indicatorsData.js          # INDICATORS_LIBRARY (114 entries, Pine v5 scripts, optional nativeName)
├── indicatorsFa.js            # INDICATORS_FA (Persian name/description per id)
├── indicatorsModal.js         # IndicatorsModal: search, category filter, add with busy guard
├── indicatorSettingsModal.js  # IndicatorSettingsModal: inputs/style tabs, apply, remove
├── pineStudio.js              # PINE_TEMPLATES (5), PineStudio editor, validate/add/backtest
├── strategyTester.js          # StrategyTester: PineTS run, metrics, equity SVG, CSV, Prop-Sim export
├── technicalRatingCard.js     # TechnicalRatingCard (mounted by watchlistManager.js)
├── velaPanels.js              # registerAllVelaPanels: side panels incl. pine/templates/strategy
├── main.js                    # wiring: onAddIndicator + plan gate, initDesktopBottomSuite, mount*()
├── chartManager.js            # addPineIndicator, countActiveIndicators, togglePanel
└── authManager.js             # enforce(), feature() client gates
client/chart/index.html        # #modal-indicators, #view-pine, #view-strategy mounts
client/styles/main.css         # .pine-top-toolbar / .pine-split-view narrow layout (2463-2472)
server/
├── security.js                # CSP 'unsafe-eval' for PineTS
├── featuresCatalog.js         # indicatorsPerChart, pineStudio, strategyTester, csvTradesExport, ...
├── accounts.js                # PLANS per-tier values, STATE_LIMITS
├── technicalScreener.js       # rsi14 / trend / technicalRating consumed by the card
└── index.js                   # GET /api/tickers, GET /api/screener, GET /api/candles
PINE_SCRIPT_GUIDE.md
tests/
├── validate-all-indicators.js
├── test-indicator-syntax.js
├── qa_indicators_unified.cjs
├── qa_functional_dogfood.cjs
├── dogfood_cycle9_zero_defect.cjs
├── probe_indicator_ledger.cjs
└── spike_pine_strategy.mjs
```

**Structure Decision**: Pure client feature inside the existing web app; each surface is one ES module class
mounted by `main.js` into either the desktop bottom dock (`#view-pine`, `#view-strategy`) or a Vela side panel.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| I: fabricated values in technical rating card | Shipped in c724bb4 as a TradingView look-alike before the honest-data rule (7544e50) and was never revisited | Not justified — must be fixed (see tasks Converge phase) |
| I: unconditional success toast in settings dialog | Vela handle API shape was unknown, so every call is wrapped in empty `catch` | Not justified — report failure when no apply path succeeded |
| II: no original spec | Product predates SDD adoption | Retrofit spec is the remedy |
| III: synthetic clicks, mobile-only indicator suite | Suites written before the real-click rule | Not justified — add real-click desktop+mobile × EN+FA cells |
| IV: EN-only Pine diagnostics, unassigned `pineStudioSide` | Diagnostics pane treated as "code" area | Not justified — strings are user-facing |
| V: sub-44px controls | Desktop-density styling reused in mobile drawer | Not justified on touch viewports |
| VI: unescaped title/input interpolation | Template-string rendering throughout | Escaping is a one-line helper already used in strategyTester |
| VII: client-only and partial quota enforcement | Indicators live in client chart state; server never counts them | Server can count `indicators.natives`/`manifest` in saved layouts; all add paths can share one gate |
