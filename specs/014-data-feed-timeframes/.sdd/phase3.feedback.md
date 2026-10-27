# Gate feedback — 014-data-feed-timeframes phase 3, attempt 1

Result: FAIL

## PASS lock — ok

## PASS scope — ok

## PASS build — ok

## PASS unit — ok

## PASS serve — up on :18088

## FAIL acceptance — exit 1
```
[014 Acceptance Suite 01] PASS: All timeframe grammar, alignment and aggregation assertions satisfied.
[014 Acceptance Suite 02] PASS: All crypto deep history, outage resilience and memory safety assertions satisfied.
[014 Acceptance Suite 03] PASS: All demo markets, sessions and unified pricing assertions satisfied.
[014 Acceptance Suite 04] PASS: All client live bucketing, notices and timeframe UI assertions satisfied.
❌ Suite 04 unhandled error: closeAllBrowsers is not a function
```

## FAIL ui — exit 1
```
FAIL /chart mobile/fa defects=3
UI PROBE FAIL defects=3 (new vs baseline .sdd/baseline/ui_probe_2026-10-23.json; known baseline defects still present=23)
```

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
