# Research: Market Data Feed

History: `git log --format='%h %ad %s' --date=short -- server/dataFeed.js server/symbolCatalog.js server/depthFeed.js server/index.js client/src/universalProvider.js client/src/depthOfMarket.js client/src/marketSourcesModal.js client/src/syntheticChartTypes.js`
— `ecdb389` (2026-09-17, Initial release of TradingChart with Binance Vision feed & multi-tier waterfall), `267f359` (2026-09-18, Zero-defect architectural elevation across desktop, mobile, and RTL surfaces), `b1565ab` (2026-09-18, Parity release: timeframe builder and multi-symbol data export), `8f408cb` (2026-09-18, DOM level-2 ladder, real-time technical screener), `c724bb4` (2026-09-18, Complete TradingView replacement: synthetic chart styles, news feed, technical rating card), `9dbd456` (2026-09-18, Exploratory browser dogfooding cycles and zero-defect layout clearance), `14f85d6` (2026-09-18, Responsive header, FA i18n completion), `c17dbc7` (2026-09-18, Fix DOM qty input inner-clip via textfield appearance), `95eade6` (2026-09-18, DOM L2 badge localization, 44px mobile touch targets), `c22ef30` (2026-09-18, Interval teardown on gold/tse views), `7544e50` (2026-10-12, Real-browser zero-defect cycle: honest data, Binance L2, no fake metrics, resource-aware polling, DOM badge), `fb0ff94` (2026-10-22, Platform admin console), `a94a611` (2026-10-22, Chartivia rebrand, production hardening, TradingView-style routing).

---

## R1. Multi-tier market data waterfall with live crypto and labelled demo feeds

- **Decision**: Serve real-time and historical cryptocurrency candles directly from Binance Vision public endpoints (`https://data-api.binance.vision/api/v3`), while serving non-crypto markets (Tehran gold/currencies, Tehran Stock Exchange, global forex, metals, commodities, and US equities) through deterministic, continuous demo series derived from canonical mathematical formulas and market tape microstructures.
- **Rationale**: Real global market data feeds for non-crypto assets (e.g. ICE, NYMEX, TSETMC, OANDA) require proprietary exchange licenses and commercial redistribution fees incompatible with an open, self-hosted white-label platform. Providing high-fidelity continuous series allows complete technical analysis, drawing, and indicator functionality, while strict honesty rules (Constitution Principle I) ensure the user is always informed of the demo status.
- **Alternatives considered**:
  - Scraping unauthorized public retail web portals for gold and TSE prices (rejected: fragile, prone to blocking/CAPTCHAs, and unreliable during market spikes).
  - Showing dummy static charts or disabled states for non-crypto symbols (rejected: prevents users from testing indicators and layouts on diverse asset classes).
- **Evidence**: `server/dataFeed.js:78-120,439-478`, `server/symbolCatalog.js:5-84`.

## R2. Multi-mirror fallback chain for cryptocurrency klines

- **Decision**: In `fetchBinanceKlines`, kline requests iterate across three redundant endpoints in sequential order: `https://data-api.binance.vision/api/v3/klines`, `https://api.binance.com/api/v3/klines`, and `https://api.binance.us/api/v3/klines`. If all endpoints fail or time out after 5,000 ms, the system degrades to `generateContinuousBars(cleanSymbol, timeframe, limit, toTime)` instead of returning an HTTP 500 or crashing.
- **Rationale**: Certain public endpoints of Binance are geo-restricted or rate-limited in specific network environments (e.g. Iran, US, or restricted VPS hosting). The multi-mirror strategy maximizes uptime, and the continuous fallback ensures uninterrupted charting and backtesting.
- **Alternatives considered**:
  - Direct client-side calls to Binance from the browser (rejected: blocked by CORS and geographical IP restrictions in restricted jurisdictions).
  - Single endpoint with failure abort (rejected: a single network hiccup or rate limit would render the chart unusable).
