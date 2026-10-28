# Tasks: Real Symbol Universe

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/market-data-api.md. Tests: tests/acceptance/015/ (locked before Phase 1).

## Phase 1: TradingView data client and routing

- [x] T001 [US2] Create server/tradingviewClient.js: pooled sockets (≤ TC_TV_MAX_SERIES_PER_SOCKET series), framing, heartbeat echo, backoff reconnect, rate cap, `resolve(symbol)`, `getBars(symbol, resolution, {limit, to})` with `request_more_data` paging, LRU caches (FR-001, FR-002)
- [x] T002 [US2] Add live updates and a quote session to server/tradingviewClient.js (`subscribe(symbol, cb)`, `getQuote(symbol)`) (FR-003)
- [x] T003 [US2] Route exchange-qualified non-Binance symbols in server/dataFeed.js `getCandles`/`get24hTicker` to the TradingView client with `source`, `exchange`, `delaySec`; last-good on outage (FR-002, FR-003)
- [x] T004 [US2] In server/index.js keep `EXCHANGE:SYMBOL` in `cleanSymbol`, push TradingView live ticks on /ws/live, add `exchange`/`delaySec` to /api/candles (FR-002, FR-003)

## Phase 2: Real catalogue

- [x] T005 [US3] In server/symbolCatalog.js load all Binance spot TRADING pairs from exchangeInfo (24 h refresh) as `BINANCE:<PAIR>` with precision/minTick from filters (FR-005)
- [x] T006 [US2] In server/symbolCatalog.js add curated TradingView defaults per category (forex majors/crosses, metals, energy, indices, top US/EU stocks, ETFs, US10Y/DXY) with nameFa, and TradingView search proxy merged into `/api/symbols?q=` (cached 10 min) (FR-004)
- [x] T007 [US1] Add the legacy alias table in server/symbolCatalog.js and apply it on every route in server/index.js (FR-004)
- [x] T008 [US1] Real default watchlist / landing tickers / screener universe in client/src/watchlistManager.js, client/landing/landing.js and server/technicalScreener.js (FR-011)

## Phase 3: Tehran sources

- [x] T009 [US4] Create server/tgjuClient.js: slug map, daily history (rial→Toman, verified column order), current value polling ≤ 60 s, cache (FR-006)
- [x] T010 [US4] Register TGJU entries in server/symbolCatalog.js with `timeframes: D/W/M` and route them in server/dataFeed.js; intraday → 400 `timeframe_unavailable` in server/index.js (FR-006)
- [x] T011 [US5] Create server/tseSource.js (BrsApi via TC_BRSAPI_KEY, relay via TC_TSETMC_PROXY, health probe) and enable `iran_tse` catalogue/routes only when healthy, in server/symbolCatalog.js and server/dataFeed.js (FR-007)
- [x] T012 [US4] Rebuild `/api/gold-snapshot` in server/dataFeed.js from real inputs (OANDA:XAUUSD, IR:USD_FREE, TGJU coins) with source/time per input (FR-006, FR-008)

## Phase 4: Remove every demo path

- [x] T013 [US1] Delete the demo-path module and the market-sessions module usage and all demo branches, fixed prices and `getTseMarketTape` fakes in server/dataFeed.js; unknown → 404 `unknown_symbol` on every route in server/index.js (FR-008)
- [x] T014 [US1] server/depthFeed.js: Binance only, others 404 `depth_unavailable`; client/src/depthOfMarket.js shows the unavailable state (FR-008)
- [x] T015 [US1] `/api/market-sources` real sources only in server/dataFeed.js and client/src/marketSourcesModal.js (FR-008, FR-009)
- [x] T022 [US4] In server/tgjuClient.js and server/symbolCatalog.js make `IR:GOLD_ABSHODEH` an alias of `IR:GOLD_MESGHAL` (same TGJU slug `mesghal` — no duplicate catalogue entry) and add `IR:USDT_FREE` (`crypto-tether-irr`) and `IR:GOLD_24K` (`geram24`) — slugs verified by the architect: OHLC order open,low,high,close, ≥ 2000 rows (FR-006)
- [x] T016 [US5] Hide TSE tape and category in client/src/tseTapeView.js and client/src/main.js unless enabled (FR-007, FR-008)

## Phase 5: Client UX and accuracy proof

