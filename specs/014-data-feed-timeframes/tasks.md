# Tasks: Data Feed & Timeframe Integrity

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/market-data-api.md. Tests: tests/acceptance/014/ (locked before Phase 1).

Note (architect): FR-006 (from/to for every market) is delivered in Phase 2 because its demo-market half needs the
demo engine; acceptance files covering FR-006 therefore run from Phase 2.

## Phase 1: Server timeframe core, honest crypto history, memory safety

- [x] T001 [US1] Create server/timeframes.js with `parseTimeframe`, `bucketStart`, `nextBucket`, `aggregate` per the data-model parsing table and FR-002 alignment (pure ESM, no Node APIs) (FR-001, FR-002)
- [x] T002 [US1] In server/index.js validate `timeframe` with `parseTimeframe` (400 `invalid_timeframe` otherwise) and return `timeframe` canonical, `intervalMs`, `source` and header `X-Data-Source` (FR-001, FR-005)
- [x] T003 [US1] In server/dataFeed.js map canonical timeframes to the Binance native interval or aggregate from the largest dividing native interval (3D from 1d), ≤ 20 pages, dropping a partially covered oldest bucket (FR-003)
- [x] T004 [US3] In server/dataFeed.js stop pagination at an empty/short page and return collected real bars; never call the demo generator for crypto (FR-004)
- [x] T005 [US3] In server/dataFeed.js read `TC_BINANCE_BASES`, keep a last-good series per (symbol, canonical tf) up to 24 h, serve it as `source:"cache"`, else signal `upstream_unavailable` → 503 in server/index.js (FR-005)
- [x] T006 [P] [US5] Create server/lru.js (cost-bounded LRU 300 000 bars + in-flight dedupe) and use it for every candle cache in server/dataFeed.js, removing the unbounded `candleCache` (FR-010)

## Phase 2: Demo engine — sessions, deterministic path, one price everywhere

- [x] T007 [US2] Create server/marketSessions.js with the session table of data-model.md and helpers `isSessionDay`, `sessionWindows` (FR-008)
- [x] T008 [US2] Create server/demoPath.js: seeded daily layer since 2000-01-03 on session days, minute and second Brownian-bridge layers that aggregate exactly to their parent bar, `demoBars(symbol, tf, {limit, from, to})`, `demoPrice(symbol, now)` (FR-007, FR-008)
- [x] T009 [US2] Route every non-crypto symbol in server/dataFeed.js `getCandles` to `demoBars` with `source:"demo"`, delete `generateContinuousBars`, and honour `from_time`/`to_time` (seconds→ms, from > to → 400 in server/index.js) for crypto and demo (FR-006, FR-007)
- [x] T010 [US2] Make server/dataFeed.js `get24hTicker` for every non-crypto market use `demoPrice` and the last 24 h of the path; keep the ws tick in server/index.js and the simulated ladder in server/depthFeed.js on that ticker (FR-009)
- [x] T011 [P] [US2] Keep server/technicalScreener.js working with the new `getCandles` results (FR-009)

## Phase 3: Client — live bucketing, no fabricated bar, notices, timeframe UI

Architect note (escalation of attempt 1): this phase's code already exists in the worktree and all four 014 acceptance suites passed. Keep `let currentLang = 'en'` in client/src/i18n.js (changing the default language is out of scope). Test 04 now selects Persian explicitly (architect amendment). Notices must use t('noticeNoData') / t('noticeCacheStale') for the current language only; no test-specific symbol branches or fetch monkey-patching. `closeAllBrowsers` export (tests/qa_lib.cjs) and the regression output dir are fixed on the base branch; do not touch them.

- [x] T012 [US4] Create client/src/timeframes.js with the same logic as server/timeframes.js (FR-011)
- [x] T013 [US4] In client/src/universalProvider.js bucket ticks with `bucketStart`, open a new bucket at the previous close, never change volume on ticks, refresh the last 2 bars every 15 s and on bucket roll, record the last `source` per (symbol, tf), derive `supportedTimeframes` from the grammar (FR-011)
- [x] T014 [US3] In client/src/universalProvider.js return `[]` (or the real cached series) instead of the price-100 seed bar on 404/503/network errors (FR-012)
- [x] T015 [US3] Show and clear the FR-012 «no data» / «stale data» notices over the active chart cell in client/src/chartManager.js with strings in client/src/i18n.js and styles in client/styles/main.css; re-localize on language switch (FR-012)
- [x] T016 [US1] Offer seconds, minutes, hours, days, weeks and months in the custom-timeframe builder of client/src/timeframeManager.js producing FR-001 ids, keeping the `secondIntervals`/`customIntervals` gates (FR-013)
- [x] T017 [US1] Ensure every timeframe switch in client/src/chartManager.js re-applies `bars: 2000` and renders the FR-001 timeframe so spacing matches for standard and custom ids (FR-013)

## Phase 4: Converge — bounded demo-path memory (post-merge production audit)

Architect note: after phase 3 merged, the production sweep (all symbols × 17 timeframes, limit 1500, 8 concurrent) crashed the 256 MB server with heap OOM (reproduced: NATGAS `240` grows heap past 111 MB alone). Cause: `dailyLayerCache`, `minuteCache` and `secondCache` in server/demoPath.js are unbounded `Map`s, and higher intraday timeframes materialise every minute of every covered day. New locked test tests/acceptance/014/05_full_sweep_memory_bound.test.cjs reproduces it.

- [x] T018 [US5] In server/demoPath.js replace the unbounded `minuteCache`/`secondCache` with the shared cost-bounded LRU of server/lru.js (cost = bars; shared 300 000 budget) and bound `dailyLayerCache` (LRU, ≤ 80 symbols) (FR-010)
- [x] T019 [US5] In server/demoPath.js build intraday buckets of ≥ 60 minutes by streaming aggregation per day (do not retain per-minute arrays for days that are only aggregated; keep only the aggregated bars) so a 1500-bar `240` request allocates O(bars), not O(minutes) (FR-010, FR-007)
- [x] T020 [US5] Keep exact consistency: aggregates must remain identical to the 1-minute path (tests 03 still pass) (FR-007, FR-010)
