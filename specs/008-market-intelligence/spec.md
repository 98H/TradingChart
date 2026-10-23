# Feature Specification: Market Intelligence

**Feature Branch**: `008-market-intelligence` (retrofit)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Next to the chart, give traders the context professionals use: US disclosure trackers (Congress, Form 4, 13F, FINRA short volume), an economic calendar, a market news feed, a Tehran gold and coin-bubble studio and a Tehran Stock Exchange tape — each one click away from the chart of the instrument it mentions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Disclosure trackers (Priority: P2)

A trader opens Trackers and browses Congressional trades, SEC Form 4 insider trades, hedge-fund 13F portfolios and FINRA short-sale volume, filtering by ticker or name; every disclosure links to its official source.

**Independent Test**: Open Trackers, switch through the four sub-tabs, type a ticker and see only matching rows.

**Acceptance Scenarios**:

1. **Given** the bottom panel, **When** the user clicks Trackers, **Then** the panel expands and four sub-tabs are shown, the first one selected.
2. **Given** a sub-tab, **When** the user types in the filter, **Then** only rows whose member, company, fund or symbol match remain.
3. **Given** a Congress or Form 4 row, **Then** it carries a link to the official filing (`sourceUrl`).

---

### User Story 2 - Economic calendar (Priority: P2)

A trader sees upcoming macro releases (CPI, FOMC, NFP, GDP, central banks) with impact, forecast, previous and actual, highlights the next release, filters by impact, currency, category or text, and refreshes.

**Acceptance Scenarios**:

1. **Given** the Calendar tab, **Then** a highlight of the next release and a list of event cards are shown.
2. **Given** a filter (All, High Impact, USD, Central Banks, Inflation), **When** it is clicked, **Then** only matching events remain; clicking the active filter returns to All.
3. **Given** a search such as "CPI", **Then** only events whose name matches remain.

---

### User Story 3 - Market news (Priority: P2)

A trader reads headlines with sentiment and impact badges, filters by category or text, and jumps to the chart of a mentioned symbol; the feed refreshes every 15 s while open.

**Acceptance Scenarios**:

1. **Given** the News tab, **When** a category (All, Crypto, Metals, Forex, Equities, Commodities) is clicked, **Then** headlines of that category (up to 30) are shown.
2. **Given** a search with no match, **Then** "No headlines matched active filter." (Persian equivalent in FA) is shown.
3. **Given** a symbol pill on a headline, **When** clicked, **Then** the active chart switches to that symbol.

---

### User Story 4 - Tehran gold and coin bubbles (Priority: P2)

An Iranian trader sees melted gold (17k abshodeh), 18k gram, ounce spot and free USD/USDT, plus each official coin's market price, intrinsic value and bubble, refreshed every 4 s, and opens the chart of gold or a coin.

**Acceptance Scenarios**:

1. **Given** the Gold tab, **Then** four pillar cards and a coin bubble table (market price, intrinsic value, bubble amount and percent) are shown.
2. **Given** "Melted Gold Chart" or a coin's "Chart", **When** clicked, **Then** the active chart switches to that instrument.

---

### User Story 5 - TSE tape (Priority: P2)

An Iranian trader picks a Tehran stock (FOOLAD, FAMELI, KHODRO, AHRAM, SHASTA, TALA, AYAR, TAVAN) and sees price, buyer-power ratio, per-capita buy/sell, individual vs institutional volume and smart-money signals, refreshed every 3 s, and opens its chart.

**Acceptance Scenarios**:

1. **Given** the TSE tab, **When** a symbol chip is clicked, **Then** the title and all tape figures switch to that symbol.
2. **Given** "Open Symbol Chart", **Then** the active chart switches to the selected symbol.

---

### User Story 6 - Panels on desktop and mobile (Priority: P3)

Trackers, calendar and news open as bottom-panel tabs and as right-dock panels; on mobile, gold and TSE are reachable from the panels menu.

**Acceptance Scenarios**:

1. **Given** a plan without `marketTrackers`, `economicCalendar` or `marketNews`, **When** the right-dock panel is opened, **Then** a locked card with an upgrade button is shown.
2. **Given** a viewport ≤ 768 px, **When** the user opens the panels menu and picks Gold or TSE, **Then** the matching bottom view opens.

---

### Edge Cases