- [x] T017 [US2] Topbar source/status badge LIVE / Delayed N min / EOD / Market closed and symbol-search rows with exchange, type, source in client/src/main.js and client/src/i18n.js (FR-009)
- [x] T018 [US4] Disable timeframes not in the symbol's `timeframes` with the FA/EN tooltip in client/src/timeframeManager.js and client/src/universalProvider.js (FR-009)
- [x] T019 [US1] Alias migration and removed-symbol notice for watchlists/layouts in client/src/watchlistManager.js and client/src/universalProvider.js (FR-009)
- [x] T020 [US2] Real-input gold bubble view with source/time in client/src/goldBubbleView.js (FR-009)
- [x] T023 [US1] Delete the now-unused market-sessions module (no importer left) and keep the build green (FR-008)
- [x] T021 [US6] Create tools/accuracy_audit.mjs (≥ 200 stratified symbols, provider-direct comparison, JSON report, exit 1 on mismatch) (FR-010)

## Phase 6: Converge — search/catalogue integrity (post-merge production audit)

Architect note: after phase 5 merged and deployed, the production audit found (and production was rolled back to 014):
26 search results whose ids are not TradingView tickers (e.g. `Pepperstone:EURUSD`, `CMC Markets:EURUSD`), 8 unknown ids silently served BTCUSDT from Binance (`Capital.com:DXY`, `Euronext Oslo:GYL` → BINANCE:BTCUSDT — a fabricated chart), 12 search results answering 503 (`FXCM:EURUSD` — TradingView prefix is `FX`), 44 delayed instruments labelled live, forex search results with precision 2, 4 curated defaults that do not exist on TradingView (TVC:COPPER, TVC:NATGAS, TVC:FTSE, AMEX:TLT), and tools/accuracy_audit.mjs exiting 0 with an "offline baseline" when the server is unreachable plus a 2 % tolerance. Curated TradingView symbols (41) and TGJU (12) were verified equal to the providers. New locked test tests/acceptance/015/06_search_and_catalog_integrity.test.cjs.

- [x] T024 [US2] Build search ids from `prefix`/`source_id`/`exchange` (uppercase, no spaces), verify each result with `resolve_symbol` (cached 24 h) and take dataStatus/delaySec/precision/minTick from the resolution, in server/symbolCatalog.js and server/tradingviewClient.js (FR-012)
- [x] T025 [US1] Route strictly by prefix in server/dataFeed.js and server/symbolCatalog.js: only `BINANCE:`/bare crypto pairs go to Binance, `IR:` to TGJU, `TSE:` to the TSE source, every other prefix to TradingView; unresolvable → 404 `unknown_symbol` (no fallback) (FR-012)
- [x] T026 [US2] Replace the four unresolvable curated defaults and derive every curated `dataStatus` from the resolved delay in server/symbolCatalog.js (FR-012)
- [x] T027 [US6] Make tools/accuracy_audit.mjs fail closed (exit 1 when server/provider unreachable), compare TradingView symbols via the public socket, compare the last closed bar within one minTick (FR-012)

## Phase 7: Complete universe — all TradingView markets and all Iranian exchange symbols (founder 2026-10-28)

Architect note: founder rejected the curated-only catalogue («قراره جایگزین تریدینگ‌ویو باشه، پس باید تکمیل باشه» and «به تمامی نمادهای بورس ایران هم نیازه»). Recon: `POST https://scanner.tradingview.com/<market>/scan` with `Origin: https://www.tradingview.com`, body `{columns:[name,description,exchange,type,subtype,currency,pricescale,minmov,update_mode], range:[from,to], filter?, sort?}` → `{totalCount, data:[{s, d:[...]}]}` — measured totals: global 454 562, crypto 64 494, futures 52 622, germany 39 830, america 20 053, economics2 15 167, uk 9 509, india 8 759, forex 6 332, bonds 1 163, cfd 650, turkey 650. BrsApi free key: 300 req / 5 min, ≥ 300 ms spacing, one key per person; `AllSymbols` returns every TSE/IFB instrument in one call. TradingView `TSE:` = Tokyo.

- [ ] T028 [US2] Add scanner access (markets list with totals, paged browse with filters, `update_mode` → dataStatus, pricescale/minmov → precision) to server/tradingviewClient.js and expose `GET /api/symbols/markets` and `GET /api/symbols/browse` in server/index.js via server/symbolCatalog.js (FR-013)
- [ ] T029 [US5] Rename the Tehran exchange prefix to `TSETMC:` across server/tseSource.js, server/symbolCatalog.js and server/dataFeed.js, route `TSE:` to TradingView (Tokyo) (FR-013)
- [ ] T030 [US5] Load ALL BrsApi `AllSymbols` instruments (stocks, rights, funds, bonds, options) with one snapshot per minute for live prices and on-demand cached daily history, respecting the fair-use limits, in server/tseSource.js (FR-013, FR-007)
- [ ] T031 [US2] Add the market browser (market tabs, exchange/type filters, infinite scroll, status badges, FA/EN) to the symbol-search dialog in client/src/main.js and client/src/i18n.js (FR-013)
