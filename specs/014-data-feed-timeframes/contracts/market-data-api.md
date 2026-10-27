# HTTP / WS contract — Market data (owned by 014 from now on)

## GET /api/candles
Query: `symbol` (default BTCUSDT), `timeframe` (FR-001 grammar, default `60`), `limit` (default 500, clamped to plan
`histBars`), `from_time`, `to_time` (epoch ms; values < 10^11 are seconds).

200 headers: `X-History-Limit: <cap>`, `X-Data-Source: binance|demo|cache`
200 body:
```json
{ "symbol": "BTCUSDT", "timeframe": "45", "intervalMs": 2700000, "source": "binance", "count": 2,
  "candles": [ { "time": 1793124000000, "open": 1, "high": 2, "low": 0.5, "close": 1.5, "volume": 10, "closeTime": 1793126699999 } ] }
```
Errors:
- 400 `{ok:false,error:"invalid_symbol"}` · `invalid_timeframe` (anything outside FR-001) · `invalid_time` (non-numeric, or from > to)
- 404 `{symbol, timeframe, count:0, candles:[], error:"no_market_data"}` — unknown symbol, or no bars in the requested window
- 503 `{ok:false,error:"upstream_unavailable"}` — crypto upstream down and no last-good series
- 500 `{ok:false,error:"internal_error"}`

Rules: bars aligned per FR-002; crypto bars real only (FR-003/004); demo bars per FR-007/008; with `to_time` the
`limit` newest bars with `time ≤ to_time`; with `from_time` only bars with `time ≥ from_time`.

## GET /api/tickers  (unchanged shape)
Demo markets: `lastPrice` = demo path price now; `highPrice`/`lowPrice`/`priceChange`/`priceChangePercent` over the
last 24 h of the path (FR-009).

## /ws/live tick  (unchanged shape)
Demo markets: `price` = demo path price at `time` (FR-009).

## GET /api/depth  (unchanged shape)
Simulated ladder mid = `/api/tickers` lastPrice (FR-009).

## Environment
- `TC_BINANCE_BASES` — comma-separated base URLs (default
  `https://data-api.binance.vision/api/v3,https://api.binance.com/api/v3,https://api.binance.us/api/v3`). Used by
  klines, 24 h ticker, depth and the source probe.
