# Implementation Plan: Market Intelligence

**Branch**: `008-market-intelligence` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-market-intelligence/spec.md`

## Summary

The Market Intelligence feature equips traders with institutional macroeconomic context, alternative data feeds, and localized Tehran market microstructure directly adjacent to the active charting canvas:
1. **US Alternative Disclosure Trackers**: In-memory catalogs and filtering UI for Congressional stock transactions, SEC Form 4 insider acquisitions and disposals, hedge fund 13F quarterly portfolio allocations, and FINRA daily short-sale volume with direct outbound links to official US government PDFs and EDGAR filings.
2. **Global Macroeconomic Calendar**: Real-time economic release schedule with impact filtering (High, Med, Low), currency filtering (USD), thematic categorization (Central Banks, Inflation), next-upcoming event countdown telemetry, and deviation attribution (Actual vs Forecast vs Previous).
3. **Breaking Market News & Catalysts**: Real-time headline feed categorized across 5 asset classes (Crypto, Metals, Forex, Equities, Commodities) with sentiment badges (Bullish, Bearish, Neutral), high-impact indicators, and 1-click active chart symbol switching.
4. **Tehran Gold & Coin Bubble Studio**: Live Iranian bullion calculations tracking 17k Melted Gold (Abshodeh), 18k Gram Gold, Ounce Spot, and Free USD/Tether parity, paired with an institutional formula calculating intrinsic gold value, bubble amount, and bubble percentage across official Iranian coins (Emami, Bahar, Nim, Rob, Gerami).
5. **TSETMC Market Tape & Smart Money Inspector**: Microstructure orderflow inspector for Tehran Stock Exchange equities (FOOLAD, FAMELI, KHODRO, etc.) analyzing retail vs institutional volume distribution, buyer power ratio, individual buy/sell per-capita in Tomans, and smart money inflow detection.
6. **Multi-Tier Market Data Pipeline & Waterfall Inspector**: Modal inspector and topbar telemetry badge displaying live Binance latency and 5-tier failover routing with honest demo/synthetic data labeling.
7. **Multi-Surface Integration**: Available across desktop expandable bottom panels (`#bottom-panel`), Vela WebGL2 right-dock side panels (`velaPanels.js`), and mobile panels drawer (`#modal-panels-menu`).

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ ESM in client and Node.js v20+ ESM in server).

**Primary Dependencies**:
- `@luxalgo/vela`: `^0.7.5` (Right-dock side panel container `registerSidePanel` and WebGL2 workspace).
- `express`: `^4.21.2` (REST HTTP route handlers).
- `ws`: `^8.18.0` (WebSocket broadcast server).
- `cors`: `^2.8.5` (Cross-Origin Resource Sharing middleware for REST APIs).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian RTL typography and numerals).
- `@fontsource/jetbrains-mono`: `^5.3.0` (Monospace numerals for prices, ratios, and percentages).
- `@fontsource/inter`: `^5.3.0` (Latin UI typography).
- `puppeteer-core`: `^24.3.1` (Headless browser automation for acceptance tests).

**Storage**:
- Client `localStorage`: None (all 6 views maintain in-memory instance state and fetch from HTTP endpoints on mount/navigation).
- Server memory:
  - In-memory static catalogs: `CONGRESSIONAL_TRADES`, `INSIDER_TRADES`, `HEDGE_FUND_13F`, `FINRA_SHORT_VOLUME` (`server/marketTrackers.js`).
  - In-memory news catalog: `BREAKING_NEWS_CATALOG` (`server/newsFeed.js`).
  - In-memory economic releases: `ECONOMIC_EVENTS` (`server/economicCalendar.js`).
  - In-memory algorithmic simulation: Gold snapshot calculations, TSETMC tape formulas, and Binance reachability cache (`server/dataFeed.js`).
- Server filesystem:
  - `server/data/accounts/plans.json`: Tier entitlement flags (`marketTrackers`, `economicCalendar`, `marketNews`).

**Testing**:
- `tests/qa_iran_and_sources_deep.cjs`: Puppeteer suite testing Market Sources modal, Tehran Gold & Bubble studio, TSE tape, symbol switching to FAMELI, Persian RTL translations, interval teardown on tab switch, and mobile 390px viewport fit.
- `tests/qa_diag.cjs`: Diagnostic audit confirming module initialization and render methods for calendar, news, and trackers on `window.__TRADING_APP__`.
- `tests/qa_crusade_omni.cjs`: Comprehensive modal suite verifying topbar button `#btn-topbar-market-source` opens and renders `#modal-market-sources`.

