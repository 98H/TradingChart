  ⚠ dashboard [default] pid 732041: manual restart still pending; this process may still serve pre-update code.
    Ask its owner to relaunch `hermes serve` / `hermes dashboard` (reconnect Desktop for an SSH backend).
VERDICT: PASS
- [checklist item: Behaviour beyond tests] server/tgjuClient.js:1012 — TGJU daily history client correctly divides Rial by 10 to Toman, enforces OHLC integrity, and respects the 10-minute cache TTL with 24h fallback.
- [checklist item: Behaviour beyond tests] server/tgjuClient.js:906 — Real-time price polling configured at 40s (<= 60s) via call.tgju.org with WebSocket tick emission.
- [checklist item: Behaviour beyond tests] server/symbolCatalog.js:584 — TGJU entries registered with allowed timeframes ['D', 'W', 'M']; intraday requests return 400 timeframe_unavailable in server/index.js:104 and server/dataFeed.js:626.
- [checklist item: Behaviour beyond tests] server/tseSource.js:1260 — Tehran Stock Exchange gated strictly behind TC_BRSAPI_KEY and TC_TSETMC_PROXY health probes; completely absent from catalog, routes, search, and status when unconfigured.
- [checklist item: Behaviour beyond tests] server/dataFeed.js:351 — Rebuilt /api/gold-snapshot using real upstream inputs (TradingView OANDA:XAUUSD, TGJU USD free market, TGJU coins) with verified source and timestamp per component and 503 upstream_unavailable error mapping.
- [checklist item: Architecture boundaries] server/dataFeed.js, server/symbolCatalog.js, server/tgjuClient.js, server/tseSource.js — Zero new npm dependencies; env keys only; no hardcoded secrets or test-environment shortcuts.

session_id: local-a5f2102fa3b1988a6082733ee444ed849281993ce7f07ce11d428e8db28343aa
0
