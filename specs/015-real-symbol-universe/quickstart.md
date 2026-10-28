# Quickstart — 015

1. `/api/symbols?q=EURUSD` → contains `OANDA:EURUSD` (source tradingview). `/api/candles?symbol=OANDA:EURUSD&timeframe=60&limit=500` → 200, source tradingview.
2. `/api/candles?symbol=NASDAQ:AAPL&timeframe=D&limit=5` last close == TradingView's.
3. `/api/symbols?category=crypto&limit=2000` → ≥ 500 USDT pairs.
4. `/api/candles?symbol=IR:COIN_EMAMI&timeframe=D&limit=100` → TGJU values ÷10; `timeframe=60` → 400 timeframe_unavailable.
5. `/api/candles?symbol=FOOLAD` (no TSE key) → 404 unknown_symbol; `/api/symbols?category=iran_tse` → [].
6. `/api/depth?symbol=OANDA:EURUSD` → 404 depth_unavailable.
7. Legacy `/api/candles?symbol=XAUUSD` → served as OANDA:XAUUSD.
8. `node tools/accuracy_audit.mjs --base $SDD_BASE_URL --out .sdd/out/accuracy.json` → checked ≥ 200, mismatches 0.
9. Browser: SP:SPX badge «تأخیر ۱۰ دقیقه»; IR:COIN_EMAMI intraday timeframes disabled; old watchlist with FOOLAD shows «این نماد دیگر پشتیبانی نمی‌شود».
