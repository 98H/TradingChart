  ⚠ dashboard [default] pid 732041: manual restart still pending; this process may still serve pre-update code.
    Ask its owner to relaunch `hermes serve` / `hermes dashboard` (reconnect Desktop for an SSH backend).
VERDICT: FAIL
- [Behaviour beyond tests] server/symbolCatalog.js:379 — tvSearchCache is an unbounded Map without max entries or LRU eviction — use CostLruCache from server/lru.js per the checklist item "Every cache bounded (server/lru.js)".
- [Forbidden shortcuts / Rule 2] server/symbolCatalog.js:212-231 — binancePairSet is never cleared in rebuildCatalog during 24h refresh — add binancePairSet.clear() so delisted pairs are removed per US3/FR-005.

session_id: local-78dc0e27a1c02d2ce775d2cdde274d90a25bd68d75737b4b99666d7a3469afbb
0
