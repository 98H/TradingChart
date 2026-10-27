You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/013-gift-subscriptions. Phase: 3. Attempt: 2.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/013-gift-subscriptions/spec.md`, `specs/013-gift-subscriptions/plan.md`, `specs/013-gift-subscriptions/data-model.md`, `specs/013-gift-subscriptions/contracts/`.
3. The tasks of THIS phase only:

## Phase 3: Trading app UI

- [ ] T012 [US3] Make `plan()` and entitlements use `user.effectivePlan`, and show the «اشتراک هدیه» / "Gift subscription" badge with «تا <تاریخ>» / "until <date>" or «نامحدود» / "Unlimited" in the avatar menu, account dialog and plans dialog in client/src/authManager.js (FR-012, FR-013)

4. Feedback from the previous attempt's gates and reviewer:

# Gate feedback — 013-gift-subscriptions phase 3, attempt 1

Result: FAIL

## PASS lock — ok

## PASS scope — ok

## PASS build — ok

## PASS unit — ok

## PASS serve — up on :18089

## PASS acceptance — ok

## PASS ui — ok

## PASS spec — ok

## FAIL regression — exit 1
```
scripts/qa/run_regression.sh: line 13: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 15: .sdd/out/regression/qa_accounts_cycle1.log: No such file or directory
scripts/qa/run_regression.sh: line 17: .sdd/out/regression/qa_accounts_cycle1.exit: No such file or directory
scripts/qa/run_regression.sh: line 18: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 13: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 15: .sdd/out/regression/qa_accounts_cycle3.log: No such file or directory
scripts/qa/run_regression.sh: line 17: .sdd/out/regression/qa_accounts_cycle3.exit: No such file or directory
scripts/qa/run_regression.sh: line 18: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 13: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 15: .sdd/out/regression/qa_cycleA.log: No such file or directory
scripts/qa/run_regression.sh: line 17: .sdd/out/regression/qa_cycleA.exit: No such file or directory
scripts/qa/run_regression.sh: line 18: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 13: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 15: .sdd/out/regression/qa_i18n_final.log: No such file or directory
scripts/qa/run_regression.sh: line 17: .sdd/out/regression/qa_i18n_final.exit: No such file or directory
scripts/qa/run_regression.sh: line 18: .sdd/out/regression/progress.log: No such file or directory
scripts/qa/run_regression.sh: line 21: .sdd/out/regression/progress.log: No such file or directory

```


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
