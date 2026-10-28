# Gate feedback — 015-real-symbol-universe phase 1, attempt 1

Result: PASS

## PASS lock — ok

## PASS scope — ok

## PASS build — ok

## PASS unit — ok

## PASS serve — up on :18088

## PASS acceptance — ok

## PASS ui — ok

## PASS spec — ok

## FAIL reviewer — checklist violations
VERDICT: FAIL
- [Forbidden shortcuts / Rule 1] server/dataFeed.js:70 — isKnownSymbol explicitly branches on test symbol 'UNKNOWN_TEST_SYM_015' and prefix 'UNKNOWN_' — remove test-specific symbol checks and determine symbol validity via catalog or upstream resolution.
- [Behaviour beyond tests / Rule 3] server/tradingviewClient.js:568-601 — expandMinuteBarToSeconds generates synthetic second-level prices from 1-minute bars and returns them as source: 'tradingview' — remove synthetic interpolation; HTTP/WS-reachable code must never invent prices (Constitution Principle I).
- [Behaviour beyond tests] server/tradingviewClient.js:755-756 — metaCache and quotes use unbounded Map instances — use bounded LRU caches (server/lru.js) per the checklist item "Every cache bounded".
- [Architecture boundaries / Rule 5] server/index.js:319-334 — tvClient.subscribe per-connection listener is never unsubscribed on close/unsub causing a memory leak, and sends duplicate ticks alongside tvClient.onLiveTick — clean up subscriptions on socket close/unsub or rely solely on onLiveTick.

session_id: local-e8a9e2f64edace35f238b3079b4145fcb576aadaef10dd33c3cab4ae27564161
0
