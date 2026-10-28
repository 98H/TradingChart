# Tasks: Real Symbol Universe

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/market-data-api.md. Tests: tests/acceptance/015/ (locked before Phase 1).

## Phase 1: TradingView data client and routing

- [ ] T001 [US2] Create server/tradingviewClient.js: pooled sockets (≤ TC_TV_MAX_SERIES_PER_SOCKET series), framing, heartbeat echo, backoff reconnect, rate cap, `resolve(symbol)`, `getBars(symbol, resolution, {limit, to})` with `request_more_data` paging, LRU caches (FR-001, FR-002)
- [ ] T002 [US2] Add live updates and a quote session to server/tradingviewClient.js (`subscribe(symbol, cb)`, `getQuote(symbol)`) (FR-003)
- [ ] T003 [US2] Route exchange-qualified non-Binance symbols in server/dataFeed.js `getCandles`/`get24hTicker` to the TradingView client with `source`, `exchange`, `delaySec`; last-good on outage (FR-002, FR-003)
- [ ] T004 [US2] In server/index.js keep `EXCHANGE:SYMBOL` in `cleanSymbol`, push TradingView live ticks on /ws/live, add `exchange`/`delaySec` to /api/candles (FR-002, FR-003)

## Phase 2: Real catalogue

- [ ] T005 [US3] In server/symbolCatalog.js load all Binance spot TRADING pairs from exchangeInfo (24 h refresh) as `BINANCE:<PAIR>` with precision/minTick from filters (FR-005)
- [ ] T006 [US2] In server/symbolCatalog.js add curated TradingView defaults per category (forex majors/crosses, metals, energy, indices, top US/EU stocks, ETFs, US10Y/DXY) with nameFa, and TradingView search proxy merged into `/api/symbols?q=` (cached 10 min) (FR-004)
- [ ] T007 [US1] Add the legacy alias table in server/symbolCatalog.js and apply it on every route in server/index.js (FR-004)
- [ ] T008 [US1] Real default watchlist / landing tickers / screener universe in client/src/watchlistManager.js, client/landing/landing.js and server/technicalScreener.js (FR-011)

## Phase 3: Tehran sources

- [ ] T009 [US4] Create server/tgjuClient.js: slug map, daily history (rial→Toman, verified column order), current value polling ≤ 60 s, cache (FR-006)
- [ ] T010 [US4] Register TGJU entries in server/symbolCatalog.js with `timeframes: D/W/M` and route them in server/dataFeed.js; intraday → 400 `timeframe_unavailable` in server/index.js (FR-006)
- [ ] T011 [US5] Create server/tseSource.js (BrsApi via TC_BRSAPI_KEY, relay via TC_TSETMC_PROXY, health probe) and enable `iran_tse` catalogue/routes only when healthy, in server/symbolCatalog.js and server/dataFeed.js (FR-007)
- [ ] T012 [US4] Rebuild `/api/gold-snapshot` in server/dataFeed.js from real inputs (OANDA:XAUUSD, IR:USD_FREE, TGJU coins) with source/time per input (FR-006, FR-008)

## Phase 4: Remove every demo path

- [ ] T013 [US1] Delete server/demoPath.js and server/marketSessions.js usage and all demo branches, fixed prices and `getTseMarketTape` fakes in server/dataFeed.js; unknown → 404 `unknown_symbol` on every route in server/index.js (FR-008)
- [ ] T014 [US1] server/depthFeed.js: Binance only, others 404 `depth_unavailable`; client/src/depthOfMarket.js shows the unavailable state (FR-008)
- [ ] T015 [US1] `/api/market-sources` real sources only in server/dataFeed.js and client/src/marketSourcesModal.js (FR-008, FR-009)
- [ ] T016 [US5] Hide TSE tape and category in client/src/tseTapeView.js and client/src/main.js unless enabled (FR-007, FR-008)

## Phase 5: Client UX and accuracy proof

- [ ] T017 [US2] Topbar source/status badge LIVE / Delayed N min / EOD / Market closed and symbol-search rows with exchange, type, source in client/src/main.js and client/src/i18n.js (FR-009)
- [ ] T018 [US4] Disable timeframes not in the symbol's `timeframes` with the FA/EN tooltip in client/src/timeframeManager.js and client/src/universalProvider.js (FR-009)
- [ ] T019 [US1] Alias migration and removed-symbol notice for watchlists/layouts in client/src/watchlistManager.js and client/src/universalProvider.js (FR-009)
- [ ] T020 [US2] Real-input gold bubble view with source/time in client/src/goldBubbleView.js (FR-009)
- [ ] T021 [US6] Create tools/accuracy_audit.mjs (≥ 200 stratified symbols, provider-direct comparison, JSON report, exit 1 on mismatch) (FR-010)
