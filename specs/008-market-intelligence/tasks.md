# Tasks: Market Intelligence

**Input**: Design documents from `/specs/008-market-intelligence/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-24)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML layout containers, CSS styling, backend entitlements catalog, and plan tier configurations

- [x] T001 [P] Mount `#btn-topbar-market-source`, `#modal-market-sources`, and bottom panel tabs (`#tab-label-trackers`, `#tab-label-calendar`, `#tab-label-news`, `#tab-label-gold`, `#tab-label-tse`) in client/chart/index.html (infra)
- [x] T002 [P] Define responsive styling for news cards, subtab headers, gold pillar cards, TSE tape scoreboard, and modal overlays in client/styles/main.css (infra)
- [x] T003 [P] Declare `marketTrackers`, `economicCalendar`, and `marketNews` feature flags in server/featuresCatalog.js (infra)
- [x] T004 [P] Configure tier entitlement booleans for `marketTrackers`, `economicCalendar`, and `marketNews` across all 5 tiers in server/data/accounts/plans.json (infra)

---

## Phase 2: Foundational (Backend Data Services & Express Routes)

**Purpose**: Server in-memory catalogs, algorithmic simulation models, and REST route handlers

- [x] T005 [P] Implement static catalogs for Congress, Form 4, 13F, and FINRA short volume in server/marketTrackers.js (FR-001)
- [x] T006 [P] Implement static catalog `BREAKING_NEWS_CATALOG` and `getMarketNews` filter helper in server/newsFeed.js (FR-005)
- [x] T007 [P] Implement static catalog `ECONOMIC_EVENTS` and `getEconomicEvents` filter helper in server/economicCalendar.js (FR-003)
- [x] T008 [P] Implement gold bubble formulation, TSETMC tape algorithmic simulation, and Binance reachability probe in server/dataFeed.js (FR-007, FR-009)
- [x] T009 Expose Express route `GET /api/market-trackers` with `kind` query filter in server/index.js (FR-001)
- [x] T010 Expose Express route `GET /api/economic-calendar` with `impact`, `country`, and `category` filters in server/index.js (FR-003)
- [x] T011 Expose Express route `GET /api/news` with `category`, `symbol`, and `limit` clamping in server/index.js (FR-005)
- [x] T012 Expose Express route `GET /api/gold-snapshot` delivering bullion quotes and coin bubbles in server/index.js (FR-007)
- [x] T013 Expose Express route `GET /api/tse-tape` with symbol validation and orderflow metrics in server/index.js (FR-009)
- [x] T014 Expose Express route `GET /api/market-sources` delivering 5-tier waterfall telemetry in server/index.js (infra)

---

## Phase 3: User Story 1 - Disclosure Trackers (Priority: P2)

**Goal**: Traders can browse Congressional trades, SEC Form 4 insider transactions, hedge fund 13F portfolios, and FINRA short volume with text filtering and outbound links to official US disclosures.

- [x] T015 [US1] Build `MarketTrackersView` container with 4 subtab buttons, demo disclaimer banner, and search input in client/src/marketTrackersView.js (FR-002)
- [x] T016 [US1] Implement subtab switching and text filtering logic over member, company, fund, and symbol in client/src/marketTrackersView.js (FR-002)
- [x] T017 [US1] Render tabular records with outbound links to official House, Senate, and SEC EDGAR filing URLs in client/src/marketTrackersView.js (FR-001)
- [x] T018 [US1] Mount `MarketTrackersView` in bottom panel `#view-trackers` in client/src/main.js (FR-002, FR-011)

---

## Phase 4: User Story 2 - Economic Calendar (Priority: P2)

**Goal**: Traders can view upcoming macroeconomic announcements with impact ratings, previous/forecast/actual values, next-release countdown telemetry, filter buttons, text search, and manual refresh.

- [x] T019 [US2] Build `EconomicCalendarView` container with search input, refresh button, and filter buttons in client/src/economicCalendar.js (FR-004)
- [x] T020 [US2] Render next upcoming release highlight banner with country flag, forecast, and impact badge in client/src/economicCalendar.js (FR-004)
- [x] T021 [US2] Implement filter button toggling (All, High Impact 🔥, 🇺🇸 USD, Central Banks, Inflation) resetting to 'all' on toggle in client/src/economicCalendar.js (FR-004)
- [x] T022 [US2] Implement event card list rendering actual, forecast, and previous values in client/src/economicCalendar.js (FR-003, FR-004)
- [x] T023 [US2] Mount `EconomicCalendarView` in bottom panel `#view-calendar` in client/src/main.js (FR-004, FR-011)

---

## Phase 5: User Story 3 - Market News (Priority: P2)

**Goal**: Traders can read breaking news headlines categorized by asset class, view sentiment and impact badges, filter by text, jump directly to active symbol charts, and receive background polling updates.

