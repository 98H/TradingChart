# Implementation Plan: Trade Journal and Prop-Firm Tools

**Branch**: `007-journal-propfirm` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-journal-propfirm/spec.md`

## Summary

The Trade Journal and Prop-Firm Tools feature delivers an institutional-grade performance analytics, trade journaling, and challenge risk evaluation workstation for Chartivia:
1. **Tri-Surface Journal Workspace**: Full-page dedicated workstation (`#journal-workspace-view`) accessible via topbar navigation pill (`#nav-btn-journal`), plus secondary bottom panel tab (`#view-journal`) and Vela side-dock drawer (`mountTradeJournal`), organizing 8 integrated suites: Dashboard & Heatmap, Edge Radar & Deep Analytics, Trades Ledger & Replay, Daily Journal & Voice, Prop Firm Tracker, Playbooks & Checklists, AI Reflection Coach, and Universal Statement Importer.
2. **Reactive Quantitative Journal Store**: Centralized reactive client store (`JournalStore` in `client/src/journal/journalStore.js`) backed by `@luxalgo/journal-core` (FIFO execution matching, performance metrics, 6-axis Edge Score v2 composite, drawdown analysis, and strategy rule adherence) and `@luxalgo/journal-importers` (auto-detecting and parsing 14 broker formats).
3. **Interactive Trade Logging & Voice Dictation**: Modal dialog (`TradeJournalModal`) with 1-click BUY/SELL toggle, real-time P&L and risk-reward ($R$) calculation, strategy playbook tagging, psychology mistake classification, and Web Speech API voice dictation in Persian (`fa-IR`) and English (`en-US`).
4. **Prop-Firm Challenge Tracker & Monte Carlo Simulator**: Dedicated prop account capital tracker (`PropFirmTracker`) tracking evaluation fees, payouts, ROI, and drawdown buffer alerts, seamlessly bridged to the 500-path Monte Carlo simulator (`PropFirmSimulator` backed by `@luxalgo/prop-firm-sim-core`) supporting FTMO and Topstep challenge presets and 1-click strategy statistics export from the Strategy Tester.
5. **Privacy Mode & Cloud State Sync**: Instant client-side masking of all financial figures (`$***.**`) for screen-sharing and streaming, coupled with per-user cloud state persistence (`tradeJournal`) under `/api/user/state` subject to the 2 MB state quota.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ ESM in browser; Node.js v20+ ESM in backend). Mathematical core and importer types defined in TypeScript (`client/src/journal/core/`, `client/src/journal/importers/`).

**Primary Dependencies**:
- `@luxalgo/journal-core`: `^0.1.0` (FIFO round-trip execution engine, metrics aggregator, Edge Score v2 composite, equity curve, drawdown, time attribution, and rule adherence analysis).
- `@luxalgo/journal-importers`: `^0.1.0` (Universal format detector and parsers for 14 broker statement formats).
- `@luxalgo/prop-firm-sim-core`: `^1.2.1` (Parametric Monte Carlo challenge simulator for prop-firm evaluations).
- `express`: `^4.21.2` (Backend HTTP routing and authentication middleware).
- `puppeteer-core`: `^24.3.1` (Headless browser automation for acceptance tests).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography, numerals, and RTL alignment).
- `@fontsource/jetbrains-mono`: `^5.3.0` (Monospace figures for tabular financial data).
- Web Speech API: `window.SpeechRecognition` / `window.webkitSpeechRecognition` (browser-native speech-to-text dictation in `fa-IR` and `en-US`).

