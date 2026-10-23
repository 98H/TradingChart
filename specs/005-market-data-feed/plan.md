# Implementation Plan: Market Data Feed

**Branch**: `005-market-data-feed` | **Date**: 2026-10-23 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-market-data-feed/spec.md`

## Summary

The Market Data Feed feature serves historical and live market candles, real-time WebSocket ticker updates, Level 2 Depth of Market (DOM) order book ladders, 24-hour ticker statistics, and a universal instrument catalogue across 8 asset classes (crypto, metals, commodities, forex, global indices, US equities, Tehran gold & currencies, and Tehran Stock Exchange TSETMC). Live crypto data is sourced directly from Binance Vision REST API and public mirrors with multi-page historical backfill, while all non-crypto markets are provided as high-fidelity deterministic continuous demo series. In accordance with the Chartivia Constitution's Honest Data doctrine, the platform transparently labels all feeds as either "LIVE" or "DEMO" in the topbar route badge, DOM ladder header, and the Market Data Pipeline Inspector modal dialog. A resilient client-side provider architecture (`UniversalMarketProvider`) guarantees that network dropouts or upstream API failures never crash the chart or downstream indicator calculations by replaying cached series or serving neutral seed bars.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ ESM in browser; Node.js v20+ ESM in backend).

**Primary Dependencies**:
- `express`: `^4.21.2` (HTTP routing, query parsing, and error middleware).
- `ws`: `^8.18.0` (RFC 6455 WebSocket server for real-time tick broadcasting).
- `@luxalgo/vela`: `^0.7.5` (WebGL2 charting engine hosting the custom data provider bridge).
- `puppeteer-core`: `^24.3.1` (Headless browser acceptance test runner).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography for localized market names and route badges).
- `@fontsource/inter`: `^5.3.0` (Latin typography for ticker codes and price digits).

**Storage**:
- Client `localStorage`:
  - `tradingchart_price_style`: Active chart price style string (`'candles'`, `'renko'`, `'kagi'`, `'linebreak'`, `'range'`, `'pnf'`, `'hollow'`, `'volumecandles'`).
- Server in-memory state:
  - `candleCache` (`server/dataFeed.js`): `Map<string, { ts: number, data: Candle[] }>`, TTL 3000 ms.
  - `binanceProbe` (`server/dataFeed.js`): `{ at: number, ok: boolean, ms: number | null }`, TTL 30000 ms.
  - `cache` (`server/depthFeed.js`): `Map<string, { at: number, data: DepthSnapshot }>`, TTL 1500 ms, FIFO capped at 200 entries.
  - `activeSubscriptions` (`server/index.js`): `Map<WebSocket, Set<string>>`, capped at 50 symbols per client.
- Client in-memory state:
  - `UniversalMarketProvider.symbolsCache`: Cached symbol catalogue from `/api/symbols`.
  - `UniversalMarketProvider.seriesCache`: `Map<string, Bar[]>`, last known-good candle series preventing PineTS crashes during outages.
  - `UniversalMarketProvider.lastBarsCache`: `Map<string, Bar>`, latest bar snapshot per symbol and interval.
  - `UniversalMarketProvider.subscribers`: `Map<string, Set<Subscriber>>`, active tick subscribers with 250 ms coalescing timers.

**Testing**:
- Puppeteer browser test suites:
  - `tests/qa_iran_and_sources_deep.cjs`: Pipeline modal trigger, >=4 source cards, live latency display, modal close.
  - `tests/qa_symsearch.cjs`: `/api/symbols` search filtering, input debounce, instrument count badge.
  - `tests/qa_cycle_ctx_depth.cjs`: History depth (>=1500 bars) on boot and timeframe switch to Daily ('D').
  - `tests/qa_cycleC.cjs`: `C03_depth_of_market_ladder` DOM rendering, bid/ask rows, `C05_export_csv_integrity`.
  - `tests/qa_accounts_cycle7.cjs`: `09_histbars_plan_gate` checking `X-History-Limit` header (10000 guest vs 20000 premium) and bar clamping.
  - `tests/test-update-candles.js`: Headless inspection of chart and orchestrator candle updates.
  - `tests/test-set-bar-series.js`: Headless verification of orchestrator `setBarSeries` and `applyBar`.

**Target Platform**: Responsive web charting application (`/chart`) running on desktop and mobile viewports in English (LTR) and Persian (RTL).

**Project Type**: Client-server web application with Node.js/Express backend proxies and modular ES client classes.

**Performance Goals**:
- `/api/candles` response latency under 50 ms on micro-cache hits; under 600 ms on cold Binance Vision multi-page backfills.
- Live WebSocket tick distribution to all connected clients within 50 ms of interval tick.
- Client tick burst coalescing capped at 250 ms per subscriber to preserve 60 FPS canvas rendering.
- DOM ladder background polling throttled to 1500 ms and suppressed completely when container is hidden or tab inactive.

**Constraints**:
- Single Binance Vision public API limit of 1,200 request weight per minute without API key; mitigated by multi-page batching, micro-caching (3s), and deterministic demo series for non-crypto.
- No perpetual interval loops faster than 1,000 ms.
- Client canvas indicator engine (`pinets`) throws fatal exceptions if a bar series is empty or lacks `openTime`; provider must always return valid bars.

**Scale/Scope**:
- 52 catalogued instruments across 8 categories (17 Crypto, 2 Metals, 3 Commodities, 9 Forex, 3 Indices, 7 US Stocks, 9 Tehran Gold & Currencies, 16 Tehran Stock Exchange equities/ETFs).
- 5 documented data routes in Market Data Pipeline (Binance Direct, Forex/Metals, US Equities, Tehran Gold & Currencies, TSETMC Bourse).
- Up to 2,000 concurrent WebSocket clients (`TC_MAX_WS`).
- Historical bar depth up to 40,000 bars based on user account tier.

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | Crypto is fetched live from Binance Vision API with mirrors, while all other markets (Tehran gold, TSE, forex, commodities, US equities) are explicitly and honestly labelled as "DEMO" / "نمایشی" in the topbar (`client/src/main.js:1354-1374`) with `.is-demo-feed` styling, in the DOM ladder source badge ("Simulated" / "شبیه‌سازی‌شده", `client/src/depthOfMarket.js:68`), and in `/api/market-sources` (`client/src/marketSourcesModal.js:70,94`, `live: false`, `status: 'demo'`). No fake live claims are made. Minor cosmetic gap: DOM ladder displays a hardcoded `$` prefix even for Toman/Rial instruments (`client/src/depthOfMarket.js:215,243`). |
| II | Spec Before Code | VIOLATION | The market data feed and fallback pipelines were developed between September and October 2026 before adopting Hybrid SDD. This retrofit captures the existing system contracts and architecture into formal Spec Kit artifacts. |
| III | Real-Browser Zero-Defect Verification | VIOLATION | Existing automated tests (`qa_iran_and_sources_deep.cjs`, `qa_cycleC.cjs`, `qa_symsearch.cjs`) execute primarily in desktop mode (1440x900) or check specific mobile viewports without full desktop/mobile × fa/en matrix coverage for all market feed interactions. Some tests use programmatic clicks (`sourceBtn.click()`, `page.click()`) rather than strict coordinate-verified pointer clicks. |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | Symbol catalogue entries have full English and Persian names (`nameFa`, `tickerFa`). Topbar route badges, market sources modal, and DOM ladder feature comprehensive Persian localization (`L('LIVE', 'زنده')`, `L('DEMO', 'نمایشی')`, `L('TEHRAN BOURSE', 'بورس تهران')`, Persian numbers). However, minor gaps exist: `client/src/main.js:1365` leaves `'FOREX'` untranslated in English; `client/src/main.js:1562` shows untranslated `'Error searching symbols'`; static attributes in `client/chart/index.html:61` contain English fallback strings. |
| V | Mobile Fit and Interaction Safety | VIOLATION | While the topbar badge and symbol search accommodate mobile layouts, the DOM quantity buttons (`#dom-qty-dec`, `#dom-qty-inc`) have dimensions of 30x30px (`client/src/depthOfMarket.js:93,95`), falling below the mandatory 44px mobile touch target rule. |
| VI | Security and Privacy by Default | PASS | Public endpoints (`/api/candles`, `/api/tickers`, `/api/symbols`, `/api/symbol-info`, `/api/depth`, `/api/market-sources`) sanitize inputs (`cleanSymbol`, regex validation for `timeframe`, `clampInt` for limits). Payloads are strictly bounded; WebSocket message frames are size-capped; errors return generic JSON error codes without stack traces. No secrets or user credentials are exposed. |
| VII | Single Source of Truth for Entitlements | VIOLATION | `histBars` is properly enforced server-side in `server/index.js:93-97` via `featuresCatalog.js` and `PLANS`. However, `depthOfMarket` is gated solely on the client in `client/src/main.js:526` (`auth.feature('depthOfMarket')`), while the backend route `/api/depth` has no plan checks or authentication. Similarly, `synthChartTypes` is gated client-side in `chartStylePicker.js`. |
| VIII | Performance Budget | PASS | Candle responses are micro-cached for 3000 ms (`server/dataFeed.js:26`); DOM snapshots are cached for 1500 ms with a 200-entry ceiling (`server/depthFeed.js:16,101`); Binance probe is cached for 30 s. The client DOM ladder uses visibility-gated polling (`isVisible()`), stopping polling when the tab is hidden or panel closed (`client/src/depthOfMarket.js:38-44`). WebSocket tick bursts are coalesced to at most 250 ms per subscriber (`client/src/universalProvider.js:105-114`). |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Uses standard Node.js built-ins (`fetch`, `AbortSignal`), `express`, and `ws`. No vendor code in `node_modules/@luxalgo/vela` is modified. |
| X | Hybrid SDD | VIOLATION | Feature was implemented prior to SDD adoption. This retrofit establishes the complete Spec Kit documentation set to govern future iterations without altering working production code. |

