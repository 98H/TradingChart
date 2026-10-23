# Feature Specification: Market Data Feed

**Feature Branch**: `005-market-data-feed` (retrofit)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Serve candles, tickers, order-book depth and a live stream for every market in the catalogue — crypto live from Binance with mirrors, everything else as clearly-labelled demo data — never crash the chart when a source is down, and always tell the user honestly which data is live and which is demo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Candles for any catalogue market (Priority: P1)

The chart asks the server for historical candles of any catalogue symbol and interval; crypto comes from Binance (with mirrors), other markets from deterministic continuous demo series; the amount of history follows the user's plan.

**Why this priority**: Every chart, indicator and backtest depends on candles.

**Independent Test**: Request BTCUSDT 60 and XAUUSD D; both return candles in the documented shape; a guest gets at most 10 000 bars and the `X-History-Limit` header.

**Acceptance Scenarios**:

1. **Given** a valid symbol and timeframe, **When** `GET /api/candles` is called, **Then** it returns `{symbol, timeframe, count, candles[]}` with time, open, high, low, close, volume, closeTime.
2. **Given** a malformed symbol, timeframe or time bound, **Then** the response is `400` with `invalid_symbol`, `invalid_timeframe` or `invalid_time`.
3. **Given** a guest or Basic user requesting `limit=50000`, **Then** at most 10 000 candles are returned and `X-History-Limit: 10000` is set; a Premium user gets up to 20 000.
4. **Given** Binance is unreachable, **When** crypto candles are requested, **Then** the server falls back to mirrors and then to a continuous series instead of failing.

---

### User Story 2 - Live updates (Priority: P1)

The chart subscribes to symbols over the live WebSocket and its last candle updates in real time; if the connection drops it reconnects.

**Independent Test**: Open a socket, subscribe to ETHUSDT, receive a `tick` within 3 s; close the server side and see the client reconnect.

**Acceptance Scenarios**:

1. **Given** a connection to `/ws/live`, **When** the client sends `{action:"subscribe", symbol}`, **Then** it receives `tick` messages for that symbol about every 1.2 s.
2. **Given** ticks arriving faster than 250 ms, **Then** the chart's last candle is updated at most every 250 ms.
3. **Given** the socket closes, **Then** the client reconnects after 3 s.
4. **Given** the server already has the configured maximum of clients, **Then** a new connection is closed with code 1013 "busy".

---

### User Story 3 - Honest source labelling (Priority: P1)

The topbar shows where the current market's data comes from — "LIVE" for Binance crypto, "DEMO" for every other market — and a Market Data Pipeline dialog shows each source's status and latency with a ping test.

**Independent Test**: Switch to BTCUSDT (LIVE) and to a Tehran stock (DEMO, demo styling); open the pipeline dialog and run the ping test.

**Acceptance Scenarios**:

1. **Given** a crypto symbol, **Then** the topbar source badge shows BINANCE / LIVE; **given** Tehran stocks, Tehran gold, Tehran FX, forex, commodities or US stocks, **Then** it shows the market name and DEMO, and the topbar is marked as a demo feed.
2. **Given** the pipeline dialog, **Then** it lists the sources with status (online / degraded / demo), latency and markets covered, and "Ping Test" refreshes them.
3. **Given** Binance does not answer within 4 s, **Then** its source is reported `degraded`.

---

### User Story 4 - Depth of market (Priority: P2)

A trader opens the Depth of Market panel and sees a 12-level bid/ask ladder with spread, labelled Live · Binance or Simulated, and can place paper market or one-click limit orders from it.

**Acceptance Scenarios**:

1. **Given** the DOM panel for BTCUSDT, **Then** bids, asks, spread and mark price are shown and refreshed every 1.5 s while the panel is visible.
2. **Given** a non-crypto symbol, **Then** the ladder is simulated around the 24 h price and labelled "Simulated".
3. **Given** quantity 0.05 and a click on MARKET BUY, **Then** a paper market buy of 0.05 is executed and confirmed by a toast; clicking "+ Buy" on a bid row places a paper limit buy at that price.

---

### User Story 5 - Symbol catalogue (Priority: P2)

The symbol search queries a universal catalogue (crypto, metals, commodities, forex, indices, US stocks, Tehran gold & currencies, Tehran stocks) by text, category and exchange.

**Acceptance Scenarios**:

1. **Given** `GET /api/symbols?q=SOL`, **Then** only matching instruments are returned with metadata (precision, min tick, lot size, exchange, currency, Persian names).
2. **Given** `GET /api/symbol-info?symbol=XAUUSD`, **Then** its metadata is returned; a malformed symbol gives `400 invalid_symbol`.

---

### Edge Cases

