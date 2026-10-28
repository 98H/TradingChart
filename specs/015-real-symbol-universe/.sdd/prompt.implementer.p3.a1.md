You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/015-real-symbol-universe. Phase: 3. Attempt: 1.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/015-real-symbol-universe/spec.md`, `specs/015-real-symbol-universe/plan.md`, `specs/015-real-symbol-universe/data-model.md`, `specs/015-real-symbol-universe/contracts/`.
3. The tasks of THIS phase only:

## Phase 3: Tehran sources

- [ ] T009 [US4] Create server/tgjuClient.js: slug map, daily history (rial→Toman, verified column order), current value polling ≤ 60 s, cache (FR-006)
- [ ] T010 [US4] Register TGJU entries in server/symbolCatalog.js with `timeframes: D/W/M` and route them in server/dataFeed.js; intraday → 400 `timeframe_unavailable` in server/index.js (FR-006)
- [ ] T011 [US5] Create server/tseSource.js (BrsApi via TC_BRSAPI_KEY, relay via TC_TSETMC_PROXY, health probe) and enable `iran_tse` catalogue/routes only when healthy, in server/symbolCatalog.js and server/dataFeed.js (FR-007)
- [ ] T012 [US4] Rebuild `/api/gold-snapshot` in server/dataFeed.js from real inputs (OANDA:XAUUSD, IR:USD_FREE, TGJU coins) with source/time per input (FR-006, FR-008)

4. Feedback from the previous attempt's gates and reviewer:

(first attempt — no feedback)

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
