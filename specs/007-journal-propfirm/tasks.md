# Tasks: Trade Journal and Prop-Firm Tools

**Input**: Design documents from `/specs/007-journal-propfirm/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-24)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML layout containers, CSS styling, backend entitlements catalog, and plan tier definitions

- [x] T001 [P] Mount `#nav-btn-journal`, `#journal-workspace-view`, `#view-propsim`, and `#view-journal` containers in client/chart/index.html (infra)
- [x] T002 [P] Define responsive layout, touch targets, and tab styles in client/styles/main.css (infra)
- [x] T003 [P] Declare `tradeJournal` and `propFirmSim` entitlement flags in server/featuresCatalog.js (infra)
- [x] T004 [P] Configure tier plan allocations for `tradeJournal` and `propFirmSim` in server/accounts.js (infra)

---

## Phase 2: Foundational (Quantitative Engine & Storage Layers)

**Purpose**: Mathematical analytics core, multi-broker statement parsers, and reactive journal store

- [x] T005 [P] Implement FIFO round-trip builder, metrics, equity curve, and Edge Score v2 mathematical engine in client/src/journal/core/index.ts (FR-005, FR-012)
- [x] T006 [P] Implement universal multi-broker format detection and parsing engine for 14 formats in client/src/journal/importers/index.ts (FR-009)
- [x] T007 Implement reactive store with localStorage persistence, subscriptions, and seed executions in client/src/journal/journalStore.js (FR-003, FR-005, FR-021)
- [x] T008 [P] Implement SVG chart renderers for Edge radar, equity curve, session heatmap, and scatter in client/src/journal/journalCharts.js (FR-004, FR-011, FR-012)

---

## Phase 3: User Story 1 - Journal Workspace and Dashboard (Priority: P1) 🎯 MVP

**Goal**: Traders can switch between the candlestick chart and a full-page trade journal workstation, filter executions by account and time window, review KPIs, monthly calendar, and equity curve, and toggle privacy mode.

- [x] T009 [US1] Implement workspace mode switching between Quant chart and full-page Journal in client/src/main.js (FR-001)
- [x] T010 [US1] Mount Journal and Prop-Firm Simulator views in bottom panel and Vela side-dock in client/src/main.js (FR-001, FR-020)
- [x] T011 [US1] Render 8-suite tab navigation strip and header filter ribbon in client/src/tradeJournal.js (FR-001, FR-002)
- [x] T012 [US1] Implement account and time-window filtering logic updating KPIs, calendar, and ledger in client/src/tradeJournal.js (FR-003)
- [x] T013 [US1] Implement privacy mode toggle masking monetary amounts across cards, calendar, and curves in client/src/tradeJournal.js (FR-004)
- [x] T014 [US1] Render dashboard KPI cards, monthly P&L calendar heatmap, and cumulative equity curve in client/src/tradeJournal.js (FR-011)
- [x] T015 [US1] Bind calendar day clicks to switch directly to trades ledger view in client/src/tradeJournal.js (FR-011)
- [x] T016 [US1] Route journal workspace access through +Panels drawer on mobile screens (≤ 768px) in client/src/main.js (FR-022)

---

## Phase 4: User Story 2 - Log and Import Trades (Priority: P1)

**Goal**: Traders can manually log trades with live P&L and R-multiple calculations and voice dictation, import statements from 14 broker formats with preview deduplication, automatically record paper/replay trades, and export to CSV.

- [x] T017 [US2] Build `TradeJournalModal` prefilling symbol, price, BUY side, 0.5 quantity, SL/TP in client/src/tradeJournalModal.js (FR-006)
- [x] T018 [US2] Implement live P&L and risk-reward ($R$) preview calculations on input changes in client/src/tradeJournalModal.js (FR-006)
- [x] T019 [US2] Implement Web Speech API voice dictation appending transcribed text in `TradeJournalModal` in client/src/tradeJournalModal.js (FR-007)
- [x] T020 [US2] Create paired open and close executions with annotations and display confirmation toast on save in client/src/tradeJournalModal.js (FR-006)
- [x] T021 [US2] Refuse modal opening with upgrade warning toast when plan lacks `tradeJournal` entitlement in client/src/tradeJournalModal.js (FR-020)
- [x] T022 [P] [US2] Auto-log closed paper trading positions into journal store in client/src/paperTrading.js (FR-008)
- [x] T023 [P] [US2] Auto-log closed bar replay positions with historical timestamps into journal store in client/src/barReplay.js (FR-008)
- [x] T024 [US2] Build `StatementImporter` dropzone, file picker, and text paste area in client/src/journal/statementImporter.js (FR-009)
- [x] T025 [US2] Auto-detect statement format and render 15-row preview reconciliation table in client/src/journal/statementImporter.js (FR-009)
- [x] T026 [US2] Commit statement executions filtering duplicates via 5-tuple signatures with success banner in client/src/journal/statementImporter.js (FR-009)
- [x] T027 [US2] Implement CSV export downloading `tradingchart_journal_export_YYYY-MM-DD.csv` in client/src/journal/journalStore.js (FR-010)

