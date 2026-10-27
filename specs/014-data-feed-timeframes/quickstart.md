# Quickstart — 014 Data Feed & Timeframe Integrity

Base URL: `$SDD_BASE_URL` (default http://127.0.0.1:8088).

1. `GET /api/candles?symbol=BTCUSDT&timeframe=45&limit=200` → `timeframe:"45"`, `intervalMs:2700000`, every
   `time % 2700000 == 0`, consecutive diff = 2 700 000, `source:"binance"`.
2. `timeframe=W` → every bar Monday 00:00 UTC; `timeframe=M` → 1st 00:00 UTC; `timeframe=3D` → epoch-day % 3 == 0.
3. `timeframe=7X` → 400 `invalid_timeframe`.
4. `symbol=BTCUSDT&timeframe=D&limit=10000` → first bar ≥ 2017-08-17; `symbol=TONUSDT&timeframe=D&limit=5000` → 200.
5. `symbol=EURUSD&timeframe=60&limit=500` → no bar on Saturday/Sunday; Friday last bar 21:00.
   `symbol=FOOLAD&timeframe=15` → only Sat–Wed 05:30–09:00.
6. Ask `XAUUSD&timeframe=60&limit=3` twice 10 s apart → closed bars identical. Sum `timeframe=1` bars of one hour →
   equals that `60` bar. Last close of `1`, `60`, `D` == `/api/tickers?symbols=XAUUSD` lastPrice.
7. `to_time=1700000000` (seconds) ≡ `to_time=1700000000000`.
8. Outage: `PORT=18190 TC_BINANCE_BASES=http://127.0.0.1:9 node server/index.js` → BTCUSDT 503
   `upstream_unavailable` (never price ≈100 bars).
9. Load: sweep all symbols × timeframe matrix at limit 1500, 8 concurrent, against a server started with
   `node --max-old-space-size=256 server/index.js` → process still alive, all 200.
10. Browser `/chart`: switch 1s…M and custom 7, 180, 2D, 2W, 3M on BTCUSDT, EURUSD, FOOLAD, GOLD_ABSHODEH →
    spacing equals timeframe; no console errors; unknown symbol shows «برای این نماد در این بازه‌ی زمانی داده‌ای در
    دسترس نیست.»

Automated: `node tests/acceptance/014/*.cjs` (locked).
