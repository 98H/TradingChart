# Feature Specification: Data Feed & Timeframe Integrity

**Feature Branch**: `014-data-feed-timeframes` (converge of 005-market-data-feed) — owns the `/api/candles` contract from now on

**Created**: 2026-10-27

**Status**: Draft — awaiting founder approval

**Input**: Founder intent (2026-10-27, verbatim): "در پلتفرم چارتیویا سورس‌های داده و نمایش آن‌ها را در تمام تایم‌فریم‌ها دیباگ، تکمیل، بی‌نقص و جامع کن."

## Architect audit (evidence, 2026-10-27, live server, 67 symbols × 17 timeframes = 1139 requests)

Every one of the 1139 combinations showed at least one defect:

1. `5s`, `45`, `7`, `3D`, `2W` (and every id outside a fixed map) are silently served as **1-hour** bars.
2. Demo markets (forex, metals, commodities, indices, US stocks, Tehran gold/FX, TSE): bar times are not aligned to the interval (e.g. `17:30:29`), history re-shifts on every request, there are no market sessions (weekend forex bars, 24/7 TSE), the daily close differs from the 1-minute close and from the ticker (FOOLAD: ticker 4868, 1m 4840, D 4852).
3. Crypto deep history is padded with **fabricated bars at price ≈100** before the listing date (BTCUSDT `D` limit 5000 starts 2013 at 100; `M` starts in 1903).
4. When Binance fails for a known crypto symbol the server returns fabricated bars at price ≈100 labelled as that coin (journal: "falling back to high-fidelity feed").
5. TONUSDT / TAOUSDT `D`/`W`/`M` with a deep limit return 404 (a page before the listing date aborts the whole request).
6. `to_time` in seconds is read as milliseconds (bars from 1970).
7. The server crashed with **JavaScript heap out of memory** (256 MB) during the sweep; the candle cache is unbounded.
8. Client: weekly and monthly live-tick buckets use a fixed 7/30-day epoch grid (wrong weekday/month); `1M` is treated as one minute; ticks add fake volume (+1 per tick); on failure a fake bar at price 100 is drawn.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every timeframe shows true bars of that timeframe (Priority: P1)

A trader picks any standard or custom timeframe (1s … 1M, 45m, 7m, 3h, 2D, 2W, 3M) on any symbol and sees bars of exactly that size, aligned to the standard boundaries, with the newest bar being the current period.

**Independent Test**: For every catalogue symbol and every timeframe in the matrix, `/api/candles` returns bars whose spacing and alignment match the timeframe and the market's session calendar.

**Acceptance Scenarios**:

1. **Given** BTCUSDT and timeframe `45`, **Then** consecutive bars are exactly 45 minutes apart and each bar time is a multiple of 45 minutes since the UTC epoch.
2. **Given** any symbol and `W`, **Then** every bar opens Monday 00:00 UTC; with `M` every bar opens on the 1st of a month 00:00 UTC.
3. **Given** an unknown id such as `7X` or `0`, **Then** the server answers `400 invalid_timeframe` (never a silent substitute).
4. **Given** a market that is open now, **Then** the last bar is the bucket that contains "now" and no bar lies in the future.

---

### User Story 2 - Demo markets behave like real markets (Priority: P1)

Non-crypto markets are demo series, but they must be internally consistent: stable history, real trading sessions, and the same price on every timeframe, in the ticker, in the live stream and in the order book.

**Independent Test**: For every demo symbol the last close of `1`, `60` and `D` and the ticker `lastPrice` are equal (within one `minTick`), and the same historical bar requested twice (seconds apart) is identical.

**Acceptance Scenarios**:

1. **Given** EURUSD on a Saturday (UTC), **Then** no intraday bar exists for Saturday or Sunday and the daily series has no Saturday/Sunday bars.
2. **Given** FOOLAD, **Then** intraday bars exist only Saturday–Wednesday 05:30–09:00 UTC and daily bars only on those days.
3. **Given** a 60-minute bar of XAUUSD, **Then** its open/high/low/close/volume equal the aggregation of the 1-minute bars inside it.

---

### User Story 3 - No fabricated prices (Priority: P1)

The chart never shows invented prices as if they were a real market: no padding before a coin's listing, no fake coin bars during an outage, no price-100 placeholder.

**Independent Test**: With the upstream bases pointed at an unreachable address, a crypto request returns the last cached real series marked `stale`, or `503 upstream_unavailable` when nothing is cached.

**Acceptance Scenarios**:

