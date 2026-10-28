You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/015-real-symbol-universe. Phase: 1. Attempt: 1.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/015-real-symbol-universe/spec.md`, `specs/015-real-symbol-universe/plan.md`, `specs/015-real-symbol-universe/data-model.md`, `specs/015-real-symbol-universe/contracts/`.
3. The tasks of THIS phase only:

## Phase 1: TradingView data client and routing

- [ ] T001 [US2] Create server/tradingviewClient.js: pooled sockets (≤ TC_TV_MAX_SERIES_PER_SOCKET series), framing, heartbeat echo, backoff reconnect, rate cap, `resolve(symbol)`, `getBars(symbol, resolution, {limit, to})` with `request_more_data` paging, LRU caches (FR-001, FR-002)
- [ ] T002 [US2] Add live updates and a quote session to server/tradingviewClient.js (`subscribe(symbol, cb)`, `getQuote(symbol)`) (FR-003)
- [ ] T003 [US2] Route exchange-qualified non-Binance symbols in server/dataFeed.js `getCandles`/`get24hTicker` to the TradingView client with `source`, `exchange`, `delaySec`; last-good on outage (FR-002, FR-003)
- [ ] T004 [US2] In server/index.js keep `EXCHANGE:SYMBOL` in `cleanSymbol`, push TradingView live ticks on /ws/live, add `exchange`/`delaySec` to /api/candles (FR-002, FR-003)

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