**Storage**:
- Client `localStorage`:
  - `tradingchart_trade_journal`: Primary JSON array of execution objects `[{ id, accountId, symbol, side, quantity, price, fee, executedAt, source, assetClass, importMetadata }]`.
  - `trading_journal_executions`: Legacy fallback mirror for executions (read if primary is empty, written on save).
  - `tradingchart_journal_accounts`: JSON array of accounts `[{ id, name, nameFa, currency, type, startingBalance?, target?, maxLoss?, dailyLoss? }]`.
  - `tradingchart_prop_firms`: JSON array of tracked challenges `[{ id, firmName, accountId, accountNumber, initialBalance, currentBalance, targetProfit, maxLossLimit, dailyLossLimit, phase, status, evalFee, resetFees, payoutsRequested, payoutsReceived, startDate, notes }]`.
  - `tradingchart_journal_playbooks`: JSON array of setups `[{ id, name, nameFa, rules: string[] }]`.
  - `tradingchart_journal_notes`: JSON dictionary of daily notes keyed by date `YYYY-MM-DD`: `{ [dateStr]: { text, voiceDictations, emotion, rulesCompleted, updatedAt } }`.
  - `tradingchart_journal_annotations`: JSON dictionary of trade annotations keyed by trade key (`${accountId}|${symbol}|${direction}|${openTime}`): `{ [tradeKey]: { playbook, tags, mistakes, notes, stopLoss, rating, rulesChecked } }`.
  - `tradingchart_journal_settings`: JSON object: `{ privacyMode: boolean, method: 'fifo', activeAccount: string, timeFilter: string, timeZone: string }`.
- Server filesystem:
  - `server/data/states/<userId>.json`: Per-user synchronized cloud state storing `tradeJournal`.
  - `server/data/accounts/plans.json`: Entitlement definitions and tier quotas (`tradeJournal`, `propFirmSim`).
- Server in-memory state:
  - None (all journal analytics, parsing, and Monte Carlo simulations execute client-side; server handles stateless JSON persistence).

**Testing**:
- Puppeteer browser test suites:
  - `tests/test_luxalgo_trade_journal_deep.cjs`: Full E2E audit of full-page workspace switch, 8 subnav suites, KPI ribbon, monthly calendar heatmap, privacy mode toggle, Edge Score v2 polygon radar, 24-hr session heatmap, trade scatter explorer, trades ledger replay jump, prop firm tracker, playbooks checklist, AI Coach prompt chips and response delivery, 14-broker statement importer (TradingView CSV paste, preview table, commit toast), and trade log modal with SL/TP R-multiple calculation.
  - `tests/test_journal_and_timeframe.cjs`: E2E test verifying trade journal modal opening, SELL direction pill toggle, price/qty input, submission, and confirmation of execution in `app.tradeJournal.sampleExecutions`.
  - `tests/qa_probe_journal_nav.cjs`: Nav probe testing journal workspace visibility on nav button click.

**Target Platform**: Modern desktop and mobile evergreen web browsers (Chromium, Firefox, Safari/WebKit) with bilingual LTR/RTL support.

**Project Type**: Responsive single-page web charting application (`/chart`) backed by an Express REST API.

**Performance Goals**:
- 500-path Monte Carlo challenge simulation executed in under 200 ms (well within SC-004 requirement of under 2 s).
- Journal FIFO round-trip calculations and Edge Score updates in under 50 ms for up to 1,000 executions.
- Statement parsing and format auto-detection in under 100 ms for statements up to 5,000 rows.
- Zero perpetual DOM loops; reactive store notify pattern on mutations.

**Constraints**:
- Server cloud state capped at `STATE_MAX_BYTES` (2,097,152 bytes / 2 MB).
- Web Speech API availability dependent on browser support (Chromium/WebKit); falls back gracefully.
- All analytics, imports, and simulations run entirely in-browser; zero external data egress.