**Target Platform**: Modern desktop and mobile web browsers (Chromium, Firefox, Safari/WebKit) with full bilingual LTR/RTL layout support.

**Project Type**: Single-page web charting application (`/chart`) backed by an Express REST API.

**Performance Goals**:
- Sub-200ms API response time across all in-memory market intelligence endpoints (`/api/market-trackers`, `/api/economic-calendar`, `/api/news`, `/api/gold-snapshot`, `/api/tse-tape`, `/api/market-sources`).
- Zero perpetual background DOM loops: polling intervals (3s TSE, 4s Gold, 15s News) pause when `document.hidden` is true, and Gold/TSE intervals dismantle cleanly upon tab unmount.
- Sub-50ms client-side filter execution for search inputs across news, calendar, and tracker tables.

**Constraints**:
- External network egress restricted to Binance Ping (`https://data-api.binance.vision/api/v3/ping`) with 4-second timeout; all other feeds run entirely in-memory with simulated or static data.
- Read-only anonymous access across all market intelligence REST endpoints.
- Mobile viewport compatibility down to 390px width without horizontal overflow.

**Scale/Scope**:
- 4 tracker sub-tabs (Congress, Insider Form 4, 13F Hedge Funds, FINRA Short Volume).
- 10 macro calendar releases with 5 impact/category quick-filter buttons.
- 10 breaking news catalyst items categorized across 5 asset classes.
- 4 gold market pillar cards + 5 official Iranian coin bubble specifications.
- 8 TSE quick-switch stock chips with real-time simulated orderflow metrics.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | VIOLATION | Trackers, news, and calendar data originate from static in-memory catalogs (`server/marketTrackers.js`, `server/newsFeed.js`, `server/economicCalendar.js`). Tehran gold rates and TSE tape orderflow are algorithmically generated by mathematical models rather than live upstream exchange APIs. While the topbar badge and data pipeline modal explicitly label these markets as "Demo Data" / "داده نمایشی", and `marketTrackersView.js:34` and `marketNewsView.js:59` display demo data disclaimers, the underlying feeds are simulated rather than live market upstreams. |
| II | Spec Before Code | VIOLATION | Feature components were developed during September-October 2026 prior to adopting Hybrid SDD. Retrofit establishes the full specification and verification artifacts without altering working product code. |
| III | Real-Browser Zero-Defect Verification | PASS | Verified by real-browser Puppeteer suites `tests/qa_iran_and_sources_deep.cjs`, `tests/qa_diag.cjs`, and `tests/qa_crusade_omni.cjs` exercising desktop and mobile viewports, Persian RTL mode, symbol switching, and interval unmounting. |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | Comprehensive English and Persian localization is implemented across all five views, tab headers, and the pipeline modal. However, minor gaps exist: untranslated English `aria-label` attributes on tracker subtabs (`client/src/marketTrackersView.js:37-46`), untranslated `aria-label` on news symbol pill (`client/src/marketNewsView.js:163`), untranslated title on calendar refresh button (`client/src/economicCalendar.js:67`), and untranslated HTML modal shell title `#sources-modal-title` (`client/chart/index.html:647`). |
| V | Mobile Fit and Interaction Safety | PASS | Verified in `tests/qa_iran_and_sources_deep.cjs`: all touch targets meet or exceed 36-44px standards, `#modal-market-sources` fits within 390px without horizontal overflow, and mobile users can access Gold and TSE views via the drawer menu `#modal-panels-menu`. |
| VI | Security and Privacy by Default | PASS | All 6 REST routes (`/api/market-trackers`, `/api/economic-calendar`, `/api/news`, `/api/gold-snapshot`, `/api/tse-tape`, `/api/market-sources`) are read-only, sanitize query parameters (`cleanSymbol`, `clampInt`, `.slice(0, 32)`), and expose zero sensitive user data. |
| VII | Single Source of Truth for Entitlements | VIOLATION | Plan entitlement flags `marketTrackers`, `economicCalendar`, and `marketNews` are declared in `server/featuresCatalog.js` and defined in `server/data/accounts/plans.json`. However, gating is enforced solely when mounting the Vela right-dock side panels (`client/src/main.js:491, 505, 538`), while the bottom panel tabs (`#view-trackers`, `#view-calendar`, `#view-news`) and backend REST endpoints are completely ungated and open to all users. |
| VIII | Performance Budget | PASS | Endpoints return in-memory responses in < 5ms. Polling intervals use resource-aware checks (`!document.hidden`), and Gold (4s) and TSE (3s) intervals are cleared upon tab switch or bottom panel collapse (`client/src/main.js:1653, 1671, 1674`). |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Built with native DOM APIs, standard fetch, Express, and existing Vela panel registration. No new runtime dependencies added and no vendor packages in `node_modules` modified. |
| X | Hybrid SDD | VIOLATION | Retrofit reverse-specifies existing features. Artifacts capture normative requirements and code reality without modifying code. |