---

## Phase 5: User Story 3 - Analytics (Priority: P2)

**Goal**: Traders can evaluate their trading edge via a 6-axis Edge Score radar, a 24-hour UTC session heatmap with market bands, and a duration-vs-P&L scatter explorer with honest empty states.

- [x] T028 [US3] Render 6-axis Edge Score v2 polygon radar with 0-100 composite and honest empty state in client/src/journal/journalCharts.js (FR-012)
- [x] T029 [US3] Render 24-hour UTC session heatmap with Tokyo, London, and New York bands in client/src/journal/journalCharts.js (FR-012)
- [x] T030 [US3] Render duration vs P&L trade scatter explorer with bubble tooltips and empty state in client/src/journal/journalCharts.js (FR-012)
- [x] T031 [US3] Wire Analytics suite tab to render radar, heatmap, and scatter explorer from filtered trades in client/src/tradeJournal.js (FR-012)

---

## Phase 6: User Story 4 - Ledger, Daily Journal, Playbooks and AI Coach (Priority: P2)

**Goal**: Traders can inspect individual trades and jump to the chart, write daily reflections with mood ratings and voice dictation, manage playbook checklists with adherence metrics, and query the grounded AI coach.

- [x] T032 [US4] Render closed trades ledger and bind "View on Chart" replay jump in client/src/tradeJournal.js (FR-013)
- [x] T033 [US4] Implement `DailyJournal` date stepping, day trade statistics, and 5-state emotion selector in client/src/journal/dailyJournal.js (FR-014)
- [x] T034 [US4] Implement Web Speech API voice dictation and note persistence with save indicators in client/src/journal/dailyJournal.js (FR-007, FR-014)
- [x] T035 [US4] Implement `PlaybookManager` listing setups with rule checklists, adherence rates, and 4 defaults in client/src/journal/playbookManager.js (FR-015)
- [x] T036 [US4] Implement "+ New Playbook Setup" creation flow in client/src/journal/playbookManager.js (FR-015)
- [x] T037 [US4] Build `AiCoach` interface with suggestion chips, question input, and chat thread in client/src/journal/aiCoach.js (FR-016)
- [x] T038 [US4] Implement grounded query evaluation answering performance questions from round-trip data in client/src/journal/aiCoach.js (FR-016)

---

## Phase 7: User Story 5 - Prop-Firm Tracker and Simulator (Priority: P2)

**Goal**: Traders can track prop-firm challenge evaluations, monitor drawdown buffers, run 500-path Monte Carlo simulations across FTMO/Topstep presets, and bridge backtest statistics from the Strategy Tester.

- [x] T039 [US5] Implement `PropFirmTracker` cash flow KPI ribbon, active challenges grid, and drawdown buffer alert in client/src/journal/propFirmTracker.js (FR-017)
- [x] T040 [US5] Implement "+ Add Prop Challenge" challenge creation with 10% target and 10% max loss in client/src/journal/propFirmTracker.js (FR-017)
- [x] T041 [US5] Implement `PropFirmSimulator` running 500 Monte Carlo paths for FTMO and Topstep presets in client/src/propFirmSimulator.js (FR-018)
- [x] T042 [US5] Render pass probability, risk of ruin, EV, median days to funded, and 35 SVG sample paths in client/src/propFirmSimulator.js (FR-018)
- [x] T043 [US5] Re-run Monte Carlo simulation automatically upon preset change or Run button click in client/src/propFirmSimulator.js (FR-018)
- [x] T044 [US5] Implement "Export to Prop-Sim" in Strategy Tester passing backtest metrics to simulator in client/src/strategyTester.js (FR-019)
- [x] T045 [US5] Render feature-locked placeholder for side-dock simulator panel when plan lacks `propFirmSim` in client/src/main.js (FR-020)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Device persistence, cloud state synchronization, and bilingual Persian/English localization

- [x] T046 [P] Synchronize `tradeJournal` executions to `/api/user/state` and handle conflict unioning in client/src/authManager.js (FR-021)
- [x] T047 [P] Enforce 2 MB cloud state size limit during user state persistence in server/accounts.js (FR-021)
- [x] T048 [P] Provide bilingual English and formal Persian translations for all journal and simulator strings in client/src/i18n.js (FR-022)
- [x] T049 [P] Re-render open journal views and simulator panels upon language change events in client/src/main.js (FR-022)
