# Tasks: Market Data Feed

**Input**: Design documents from `/specs/005-market-data-feed/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-23)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML modal mounts, CSS styling, backend entitlements, and base server routing

- [x] T001 [P] Mount `#modal-market-sources` and `#modal-symbol-search` dialog containers in client/chart/index.html (infra)
- [x] T002 [P] Define CSS styling for DOM ladder, market sources cards, and demo route badge in client/styles/main.css (infra)
- [x] T003 [P] Declare `histBars`, `depthOfMarket`, and `synthChartTypes` plan entitlements in server/featuresCatalog.js (infra)
- [x] T004 Setup Express HTTP server, CORS middleware, and WebSocket server instance in server/index.js (infra)

---

## Phase 2: Foundational (Symbol Registry & Universal Provider Bridge)

**Purpose**: Universal symbol catalogue across 8 asset classes and base Vela charting data provider bridge

- [x] T005 [P] Register 52 multi-asset instruments across crypto, gold, TSE, forex, and equities in server/symbolCatalog.js (infra)
- [x] T006 Initialize `UniversalMarketProvider` class and symbol resolution methods in client/src/universalProvider.js (infra)
- [x] T007 Register `universal` data provider with Vela chart workspace in client/src/chartManager.js (infra)

---

## Phase 3: User Story 1 - Candles for any catalogue market (Priority: P1) 🎯 MVP

**Goal**: The chart requests historical candles for any catalogue symbol and timeframe; crypto is fetched live from Binance Vision (with mirrors and continuous fallback) while non-crypto uses deterministic continuous series; depth is clamped to the user's plan limit.

- [x] T008 [US1] Implement `fetchBinanceKlines` with multi-page backward backfill and mirror fallbacks in server/dataFeed.js (FR-004)
- [x] T009 [US1] Implement `generateContinuousBars` fallback and non-crypto demo candle models in server/dataFeed.js (FR-004)
- [x] T010 [US1] Implement server-side 3-second micro-cache in `getCandles` in server/dataFeed.js (FR-005)
- [x] T011 [US1] Implement `GET /api/candles` route with query sanitization and error responses in server/index.js (FR-001, FR-002)
- [x] T012 [US1] Enforce plan `histBars` limit clamping and send `X-History-Limit` header in server/index.js (FR-003)
- [x] T013 [P] [US1] Implement `getBars` candle fetcher with series caching and neutral seed bar outage fallback in client/src/universalProvider.js (FR-009)

---

## Phase 4: User Story 2 - Live updates (Priority: P1)

**Goal**: The chart subscribes to live symbol updates over WebSocket; the active bar updates smoothly in real time with 250 ms throttling and automatic reconnection on connection drops.

- [x] T014 [US2] Implement `/ws/live` connection handling, client limit (`TC_MAX_WS`), and 1013 "busy" rejection in server/index.js (FR-008)
- [x] T015 [US2] Handle `{action: "subscribe"}` and `{action: "unsubscribe"}` messages with 50-symbol cap in server/index.js (FR-008)
- [x] T016 [US2] Broadcast 1200ms `tick` price messages to subscribed client sockets in server/index.js (FR-008)
- [x] T017 [US2] Connect to `/ws/live` and implement 3-second auto-reconnection on socket close in client/src/universalProvider.js (FR-009)
- [x] T018 [US2] Coalesce incoming tick burst emissions to subscribers to at most every 250 ms in client/src/universalProvider.js (FR-009)

---

## Phase 5: User Story 3 - Honest source labelling (Priority: P1)

**Goal**: The topbar route badge clearly differentiates live Binance crypto feeds from demo series, and the Market Data Pipeline Inspector dialog displays route health, live ping latency, and source telemetry.

- [x] T019 [P] [US3] Implement `updateTopbarSourceBadge` displaying LIVE or DEMO route styling in client/src/main.js (FR-010)
- [x] T020 [US3] Implement `probeBinance` and `getMarketSourceStatus` telemetry endpoint `GET /api/market-sources` in server/dataFeed.js (FR-011)
- [x] T021 [US3] Expose `GET /api/market-sources` route in server/index.js (FR-011)
- [x] T022 [P] [US3] Build `MarketSourcesModal` dialog rendering 5 route cards and live ping test in client/src/marketSourcesModal.js (FR-012)
- [x] T023 Wire `#btn-topbar-market-source` button to open Market Data Pipeline modal in client/src/main.js (FR-012)

---

## Phase 6: User Story 4 - Depth of market (Priority: P2)

**Goal**: Traders can inspect a 12-level Level 2 bid/ask order book ladder with live spread, honestly labelled as Live · Binance or Simulated, with 1.5 s visibility-gated polling and 1-click paper trading order placement.

- [x] T024 [US4] Implement `getOrderBookDepth` with Binance orderbook mirror and simulated ladder fallback in server/depthFeed.js (FR-013)
- [x] T025 [US4] Implement `GET /api/depth` endpoint with `levels` clamping (1..50) and 1.5s cache in server/index.js (FR-013)
- [x] T026 [P] [US4] Build `DepthOfMarketView` ladder rendering, spread calculation, and source badge in client/src/depthOfMarket.js (FR-014)
- [x] T027 [US4] Implement visibility-gated polling (`isVisible()`) checking tab and container visibility in client/src/depthOfMarket.js (FR-014)
- [x] T028 [US4] Bind quantity stepper and 1-click market/limit paper trade execution in client/src/depthOfMarket.js (FR-014)
- [x] T029 Mount DOM panel in side dock with `depthOfMarket` plan entitlement check in client/src/main.js (FR-014)

---

## Phase 7: User Story 5 - Symbol catalogue (Priority: P2)

**Goal**: Traders can query the universal symbol catalogue by text, category, and exchange via search modal and inspect individual instrument trading specifications.

- [x] T030 [US5] Implement `searchSymbols` query filtering and `getSymbolMeta` in server/symbolCatalog.js (FR-007)
- [x] T031 [US5] Implement `GET /api/symbols` and `GET /api/symbol-info` endpoints in server/index.js (FR-007)
- [x] T032 [US5] Implement `GET /api/tickers` endpoint supporting up to 40 comma-separated symbols in server/index.js (FR-006)
- [x] T033 [US5] Implement `get24hTicker` computing 24h stats for crypto, gold, TSE, and macro assets in server/dataFeed.js (FR-006)
- [x] T034 [P] [US5] Wire symbol search modal opening, typing debounce, and keyboard selection in client/src/main.js (FR-007)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Synthetic non-time-based chart styles, bilingual re-rendering, and client entitlement integration

- [x] T035 [P] Implement client-side transformations for Renko, Kagi, Line Break, Range, and PnF in client/src/syntheticChartTypes.js (FR-015)
- [x] T036 Gate synthetic chart style selection by `synthChartTypes` plan entitlement in client/src/chartStylePicker.js (FR-015)
- [x] T037 Re-render topbar source badge and DOM ladder on `tc:languagechange` events in client/src/main.js (FR-010)
- [x] T038 Implement client-side entitlement check helpers in client/src/authManager.js (infra)
