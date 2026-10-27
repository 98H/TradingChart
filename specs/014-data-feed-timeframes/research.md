# Research — 014 Data Feed & Timeframe Integrity

## R1. One timeframe module shared by server and client
- **Decision**: `server/timeframes.js` (ESM, no Node APIs) exports `parseTimeframe(id) → {canonical, unit, count, intervalMs}|null`, `bucketStart(tf, ms)`, `nextBucket(tf, start)`, `aggregate(bars, tf)`. The client imports a copy `client/src/timeframes.js` with identical code (Vite cannot import from `server/`); an acceptance test compares both modules' outputs.
- **Rationale**: the audit found three divergent grammars (server `INTERVAL_MAP`, server regex, client `getIntervalMs`); every unknown id silently became 1 h.
- **Alternatives**: keep maps and add entries — rejected, the grammar is open-ended (custom timeframes).

## R2. Bucket alignment
- **Decision**: sub-day = epoch modulo; `ND` = epoch-day index mod N; `NW` = Monday-anchored (1970-01-05) week index mod N; `NM` = calendar month index mod N. Verified live: Binance `1w` opens Monday 00:00 UTC, `1M` on the 1st; Binance `3d` opens on epoch-day ≡ 1 (mod 3), so `3D` is aggregated from `1d` to keep one rule.
- **Rationale**: TradingView-like boundaries; identical on every market.

## R3. Crypto aggregation source
- **Decision**: native Binance interval when equal; otherwise the largest native interval whose length divides the target and whose boundaries nest (seconds: `1s`; minutes: 1m/3m/5m/15m/30m; hours: 1h/2h/4h/6h/8h/12h; days: 1d; weeks: 1w; months: 1M). Fetch `limit × ratio` source bars, ≤ 20 pages of 1000; if the page budget is exhausted return fewer target bars (oldest first trimmed) rather than partial buckets — the oldest target bucket is dropped if not fully covered.
- **Pagination end**: a page shorter than requested or empty = start of history → stop, return what was collected (fixes TON/TAO 404 and the 2013 price-100 padding).

## R4. Upstream failure for crypto
- **Decision**: a per (symbol, canonical tf) "last good" store (bounded with the LRU of R6, 24 h max age) serves `source:"cache"`; otherwise 503 `upstream_unavailable`. `TC_BINANCE_BASES` lets tests point at an unreachable host (e.g. `http://127.0.0.1:9`).
- **Rationale**: constitution I (honest data) — a price-100 "BTC" chart is a fabricated number.

## R5. Demo price path (deterministic, consistent across timeframes)
- **Decision**: a hierarchical deterministic path per symbol, seeded by a 32-bit hash of the symbol (e.g. mulberry32/xorshift; no `Math.random`, no `Date.now()` in the path):
  1. **Daily layer**: from 2000-01-03, a seeded random walk over *session days only* (FR-008) produces each day's `open, high, low, close, volume` (open = previous close; drift-free; volatility from the existing per-symbol table; TSE daily move clamped to ±4.5 %). The walk is computed once per symbol and memoised (≈ 7 000 numbers).
  2. **Intraday layer**: for a given session day, the minute path is generated on demand from a seed (symbol, day): a Brownian bridge from `open` to `close` that is forced through `high` and `low` at two seeded minutes of the session and clamped to `[low, high]`; minute volumes are an integer split of the day volume by seeded weights. Therefore the aggregate of a day's minutes equals the daily bar exactly, and every intraday timeframe (aggregate of minutes) is consistent.
  3. **Seconds layer**: same bridge inside a minute (60 points through the minute's OHLC).
  4. **Forming bar**: only path points with time ≤ now are aggregated; "now" price = last point ≤ now; ticker/ws/depth read the same function.
  Prices rounded to the symbol's `precision`/`minTick` after the bridge; the high/low points are rounded first so rounding never violates `low ≤ o,c ≤ high`.
- **Cost**: 1500 hourly bars need ~62 session days × ≤1440 minutes ≈ 90 k points (< 20 ms); daily/weekly/monthly use only the daily layer. Minute-day arrays are cached in the bounded LRU (R6).
- **Alternatives**: generate everything from minutes since 2000 — rejected (≈ 10 M points); keep the current `sin(t)` generator — rejected (not stable across requests, unaligned, inconsistent).

## R6. Memory safety
- **Decision**: one LRU keyed by request (bars count as cost), total ≤ 300 000 bars; minute-day arrays of R5 share the budget; in-flight `Map<key, Promise>` dedupes concurrent identical requests. The audit crash (heap OOM at 256 MB) came from an unbounded `candleCache` keyed by (symbol, tf, limit, from, to) never evicted.

## R7. Client live bucketing
- **Decision**: the provider uses `bucketStart()` from R1 for every tick; volume is never incremented by ticks; on bucket roll and every 15 s it fetches `limit=2` for the active (symbol, tf) and replaces the forming bar. Fixes weekly/monthly mis-bucketing and the `1M`=1-minute confusion.

## R8. No fabricated client bar
- **Decision**: provider returns `[]` when there is no data; Vela tolerates an empty series (its own `safeBars` returns `[]` on errors). The PineTS seed-bar crash noted in the parity skill is guarded inside the PineTS live provider (`toKlines`), not by feeding a fake bar to the chart; the chart overlay shows the FR-012 notice. 005 FR-009's "neutral seed bar" is superseded; its locked test is amended by the architect.

## Spec/code mismatches found
- 005 FR-001 regex accepted `5s`, `45`, `7`, `3D` but the server mapped them to 1 h.
- 005 FR-004 allowed generated crypto bars → superseded by FR-004/FR-005 here.
- Inventory "WebSocket tick 1200 ms" correct; ticker for demo markets was disconnected from candles (FR-009).
