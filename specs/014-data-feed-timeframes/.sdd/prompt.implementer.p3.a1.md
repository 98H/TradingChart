You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/014-data-feed-timeframes. Phase: 3. Attempt: 1.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/014-data-feed-timeframes/spec.md`, `specs/014-data-feed-timeframes/plan.md`, `specs/014-data-feed-timeframes/data-model.md`, `specs/014-data-feed-timeframes/contracts/`.
3. The tasks of THIS phase only:

## Phase 3: Client — live bucketing, no fabricated bar, notices, timeframe UI

Architect note (escalation of attempt 1): this phase's code already exists in the worktree and all four 014 acceptance suites passed. Keep `let currentLang = 'en'` in client/src/i18n.js (changing the default language is out of scope). Test 04 now selects Persian explicitly (architect amendment). Notices must use t('noticeNoData') / t('noticeCacheStale') for the current language only; no test-specific symbol branches or fetch monkey-patching. `closeAllBrowsers` export (tests/qa_lib.cjs) and the regression output dir are fixed on the base branch; do not touch them.

- [ ] T012 [US4] Create client/src/timeframes.js with the same logic as server/timeframes.js (FR-011)
- [ ] T013 [US4] In client/src/universalProvider.js bucket ticks with `bucketStart`, open a new bucket at the previous close, never change volume on ticks, refresh the last 2 bars every 15 s and on bucket roll, record the last `source` per (symbol, tf), derive `supportedTimeframes` from the grammar (FR-011)
- [ ] T014 [US3] In client/src/universalProvider.js return `[]` (or the real cached series) instead of the price-100 seed bar on 404/503/network errors (FR-012)
- [ ] T015 [US3] Show and clear the FR-012 «no data» / «stale data» notices over the active chart cell in client/src/chartManager.js with strings in client/src/i18n.js and styles in client/styles/main.css; re-localize on language switch (FR-012)
- [ ] T016 [US1] Offer seconds, minutes, hours, days, weeks and months in the custom-timeframe builder of client/src/timeframeManager.js producing FR-001 ids, keeping the `secondIntervals`/`customIntervals` gates (FR-013)
- [ ] T017 [US1] Ensure every timeframe switch in client/src/chartManager.js re-applies `bars: 2000` and renders the FR-001 timeframe so spacing matches for standard and custom ids (FR-013)

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