**Scale/Scope**:
- Support up to 10,000 trade executions in local store.
- 14 broker/platform statement formats supported out-of-the-box.
- 8 integrated journal suites, 4 default playbook setups, 3 challenge presets.

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | VIOLATION | Several known violations documented in spec Assumptions: hardcoded Tuesday KPI (`+$2,840` in `tradeJournal.js:255`), hardcoded adherence P&L (`+$4,280` / `-$890` in `playbookManager.js:39,43`), AI coach fallback constants (88 score, 3.42 PF, 84.2% WR, static Tuesday/London copy in `aiCoach.js:129,174,185`), synthetic equity curve fallback points (`+$3,930` in `journalCharts.js:121-128`), and hardcoded manual fee ($1.5) and 1-hour duration (`tradeJournalModal.js:368,381`). |
| II | Spec Before Code | VIOLATION | The trade journal, statement importer, and prop-firm simulator were written during September-October 2026 before adopting Hybrid SDD. Retrofit establishes the full specification and verification kit. |
| III | Real-Browser Zero-Defect Verification | VIOLATION | Automated test suites (`test_luxalgo_trade_journal_deep.cjs`, `test_journal_and_timeframe.cjs`, `qa_probe_journal_nav.cjs`) exercise the major functional paths on desktop viewports, but complete matrix execution (`desktop\|mobile` × `fa\|en`) across all permutations has gaps; some tests rely on programmatic clicks (`btn.click()`) rather than coordinate-derived pointer clicks. |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | Extensive Persian localization exists across all 8 suites, modals, and charts. However, minor gaps remain: calendar heatmap title hardcodes "سپتامبر ۲۰۲۶ / September 2026", Tuesday KPI hardcodes "سه‌شنبه / Tuesday", and some importer headers and tooltips remain in English. |
| V | Mobile Fit and Interaction Safety | VIOLATION | On viewports ≤ 768px, the `#nav-btn-journal` topbar button is hidden (`display: none !important`) and routed through the +Panels menu (`#nav-btn-panels`). While functional, statement dropzone and radar charts have tight padding on 390px screens. |
| VI | Security and Privacy by Default | PASS | Privacy mode instantly masks all financial balances and P&L figures (`$***.**`) for screen-sharing. Cloud state synchronization enforces session authentication (`req.user`) and the 2 MB payload cap (`STATE_MAX_BYTES`). Statement parsing occurs 100% in-browser with zero data transmitted to third parties. |
| VII | Single Source of Truth for Entitlements | VIOLATION | Plan entitlement keys `tradeJournal` and `propFirmSim` are declared in `server/featuresCatalog.js` and `server/accounts.js`. However, bottom panels (`#view-journal`, `#view-propsim`) and full-page workspace (`#journal-workspace-view`) mount ungated without checking user tier; gating is only checked on side-dock mounts (`main.js:471,481`) and in the modal (`tradeJournalModal.js:30`). Furthermore, `server/accounts.js` `STATE_LIMITS` lacks execution caps for `tradeJournal`. |
| VIII | Performance Budget | PASS | All analytics, FIFO pairing, radar rendering, and Monte Carlo paths execute locally with no network calls or perpetual loops. Reactivity is driven by `JournalStore` listener subscriptions. |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Built on standard `@luxalgo` ecosystem packages (`@luxalgo/journal-core`, `@luxalgo/journal-importers`, `@luxalgo/prop-firm-sim-core`) and native browser APIs (SVG, Web Speech API, FileReader, Blob). No external libraries added and no files in `node_modules` modified. |
| X | Hybrid SDD | VIOLATION | Feature was implemented prior to SDD adoption. Retrofit generates formal Spec Kit artifacts to govern all future iterations without modifying working product code. |

## Project Structure

### Documentation (this feature)

