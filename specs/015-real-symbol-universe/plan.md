# Implementation Plan: Real Symbol Universe

**Branch**: `015-real-symbol-universe` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

## Summary
Add a server-side TradingView data client (candles, paging, live, quotes, search) and a TGJU daily client; expand crypto to all
Binance spot pairs; gate TSE behind a real source; delete every demo/synthetic price path; give the client real source/status
badges, per-symbol timeframes and legacy-id aliases; prove accuracy with a zero-token audit against the providers.

## Technical Context
JavaScript (Node ESM, `ws` already a dependency); no new dependency. In-memory LRU (server/lru.js). Tests: `tests/acceptance/015/`
against `$SDD_BASE_URL`; provider comparisons hit Binance/TradingView/TGJU directly.

## Constitution Check
I Honest data — PASS (the feature *is* this principle; demo removed). II — PASS. III — PASS (browser suite FA/EN, mobile/desktop).
IV — PASS (badges, notices FA/EN). V — PASS. VI — PASS (TradingView only server-side; keys via env; no secrets in client).
VII — PASS (`histBars` unchanged). VIII — PASS (bounded caches, pooled sockets, rate cap). IX — PASS (no new deps). X — PASS.

## Files
```
server/tradingviewClient.js   NEW  pooled socket client: resolve, series, paging, live updates, quote session, search, rate cap
server/tgjuClient.js          NEW  TGJU daily history + current value, slug map, rial→Toman
server/tseSource.js           NEW  BrsApi / relay adapter, health probe, disabled when unconfigured
server/symbolCatalog.js       real catalogue: Binance exchangeInfo (24 h refresh), curated TradingView defaults, TGJU map, TSE (if enabled), aliases, search merge
server/dataFeed.js            routing by source; remove demo; tickers via providers; market-sources real health
server/depthFeed.js           Binance only; others 404 depth_unavailable
server/index.js               cleanSymbol keeps EXCHANGE:SYMBOL; /api/candles errors timeframe_unavailable/unknown_symbol; ws ticks from providers; gold-snapshot & tse-tape real or 404
server/technicalScreener.js   real universe
server/demoPath.js, server/marketSessions.js   DELETE (unless marketSessions is reused for badges)
client/src/universalProvider.js  exchange-qualified ids, aliases, per-symbol timeframes, source/status
client/src/main.js            topbar badge LIVE/Delayed/EOD/Market closed; symbol search shows exchange/type/source; removed-symbol notice
client/src/watchlistManager.js  real defaults, removed-symbol notice, alias migration
client/src/marketSourcesModal.js  real sources only
client/src/depthOfMarket.js   unavailable state
client/src/goldBubbleView.js  real inputs with source/time
client/src/tseTapeView.js     hidden unless TSE enabled
client/src/timeframeManager.js  disable timeframes not allowed for the symbol
client/src/i18n.js            FA/EN strings
tools/accuracy_audit.mjs      NEW  zero-token provider comparison
```

## Phases (tasks.md)
1. TradingView client + routing for TradingView symbols (FR-001..003)
2. Real catalogue: Binance full, curated TradingView, search, aliases (FR-004, FR-005, FR-011)
3. TGJU + TSE gating (FR-006, FR-007)
4. Demo removal everywhere (FR-008)
5. Client UX + accuracy audit (FR-009, FR-010)