## Project Structure

### Documentation (this feature)

```text
specs/005-market-data-feed/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-015, SC-001..SC-005)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R12, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/candles, /api/tickers, /api/symbols, etc.)
│   └── module-api.md           # Client module interfaces, methods, WebSocket contracts
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Modal mounts (#modal-market-sources, #modal-symbol-search, #btn-topbar-market-source)
├── src/
│   ├── universalProvider.js    # Custom Vela DataProvider bridge: candles, symbol resolver, WebSocket subscriber
│   ├── depthOfMarket.js        # DepthOfMarketView: Level 2 orderbook ladder, spread, visibility-gated polling
│   ├── marketSourcesModal.js   # MarketSourcesModal: waterfall pipeline inspector, live latency ping test
│   ├── syntheticChartTypes.js  # Client-side non-time-based series generators (Renko, Kagi, PnF, Range, etc.)
│   ├── chartStylePicker.js     # Chart style selector and plan gate for synthetic types
│   ├── chartManager.js         # Provider registration and workspace coordination
│   ├── main.js                 # App coordinator, topbar source badge updater, symbol search wiring
│   └── i18n.js                 # Localization helper and Persian digit formatting
├── styles/
│   └── main.css                # DOM ladder (.dom-wrapper), market sources modal (.source-card), demo badge (.is-demo-feed)
server/
├── index.js                    # Express HTTP routes (/api/candles, /api/depth, etc.) & WebSocket (/ws/live)
├── dataFeed.js                 # Multi-tier waterfall, Binance Vision fetcher, continuous series generator, telemetry
├── depthFeed.js                # Level 2 Depth of Market aggregator with Binance book mirror and simulated ladder
├── symbolCatalog.js            # Universal symbol registry across 8 asset classes and searchSymbols query engine
└── featuresCatalog.js          # Canonical plan entitlements (histBars, depthOfMarket, synthChartTypes)
tests/
├── qa_iran_and_sources_deep.cjs # Market sources modal, route cards count, live latency display, close button
├── qa_symsearch.cjs            # /api/symbols search filtering, input debounce, and count badge
├── qa_cycle_ctx_depth.cjs      # History depth (>=1500 bars) on boot and timeframe switch to Daily ('D')
├── qa_cycleC.cjs               # DOM ladder rendering (C03) and candle schema integrity (C05)
├── qa_accounts_cycle7.cjs      # X-History-Limit header check and bar clamping (09_histbars_plan_gate)
├── test-update-candles.js      # Headless Puppeteer probe inspecting candle update methods
└── test-set-bar-series.js      # Headless Puppeteer probe verifying setBarSeries and applyBar
```

