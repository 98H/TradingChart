# Contract — Market data (015 owns it; extends 014)

## GET /api/symbols?q=&category=&exchange=&limit=
200 `CatalogEntry[]` (≤ 200 local; with `q`, merged TradingView search ≤ 50). Never contains non-real entries.

## GET /api/symbol-info?symbol=
200 `CatalogEntry` · 404 `{ok:false,error:"unknown_symbol"}` (aliases resolved).

## GET /api/candles
As 014, plus: `source` ∈ binance|tradingview|tgju|brsapi|tsetmc_proxy|cache, `exchange`, `delaySec`.
Errors added: 404 `unknown_symbol` (no real source), 400 `timeframe_unavailable` (not in entry.timeframes).
Bar times: provider's (TradingView exchange-session anchored; TGJU daily 00:00 UTC of the Gregorian date; Binance per 014).

## GET /api/tickers?symbols=
Per symbol: `{symbol, lastPrice, priceChange, priceChangePercent, highPrice, lowPrice, volume, exchange, category, currency, source, dataStatus, delaySec, time}`. Unknown → omitted and listed in `unknown:[]`… (response stays an array; unknown symbols are skipped).

## /ws/live
Ticks only for real symbols from their provider; subscribe to an unknown symbol → `{type:"error", error:"unknown_symbol", symbol}`.

## GET /api/depth
Binance symbols only; others 404 `depth_unavailable`.

## GET /api/gold-snapshot
Real inputs only `{ounceUsd:{value,source,time}, usdFree:{…}, coins:{emami:{market,intrinsic,bubblePct,source,time},…}}`; 503 when a source is down.

## GET /api/tse-tape
404 `tse_unavailable` unless a TSE source is enabled.

## GET /api/market-sources
`sources[]` only real: binance, tradingview, tgju, (brsapi|tsetmc_proxy when enabled) with live health/latency.

## Env
`TC_BRSAPI_KEY`, `TC_TSETMC_PROXY`, `TC_TV_MAX_SERIES_PER_SOCKET` (default 50), `TC_TV_RATE` (default 10/s).