## Project Structure

### Documentation (this feature)

```text
specs/008-market-intelligence/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-013, SC-001..SC-004)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R10, rationale, spec/code mismatches
├── data-model.md               # Key entities, schemas, in-memory catalogs, lifecycles
├── quickstart.md               # Manual verification by story & automated test suites
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/market-trackers, /api/news, /api/gold-snapshot, etc.)
│   └── module-api.md           # Client module interfaces, methods, and lifecycle hooks
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Bottom panel tabs, topbar source button #btn-topbar-market-source, #modal-market-sources
├── styles/
│   └── main.css                # Styling for news feed cards, tracker subtabs, gold cards, TSE scoreboard, source cards
└── src/
    ├── marketTrackersView.js   # Alternative institutional data feeds viewer (Congress, Form 4, 13F, FINRA)
    ├── marketNewsView.js       # Real-time breaking market news and macro catalyst feed with sentiment badges
    ├── economicCalendar.js     # Macroeconomic calendar with impact/category filters and next-release banner
    ├── goldBubbleView.js       # Tehran gold market rates and official coin bubble/intrinsic calculator
    ├── tseTapeView.js          # Tehran Stock Exchange (TSETMC) microstructure tape and smart money flow
    ├── marketSourcesModal.js   # Multi-tier market data waterfall and latency inspector modal
    ├── velaPanels.js           # Registration of right-dock side panels (trackers, calendar, news)
    ├── main.js                 # Coordinator mounting bottom views, dock drawers, and topbar source routing
    └── i18n.js                 # Persian/English localization dictionaries and number formatting

server/
├── index.js                    # Express HTTP routes for /api/market-trackers, /api/economic-calendar, /api/news, /api/gold-snapshot, /api/tse-tape, /api/market-sources
├── marketTrackers.js           # Static catalogs: CONGRESSIONAL_TRADES, INSIDER_TRADES, HEDGE_FUND_13F, FINRA_SHORT_VOLUME
├── newsFeed.js                 # Static catalog: BREAKING_NEWS_CATALOG and getMarketNews helper
├── economicCalendar.js         # Static catalog: ECONOMIC_EVENTS and getEconomicEvents helper
├── dataFeed.js                 # Mathematical models for gold snapshot, TSETMC tape, and Binance reachability probe
├── featuresCatalog.js          # Feature descriptors and default plan flags for marketTrackers, economicCalendar, marketNews
└── data/accounts/plans.json    # Plan tier entitlement definitions (Basic, Essential, Plus, Premium, Institutional)

tests/
├── qa_iran_and_sources_deep.cjs # Puppeteer test suite for Gold & Bubble studio, TSE tape, sources modal, and mobile fit
├── qa_diag.cjs                 # Diagnostic audit verifying instance mounts and render methods
└── qa_crusade_omni.cjs         # End-to-end modal lifecycle test verifying #btn-topbar-market-source and #modal-market-sources
```

**Structure Decision**: Monolithic web charting application with Express ESM backend serving client static assets under `client/chart/` and bundled ESM scripts under `client/src/`. All market intelligence REST endpoints reside under `/api/` in `server/index.js`, delegating data generation to modular server files.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle I: In-memory catalogs and algorithmic models for market data | Real-time institutional feeds for US Congressional trades, SEC Form 4 EDGAR, FINRA short volume, Tehran gold bazaar, and TSETMC Bourse require costly commercial API licenses, complex scraping pipelines, and Iranian financial gateway infrastructure. | Pure placeholder stubs or empty states provide zero pedagogical value for traders learning orderflow, bubble analysis, and macro correlation; in-memory catalogs provide realistic deterministic structures. |
| Principle IV: Untranslated aria-labels in Persian mode | Rapid prototype development prioritized visible text nodes over accessibility attributes. | Code modification is prohibited during Spec Kit retrofit; tracked for Converge resolution. |
| Principle VII: Gating in right-dock panels but ungated bottom panels and API routes | Feature was initially implemented in bottom panel suite for unrestricted use, and later exposed in Vela side dock with plan gating checks. | Removing bottom panel access would break existing user workflows; enforcing API authentication requires session cookies and account refactoring tracked for Converge. |