- Network failure on the client → the chart keeps its cached series (or a neutral seed bar) so indicator engines never receive an empty series.
- More than 40 symbols in a ticker request → only the first 40 are served.
- More than 50 subscriptions on one socket → extra subscriptions are ignored.
- WebSocket frames larger than 4096 bytes are rejected.
- `levels` outside 1..50 on `/api/depth` is clamped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `GET /api/candles` MUST accept `symbol` (sanitised, default BTCUSDT), `timeframe` (matching `^[0-9]{1,4}[smhdwSMHDW]?$` or `D`/`W`/`M`, default 60), `limit` (default 500), optional `from_time` / `to_time`, and return `{symbol, timeframe, count, candles[]}` with `time, open, high, low, close, volume, closeTime`.
- **FR-002**: `GET /api/candles` MUST answer `400 {ok:false,error}` with `invalid_symbol`, `invalid_timeframe` or `invalid_time` for malformed input, `404` with `error:"no_market_data"` and an empty list when no data exists, and `500 internal_error` on unexpected failure.
- **FR-003**: `GET /api/candles` MUST clamp `limit` to the caller's plan `histBars` (guests: Basic) and send `X-History-Limit` with that cap.
- **FR-004**: Crypto candles MUST come from `data-api.binance.vision`, falling back to `api.binance.com` and `api.binance.us`, then to a deterministic continuous series; non-crypto markets MUST be served from deterministic continuous demo series.
- **FR-005**: Candle responses MUST be cached server-side for 3 s per (symbol, timeframe, limit, from, to).
- **FR-006**: `GET /api/tickers` MUST accept up to 40 comma-separated symbols (default BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XAUUSD, EURUSD) and return per symbol `lastPrice, priceChange, priceChangePercent, highPrice, lowPrice, volume, quoteVolume, exchange, category, currency`; malformed symbols → `400 invalid_symbol`.
- **FR-007**: `GET /api/symbols` MUST filter the universal catalogue by `q` (≤ 64 chars), `category` and `exchange` (≤ 32 chars, default `all`) and return instrument metadata including Persian names; `GET /api/symbol-info` MUST return one instrument's metadata or `400 invalid_symbol`.
- **FR-008**: `/ws/live` MUST accept `subscribe` / `unsubscribe` messages for single symbols (≤ 50 per socket, frames ≤ 4096 bytes), broadcast `tick` messages (`symbol, price, change, changePct, high, low, volume, time`) about every 1200 ms, and refuse connections beyond `TC_MAX_WS` (default 2000) with close code 1013 "busy".
- **FR-009**: The client data provider MUST update the current candle from ticks at most every 250 ms, reconnect the socket 3 s after a drop, and on fetch failure serve the cached series (or a neutral seed bar) instead of an empty series.
- **FR-010**: The topbar MUST show the data source of the current market: BINANCE / LIVE for crypto; for Tehran stocks, Tehran gold, Tehran FX, forex, commodities and US stocks the market name with DEMO and the demo-feed styling, in the current language.
- **FR-011**: `GET /api/market-sources` MUST return `{timestamp, overallStatus, liveCount, sources[]}` with per source `id, name, nameFa, status (online|degraded|demo), latencyMs, live, protocol, protocolFa, marketsCovered, marketsCoveredFa, tier, activeSymbols`; Binance MUST be reported `degraded` when its ping fails or exceeds 4 s (probe cached 30 s).
- **FR-012**: The Market Data Pipeline dialog MUST open from the topbar source badge, render the sources with status and latency, refresh them with "Ping Test", and close from its close button or the backdrop.
- **FR-013**: `GET /api/depth` MUST return `{symbol, lastPrice, spread, spreadPct, bids[], asks[], maxDepth, source, simulated, timestamp}` with `levels` clamped to 1..50 (default 15): mirrored from Binance for crypto, otherwise simulated around the 24 h price with `source:"simulated"`; results cached 1.5 s.
- **FR-014**: The Depth of Market panel MUST show a 12-level ladder, spread, mark price and a Live · Binance / Simulated badge, poll every 1.5 s only while visible, and allow paper market buy/sell with a quantity stepper (step 0.05, minimum 0.01) and one-click limit orders from ladder rows; it MUST show the locked placeholder when the plan lacks `depthOfMarket`.
- **FR-015**: Synthetic chart styles (Renko, Kagi, Line Break, Range, Point & Figure, Hollow, Volume candles) MUST be computed client-side from the provider's candles.

### Key Entities

- **Candle**: time, open, high, low, close, volume, closeTime.
- **Ticker**: 24 h statistics plus exchange, category and currency.
- **Instrument**: catalogue metadata (precision, min tick, lot size, exchange, market, currency, Persian names).
- **Data Source**: id, names, status, latency, live flag, protocol, markets covered, tier.
- **Depth Snapshot**: bid/ask levels with size and cumulative total, spread, source.
- **Tick**: live price update for a subscribed symbol.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of catalogue symbols return candles (live or demo) for the default interval; none returns a server error.
- **SC-002**: 100% of candle responses respect the plan's `histBars` cap.
- **SC-003**: Every non-crypto market is labelled DEMO in the topbar and in the pipeline dialog; zero demo markets are labelled live.
- **SC-004**: A subscribed client receives its first tick within 3 s.
- **SC-005**: With the upstream source unreachable, the chart still renders candles and indicators without console errors.

## Assumptions

- Only crypto has a live upstream today; all other markets are deterministic demo series and must be presented as such (constitution: honest data).
- Plan gates for `depthOfMarket` and `synthChartTypes` are client-side; server enforcement is a known gap for the Converge phase.
- Known gaps for Converge: silent error swallowing in socket and fetch paths, unused Binance mirrors for tickers and probe, every socket auto-subscribed to BTCUSDT, `$` shown for Toman/Rial instruments in the DOM ladder, untranslated "FOREX" and "Error searching symbols" strings, and no error state in the DOM panel and pipeline dialog.