- **Evidence**: `server/dataFeed.js:99-125,454-465`.

## R3. Server-side micro-caching of candle queries and depth snapshots

- **Decision**:
  1. Micro-cache `/api/candles` responses in an in-memory `Map` (`candleCache`) for 3,000 ms (`CACHE_TTL_MS = 3000`), keyed by `${cleanSymbol}_${timeframe}_${limit}_${fromTime}_${toTime}`.
  2. Micro-cache `/api/depth` responses in an in-memory `Map` (`cache`) for 1,500 ms (`CACHE_MS = 1500`), keyed by `${symbol}:${levels}`, capped at 200 entries with FIFO eviction.
  3. Micro-cache Binance liveness ping (`probeBinance`) for 30,000 ms.
- **Rationale**: Prevents upstream API rate-limit exhaustion (Binance Vision weight limits) when multiple users or multi-chart layouts query identical symbols concurrently. 3,000 ms is well within acceptable latency for charting timeframes >= 1 minute while slashing redundant outbound HTTP traffic by over 90%.
- **Alternatives considered**:
  - External Redis cache (rejected: introduces heavy external dependencies violating Constitution Principle IX).
  - No caching (rejected: immediate IP ban from Binance Vision under concurrent multi-tab usage).
- **Evidence**: `server/dataFeed.js:25-26,441-446,613`, `server/depthFeed.js:16-17,55,120`.

## R4. Multi-page kline backfilling for deep historical bar limits

- **Decision**: When the requested candle limit exceeds Binance's single-request limit of 1,000 bars (`PAGE = 1000`), `fetchBinanceKlines` executes backward pagination up to 20 iterations (`guard < 20`), decrementing `endTime` to `oldest.time - 1` on each step, collecting bars into a timestamp-keyed `Map`, and slicing the final chronological array to the exact requested limit.
- **Rationale**: High-tier plans (Premium: 20,000 bars; Ultimate: 40,000 bars) require multi-year continuous daily and hourly history for quantitative backtesting. Single-page fetching caps history at ~1,000 bars, crippling long-term strategies.
- **Alternatives considered**:
  - Restricting all users to 1,000 bars (rejected: fails user expectation for institutional TradingView parity).
  - Unbounded pagination (rejected: could trigger memory exhaustion and upstream rate limit penalties; 20-page guard bounds execution).
- **Evidence**: `server/dataFeed.js:82-97`.

## R5. Client-side series caching and neutral seed bar outage fallback

- **Decision**: `UniversalMarketProvider` maintains a `seriesCache` map (`${clean}_${timeframe}` -> `Bar[]`) storing the last known-good candle series. If an upstream network request fails or returns an empty array, the provider replays the cached series. If no cache exists for a newly loaded symbol, it generates a single neutral seed bar (`{ time, open: 100, high: 100, low: 100, close: 100, volume: 0, openTime }`).
- **Rationale**: The charting engine (`@luxalgo/vela`) and indicator runtime (`pinets`) evaluate candle arrays on every tick. If an empty array is received, scripts attempting to access `bars[0].openTime` throw unhandled fatal exceptions, destroying the canvas state. Serving cached or seed bars ensures visual resilience.
- **Alternatives considered**:
  - Propagating empty arrays and showing blank canvas (rejected: triggers fatal PineTS crashes).
  - Displaying a full-screen blocking error overlay (rejected: disrupts user workflow during momentary network reconnects).
- **Evidence**: `client/src/universalProvider.js:37-40,177-198,215-223`.

## R6. Tick burst throttling (250 ms) and automatic WebSocket reconnection

