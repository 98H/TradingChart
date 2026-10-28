# Feature Specification: Real Symbol Universe (TradingView-grade coverage, real data only)

**Feature Branch**: `015-real-symbol-universe` — owns the symbol catalogue and every market-data source from now on

**Created**: 2026-10-28

**Status**: Founder decisions received (2026-10-28)

**Input**: Founder (verbatim): «الان می‌تونیم مطمئن باشیم که به لحاظ تکمیل بودن لیست نمادها و صحتشون می‌تونیم جایگزینی برای تریدینگ ویو باشیم؟ اگر نه هدف بعدی همینه.» Decisions: (1) «برای بازارهای جهانی می‌تونی به داده‌های رایگان تریدینگ‌ویو متصل بشی.» (2) Tehran Stock Exchange: no Iran-IP relay available — «ببین چیکار میشه کرد». (3) «اگر نماد واقعی و صحیح نیست نباید روی پلتفرم باشه.»

## Architect recon (2026-10-28, from the production host)

- Catalogue today: 67 symbols; 17 real (Binance), 50 demo.
- Binance spot exchangeInfo: 1 383 trading pairs, 516 quoted in USDT — reachable. Binance futures (`fapi`): blocked (restricted location, also via WARP).
- TradingView public chart WebSocket `wss://data.tradingview.com/socket.io/websocket` with `unauthorized_user_token`: reachable; verified real bars for OANDA:EURUSD (60, 5000 bars), NASDAQ:AAPL (D, since 2006), OANDA:XAUUSD (1), SP:SPX (D, `delay: 600` s), TVC:USOIL (240), FX_IDC:USDIRR (D), BINANCE:BTCUSDT (1). `TSE:*` (Tehran) → `invalid symbol`. Symbol search `symbol-search.tradingview.com/symbol_search/v3` reachable.
- TGJU `api.tgju.org/v1/market/indicator/summary-table-data/<slug>`: reachable; real daily history (e.g. `price_dollar_rl` 3 988 days, `sekee` 4 326 days, `geram18`, `mesghal`), values in rial.
- tsetmc.com / cdn.tsetmc.com, codal, rahavard365, nobitex: unreachable from this host (foreign IP). BrsApi.ir (TSETMC data API) reachable but requires an API key (401 without).
- Yahoo Finance: 429; Stooq: JS proof-of-work wall.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every listed symbol is real (Priority: P1)

The trader only ever sees symbols whose prices come from a real market source. Nothing demo, simulated or generated remains anywhere in the product (chart, tickers, watchlist, screener, live stream, depth, gold-bubble view, TSE tape).

**Independent Test**: every symbol returned by `/api/symbols` (any query/category) returns candles whose `source` is a real provider, and the last close matches that provider directly (FR-010 audit).

**Acceptance Scenarios**:
1. **Given** `/api/symbols?category=all`, **Then** no entry has a demo/synthetic source and every entry has `source` and `dataStatus` fields.
2. **Given** a former demo symbol with no real source (e.g. `FOOLAD` while no TSE source is configured), **Then** `/api/candles`, `/api/tickers`, `/ws/live` and `/api/depth` answer `404 unknown_symbol` and it is absent from search, watchlists defaults and screener.
3. **Given** a saved layout or watchlist that references a removed symbol, **Then** the app shows «این نماد دیگر پشتیبانی نمی‌شود» / "This symbol is no longer supported" in place and does not crash.

### User Story 2 - TradingView-grade global coverage (Priority: P1)

The trader searches any global instrument (forex, metals, energy, indices, US/EU stocks, ETFs, bonds/yields, crypto on major exchanges) and gets the same symbols and prices TradingView shows for free users.

**Acceptance Scenarios**:
1. **Given** search text `EURUSD`, `AAPL`, `XAUUSD`, `SPX`, `USOIL`, `DXY`, `US10Y`, **Then** results list the TradingView exchange-qualified symbols (`OANDA:EURUSD`, `NASDAQ:AAPL`, …) with exchange, type and description; selecting one charts it.
2. **Given** `NASDAQ:AAPL` on `D`, **Then** the last close equals TradingView's for the same session.
3. **Given** a delayed instrument (TradingView `delay > 0`, e.g. `SP:SPX`), **Then** the topbar badge shows «تأخیر ۱۰ دقیقه» / "Delayed 10 min" — never LIVE.

### User Story 3 - Complete crypto spot (Priority: P1)

All Binance spot pairs that are trading are available, live, with order book.

**Acceptance Scenarios**:
1. **Given** search `USDT` category crypto, **Then** every Binance spot pair with status `TRADING` and quote USDT is listed (≥ 500), plus the other quotes (USDC, FDUSD, BTC, ETH, TRY, EUR…).
2. **Given** a delisted pair, **Then** it disappears from the catalogue within 24 h (catalogue refresh) and its candles answer 404.

### User Story 4 - Tehran gold, coins and currencies are real (Priority: P1)

