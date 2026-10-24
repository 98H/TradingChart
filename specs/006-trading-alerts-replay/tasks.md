# Tasks: Paper Trading, Alerts and Bar Replay

**Input**: Design documents from `/specs/006-trading-alerts-replay/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-23)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML layout containers, CSS styling, backend entitlements catalog, and plan definitions

- [x] T001 [P] Mount `#chart-quick-trade`, `#qt-collapsed-trigger`, `#replay-bar`, and side-rail buttons in client/chart/index.html (infra)
- [x] T002 [P] Define CSS styling for quick-trade widget, replay bar, canvas alert lines, and badges in client/styles/main.css (infra)
- [x] T003 [P] Declare `priceAlerts`, `webhookAlerts`, `paperAccounts`, `holdingsPerAccount`, and `barReplayMinuteDays` quotas in server/featuresCatalog.js (infra)
- [x] T004 [P] Define plan tier allocations in server/data/accounts/plans.json (infra)

---

## Phase 2: Foundational (Trade-Relay Engine & Multi-Account Stores)

**Purpose**: In-memory execution simulator, safety rails, and base storage persistence layers

- [x] T005 Implement `TradeRelay` in-memory simulation engine with safety rails and flight recorder in server/tradeRelay.js (FR-015)
- [x] T006 Initialize multi-account loading, tombstone handling, and persistence in client/src/paperTrading.js (FR-002, FR-018)
- [x] T007 Initialize alert loading, tombstone tracking, and persistence in client/src/alertsManager.js (FR-009, FR-018)

---

## Phase 3: User Story 1 - One-Click Paper Trading (Priority: P1) 🎯 MVP

**Goal**: Traders can execute market BUY and SELL orders in one click directly from the floating quick-trade chart widget with quantity stepping and responsive mobile minimization.

- [x] T008 [US1] Mount `#chart-quick-trade` markup and `#qt-collapsed-trigger` pill in client/chart/index.html (FR-001)
- [x] T009 [US1] Bind quantity stepper increment/decrement (step 0.05, min 0.01) in client/src/main.js (FR-001)
- [x] T010 [US1] Bind BUY and SELL buttons to execute market orders via `paperTrading.placeOrder` in client/src/main.js (FR-001)
- [x] T011 [US1] Implement `showExecutionToast` with localized confirmation messages in client/src/main.js (FR-001, FR-019)
- [x] T012 [US1] Handle responsive minimization to floating pill on mobile viewports (≤ 768px) in client/src/main.js (FR-001)

---

## Phase 4: User Story 2 - Paper Trading Panel (Priority: P1)

**Goal**: Traders can manage multi-account portfolios, execute Market/Limit/Stop orders via tickets, click Level 2 DOM ladder rows to place resting limits, track live unrealized P&L, close positions into the Trade Journal, and reset balances.

- [x] T013 [US2] Render equity, free balance, and unrealized P&L cards in client/src/paperTrading.js (FR-002)
- [x] T014 [US2] Implement account creation and switching with `paperAccounts` plan enforcement in client/src/paperTrading.js (FR-002, FR-003)
- [x] T015 [US2] Enforce `holdingsPerAccount` plan limit on position opening in client/src/paperTrading.js (FR-003)
- [x] T016 [US2] Implement Order Ticket supporting Market, Limit, and Stop orders with half-spread quoting in client/src/paperTrading.js (FR-004)
- [x] T017 [US2] Implement pending resting order queue and marketable check in client/src/paperTrading.js (FR-004)
- [x] T018 [US2] Implement `cancelOrder` with localized confirmation toast in client/src/paperTrading.js (FR-004, FR-019)
- [x] T019 [US2] Render Depth of Market (DOM) ladder and bind limit order clicks in client/src/paperTrading.js (FR-005)
- [x] T020 [P] [US2] Bind right-click canvas context menu "Buy Limit at X" / "Sell Limit at X" in client/src/canvasContextMenu.js (FR-005)
- [x] T021 [US2] Implement `closePosition` returning margin plus P&L and synchronizing executions to Trade Journal in client/src/paperTrading.js (FR-006)
- [x] T022 [US2] Implement account reset with danger confirmation dialog restoring $100,000 balance in client/src/paperTrading.js (FR-007)

---

## Phase 5: User Story 3 - Price Alerts (Priority: P1)

**Goal**: Traders can create price alerts across 11 conditions from the alerts dock, Alt+A shortcut, or chart context menu, view active lines and off-scale pinned badges on canvas, and receive notifications with Trade-Relay dispatch.