- [x] T024 [US3] Build `MarketNewsView` container with category pills (All, Crypto, Metals, Forex, Equities, Commodities) and search input in client/src/marketNewsView.js (FR-006)
- [x] T025 [US3] Implement category pill switching and free-text headline filtering with empty-state handling in client/src/marketNewsView.js (FR-006)
- [x] T026 [US3] Implement 15-second background polling timer guarded by `!document.hidden` in client/src/marketNewsView.js (FR-006)
- [x] T027 [US3] Bind symbol pills `.news-sym-pill` to repoint active chart via `chartManager.setSymbol` with execution toast in client/src/marketNewsView.js (FR-006)
- [x] T028 [US3] Mount `MarketNewsView` in bottom panel `#view-news` in client/src/main.js (FR-006, FR-011)

---

## Phase 6: User Story 4 - Tehran Gold and Coin Bubbles (Priority: P2)

**Goal**: Iranian traders can inspect 17k melted gold, 18k gram, spot ounce, free USD/USDT, and official coin bubble valuations with 4-second polling, manual refresh, and 1-click chart opening.

- [x] T029 [US4] Build `GoldBubbleView` container with institutional formula header, refresh button, and melted gold chart button in client/src/goldBubbleView.js (FR-008)
- [x] T030 [US4] Render 4 top-level market pillar cards (Abshodeh 17k, 18k Gram, Spot Ounce, Free USD/USDT) in client/src/goldBubbleView.js (FR-007, FR-008)
- [x] T031 [US4] Render official coin bubble table with market price, intrinsic value, bubble amount, and bubble percentage in client/src/goldBubbleView.js (FR-007, FR-008)
- [x] T032 [US4] Implement 4-second polling lifecycle (`mount` / `unmount`) in client/src/goldBubbleView.js (FR-008)
- [x] T033 [US4] Bind chart buttons to switch primary chart to `GOLD_ABSHODEH` or selected coin in client/src/goldBubbleView.js (FR-008)
- [x] T034 [US4] Mount `GoldBubbleView` in bottom panel `#view-gold` in client/src/main.js (FR-008)

---

## Phase 7: User Story 5 - TSE Tape & Microstructure (Priority: P2)

**Goal**: Iranian traders can inspect real-time orderflow, retail vs institutional volume distribution, buyer power ratio, and smart money signals for 8 Tehran stocks with 3-second polling and chart loading.

- [x] T035 [US5] Build `TseTapeView` container with 8 quick-switch symbol chips and refresh button in client/src/tseTapeView.js (FR-010)
- [x] T036 [US5] Render scoreboard cards for Last Price, Buyer Power Ratio, Per-Capita Volume, and Suspicious Volume / Queue in client/src/tseTapeView.js (FR-009, FR-010)
- [x] T037 [US5] Render retail vs institutional volume distribution progress bar with share counts and percentages in client/src/tseTapeView.js (FR-009, FR-010)
- [x] T038 [US5] Implement 3-second polling lifecycle (`mount` / `unmount`) in client/src/tseTapeView.js (FR-010)
- [x] T039 [US5] Bind symbol chips and "Open Symbol Chart" button to switch active symbol in client/src/tseTapeView.js (FR-010)
- [x] T040 [US5] Mount `TseTapeView` in bottom panel `#view-tse` in client/src/main.js (FR-010)

---

## Phase 8: User Story 6 - Panels on Desktop and Mobile (Priority: P3)

**Goal**: Trackers, calendar, and news are accessible as right-dock side panels with plan gating; on mobile screens ($\le 768\text{px}$), Gold, TSE, and Market Sources are accessible via the panels drawer.

- [x] T041 [US6] Register side panels `trackers`, `calendar`, and `news` in Vela workspace in client/src/velaPanels.js (FR-011)
- [x] T042 [US6] Implement plan entitlement gating displaying `renderFeatureLocked` upgrade card on side dock mounts in client/src/main.js (FR-011)
- [x] T043 [US6] Route mobile panels drawer items (`[data-panel="gold"]`, `[data-panel="tse"]`, `[data-panel="sources"]`) in client/src/main.js (FR-012)
- [x] T044 [US6] Implement `MarketSourcesModal` displaying live Binance ping and 5 waterfall cards in client/src/marketSourcesModal.js (infra)
- [x] T045 [US6] Bind topbar source button `#btn-topbar-market-source` to open market sources modal and synchronize status badge in client/src/main.js (infra)

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Resource cleanup, tab teardown, and bilingual English/Persian localization

- [x] T046 [P] Dismantle Gold and TSE polling intervals on tab switch or bottom panel collapse in client/src/main.js (FR-008, FR-010)
- [x] T047 [P] Provide bilingual English and Persian string translations for tabs, titles, and descriptions in client/src/i18n.js (FR-013)
- [x] T048 [P] Enforce RTL alignment, Persian digits, and LTR number isolation (`num-ltr`) in client/styles/main.css (FR-013)
