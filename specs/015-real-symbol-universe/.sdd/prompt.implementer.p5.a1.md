You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/015-real-symbol-universe. Phase: 5. Attempt: 1.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/015-real-symbol-universe/spec.md`, `specs/015-real-symbol-universe/plan.md`, `specs/015-real-symbol-universe/data-model.md`, `specs/015-real-symbol-universe/contracts/`.
3. The tasks of THIS phase only:

## Phase 5: Client UX and accuracy proof

- [ ] T017 [US2] Topbar source/status badge LIVE / Delayed N min / EOD / Market closed and symbol-search rows with exchange, type, source in client/src/main.js and client/src/i18n.js (FR-009)
- [ ] T018 [US4] Disable timeframes not in the symbol's `timeframes` with the FA/EN tooltip in client/src/timeframeManager.js and client/src/universalProvider.js (FR-009)
- [ ] T019 [US1] Alias migration and removed-symbol notice for watchlists/layouts in client/src/watchlistManager.js and client/src/universalProvider.js (FR-009)
- [ ] T020 [US2] Real-input gold bubble view with source/time in client/src/goldBubbleView.js (FR-009)
- [ ] T023 [US1] Delete the now-unused server/marketSessions.js (no importer left) and keep the build green (FR-008)
- [ ] T021 [US6] Create tools/accuracy_audit.mjs (≥ 200 stratified symbols, provider-direct comparison, JSON report, exit 1 on mismatch) (FR-010)

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