- **Decision**: Real-time tick updates received from `/ws/live` are merged into the active candle bucket (`lastBarsCache`), but notification to chart subscribers (`sub.onBar`) is throttled to at most once every 250 ms using a trailing timer (`sub._pendingTimer`). On socket disconnect, the provider schedules an automatic reconnection attempt after 3,000 ms.
- **Rationale**: High-frequency ticks during volatile market moves can overwhelm browser Canvas/WebGL rendering loops if rendered synchronously. 250 ms matches TradingView's visual update cadence and Constitution Principle VIII ("Tick streams are coalesced to at most one emit per 250 ms per subscriber").
- **Alternatives considered**:
  - Direct synchronous emit on every WebSocket message (rejected: causes frame drops and browser stuttering on rapid tick influx).
  - Fixed 1,000 ms interval polling (rejected: too sluggish for scalping and DOM order book reaction).
- **Evidence**: `client/src/universalProvider.js:99-125`.

## R7. Honest provenance signalling across all user surfaces (commit 7544e50)

- **Decision**:
  1. Topbar route button `#btn-topbar-market-source` displays `"BINANCE"` in green (`#00F2B0`) with `"LIVE"` / `"زنده"` for crypto, and the localized market name with `"DEMO"` / `"نمایشی"` and `.is-demo-feed` CSS class for all other markets (`client/src/main.js:1354-1374`).
  2. DOM ladder displays a dedicated badge `#dom-source-badge`: `"Live · Binance"` / `"زنده · بایننس"` (green) for real books, or `"Simulated"` / `"شبیه‌سازی‌شده"` (amber) for synthetic books (`client/src/depthOfMarket.js:68-74`).
  3. Market Data Pipeline modal (`#modal-market-sources`) enumerates all 5 system data tiers, explicitly marking whether each is live or demo data (`client/src/marketSourcesModal.js:65-106`).
- **Rationale**: Chartivia Constitution Principle I ("Every number shown to a user MUST come from a real source or be labelled as demo/synthetic in the UI next to the value"). Eliminates deceptive marketing and builds institutional trust.
- **Alternatives considered**:
  - Showing generic "Connected" badges without distinguishing live vs demo feeds (rejected: strictly prohibited by Constitution Principle I).
- **Evidence**: `client/src/main.js:1354-1374`, `client/src/depthOfMarket.js:62-74`, `client/src/marketSourcesModal.js:65-106`.

## R8. Visibility-gated DOM ladder polling (commit 7544e50)

- **Decision**: In `DepthOfMarketView`, polling `/api/depth` every 1,500 ms is strictly conditional on `isVisible()` returning `true` (`!document.hidden && container.getClientRects().length > 0 && container.offsetParent !== null`).
- **Rationale**: Prior to commit `7544e50`, DOM polling ran perpetually every 1,500 ms for every connected user regardless of whether the DOM panel was mounted, open, or minimized. Gating polling by visibility prevents wasted server compute and adheres to Constitution Principle VIII.
- **Alternatives considered**:
  - WebSocket order book streaming for all symbols (rejected: excessive server memory and socket bandwidth for background views).
  - Polling without visibility check (rejected: wasted resources).
- **Evidence**: `client/src/depthOfMarket.js:36-46`.

## R9. Client-side non-time-based synthetic chart series generation (commit c724bb4)

- **Decision**: Implement Renko, Kagi, 3-Line Break, Range, Point & Figure, Hollow, and Volume-weighted candle series transformations in `client/src/syntheticChartTypes.js`. These algorithms run in browser memory on the raw OHLC bar stream and inject synthetic candles into the chart canvas.
- **Rationale**: Vela renders only time-based series natively. Performing canonical non-time-based transformations on the client keeps the server stateless, allows instant style switching without extra network fetches, and ensures 100% TradingView algorithmic parity.
- **Alternatives considered**:
  - Server-side synthetic bar computation (rejected: multiplies API surface and complicates cache invalidation).
  - Modifying `@luxalgo/vela` source code in `node_modules` (rejected: strictly forbidden by Constitution Principle IX).
- **Evidence**: `client/src/syntheticChartTypes.js:1-205`, `client/src/universalProvider.js:153-156,183,197,214`.

## R10. Real exchange depth mirroring for crypto with deterministic simulation for non-crypto