- [x] T023 [US3] Implement 11 condition evaluator (`crossing`, `channel`, `% move`) in client/src/alertsManager.js (FR-008)
- [x] T024 [US3] Render inline alert creation form with dynamic channel-low row and % move relabeling in client/src/alertsManager.js (FR-008)
- [x] T025 [US3] Bind desktop tool rail button and `Alt+A` shortcut to open alerts dock panel in client/src/main.js (FR-009)
- [x] T026 [P] [US3] Bind chart context menu "Add Alert at X" in client/src/canvasContextMenu.js (FR-009)
- [x] T027 [US3] Implement alert pause toggle and deletion with tombstones in client/src/alertsManager.js (FR-009)
- [x] T028 [US3] Enforce `priceAlerts` plan limit in client/src/alertsManager.js (FR-010)
- [x] T029 [P] [US3] Enforce `priceAlerts` and `paperAccounts` quotas during cloud state sync in server/accounts.js (FR-003, FR-010)
- [x] T030 [US3] Build canvas alert overlay rendering pixel-exact price lines and badges via Vela projection in client/src/chartAlertsOverlay.js (FR-011)
- [x] T031 [US3] Implement pinned off-scale ▲/▼ badges with direct delete controls in client/src/chartAlertsOverlay.js (FR-011)
- [x] T032 [US3] Trigger audio beep, notification toast, and webhook dispatch on alert condition match in client/src/alertsManager.js (FR-012)

---

## Phase 6: User Story 4 - Personal Webhook (Trade-Relay) (Priority: P2)

**Goal**: Plus+ users can generate and rotate secret personal webhook tokens to accept automated trading signals with per-IP rate limits and safety rails.

- [x] T033 [US4] Implement `GET /api/user/webhook` returning token status and 4-character hint in server/tradeRelayApi.js (FR-013)
- [x] T034 [US4] Implement `POST /api/user/webhook/rotate` with 5 req/min rate limit and SHA-256 token hashing in server/tradeRelayApi.js (FR-013)
- [x] T035 [US4] Implement `POST /api/webhook/:token` validating token hash, `webhookAlerts` plan entitlement, and 60 req/min rate limit in server/tradeRelayApi.js (FR-014)
- [x] T036 [US4] Implement `POST /api/webhook` for session-authenticated in-app webhook dispatch in server/tradeRelayApi.js (FR-014)
- [x] T037 [US4] Implement `GET /api/trade-relay/account` returning balance, positions, and flight recorder logs in server/tradeRelayApi.js (FR-015)
- [x] T038 [US4] Render Trade-Relay Webhook card with copy and rotate confirmation dialogs in client/src/alertsManager.js (FR-013, FR-019)

---

## Phase 7: User Story 5 - Bar Replay (Priority: P2)

**Goal**: Traders can rewind historical candlesticks to 70% depth, step or auto-play forward at 0.5×–10× speed, execute simulated trades with live P&L, log executions to the Trade Journal with historical timestamps, and cleanly exit.

- [x] T039 [US5] Bind topbar `#btn-topbar-replay` to toggle `#replay-bar` and slice orchestrator candle series in client/src/main.js (FR-016)
- [x] T040 [US5] Implement series rewind to 70% depth clamped by `barReplayMinuteDays` plan entitlement in client/src/barReplay.js (FR-016)
- [x] T041 [US5] Implement Step forward advancing exactly 1 candle and updating progress text "X / Y" in client/src/barReplay.js (FR-016)
- [x] T042 [US5] Implement Play/Pause controller with 0.5×–10× speed selector and latest bar toast in client/src/barReplay.js (FR-016, FR-019)
- [x] T043 [US5] Implement simulated Buy/Sell trade execution with live P&L in client/src/barReplay.js (FR-017)
- [x] T044 [US5] Implement replay position closing and execution logging to Trade Journal with simulated bar timestamps in client/src/barReplay.js (FR-017)
- [x] T045 [US5] Implement Exit restoring full original candlestick series in client/src/barReplay.js (FR-016)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Device persistence, cloud state synchronization, and bilingual Persian/English localization

- [x] T046 [P] Persist paper accounts, active account pointer, and alerts across local storage and cloud sync in client/src/paperTrading.js (FR-018)
- [x] T047 [P] Persist alert configurations and deletion tombstones across local storage and cloud sync in client/src/alertsManager.js (FR-018)
- [x] T048 [P] Re-render paper trading views and alert lists upon `tc:languagechange` events in client/src/paperTrading.js (FR-019)
- [x] T049 [P] Provide bilingual English and Persian translations for quick trade, order ticket, DOM ladder, and alert conditions in client/src/i18n.js (FR-019)