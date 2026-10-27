# Implementation Plan: Data Feed & Timeframe Integrity

**Branch**: `014-data-feed-timeframes` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the three divergent timeframe grammars with one shared module (parse, bucket, aggregate), make crypto
history strictly real (native or aggregated Binance bars, honest history start, cached-or-503 on outage), replace
the `sin(t)` demo generator with a deterministic hierarchical price path that follows market sessions and feeds
candles, tickers, live ticks and the depth ladder from one source, bound server memory, and fix the client's live
bucketing, fake volume, fake fallback bar and custom-timeframe units.

## Technical Context

**Language**: JavaScript (Node ESM server, browser ES modules via Vite). **Dependencies**: none new.
**Storage**: in-memory only (LRU). **Testing**: `tests/acceptance/014/` against `$SDD_BASE_URL`; outage/heap tests
spawn their own server process on a free port with `TC_BINANCE_BASES=http://127.0.0.1:9` and
`--max-old-space-size=256`. **Performance**: p95 `/api/candles` ≤ 1.5 s for limit 2000 on a warm cache; demo
generation ≤ 50 ms per request; heap stays < 256 MB during the SC-001 sweep.

## Constitution Check

| Principle | Status |
|---|---|
| I Honest data | PASS — removes every fabricated crypto bar and the price-100 placeholder; demo stays labelled |
| II Spec before code | PASS — this spec |
| III Zero-defect real-browser QA | PASS — SC-004 browser matrix + UI probe |
| IV FA/EN parity | PASS — FR-012 notices in both languages, re-localized |
| V Mobile | PASS — notices fit 390 px, no overlap of controls |
| VI Security | PASS — no auth change; input validation tightened (400 on unknown timeframe) |
| VII Entitlements | PASS — `histBars`, `secondIntervals`, `customIntervals` unchanged and server-side cap kept |
| VIII Performance | PASS — bounded LRU, in-flight dedupe, OOM crash fixed |
| IX Minimal deps | PASS — none |
| X Hybrid SDD | PASS — Opus wrote docs only; Gemini implements per phase |

## Project Structure (files touched)

```
server/timeframes.js        NEW  parseTimeframe, bucketStart, nextBucket, aggregate (pure, isomorphic)
server/marketSessions.js    NEW  session calendar per category; isSessionDay, sessionWindows(dayMs)
server/demoPath.js          NEW  deterministic daily layer + on-demand minute/second bridge; demoBars(), demoPrice()
server/lru.js               NEW  bounded LRU (cost = bars) + in-flight dedupe helper
server/dataFeed.js          crypto fetch (native/aggregated, honest end, bases from env, last-good), getCandles
                            routing + source, get24hTicker for demo markets from demoPath, remove generateContinuousBars use
server/index.js             /api/candles: parse via timeframes.js, seconds→ms, from>to, response {timeframe, intervalMs,
                            source}, X-Data-Source, 503 upstream_unavailable; ws tick for demo via demoPrice
server/depthFeed.js         simulated ladder mid = demo price (via get24hTicker, unchanged call)
client/src/timeframes.js    NEW  byte-identical copy of server/timeframes.js logic (ESM)
client/src/universalProvider.js  bucketing via timeframes.js, no tick volume, 15 s/roll refresh, no fake bar,
                            exposes last `source` per (symbol, tf); supportedTimeframes from grammar
client/src/chartManager.js  data notice overlay (FR-012) driven by provider source/empty state; re-localize
client/src/timeframeManager.js  custom units s/m/h/D/W/M with ids per FR-001
client/src/i18n.js          FA/EN strings for the two notices
client/styles/main.css      notice styling (both themes, mobile)
```

## Phases (≤ 8 tasks each; see tasks.md)

1. Server timeframe core + crypto honesty + memory (FR-001..005, FR-010)
2. Demo engine: sessions, deterministic path, consistent ticker/ws/depth (FR-006..009)
3. Client: live bucketing, no fabricated bar, notices, custom units, timeframe switching (FR-011..013)

## Risks

- Vela rendering an empty series: verified in code that `safeBars` already returns `[]` on errors; PineTS live
  provider receives `[]` — implementer must confirm zero console errors (SC-004) and guard indicator start only if
  needed, never by injecting a bar.
- Upstream page budget for small aggregated timeframes (e.g. `45` from `15m`, 2000 bars → 6000 source bars, 6 pages) is
  within 20 pages; `5s` from `1s` with limit 2000 → 10 pages.
- Existing locked 005 test asserting the price-100 seed bar is superseded; the architect amends it on the base branch
  before Phase 3.
