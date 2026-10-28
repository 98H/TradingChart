# Research — 015 Real Symbol Universe

## R1. TradingView public chart socket (founder decision 1)
- Endpoint `wss://data.tradingview.com/socket.io/websocket?type=chart`, header `Origin: https://www.tradingview.com`.
- Framing `~m~<len>~m~<json>`; heartbeats `~h~N` must be echoed verbatim.
- Messages: `set_auth_token ["unauthorized_user_token"]`, `chart_create_session [cs,""]`,
  `resolve_symbol [cs, sym_id, "=" + JSON({symbol, adjustment:"splits", session:"regular"})]`,
  `create_series [cs, series_id, "s1", sym_id, resolution, count, ""]`, `request_more_data [cs, series_id, n]` for paging,
  `quote_create_session [qs]`, `quote_set_fields [qs, "lp","ch","chp","high_price","low_price","volume","lp_time","update_mode"]`, `quote_add_symbols [qs, sym]`.
- Responses: `symbol_resolved` (name, exchange, type, timezone, session, pricescale, minmov, `delay` seconds),
  `timescale_update` / `du` (bars `{i, v:[t_sec,o,h,l,c,vol]}`), `series_completed`, `symbol_error`, `qsd` (quotes).
- Verified from host 2026-10-28: OANDA:EURUSD 60 → 5000 bars; NASDAQ:AAPL D since 2006; OANDA:XAUUSD 1; SP:SPX D `delay:600`;
  TVC:USOIL 240; FX_IDC:USDIRR D; BINANCE:BTCUSDT 1. `TSE:FOOLAD` → `invalid symbol`.
- Risk: commercial-use ToS and IP rate-limiting. Mitigation: one shared server connection pool, caching, rate cap, backoff; the
  client module sits behind a provider interface so a licensed feed can replace it.

## R2. Symbol search
- `GET https://symbol-search.tradingview.com/symbol_search/v3/?text=<q>&hl=0&exchange=&lang=en&search_type=<type>&domain=production`
  with `Origin: https://www.tradingview.com` → `{symbols_remaining, symbols:[{symbol, description, type, exchange, currency_code, prefix?}]}`
  (description may contain `<em>` tags → strip). Verified reachable.

## R3. Crypto
- Binance spot `exchangeInfo` 1 383 TRADING pairs (516 USDT) — reuse 014 Binance path. Futures blocked (geo) → out of scope.

## R4. Tehran gold / coins / FX — TGJU
- `GET https://api.tgju.org/v1/market/indicator/summary-table-data/<slug>?start=0&length=N` → `{recordsTotal, data:[[open, low, high, close, change_html, pct_html, "YYYY/MM/DD", "jalali"], ...]}` newest first, values rial with thousands separators. **Column order must be verified** against the TGJU history page header during implementation (test asserts low ≤ open,close ≤ high per row to detect a wrong order).
- Slugs verified with data: `price_dollar_rl` (3988 rows), `sekee` (4326), `geram18` (3538), `mesghal` (3542). Candidates to verify by test (≥1000 rows): `sekeb` (Bahar), `nim`, `rob`, `gerami`, `price_eur`, `price_aed`, `crypto-tether-irr` (or TGJU's USDT slug), `geram24`.
- Daily only.

## R5. Tehran Stock Exchange
- tsetmc.com/cdn.tsetmc.com/codal/rahavard365 unreachable from the foreign host; TradingView has no TSE.
- BrsApi.ir (`https://Api.BrsApi.ir/Tsetmc/AllSymbols.php?key=…`, history endpoints) reachable, requires key (free tier on request) → `TC_BRSAPI_KEY`.
- Alternative: tiny relay on any Iran-IP machine joined to Tailscale, forwarding tsetmc CDN → `TC_TSETMC_PROXY`.
- Without either, TSE is hidden (founder rule 3).

## R6. Demo removal inventory (code paths to delete or gate)
server/demoPath.js, server/marketSessions.js (keep only if used for "market closed" badge from TradingView session string — otherwise remove),
server/dataFeed.js (`getGoldMarketSnapshot` formula, `getTseMarketTape`, demo branches, `get24hTicker` demo), server/depthFeed.js (simulated ladder),
server/symbolCatalog.js (static demo entries), server/technicalScreener.js (universe), client/src/depthOfMarket.js (simulated badge),
client/src/goldBubbleView.js, client/src/tseTapeView.js, client/src/marketSourcesModal.js (demo routes), client/src/main.js `updateTopbarSourceBadge` DEMO labels.

## R7. Ids
- Canonical id = TradingView-style `EXCHANGE:SYMBOL` for TradingView symbols, `BINANCE:<PAIR>` for crypto, `IR:<NAME>` for TGJU, `TSE:<ticker>` for TSE.
- `cleanSymbol` in server/index.js currently strips the prefix — must keep it (allow `[A-Z0-9_]+:[A-Z0-9._!-]+`, ≤ 40 chars).
- Alias table for legacy bare ids: BTCUSDT→BINANCE:BTCUSDT (any *USDT pair), EURUSD→OANDA:EURUSD, XAUUSD→OANDA:XAUUSD, XAGUSD→OANDA:XAGUSD, USOIL→TVC:USOIL, UKOIL→TVC:UKOIL, NATGAS→TVC:NATGAS? (verify) , SPX→SP:SPX, NDX→NASDAQ:NDX, DJI→DJ:DJI, AAPL→NASDAQ:AAPL, NVDA/TSLA/MSFT/AMZN/GOOGL/META→NASDAQ:*, GOLD_18K→IR:GOLD_18K, COIN_EMAMI→IR:COIN_EMAMI, USD_TEHRAN→IR:USD_FREE, …
