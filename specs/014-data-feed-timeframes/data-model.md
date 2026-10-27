# Data model — 014 Data Feed & Timeframe Integrity

## Timeframe (server/timeframes.js, client/src/timeframes.js)
| Field | Type | Rules |
|---|---|---|
| canonical | string | `Ns` · digits (minutes, 1h → `60`) · `D`/`ND` · `W`/`NW` · `M`/`NM` |
| unit | `'s'\|'m'\|'D'\|'W'\|'M'` | hours normalise to minutes |
| count | int | s 1–59, m 1–1440, D 1–365, W 1–52, M 1–12 |
| intervalMs | number | nominal; month = 2 592 000 000 |

Parsing table (input → canonical): `1s`,`1S`→`1s` · `1`,`1m`→`1` · `45`→`45` · `1h`,`1H`,`60`→`60` · `4h`→`240` ·
`D`,`1D`,`1d`→`D` · `3D`→`3D` · `W`,`1W`,`1w`→`W` · `2W`→`2W` · `M`,`1M`→`M` · `3M`→`3M`.
Invalid: `0`, `1441`, `60s`, `25h`, `7X`, `invalid_tf`, empty.

Functions: `bucketStart(tf, ms)`, `nextBucket(tf, startMs)`, `aggregate(bars, tf)` (groups by `bucketStart`,
OHLCV rules of FR-003, sets `closeTime = nextBucket − 1`).

## Session calendar (server/marketSessions.js)
| Category | Days (UTC) | Window (UTC) |
|---|---|---|
| crypto | every day | 00:00–24:00 |
| forex, metals, commodities | Mon–Fri (Fri ends 22:00) | Mon 00:00 → Fri 22:00 continuous |
| stocks, indices | Mon–Fri | 13:30–20:00 |
| iran_tse | Sat–Wed | 05:30–09:00 |
| iran_gold (gold, coins, FX) | Sat–Thu | 06:30–15:30 |

## Demo path (server/demoPath.js)
- `dailyLayer(symbol)` → memoised array of session days since 2000-01-03: `{day, open, high, low, close, volume}`.
- `minuteBars(symbol, dayMs)` → session minutes of that day; aggregate == daily bar exactly.
- `secondBars(symbol, minuteMs)` → 60 points; aggregate == minute bar.
- `demoBars(symbol, tf, {limit, to})` → bars per FR-002/FR-008, forming bar cut at now.
- `demoPrice(symbol, now)` → last path point ≤ now (or last session close when closed).

## Caches (server/lru.js)
| Store | Key | Cost | Bound |
|---|---|---|---|
| response LRU | `symbol|canonical|limit|from|to` | bars | shared 300 000 bars total |
| last-good (crypto) | `symbol|canonical` | bars | same budget, 24 h max age |
| minute-day cache | `symbol|day` | minutes | same budget |
| in-flight | request key | — | entries removed on settle |

## Candle response (`GET /api/candles`)
`{ symbol, timeframe (canonical), intervalMs, source: "binance"|"demo"|"cache", count, candles: [{time, open, high, low, close, volume, closeTime}] }`