1. **Given** BTCUSDT `D` with limit 10000, **Then** the first bar is not earlier than Binance's first BTCUSDT bar (2017-08-17) and `count` is the number of real bars.
2. **Given** TONUSDT `D` with limit 5000, **Then** 200 with all real bars since listing (no 404).
3. **Given** the upstream is unreachable and nothing is cached, **Then** `503 {ok:false,error:"upstream_unavailable"}` and the chart shows a localized "no data" notice instead of candles.
4. **Given** the upstream is unreachable but a real series was cached, **Then** the series is served with `source:"cache"` and the chart shows the localized stale-data notice.

---

### User Story 4 - The chart stays correct while live and while scrolling back (Priority: P2)

Live ticks update the forming bar of the active timeframe, roll into the next bar exactly at the boundary (including Monday for weekly and the 1st for monthly), never invent volume, and scrolling into history loads older bars without gaps or overlaps.

**Acceptance Scenarios**:

1. **Given** the chart on `W`, **When** a tick arrives, **Then** it updates the bar that opened on the latest Monday 00:00 UTC.
2. **Given** a tick stream, **Then** the forming bar's volume equals the server's volume for that bar (refreshed), never a tick count.
3. **Given** a page request with `to_time` = oldest loaded bar − 1 ms, **Then** the returned bars are strictly older, contiguous on the market calendar and do not overlap the loaded ones — for crypto and demo markets.

---

### User Story 5 - Server stays up under load (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a sweep of every catalogue symbol × the timeframe matrix at limit 1500 with 8 concurrent requests, **Then** the service does not restart and every response is 200.

### Edge Cases

- `limit` larger than the available history → fewer bars, 200, `count` = real number.
- `from_time` > `to_time` → `400 invalid_time`. Seconds-precision timestamps (< 10^11) are converted to milliseconds.
- Timeframe whose bucket is larger than a session (e.g. `240` on TSE) → buckets keep epoch alignment and exist only when they overlap the session.
- Seconds timeframes on a closed demo market → the last session's seconds bars.
- Iran has no DST; US sessions use fixed UTC hours (documented simplification).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST parse timeframes with one grammar: `N` (minutes, 1–1440), `Nm` (alias of minutes), `Ns`/`NS` (seconds, 1–59), `Nh`/`NH` (hours, 1–24), `D`/`ND`/`Nd` (days, 1–365), `W`/`NW`/`Nw` (weeks, 1–52), `M`/`NM` (months, 1–12; uppercase M = month). Anything else MUST return `400 invalid_timeframe`. The response MUST echo the canonical id in `timeframe` (minutes and hours → minutes as digits, e.g. `1h`→`60`; seconds → `Ns`, e.g. `1S`→`1s`; days → `D` or `ND`; weeks → `W` or `NW`; months → `M` or `NM`) and add `intervalMs` (calendar months: 2592000000 nominal).
- **FR-002**: Bucket alignment MUST be: sub-day intervals → `time % intervalMs == 0` (UTC epoch); `ND` → epoch-day index divisible by N; `NW` → Monday 00:00 UTC, week index since 1970-01-05 divisible by N; `NM` → 1st of month 00:00 UTC, month index since 1970-01 divisible by N. Every bar MUST have `time` (epoch ms) on a bucket start, `closeTime` = next bucket start − 1, strictly ascending times, no duplicates, finite numbers, `low ≤ min(open,close) ≤ max(open,close) ≤ high`, `low > 0`, `volume ≥ 0`.
- **FR-003**: Crypto MUST use the Binance native interval when its boundaries equal FR-002 (1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 1w, 1M; Binance `3d` is NOT aligned to FR-002 — its buckets start at epoch-day ≡ 1 mod 3 — so `3D` is aggregated from `1d`); every other timeframe MUST be aggregated server-side from the largest native interval that divides it (open = first open, close = last close, high = max, low = min, volume = sum), with at most 20 upstream pages per request.
- **FR-004**: Deep history MUST contain only real upstream bars: an empty or short page means the history start; the server MUST return the bars collected so far (200) and MUST NOT pad with generated bars.
- **FR-005**: When the upstream fails for a known crypto symbol the server MUST serve the last real series it fetched for that symbol/timeframe (up to 24 h old) with `source:"cache"`, else `503 {ok:false,error:"upstream_unavailable"}`; it MUST NOT generate bars for crypto. Every 200 response MUST include `source` (`"binance"` | `"demo"` | `"cache"`) and header `X-Data-Source` with the same value. Upstream base URLs MUST be configurable by env `TC_BINANCE_BASES` (comma-separated, default vision, api, us).
- **FR-006**: `from_time` / `to_time` MUST be honoured for every market; values below 10^11 are seconds and MUST be multiplied by 1000; `from_time > to_time` → `400 invalid_time`. A request with `to_time` returns the `limit` newest bars with `time ≤ to_time`.
- **FR-007**: Demo markets MUST be generated from one deterministic, time-anchored price path per symbol (stable: the same bar requested at different moments is identical once closed), starting no earlier than 2000-01-03, so that every timeframe is the exact FR-003-style aggregation of the 1-minute path (seconds timeframes refine the minute path consistently), and the price at "now" equals the last close.
- **FR-008**: Demo markets MUST follow a session calendar (UTC): forex, metals, commodities: Monday 00:00 – Friday 22:00; US stocks and indices: Monday–Friday 13:30–20:00; Tehran Stock Exchange: Saturday–Wednesday 05:30–09:00; Tehran gold and FX: Saturday–Thursday 06:30–15:30; crypto 24/7. Intraday bars exist only for buckets overlapping a session; daily bars only on session days; weekly/monthly bars aggregate session days. `limit` counts existing bars.
- **FR-009**: For demo markets `/api/tickers`, the `/ws/live` `tick` price and `/api/depth` mid-price MUST derive from the same path as the candles (ticker `lastPrice` = last 1m close within one `minTick`; `highPrice`/`lowPrice`/`priceChange` from the last 24 h of that path).
- **FR-010**: The server candle cache MUST be bounded (≤ 300 000 cached bars in total, least-recently-used eviction) and identical concurrent upstream requests MUST share one in-flight fetch; the service MUST survive the US5 sweep without restart within its 256 MB heap.
- **FR-011**: The client data provider MUST use the FR-001/FR-002 grammar and alignment for live-tick buckets (including weekly Monday and calendar-month buckets and `NS`/`NH`/`ND`/`NW`/`NM`); a new bucket MUST open at the previous close; ticks MUST NOT change volume; the provider MUST refresh the last two bars from the server at least every 15 s and at each bucket roll so volume and OHLC converge to the server's values.
- **FR-012**: The client MUST NOT draw a fabricated bar: when `/api/candles` yields no bars (404/503/network) and nothing real is cached, the chart MUST show the notice «برای این نماد در این بازه‌ی زمانی داده‌ای در دسترس نیست.» / "No data is available for this symbol on this timeframe." with zero console errors from indicators; when `source` is `"cache"` it MUST show «داده‌های زنده موقتاً در دسترس نیست؛ آخرین داده‌های ذخیره‌شده نمایش داده می‌شود.» / "Live data is temporarily unavailable; showing the last saved data." Both notices disappear when fresh data arrives and re-localize on language switch.
- **FR-013**: Switching the chart among every standard timeframe (1s, 1, 3, 5, 15, 30, 45, 60, 120, 240, D, W, M) and custom ones (e.g. 7, 180, 2D, 2W, 3M) MUST render bars whose spacing equals the timeframe on the market calendar, with at least min(2000, available) bars for crypto and demo markets, and the topbar timeframe label matching. The custom-timeframe builder MUST offer seconds, minutes, hours, days, weeks and months (seconds still gated by `secondIntervals`, custom by `customIntervals`).

