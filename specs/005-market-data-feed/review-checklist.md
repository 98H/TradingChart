# Review checklist — specs/005-market-data-feed

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

## Behaviour beyond the tests
- [ ] Topbar route badge `#btn-topbar-market-source` displays `"BINANCE"` / `"LIVE"` (`"زنده"`, color `#00F2B0`) for crypto; for non-crypto, displays market name, `"DEMO"` / `"نمایشی"`, color coding, and adds `.is-demo-feed` CSS class.
- [ ] Topbar source badge and DOM ladder re-render in place on `tc:languagechange` events without requiring a page reload.
- [ ] Market Sources modal lists all 5 data tiers; "Ping Test" button re-pings Binance Vision and updates average latency in ms.
- [ ] Upstream crypto kline fetch queries Binance Vision, then mirrors (`api.binance.com`, `api.binance.us`), then falls back to `generateContinuousBars` instead of returning 500 or failing.
- [ ] `GET /api/candles` clamps bar limit to caller's plan `histBars` and sends `X-History-Limit` header (10,000 for guest/basic, 20,000 for premium, 40,000 for ultimate).
- [ ] DOM ladder displays 12 ask rows (reversed, lowest ask closest to spread) and 12 bid rows (highest bid closest to spread) with depth percentage fill bars.
- [ ] DOM source badge displays `"Live · Binance"` / `"زنده · بایننس"` in green for crypto, or `"Simulated"` / `"شبیه‌سازی‌شده"` in gold for non-crypto.
- [ ] DOM ladder polling runs every 1,500 ms only while container is visible (`isVisible()`); halts when hidden or tab is in background.
- [ ] 1-click limit buy/sell buttons on DOM ladder rows trigger `app.paperTrading.executeOrder` with exact clicked row price.
- [ ] Market buy/sell buttons trigger paper execution for the current `orderQty` configured by the quantity stepper (step 0.05, min 0.01).
- [ ] WebSocket `/ws/live` handles subscribe/unsubscribe for up to 50 symbols per socket; drops extra subscriptions; caps connections at `TC_MAX_WS` with code 1013 "busy".
- [ ] UniversalMarketProvider coalesces live ticks to at most one emit every 250 ms per subscriber.
- [ ] UniversalMarketProvider caches last known-good series in `seriesCache` and falls back to cached series or neutral seed bar on network drop to prevent PineTS from throwing.
- [ ] Client-side synthetic series (Renko, Kagi, Line Break, Range, Point & Figure, Hollow, Volume candles) transform real OHLCV bars without altering server requests.

## Architecture boundaries
- [ ] Ingestion, multi-tier waterfall, and candle caching are isolated in `server/dataFeed.js`.
- [ ] DOM order book aggregation and simulation are isolated in `server/depthFeed.js`.
- [ ] Universal symbol registry and search query matching are isolated in `server/symbolCatalog.js`.
- [ ] Express routes and WebSocket broadcaster are encapsulated in `server/index.js`.
- [ ] Chart canvas bridge, WebSocket subscriber, and outage series cache are encapsulated in `client/src/universalProvider.js`.
- [ ] DOM ladder UI, spread display, and paper order placement are encapsulated in `client/src/depthOfMarket.js`.
- [ ] Waterfall route telemetry modal is encapsulated in `client/src/marketSourcesModal.js`.
- [ ] Synthetic chart transformations are encapsulated in `client/src/syntheticChartTypes.js`.
- [ ] Entitlement definitions (`histBars`, `depthOfMarket`, `synthChartTypes`) are anchored in `server/featuresCatalog.js`.
- [ ] Chart canvas interactions interact with `@luxalgo/vela` strictly via public APIs; no files in `node_modules` are modified.

## Forbidden shortcuts
- [ ] No branches on test inputs, test environments, or user-agent sniffing in production feed code.
- [ ] No fake live labels on demo data; all non-crypto markets must be honestly marked DEMO / Simulated.
- [ ] No perpetual unthrottled DOM timers; DOM polling must check `isVisible()` and skip while `document.hidden`.
- [ ] No uncapped WebSocket client connection pools or unbounded pagination loops.
- [ ] No empty bar series emitted to canvas or indicator engines during network dropouts.

## Copy and UX (only items tests cannot see)
- [ ] Persian copy follows formal respectful register, strict ZWNJ usage, and Persian numerals in FA mode (`داده بازار بایننس`, `بورس تهران`, `طلای تهران`, `عمق بازار`, `خرید در مارکت`, `فروش در مارکت`).
- [ ] LTR formatting on numerical prices, spreads, quantities, and ticker symbols inside RTL layout (`num-ltr`, `<bdi dir="ltr">`).
- [ ] Route badges and DOM ladder re-localize in-place without page reload on `tc:languagechange` event.
- [ ] Modal overlays and DOM container expand to responsive widths without horizontal overflow on mobile viewports (<=768px).