- Unknown TSE symbol → `400 invalid_symbol`.
- Polling views (news 15 s, gold 4 s, TSE 3 s) stop polling when unmounted.
- `limit` outside 1..100 on `/api/news` is clamped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `GET /api/market-trackers?kind=all|congress|insider|13f|short_vol` MUST return `congressionalTrades`, `insiderTrades`, `hedgeFund13F` and `finraShortVolume` in the documented shapes, Congress and Form 4 entries each with an official `sourceUrl`.
- **FR-002**: The Trackers view MUST show four sub-tabs (Congressional Stock Trades, SEC Form 4 Insider Trades, Hedge Fund 13F Portfolios, FINRA Short Sale Volume) and a text filter over member, company, fund and symbol.
- **FR-003**: `GET /api/economic-calendar` MUST accept `impact`, `country`, `category` (≤ 32 chars each) and return `{total, events[]}` with per event `id, date, timestamp, country, flag, currency, event, eventFa, impact (HIGH|MED|LOW), actual, forecast, previous, unit, category, categoryFa`.
- **FR-004**: The Calendar view MUST highlight the next release, list events, provide the filters All, High Impact, USD, Central Banks and Inflation (clicking the active filter resets to All), a text search and a refresh button.
- **FR-005**: `GET /api/news` MUST accept `category` (default all), optional `symbol` and `limit` (1..100, default 20) and return `{total, news[]}` with per item `id, symbol, category, titleEn, titleFa, source, timeAgo, timestamp, sentiment (bullish|bearish|neutral), impact (high|medium), summaryEn, summaryFa`.
- **FR-006**: The News view MUST filter by category (All, Crypto, Metals, Forex, Equities, Commodities; up to 30 items) and by text over title, summary and symbol, show the empty-state message, poll every 15 s while mounted, and switch the active chart when a symbol pill is clicked.
- **FR-007**: `GET /api/gold-snapshot` MUST return `ounceUsd, usdFree, usdtNobitex, dirhamRate`, `abshodeh` and `gram18` quotes, and per official coin `marketPrice, intrinsicValue, bubbleAmount, bubblePercent, weightGrams, purity`.
- **FR-008**: The Gold view MUST show the four pillar cards and the coin bubble table, refresh every 4 s while mounted and on "Refresh", and switch the active chart to GOLD_ABSHODEH or the chosen coin.
- **FR-009**: `GET /api/tse-tape?symbol=` MUST return the documented tape fields (prices, volume, value, trade count, individual/institutional buy/sell volumes and counts, per-capita buy/sell in Toman, buyer-power ratio, smart-money inflow, suspicious-volume ratio, queue status) and `400 invalid_symbol` for unknown symbols.
- **FR-010**: The TSE view MUST offer the 8 symbol chips, refresh every 3 s while mounted and on "Refresh Tape", and open the selected symbol's chart.
- **FR-011**: Trackers, calendar and news MUST be available as bottom-panel tabs and right-dock panels; the right-dock panels MUST show the locked upgrade card when the plan lacks `marketTrackers`, `economicCalendar` or `marketNews`.
- **FR-012**: On viewports ≤ 768 px the panels menu MUST open the Gold and TSE views.
- **FR-013**: All views of this feature MUST render in English and Persian (Persian titles, summaries and event names where provided) with rtl layout in Persian.

### Key Entities

- **Congressional Trade**, **Insider Trade**, **13F Portfolio** (fund, manager, period, top holdings), **Short Volume** (symbol, date, short/total volume, ratio).
- **Economic Event**: date, country, currency, event EN/FA, impact, actual/forecast/previous, unit, category.
- **News Item**: symbol, category, EN/FA title and summary, source, time, sentiment, impact.
- **Gold Snapshot** and **Coin Bubble**.
- **TSE Tape**: price and microstructure figures for one Tehran stock.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the five views renders its data within 2 s of opening the tab.
- **SC-002**: Every symbol link in news, gold and TSE switches the active chart in 100% of clicks.
- **SC-003**: Polling timers of news, gold and TSE are zero after their views are unmounted.
- **SC-004**: Zero untranslated user-visible labels in Persian across the five views.

## Assumptions

- **Honest-data status (constitution principle, Converge priority)**: trackers, news and calendar come from static in-memory catalogues, and gold and TSE figures are computed by formulas, not from live upstreams. The pipeline dialog (005) labels these markets as demo; the views themselves must state clearly when their data is sample/demo — whether they do so today is to be verified by the acceptance tests and fixed in Converge if not.
- The market data pipeline dialog and source badge are specified in 005-market-data-feed.
- Known gaps for Converge: plan gates only on right-dock panels (bottom panel and server routes ungated); no error state when any of the five fetches fails; untranslated aria-labels/titles; unused imports and a redundant calendar render.
