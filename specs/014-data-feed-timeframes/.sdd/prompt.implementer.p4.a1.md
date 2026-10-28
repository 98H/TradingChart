You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/014-data-feed-timeframes. Phase: 4. Attempt: 1.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/014-data-feed-timeframes/spec.md`, `specs/014-data-feed-timeframes/plan.md`, `specs/014-data-feed-timeframes/data-model.md`, `specs/014-data-feed-timeframes/contracts/`.
3. The tasks of THIS phase only:

## Phase 4: Converge — bounded demo-path memory (post-merge production audit)

Architect note: after phase 3 merged, the production sweep (all symbols × 17 timeframes, limit 1500, 8 concurrent) crashed the 256 MB server with heap OOM (reproduced: NATGAS `240` grows heap past 111 MB alone). Cause: `dailyLayerCache`, `minuteCache` and `secondCache` in server/demoPath.js are unbounded `Map`s, and higher intraday timeframes materialise every minute of every covered day. New locked test tests/acceptance/014/05_full_sweep_memory_bound.test.cjs reproduces it.

- [ ] T018 [US5] In server/demoPath.js replace the unbounded `minuteCache`/`secondCache` with the shared cost-bounded LRU of server/lru.js (cost = bars; shared 300 000 budget) and bound `dailyLayerCache` (LRU, ≤ 80 symbols) (FR-010)
- [ ] T019 [US5] In server/demoPath.js build intraday buckets of ≥ 60 minutes by streaming aggregation per day (do not retain per-minute arrays for days that are only aggregated; keep only the aggregated bars) so a 1500-bar `240` request allocates O(bars), not O(minutes) (FR-010, FR-007)
- [ ] T020 [US5] Keep exact consistency: aggregates must remain identical to the 1-minute path (tests 03 still pass) (FR-007, FR-010)

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