### Key Entities

- **Timeframe**: canonical id, unit, count, nominal `intervalMs`, bucket function (FR-001/002).
- **Session calendar**: per market category, UTC open windows and trading days (FR-008).
- **Candle response**: `{symbol, timeframe, intervalMs, source, count, candles[]}`.

## Success Criteria *(mandatory)*

- **SC-001**: A sweep of all catalogue symbols × {1s, 5s, 1, 3, 5, 7, 15, 30, 45, 60, 120, 240, D, 3D, W, 2W, M} at limit 1500 returns 100% HTTP 200 (crypto real history may be shorter), 0 alignment/spacing/OHLC/ordering defects on the session calendar, 0 future bars, and the service restart counter is unchanged.
- **SC-002**: For 100% of demo symbols, the last closes of `1`, `60`, `D` and the ticker `lastPrice` agree within one `minTick`, and a 60-minute bar equals the aggregation of its 1-minute bars.
- **SC-003**: 0 bars before the true listing for BTCUSDT, TONUSDT, TAOUSDT on `D`/`W`/`M`; 0 generated crypto bars during a simulated upstream outage.
- **SC-004**: In a real browser (desktop and mobile, FA and EN) switching through every standard timeframe on BTCUSDT, EURUSD, FOOLAD and GOLD_ABSHODEH shows bar spacing equal to the timeframe and produces 0 console errors.
- **SC-005**: The two notices of FR-012 appear in the matching situations in both languages and never otherwise.

## Assumptions

- Demo markets stay demo (no paid feed); they are labelled DEMO as in 005 FR-010.
- US-session DST and exchange holidays are out of scope (fixed UTC hours, no holiday calendar).
- Plan history caps (`histBars`, 005 FR-003) are unchanged.
- This spec supersedes 005 FR-001 (timeframe pattern) and 005 FR-004 (generated crypto fallback) and 005 FR-009 (neutral seed bar).
