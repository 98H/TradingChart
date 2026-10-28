# Review checklist — 015 Real Symbol Universe

## Behaviour beyond tests
- [ ] No HTTP/WS-reachable code generates or hard-codes a price (grep: demoPath, Math.random, sin(, fixed base prices, simulated).
- [ ] TradingView is contacted only from the server; no TradingView URL or token in client/.
- [ ] Every cache bounded (server/lru.js); socket pool and rate cap honoured; reconnect has backoff.
- [ ] TSE fully absent when no key/relay is configured.

## Architecture boundaries
- [ ] No new npm dependency; keys only from env; no secrets committed.
- [ ] `histBars` cap and `X-History-Limit` unchanged.

## Forbidden shortcuts
- [ ] No test-specific symbols/branches; no fetch monkey-patching; no change to tests/acceptance/**, specs/**, .sdd/**.
- [ ] Catalogue not padded with unverifiable entries; nameFa only for curated entries.

## Copy and UX
- [ ] FA strings formal with ZWNJ: «زنده»، «تأخیر N دقیقه»، «پایان روز»، «بازار بسته است»، «این نماد دیگر پشتیبانی نمی‌شود»، «دفتر سفارش برای این نماد در دسترس نیست»، «برای این نماد فقط داده‌ی روزانه موجود است»; Persian digits in FA.
- [ ] Badges fit 390 px topbar; disabled timeframes visibly disabled with tooltip.
