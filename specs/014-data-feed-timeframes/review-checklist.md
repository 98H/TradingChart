# Review checklist — 014 Data Feed & Timeframe Integrity (reviewer: check the diff against every item)

## Behaviour beyond tests
- [ ] No code path in server/ produces crypto bars that did not come from Binance (grep for any generator call reachable from the crypto branch).
- [ ] `generateContinuousBars` and the `sin(t)`/`Date.now()`-seeded generator are gone; demo bars use only the seeded path (no `Math.random`, no wall-clock inside the path except the forming-bar cut).
- [ ] One timeframe grammar: server/index.js, server/dataFeed.js and client/src/universalProvider.js all use timeframes.js; no leftover `INTERVAL_MAP`/`getIntervalMs` fallback to 1 h.
- [ ] Every cache is bounded (lru.js); no new unbounded `Map` keyed by request parameters.
- [ ] The client never constructs a bar with literal prices (100 or otherwise).

## Architecture boundaries
- [ ] No new dependency; server/timeframes.js and client/src/timeframes.js produce identical results.
- [ ] Plan cap (`histBars`) logic and `X-History-Limit` unchanged; `/api/candles` stays public.
- [ ] Response shape only gains `intervalMs` and `source`; existing fields keep their meaning.

## Forbidden shortcuts
- [ ] No test-specific branches, hard-coded symbols, dates, ports or env checks for tests.
- [ ] No change to tests/acceptance/**, specs/** or .sdd/**.
- [ ] Rate limiters not weakened.

## Copy and UX
- [ ] Notices use the exact FA/EN strings of FR-012, formal register, ZWNJ (بازه‌ی، ذخیره‌شده).
- [ ] Notices do not cover the timeframe bar, legend controls or bottom nav on 390 px; both themes readable.
