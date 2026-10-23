# Tasks: Indicators Library, Pine Editor and Strategy Tester

**Input**: Design documents from `/specs/004-indicators-pine-strategy/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-23)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML containers, CSS styling, backend entitlements, and security headers

- [x] T001 [P] Mount `#modal-indicators`, `#view-pine`, and `#view-strategy` containers in client/chart/index.html (infra)
- [x] T002 [P] Define CSS layouts for Pine editor, split views, and rating card in client/styles/main.css (infra)
- [x] T003 [P] Declare `indicatorsPerChart`, `pineStudio`, and `strategyTester` entitlements in server/featuresCatalog.js (infra)
- [x] T004 [P] Configure tiered indicator quotas and feature flags in server/accounts.js (infra)
- [x] T005 [P] Configure CSP allowing `unsafe-eval` for runtime Pine compilation in server/security.js (FR-023)

---

## Phase 2: Foundational (Core Catalogues, Localization & Side Panels)

**Purpose**: Bundled Pine v5 library, Persian dictionary, side dock registration, and chart workspace bridge

- [x] T006 [P] Bundle 114 Pine v5 indicator scripts and category classifications in client/src/indicatorsData.js (FR-001)
- [x] T007 [P] Supply 114 Persian indicator translations in client/src/indicatorsFa.js (FR-002)
- [x] T008 [P] Register `pine`, `templates`, and `strategy` side dock panels in client/src/velaPanels.js (FR-022)
- [x] T009 Implement `addPineIndicator` and active indicator counting in client/src/chartManager.js (infra)

---

## Phase 3: User Story 1 - Browse and add a library indicator (Priority: P1)

**Goal**: Traders can browse all 114 indicators, filter by category or search query, and add indicators to the active chart with quota enforcement.

- [x] T010 [US1] Implement live search filtering and category dropdown in client/src/indicatorsModal.js (FR-003)
- [x] T011 [US1] Check `indicatorsPerChart` quota and show upgrade toast on limit in client/src/main.js (FR-004)
- [x] T012 [US1] Implement honest add button states ("✓ Added" / "✕ Not added") with busy guard in client/src/indicatorsModal.js (FR-005)
- [x] T013 [US1] Display success toast and trigger layout persistence upon adding indicator in client/src/main.js (FR-005)
- [x] T014 [US1] Add native engine indicators via `addNativeIndicator` with fallback to Pine in client/src/main.js (FR-006)

---

## Phase 4: User Story 2 - Write, validate and plot a Pine script (Priority: P1)

**Goal**: Traders can create, edit, validate, save, and plot custom Pine v5/v6 scripts using the in-browser Pine Studio IDE.

- [x] T015 [US2] Provide 5 starter templates and "New" minimal skeleton in client/src/pineStudio.js (FR-007)
- [x] T016 [US2] Implement synchronized line numbers gutter and LTR code editor in client/src/pineStudio.js (FR-007)
- [x] T017 [US2] Validate script via `Indicator.from` and display compiler diagnostics in client/src/pineStudio.js (FR-008)
- [x] T018 [US2] Persist script to `localStorage.tradingchart_pine_code` on save in client/src/pineStudio.js (FR-009)
- [x] T019 [US2] Render locked upgrade placeholder when `pineStudio` entitlement is disabled in client/src/main.js (FR-018)

---

## Phase 5: User Story 3 - Backtest a strategy with the real engine (Priority: P1)

**Goal**: Traders can run authentic quantitative strategy backtests on active candle bars, inspect KPIs, view equity curve, and export results.

- [x] T020 [US3] Execute user `strategy()` script via `PineTS` on active chart bars in client/src/strategyTester.js (FR-010)
- [x] T021 [US3] Enforce `strategy(` declaration and minimum 30 historical bars in client/src/strategyTester.js (FR-011)
- [x] T022 [US3] Derive net profit, win rate, profit factor, drawdown, and Sharpe solely from closed trades in client/src/strategyTester.js (FR-012)
- [x] T023 [US3] Render undefined metrics as "—" and zero-loss profit factor as "∞" in client/src/strategyTester.js (FR-013)
- [x] T024 [US3] Silently re-run last backtested strategy on new candle bar updates in client/src/strategyTester.js (FR-014)
- [x] T025 [US3] Render distinct explanatory messages for runtime errors and zero closed trades in client/src/strategyTester.js (FR-015)
- [x] T026 [US3] Gate trades CSV export by `csvTradesExport` entitlement in client/src/strategyTester.js (FR-016)
- [x] T027 [US3] Forward win rate, avg win/loss ratio, and trade frequency to Prop-Sim in client/src/strategyTester.js (FR-017)
- [x] T028 [US3] Render locked upgrade placeholder when `strategyTester` entitlement is disabled in client/src/main.js (FR-018)

---

## Phase 6: User Story 4 - Tune or remove an applied indicator (Priority: P2)

**Goal**: Traders can open an indicator's settings dialog, tune typed inputs and visual styles, apply changes, or remove the indicator.

- [x] T029 [US4] Render active indicator switcher and typed inputs for numbers, sources, and colors in client/src/indicatorSettingsModal.js (FR-020)
- [x] T030 [US4] Support removing applied indicator via `handle.remove` and `orch.removeIndicator` in client/src/indicatorSettingsModal.js (FR-020)
- [x] T031 [US4] Schedule layout persistence upon applying settings or removing indicator in client/src/indicatorSettingsModal.js (FR-021)

---

## Phase 7: User Story 5 - Glance at a symbol's technical rating (Priority: P3)

**Goal**: Traders can inspect a selected symbol's price change, day range slider, and multi-gauge technical rating consensus card.

- [x] T032 [US5] Fetch ticker and screener metrics on symbol change in client/src/technicalRatingCard.js (FR-024)
- [x] T033 [US5] Render price, 24h change, day range slider, and speedometer needle gauge in client/src/technicalRatingCard.js (FR-024)
- [x] T034 [US5] Implement `/api/screener` endpoint serving institutional technical metrics in server/index.js (FR-024)
- [x] T035 [US5] Implement `/api/tickers` endpoint serving multi-symbol 24h statistics in server/index.js (FR-024)

---

## Phase 8: Polish & Cross-Cutting Integration

**Purpose**: Bilingual localization re-rendering, bottom dock suite orchestration, and client permission checks

- [x] T036 Re-render indicators modal, Pine Studio, and Strategy Tester on language switch in client/src/main.js (FR-019)
- [x] T037 Initialize desktop bottom suite and wire backtest view switching in client/src/main.js (infra)
- [x] T038 Implement client-side entitlement enforcement facade in client/src/authManager.js (infra)
