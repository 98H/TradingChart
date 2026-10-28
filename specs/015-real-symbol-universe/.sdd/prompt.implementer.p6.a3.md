You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/015-real-symbol-universe. Phase: 6. Attempt: 3.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/015-real-symbol-universe/spec.md`, `specs/015-real-symbol-universe/plan.md`, `specs/015-real-symbol-universe/data-model.md`, `specs/015-real-symbol-universe/contracts/`.
3. The tasks of THIS phase only:

## Phase 6: Converge — search/catalogue integrity (post-merge production audit)

Architect note: after phase 5 merged and deployed, the production audit found (and production was rolled back to 014):
26 search results whose ids are not TradingView tickers (e.g. `Pepperstone:EURUSD`, `CMC Markets:EURUSD`), 8 unknown ids silently served BTCUSDT from Binance (`Capital.com:DXY`, `Euronext Oslo:GYL` → BINANCE:BTCUSDT — a fabricated chart), 12 search results answering 503 (`FXCM:EURUSD` — TradingView prefix is `FX`), 44 delayed instruments labelled live, forex search results with precision 2, 4 curated defaults that do not exist on TradingView (TVC:COPPER, TVC:NATGAS, TVC:FTSE, AMEX:TLT), and tools/accuracy_audit.mjs exiting 0 with an "offline baseline" when the server is unreachable plus a 2 % tolerance. Curated TradingView symbols (41) and TGJU (12) were verified equal to the providers. New locked test tests/acceptance/015/06_search_and_catalog_integrity.test.cjs.

- [ ] T024 [US2] Build search ids from `prefix`/`source_id`/`exchange` (uppercase, no spaces), verify each result with `resolve_symbol` (cached 24 h) and take dataStatus/delaySec/precision/minTick from the resolution, in server/symbolCatalog.js and server/tradingviewClient.js (FR-012)
- [ ] T025 [US1] Route strictly by prefix in server/dataFeed.js and server/symbolCatalog.js: only `BINANCE:`/bare crypto pairs go to Binance, `IR:` to TGJU, `TSE:` to the TSE source, every other prefix to TradingView; unresolvable → 404 `unknown_symbol` (no fallback) (FR-012)
- [ ] T026 [US2] Replace the four unresolvable curated defaults and derive every curated `dataStatus` from the resolved delay in server/symbolCatalog.js (FR-012)
- [ ] T027 [US6] Make tools/accuracy_audit.mjs fail closed (exit 1 when server/provider unreachable), compare TradingView symbols via the public socket, compare the last closed bar within one minTick (FR-012)

4. Feedback from the previous attempt's gates and reviewer:

# Gate feedback — 015-real-symbol-universe phase 6, attempt 2

Result: FAIL

## PASS lock — ok

## PASS scope — ok

## PASS build — ok

## PASS unit — ok

## PASS serve — up on :18088

## FAIL acceptance — exit 1
```
❌ FR-012 every curated catalogue entry is chartable: OANDA:EURCHF -> 503 upstream_unavailable
```

## PASS ui — ok

## PASS spec — ok

## PASS regression — ok


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