**Structure Decision**: Clean separation of backend data ingestion, normalization, and caching (`server/dataFeed.js`, `server/depthFeed.js`, `server/symbolCatalog.js`) from HTTP/WebSocket transport (`server/index.js`). The frontend encapsulates charting connectivity inside `UniversalMarketProvider`, while visual inspection tools (`marketSourcesModal.js`, `depthOfMarket.js`, `syntheticChartTypes.js`) operate modularly on top of the chart shell.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| II: Built prior to SDD adoption | Implemented across September–October 2026 before adopting Hybrid SDD methodology. | Retrofit procedure creates complete Spec Kit artifacts without risking regressions in stable production code. |
| III: Incomplete browser matrix & synthetic clicks in tests | Legacy Puppeteer tests were written before strict pointer click and multi-matrix rules were established. | Rewriting test harness deferred to test authoring phase of SDD lifecycle. |
| IV: Untranslated 'FOREX' and search error strings | Quick implementation additions during parity cycles. | Fixing in product code is forbidden during retrofit; logged in research.md mismatches for Converge phase resolution. |
| V: Sub-44px touch targets on DOM quantity stepper | Compact desktop-oriented design density (30x30px buttons) reused on mobile. | Expanding mobile touch targets requires CSS layout restructuring, deferred to Converge phase. |
| VII: Client-only enforcement for `depthOfMarket` and `synthChartTypes` | DOM ladder and synthetic transformations execute purely in client memory. | Enforcing server-side requires session authentication on `/api/depth` and candle format parameters, deferred to Converge phase. |
| X: Retrofit feature governance | Feature existed in production prior to SDD pipeline ratification. | Retrofit protocol documents existing code contracts to enable future gated enhancements. |