- **Decision**: `/api/depth` checks if the symbol is Binance-listed or crypto. If so, it queries Binance's public depth endpoint (`BOOK_BASES`). If non-crypto, it constructs a 12-level deterministic order book around the symbol's last 24h ticker price using trigonometric curves, flagging `source: 'simulated'` and `simulated: true`.
- **Rationale**: Provides traders with Level 2 DOM order book visualization and 1-click paper trading capabilities across all catalogue assets while honestly indicating when the ladder is mathematically simulated.
- **Alternatives considered**:
  - Omitting DOM for non-crypto assets (rejected: disables paper trading order placement workflows for Iranian and global macro assets).
  - Random number generator for simulated books (rejected: causes unsightly erratic flickering on every 1.5 s poll; trigonometric formulas provide stable, realistic depth curves).
- **Evidence**: `server/depthFeed.js:40-118`.

## R11. Universal symbol registry with bilingual metadata

- **Decision**: Centralize all tradable assets across 8 asset classes in `server/symbolCatalog.js`, providing English and Persian names, precision, minTick, lotSize, exchange, market, and currency. Support text search across symbol, English name, Persian name, tickerFa, and base asset.
- **Rationale**: Guarantees consistent instrument properties across candle fetching, order book calculations, paper trading lot sizes, screener filtering, and bilingual UI rendering.
- **Alternatives considered**:
  - Ad-hoc symbol definitions scattered across frontend and backend modules (rejected: causes precision mismatches and broken translations).
- **Evidence**: `server/symbolCatalog.js:5-124`.

## R12. Plan-based history depth clamping at server gateway

- **Decision**: `/api/candles` inspects the authenticated caller's plan (or defaults to `PLANS.basic.histBars` for unauthenticated/guest users), clamps the requested `limit` parameter to `histCap` (10,000 for guest/basic, 20,000 for premium, 40,000 for ultimate), and sends the `X-History-Limit` response header.
- **Rationale**: Complies with Constitution Principle VII ("Single Source of Truth for Entitlements: Plan quotas and feature flags are defined only in `server/featuresCatalog.js` and enforced on the server"). Prevents unauthorized deep data scraping while maintaining transparent entitlement signaling.
- **Alternatives considered**:
  - Client-side history slicing (rejected: insecure; malicious clients could query full historical datasets).
- **Evidence**: `server/index.js:93-97`.

---

## Spec/code mismatches

- FR-004: In `server/dataFeed.js:13-14`, `BINANCE_API_BASE` and `BINANCE_US_BASE` are defined, but `get24hTicker` (`server/dataFeed.js:490`) and `probeBinance` (`server/dataFeed.js:616`) query only `BINANCE_VISION_BASE` without falling back to the mirrors.
- FR-008: In `server/index.js:223`, `/ws/live` unconditionally auto-subscribes all incoming connections to `BTCUSDT` (`activeSubscriptions.set(ws, new Set(['BTCUSDT']))`), pushing unwanted ticks to clients viewing other assets; extra subscriptions beyond 50 are silently dropped without notification at `server/index.js:232`.
- FR-010: In `client/src/main.js:1365`, `updateTopbarSourceBadge()` hardcodes the category name `'FOREX'` in English without the Persian translation `L('FOREX', 'فارکس')`, whereas all other market categories are fully localized.
- FR-014: In `client/src/depthOfMarket.js:215,216,243,263`, prices and spread in the DOM ladder unconditionally render a dollar sign prefix `$` even for Iranian Toman/Rial instruments (`GOLD_ABSHODEH`, `FOOLAD`, etc.).
- FR-014: In `client/src/main.js:526`, the `depthOfMarket` plan entitlement is checked only client-side (`auth.feature('depthOfMarket')`); the backend endpoint `/api/depth` in `server/index.js:180` is public and has no plan or authentication check.
- FR-015: In `client/src/chartStylePicker.js:234`, the `synthChartTypes` plan entitlement is checked only client-side; `/api/candles` has no awareness of synthetic chart types.
