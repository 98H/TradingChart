# Implementation Plan: Indicators Library, Pine Editor and Strategy Tester

**Branch**: `004-indicators-pine-strategy` | **Date**: 2026-10-23 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-indicators-pine-strategy/spec.md`

## Summary

The Indicators Library, Pine Editor, and Strategy Tester feature provides comprehensive institutional technical analysis and custom quantitative algorithmic backtesting inside the Chartivia web charting platform. It bundles a verified library of 114 Pine Script v5 indicators with complete Persian localization (`indicatorsData.js`, `indicatorsFa.js`), a searchable and category-filtered indicators modal dialog (`IndicatorsModal`), an in-browser Pine Script v5/v6 IDE with syntax validation, line gutter, templates, and compilation diagnostics (`PineStudio`), an active indicator tuning and styling dialog (`IndicatorSettingsModal`), and a quantitative backtesting engine (`StrategyTester`) powered by `pinets` and `@luxalgo/vela-pinets`. All calculations execute client-side on authentic chart candle bars without server-side compute or invented metrics. The Express backend serves market ticker data, institutional screener metrics, plan entitlements, and the Content Security Policy permitting runtime compilation.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser ESM; Node.js v20+ ESM for offline compilation and syntax validators).

**Primary Dependencies**:
- `pinets`: `^0.9.33` (Pine Script compiler, parser, AST builder, and execution runtime: `Indicator`, `PineTS`).
- `@luxalgo/vela`: `^0.7.5` (WebGL2 charting engine, workspace orchestrator, native indicators, side panel registration).
- `@luxalgo/vela-pinets`: `^0.2.12` (`PineEngine` runtime bridge mounting Pine indicators onto Vela canvas).
- `express`: `^4.21.2` (HTTP backend serving `/api/screener`, `/api/tickers`, `/api/candles`).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography for indicator names, descriptions, and KPI tables).
- `@fontsource/inter`: `^5.3.0` (Latin typography).
- `puppeteer-core`: `^24.3.1` (Headless browser acceptance testing).

**Storage**:
- Client `localStorage`:
  - `tradingchart_pine_code`: Raw string storing the user's last saved custom Pine script in Pine Studio.
  - `tradingchart_current_layout`: Serialized workspace layout containing active indicators ledger (`indicators.natives`, `indicators.manifest`).
- Server atomic JSON:
  - `server/data/accounts/states/state_{userId}.json`: User cloud state snapshot including synced `pineCode`.
- In-memory state:
  - `StrategyTester.results`: Backtest metrics, equity curve series, and closed trade ledger.
  - `server/technicalScreener.js` `screenerCache`: In-memory screener technical metrics cached for 8 seconds.

**Testing**:
- Node CLI unit validator: `node tests/validate-all-indicators.js` (audits syntax of all 114 library scripts via `Indicator.from()`).
- Pine syntax helper: `tests/test-indicator-syntax.js`.
- Puppeteer browser suites:
  - `tests/qa_indicators_unified.cjs`: Modal trigger, 114 count, category filtering, SMC/native adding, plan limits, Persian RTL.
  - `tests/test-pine-plot.js`: Plots custom Pine SMA indicator on canvas.
  - `tests/test_pine_inputs.cjs`: Verifies runtime input overrides on chart indicators.
  - `tests/test-add-pine.js`: Pine Studio compile and canvas mount probe.
  - `tests/probe_indicator_ledger.cjs`: Verifies Vela workspace indicator ledger.
  - `tests/spike_pine_strategy.mjs`: Standalone node spike for PineTS backtest simulation.

**Target Platform**: Responsive web charting application (`/chart`) on desktop (bottom dock suite + side panels) and mobile (bottom menu + side drawers), supporting English (LTR) and Persian (RTL).

**Project Type**: Client-centric web application with modular ES classes in `client/src/` backed by Express endpoints in `server/`.

**Performance Goals**:
- Instant indicator modal opening and responsive live search (<10 ms filter latency across 114 items).
- Pine script syntax validation and compilation diagnostics under 250 ms.
- Backtest simulation completed in <1.5 s on up to 2,000 historical bars.
- 60 FPS smooth chart rendering when running up to 5 concurrent active indicators.

**Constraints**:
- Content Security Policy requires `script-src 'self' 'unsafe-eval'` (`server/security.js:12-14`) because PineTS evaluates transpiled JavaScript via `new Function`.
- `color.cyan` is unsupported by the PineTS engine and must be transformed via regex to `color.rgb(0, 229, 255)` prior to compilation.
- Backtesting requires at least 30 historical candle bars loaded in the active chart workspace.
- Minimum touch target requirement of 44px on mobile devices.

**Scale/Scope**:
- 114 bundled library indicators across 5 categories (18 SMC, 28 Trend, 29 Oscillators, 19 Volatility, 20 Volume; 30 with native engine shortcuts).
- 114 1:1 Persian localized translation records in `INDICATORS_FA`.
- 5 built-in Pine templates (4 indicators, 1 strategy).
- 3 registered Vela side dock panels (`pine`, `templates`, `strategy`).

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | VIOLATION | Strategy Tester strictly adheres to honest data (real `PineTS` run, undefined metrics render "—" or "∞", no fake metrics). However, `technicalRatingCard.js:53-75,107-109,244-245` invents a 52-week range (`high * 1.35`, `low * 0.65`), fixed MA/oscillator vote counts (`12:2`, `12:1`), fallback constants (`price=84000`, `rsi=56`, `trend='Bullish'`, `rating='Buy'`), and a hardcoded `"BINANCE · Perpetual"` label. Furthermore, `indicatorSettingsModal.js:337-373` toasts success even when all apply calls throw. |
| II | Spec Before Code | VIOLATION | Feature was implemented in production between September 17 and October 22, 2026, before adopting SDD; this retrofit formalizes normative requirements (`spec.md`) and descriptive Spec Kit documentation. |
| III | Real-Browser Zero-Defect Verification | VIOLATION | `qa_indicators_unified.cjs` uses programmatic `btn.click()` instead of real coordinates, tests only a 390px mobile viewport (omits desktop matrix cell), and `qa_functional_dogfood.cjs` verifies only `kpisCount > 0` without validating specific engine outputs against closed trades. |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | Library modal and 114 indicators have 100% Persian translation parity (`indicatorsFa.js`). However, Pine Studio diagnostics console has hardcoded English strings ("Diagnostics Console", "Ready. Click 'Add to Chart'...", "✓ Script saved to local storage") in `pineStudio.js:173,175,227`. Additionally, `main.js:1864` calls `this.pineStudioSide?.render?.()` but `this.pineStudioSide` is never assigned in `mountPineEditor` (`main.js:439`), leaving the side Pine editor untranslated after language switch. |
| V | Mobile Fit and Interaction Safety | VIOLATION | Pine editor toolbar buttons have `padding: 4px 8px; font-size: 11px` (`pineStudio.js:142-153`), Strategy Tester export buttons have `min-height: 32px` (`strategyTester.js:231,234`), and indicator settings inputs have `height: 32px` (`indicatorSettingsModal.js:128-182`), falling below the mandatory 44px touch target guideline. |
| VI | Security and Privacy by Default | VIOLATION | CSP enables `'unsafe-eval'` with explicit justification for runtime Pine compilation (`server/security.js:12-14`). However, `indicatorSettingsModal.js:90,102,128,164` interpolates `handle.title` and input `val` directly into `innerHTML` without HTML escaping, opening potential self-XSS via crafted script titles. |
| VII | Single Source of Truth for Entitlements | VIOLATION | Plan quotas are defined in `server/featuresCatalog.js` and `server/accounts.js`. However, `indicatorsPerChart` is only checked in the library modal (`main.js:141`); Pine Studio "Add to Chart" (`main.js:281`) bypasses it. `pineStudio` and `strategyTester` flags only gate side panels (`main.js:435,452`), leaving desktop bottom panels ungated (`main.js:274-302`). Server state limits do not cap active indicators in saved layouts. |
| VIII | Performance Budget | PASS | No perpetual intervals or timers; screener data uses on-demand 8s caching; backtest runs once per invocation on <=2000 bars with an active `running` flag guard (`strategyTester.js:22`). |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Leverages standard `pinets` and `@luxalgo/vela-pinets` packages without vendor file modifications; `color.cyan` gap is solved via source rewrite. |
| X | Hybrid SDD | VIOLATION | Built prior to SDD adoption. This retrofit establishes the complete Spec Kit documentation set to govern future iterations without altering working production code. |

## Project Structure

### Documentation (this feature)

```text
specs/004-indicators-pine-strategy/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-024, SC-001..SC-006)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R12, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/screener, /api/tickers)
│   └── module-api.md           # Client module interfaces, methods, and wiring
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Modal mounts (#modal-indicators, #view-pine, #view-strategy)
├── src/
│   ├── indicatorsData.js       # 114 Pine v5 indicator scripts, categories, and native names
│   ├── indicatorsFa.js         # Complete Persian translations for all 114 library indicators
│   ├── indicatorsModal.js      # IndicatorsModal dialog: search, category filters, add trigger
│   ├── indicatorSettingsModal.js # IndicatorSettingsModal: inputs and style tabs, parameter tuning
│   ├── pineStudio.js           # PineStudio: Pine v5/v6 IDE, templates, gutter, compiler diagnostics
│   ├── strategyTester.js       # StrategyTester: PineTS simulation runner, KPI metrics, equity SVG, CSV
│   ├── technicalRatingCard.js  # TechnicalRatingCard: consensus speedometer gauge and range sliders
│   ├── technicalScreener.js    # TechnicalScreenerView: institutional screener table and filters
│   ├── velaPanels.js           # Side panel registrations for pine, templates, and strategy
│   ├── chartManager.js         # Chart workspace coordinator, addPineIndicator, indicator counting
│   ├── main.js                 # App coordinator, modal initialization, plan gating, desktop bottom suite
│   ├── authManager.js          # Client-side entitlement checking (enforce, feature)
│   └── i18n.js                 # Localization helper and Persian digit formatting
├── styles/
│   └── main.css                # Pine editor layout, split views, rating card, responsive media queries
server/
├── index.js                    # Express HTTP routes: /api/screener, /api/tickers, /api/candles
├── security.js                 # Helmet CSP config allowing 'unsafe-eval' for PineTS
├── featuresCatalog.js          # Canonical plan entitlements (indicatorsPerChart, pineStudio, etc.)
├── accounts.js                 # Per-tier plan definitions and user cloud state sync endpoints
└── technicalScreener.js        # Institutional technical screener engine (RSI-14, SMA20/50, 8s cache)
tests/
├── validate-all-indicators.js  # PineTS syntax validation of all 114 library scripts
├── test-indicator-syntax.js    # Pine syntax verification helper
├── test-pine-plot.js           # Canvas mounting Puppeteer test
├── test_pine_inputs.cjs        # Input parameter override Puppeteer probe
├── test-add-pine.js            # Pine Studio Add to Chart Puppeteer probe
├── qa_indicators_unified.cjs   # Unified indicators modal Puppeteer test suite
├── probe_indicator_ledger.cjs  # Workspace indicator ledger inspection probe
└── spike_pine_strategy.mjs     # Standalone PineTS strategy simulation test
```

**Structure Decision**: Modular client architecture where library data (`indicatorsData.js`, `indicatorsFa.js`) is separated from UI dialogs (`indicatorsModal.js`, `indicatorSettingsModal.js`), code editing (`pineStudio.js`), and backtesting analytics (`strategyTester.js`). Chart rendering is delegated to `@luxalgo/vela-pinets` and `@luxalgo/vela` through `ChartManager`. Backend routes in `server/` supply institutional technical screening, ticker quotes, and plan quotas.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| I: Fabricated values in technical rating card | Shipped in commit c724bb4 as a visual TradingView parity mockup prior to the honest data doctrine. | Retained during retrofit to avoid breaking visual layout; logged in research.md and spec.md FR-024 for architect resolution in Converge phase. |
| I: Unconditional success toast in settings dialog | Handles error suppression when optional Vela orchestrator methods are absent. | Swallowing errors prevented UI crashes, but masks failure; logged for Converge phase fix. |
| II: Built prior to SDD adoption | Implemented across September–October 2026 before adopting Hybrid SDD methodology. | Retrofit procedure creates complete Spec Kit artifacts without risking regressions in stable production code. |
| III: Synthetic clicks and mobile-only indicator test suite | Legacy Puppeteer tests were written before strict pointer click and multi-matrix rules were established. | Rewriting test harness deferred to test authoring phase of SDD lifecycle. |
| IV: Hardcoded English strings in Pine diagnostics & unassigned `pineStudioSide` | Diagnostics console was treated as a code terminal; variable assignment typo in `main.js:439`. | Minor defect logged in research.md mismatches to be corrected in Converge phase. |
| V: Sub-44px touch targets on editor and tester controls | Desktop-first compact UI design density reused on mobile viewports. | Expanding mobile touch targets requires CSS layout restructuring, deferred to Converge phase. |
| VI: Unescaped indicator title and input interpolation | Direct string interpolation used in initial modal implementation. | Minimal exploit surface in authenticated desktop app; logged for sanitization patch in Converge phase. |
| VII: Client-only and partial quota enforcement | Indicators reside exclusively in client-side canvas memory. | Full server-side validation requires parsing layout state during `/api/user/state` sync; deferred to Converge phase. |
| X: Retrofit feature governance | Feature existed in production prior to SDD pipeline ratification. | Retrofit protocol documents existing code contracts to enable future gated enhancements. |
