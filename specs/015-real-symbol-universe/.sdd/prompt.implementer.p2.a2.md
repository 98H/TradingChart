You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/015-real-symbol-universe. Phase: 2. Attempt: 2.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/015-real-symbol-universe/spec.md`, `specs/015-real-symbol-universe/plan.md`, `specs/015-real-symbol-universe/data-model.md`, `specs/015-real-symbol-universe/contracts/`.
3. The tasks of THIS phase only:

## Phase 2: Real catalogue

- [ ] T005 [US3] In server/symbolCatalog.js load all Binance spot TRADING pairs from exchangeInfo (24 h refresh) as `BINANCE:<PAIR>` with precision/minTick from filters (FR-005)
- [ ] T006 [US2] In server/symbolCatalog.js add curated TradingView defaults per category (forex majors/crosses, metals, energy, indices, top US/EU stocks, ETFs, US10Y/DXY) with nameFa, and TradingView search proxy merged into `/api/symbols?q=` (cached 10 min) (FR-004)
- [ ] T007 [US1] Add the legacy alias table in server/symbolCatalog.js and apply it on every route in server/index.js (FR-004)
- [ ] T008 [US1] Real default watchlist / landing tickers / screener universe in client/src/watchlistManager.js, client/landing/landing.js and server/technicalScreener.js (FR-011)

4. Feedback from the previous attempt's gates and reviewer:

# Gate feedback — 015-real-symbol-universe phase 2, attempt 1

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
- [Behaviour beyond tests] server/symbolCatalog.js:379 — tvSearchCache is an unbounded Map without max entries or LRU eviction — use CostLruCache from server/lru.js per the checklist item "Every cache bounded (server/lru.js)".
- [Forbidden shortcuts / Rule 2] server/symbolCatalog.js:212-231 — binancePairSet is never cleared in rebuildCatalog during 24h refresh — add binancePairSet.clear() so delisted pairs are removed per US3/FR-005.

session_id: local-78dc0e27a1c02d2ce775d2cdde274d90a25bd68d75737b4b99666d7a3469afbb
0


## Rules
- Implement exactly the tasks above. Change only files whose paths appear in these tasks.
- NEVER edit: `.specify/`, `specs/` (except nothing — the pipeline ticks tasks), acceptance tests under the
  configured acceptance directory, `.sdd/`, secrets or data files. Changes there fail the scope gate.
- Locked acceptance tests are the definition of done. Make them pass by fixing product code, never by
  special-casing test inputs or detecting the test environment.
- Follow the contracts exactly (names, shapes, error codes). Follow the constitution (honest data,
  i18n, accessibility, performance budgets, security).
- Run the build and the relevant tests yourself before finishing; fix what fails.
- If the spec is contradictory, impossible, or a required change is outside the listed paths, do not
  work around it. Print one line `SPEC_PROBLEM: <precise description with FR ids and file paths>` and stop.
- Do not commit, push, deploy or change git branches; the pipeline does that.

## Finish
Print a summary of at most 15 lines: tasks done (IDs), files changed, commands you ran and their result.