Tehran gold (18k gram, mesghal/abshodeh), coins (Emami, Bahar, half, quarter, gram coin) and free-market currencies (USD, EUR, AED, USDT) show real TGJU prices in Toman with full daily history.

**Acceptance Scenarios**:
1. **Given** `IR:COIN_EMAMI` on `D`, **Then** bars equal TGJU `sekee` daily rows converted rial → Toman (÷10), since TGJU's first row.
2. **Given** an intraday timeframe on a TGJU symbol, **Then** the timeframe bar disables intraday ids for that symbol with tooltip «برای این نماد فقط داده‌ی روزانه موجود است» / "Only daily data is available for this symbol"; the API answers `400 timeframe_unavailable` for intraday.
3. **Given** the gold-bubble view, **Then** every input (global ounce, USD free market, coin market price) comes from real sources and is shown with its source and time.

### User Story 5 - Tehran Stock Exchange when a source exists (Priority: P2)

**Acceptance Scenarios**:
1. **Given** env `TC_BRSAPI_KEY` is set and valid, **Then** all TSE/IFB symbols from BrsApi are in the catalogue under category `iran_tse` with real daily history and intraday last price; **Given** it is unset, **Then** no TSE symbol, TSE tape or TSE category is shown anywhere.
2. **Given** env `TC_TSETMC_PROXY` (an HTTP base URL reachable through Tailscale, running on an Iran-IP host) is set, **Then** it is used instead of / in addition to BrsApi.

### User Story 6 - Accuracy is continuously proven (Priority: P1)

**Acceptance Scenarios**:
1. **Given** the accuracy audit script, **When** it runs, **Then** for a stratified sample of ≥ 200 symbols (all categories) our last closed bar equals the provider's own response within one price tick, and it writes a JSON report with 0 mismatches.