```text
specs/007-journal-propfirm/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-022, SC-001..SC-005)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R11, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/user/state)
│   └── module-api.md           # Client module interfaces, methods, and event bindings
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Mounts for #nav-btn-journal, #journal-workspace-view, #view-propsim, #view-journal, and panels menu items
├── src/
│   ├── tradeJournal.js         # TradeJournal main container: 8 sub-suites, header ribbon, filters, KPI cards, calendar, ledger
│   ├── tradeJournalModal.js    # TradeJournalModal: log execution dialog, 1-click buy/sell pill, live P&L and SL/TP R preview, voice dictation
│   ├── propFirmSimulator.js    # PropFirmSimulator: Monte Carlo challenge simulator (500 paths), FTMO/Topstep presets, SVG equity paths
│   ├── main.js                 # Workspace shell integration: #nav-btn-journal, switchWorkspace, mountTradeJournal, mountPropFirmSim
│   ├── authManager.js          # Cloud state mapping (trade_journal: 'tradeJournal'), in-memory execution unioning, feature gating
│   ├── userProfileModal.js     # Workstation backup and restore handling tradeJournal executions array
│   ├── commandPalette.js       # Command palette trigger "Open Trade Journal" / "باز کردن ژورنال معاملات"
│   ├── paperTrading.js         # Auto-logging closed paper trades into tradeJournal
│   ├── barReplay.js            # Auto-logging bar replay executions into journal store
│   ├── strategyTester.js       # Exporting backtest performance metrics to Prop-Firm Simulator
│   ├── i18n.js                 # Localization utilities and Persian digit conversions
│   └── journal/
│       ├── journalStore.js     # Reactive data store: executions FIFO matching, account filter, prop firm records, playbooks, notes, CSV/JSON export
│       ├── journalCharts.js    # SVG chart renderers: Edge Score v2 radar, equity curve, 24-hr session heatmap, duration vs P&L scatter
│       ├── propFirmTracker.js  # PropFirmTracker: challenge evaluation fees, payouts, ROI, active accounts cards, drawdown buffer alert
│       ├── playbookManager.js  # PlaybookManager: strategy rule checklists, adherence analysis, add setup dialog
│       ├── dailyJournal.js     # DailyJournal: daily reflection notes, date navigation, emotion selector (5 states), voice dictation
│       ├── aiCoach.js          # AiCoach: AI reflection coach and "Ask Your Journal" chat interface grounded on trader execution data
│       ├── statementImporter.js # StatementImporter: universal 14-broker CSV/HTML importer, dropzone, raw text paste, auto-detection, preview table
│       ├── core/               # Mathematical analytics engine (FIFO round-trips, metrics, equity, edge score, adherence)
│       └── importers/          # Multi-broker format detection and parsing engine (MT4/5, TradingView, IBKR, NinjaTrader, etc.)
├── styles/
│   └── main.css                # Styles for #journal-workspace-view, .journal-nav-tab, and responsive touch targets
server/
├── accounts.js                 # Plan definitions (propFirmSim, tradeJournal), cloud state persistence (/api/user/state), STATE_MAX_BYTES
├── featuresCatalog.js          # Feature catalogue definitions for propFirmSim (:412) and tradeJournal (:436)
└── data/
    └── states/                 # Per-user cloud state JSON mirrors
tests/
├── test_luxalgo_trade_journal_deep.cjs # Comprehensive E2E browser audit of all 8 suites, 14-format importer, Edge Radar, privacy mode, replay jump
├── test_journal_and_timeframe.cjs      # E2E test for Trade Journal modal submission and verification of logged trade
└── qa_probe_journal_nav.cjs            # Nav probe testing journal workspace visibility on nav button click
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle I (Honest Data Fallbacks) | Legacy placeholder figures (`+$2,840` Tuesday KPI, `+$4,280` / `-$890` adherence P&L, 88 Edge Score fallback, synthetic curve points) were implemented during rapid initial UI construction to preview full layouts before real trading data existed. | Removing or altering fallback values in retrofit violates the "no product code edits" rule; gaps are formally catalogued for Converge phase resolution. |
| Principle II / X (Retrofit) | Feature was developed and iterated before adopting Hybrid SDD. | Halting production or deleting tested code to write specs first would cause regression; retrofit preserves working software while establishing full governance. |
| Principle III (Matrix Coverage) | Existing automated tests focus on high-risk functional flows and specific viewports. | Manual full matrix testing is time-intensive; complete Puppeteer matrix suites are scheduled for the Converge phase. |
| Principle IV (Bilingual Micro-Gaps) | Minor hardcoded strings (calendar month title, Tuesday KPI day name) do not block core trading actions. | Immediate code changes violate the retrofit rules; gaps are catalogued for Converge resolution. |
| Principle V (Mobile Nav Placement) | The top header bar has constrained horizontal space on mobile (≤ 768px). | Displaying all workspace pills horizontally on small screens causes ugly wrapping; routing journal access through the +Panels drawer maintains clean header ergonomics. |
| Principle VII (Ungated Bottom & Full-Page Views) | Bottom panel and full-page workspace mounts were wired directly without wrapping inside `auth.feature()` checks, whereas the side-dock panel and modal enforce gating. | Changing `client/src/main.js` alters runtime gating behavior in retrofit; gaps are catalogued in `research.md` for backend/frontend convergence. |