### Edge Cases
- TradingView socket drop / ban → reconnect with backoff; serve last-good bars marked `source:"cache"` (014 FR-005 semantics); never generate.
- TradingView symbol with no free data (`permission denied`/`no_data`) → excluded from search results (verified at selection: 404 + notice), never shown as tradeable.
- Same instrument on several exchanges → keep TradingView's exchange-qualified id; default symbol list uses the canonical liquid venue (OANDA forex/metals, TVC energy/indices, primary listing for stocks).
- Market closed → last session bars; badge «بازار بسته است» / "Market closed".
- Legacy bare ids in saved state (`EURUSD`, `XAUUSD`, `BTCUSDT`) → mapped by an alias table to the new ids.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST hold ONE shared TradingView client (server-side only; browsers never connect to TradingView) using the public chart WebSocket with `unauthorized_user_token`: multiplexed series per (symbol, timeframe), heartbeat echo, reconnect with exponential backoff (1 s → 60 s), ≤ 1 socket per 50 active series, global request rate ≤ 10 new series/s, and LRU-bounded caches (014 FR-010 budget).
- **FR-002**: `/api/candles` for a TradingView symbol MUST return TradingView's bars for the mapped resolution (`1s`→`1S`, minutes→digits, `D`/`W`/`M`, multiples as `ND`/`NW`/`NM`), honouring `limit`, `to_time` (paging via `request_more_data`) and plan `histBars`; bar times are TradingView's (exchange-session anchored — this supersedes 014 FR-002 alignment for session markets); `source:"tradingview"`, plus `exchange` and `delaySec`.
- **FR-003**: Live updates for TradingView symbols MUST come from the same client (`du` series updates / quote session `qsd`) and be pushed on `/ws/live` as 014 ticks; `/api/tickers` MUST use the TradingView quote session (`lp`, `ch`, `chp`, `high_price`, `low_price`, `volume`).
- **FR-004**: `/api/symbols` MUST be a real catalogue: (a) static curated defaults per category from real sources; (b) `q` search proxies TradingView symbol search (server-side, cached 10 min, ≤ 50 results) merged with local Binance/TGJU/TSE entries; every entry has `symbol` (exchange-qualified id), `name`, `nameFa` (curated list or `name`), `exchange`, `type`, `category`, `currency`, `source` (`binance`|`tradingview`|`tgju`|`brsapi`|`tsetmc_proxy`), `dataStatus` (`live`|`delayed`|`eod`), `delaySec`, `timeframes` (allowed list).
- **FR-005**: Crypto catalogue MUST include every Binance spot pair with status `TRADING` (refreshed every 24 h from `exchangeInfo`), served by the existing 014 Binance path; ids `BINANCE:<PAIR>` with alias of bare `<PAIR>`.
- **FR-006**: Tehran gold/coins/FX MUST be served from TGJU daily history (rial ÷ 10 → Toman, OHLC column order verified against TGJU's table header), cached 10 min; live price = TGJU current value polled ≤ every 60 s; only `D`, `W`, `M` (and multiples) allowed, intraday → `400 timeframe_unavailable`. Mapping table (id → TGJU slug) MUST be verified by a test that every slug returns ≥ 1000 rows.
- **FR-007**: TSE/IFB MUST be enabled only when `TC_BRSAPI_KEY` (BrsApi.ir) or `TC_TSETMC_PROXY` is configured and its health probe passes; otherwise no `iran_tse` symbol, category, tape view or screener row exists.
- **FR-008**: All demo/synthetic generation MUST be removed from user-facing paths: server/demoPath.js usage for catalogue symbols, simulated depth ladders (depth only for Binance symbols; others `404 depth_unavailable` and the DOM panel shows «دفتر سفارش برای این نماد در دسترس نیست»), the gold-snapshot formula with hard-coded prices, the TSE market tape with fake rows, and any fixed fallback prices. A symbol without a real source MUST answer `404 unknown_symbol` on every route.
- **FR-009**: The client MUST show per symbol: source and status badge (`LIVE` / «زنده», `Delayed N min` / «تأخیر N دقیقه», `EOD` / «پایان روز», `Market closed` / «بازار بسته است»), disable timeframes not in `timeframes`, map legacy ids via the alias table, and replace removed symbols in watchlists/layouts with the FR-001 US1-3 notice; symbol search shows exchange, type and source; the Market Data Pipeline dialog lists the real sources (Binance, TradingView, TGJU, and TSE only when enabled) with live health — no demo route.
- **FR-010**: `tools/accuracy_audit.mjs` (zero model tokens) MUST sample ≥ 200 catalogue symbols across all categories, fetch our `/api/candles` and the provider directly (Binance klines, TradingView socket, TGJU table), compare the last closed bar OHLC within one `minTick`, and write `.sdd/out/accuracy.json` `{checked, mismatches:[...]}`; exit 1 on any mismatch.
- **FR-011**: Default watchlist, screener universe and landing tickers MUST use real symbols only (e.g. `BINANCE:BTCUSDT`, `OANDA:XAUUSD`, `OANDA:EURUSD`, `TVC:USOIL`, `SP:SPX`, `NASDAQ:AAPL`, `IR:USD_FREE`, `IR:COIN_EMAMI`).

- **FR-012** (converge, post-merge production audit 2026-10-28): (a) catalogue/search ids MUST be the TradingView-resolvable ticker `PREFIX:SYMBOL` built from the search result's `prefix` (else `source_id`, else `exchange`) uppercased without spaces — e.g. `PEPPERSTONE:EURUSD`, `CAPITALCOM:DXY`, `FX:EURUSD` (FXCM) — while `exchange` keeps the display name; (b) an id whose prefix is not `BINANCE`, `IR` or `TSE` MUST NEVER be routed to Binance or any other source — unresolvable → 404 `unknown_symbol`; (c) search results MUST be verified resolvable (TradingView `resolve_symbol`, cached 24 h) before being returned, and carry `dataStatus`/`delaySec` from the resolved `delay` and `precision`/`minTick` from `pricescale`/`minmov`; (d) curated defaults MUST all resolve: replace `TVC:COPPER`→`COMEX:HG1!`, `TVC:NATGAS`→`NYMEX:NG1!`, `TVC:FTSE`→`TVC:UKX`, `AMEX:TLT`→`NASDAQ:TLT`, with every curated entry's `dataStatus` taken from the resolved delay; (e) `tools/accuracy_audit.mjs` MUST exit 1 when the server or a provider is unreachable (no "offline baseline"), MUST compare TradingView symbols too (via the same public socket), and MUST compare the last CLOSED bar exactly (≤ 1 minTick) instead of a 2 % tolerance.

## Success Criteria *(mandatory)*

- **SC-001**: 0 catalogue entries without a real source; 0 code paths reachable from HTTP/WS that generate prices (grep gate in review).
- **SC-002**: Catalogue size ≥ 1 300 local entries (Binance spot + TGJU + curated TradingView defaults) and search reaches TradingView's free universe (forex, metals, energy, indices, ≥ US/EU stocks and ETFs).
- **SC-003**: Accuracy audit: ≥ 200 symbols, 0 mismatches.
- **SC-004**: Full sweep (curated defaults × timeframes allowed per symbol) — 100 % HTTP 200, service restart counter unchanged (014 FR-010).
- **SC-005**: Every delayed/EOD symbol is labelled as such; zero delayed symbols labelled LIVE.

## Assumptions
- TradingView public data is used under the founder's decision; terms-of-service risk for commercial use is acknowledged (a licensed feed can replace FR-001 later behind the same interface).
- TSE becomes available as soon as the founder provides a BrsApi.ir key (free tier) or an Iran-IP relay; until then TSE is hidden (founder rule 3).
- Iranian gold/FX intraday history is unavailable from free sources; daily only.
- Supersedes: the demo parts of spec 005 (requirements 4, 10 and 13), spec 014 requirements 7, 8 and 9 (demo engine) and spec 014 requirement 2 alignment for session markets.
