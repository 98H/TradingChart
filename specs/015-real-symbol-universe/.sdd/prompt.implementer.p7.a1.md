You are the IMPLEMENTER in a Hybrid Spec-Driven Development pipeline.
Working directory: the repository root. Feature: specs/015-real-symbol-universe. Phase: 7. Attempt: 1.

## Your inputs (read these first, nothing else is authoritative)
1. `.specify/memory/constitution.md` — non-negotiable project rules.
2. `specs/015-real-symbol-universe/spec.md`, `specs/015-real-symbol-universe/plan.md`, `specs/015-real-symbol-universe/data-model.md`, `specs/015-real-symbol-universe/contracts/`.
3. The tasks of THIS phase only:

## Phase 7: Complete universe — all TradingView markets and all Iranian exchange symbols (founder 2026-10-28)

Architect note: founder rejected the curated-only catalogue («قراره جایگزین تریدینگ‌ویو باشه، پس باید تکمیل باشه» and «به تمامی نمادهای بورس ایران هم نیازه»). Recon: `POST https://scanner.tradingview.com/<market>/scan` with `Origin: https://www.tradingview.com`, body `{columns:[name,description,exchange,type,subtype,currency,pricescale,minmov,update_mode], range:[from,to], filter?, sort?}` → `{totalCount, data:[{s, d:[...]}]}` — measured totals: global 454 562, crypto 64 494, futures 52 622, germany 39 830, america 20 053, economics2 15 167, uk 9 509, india 8 759, forex 6 332, bonds 1 163, cfd 650, turkey 650. BrsApi free key: 300 req / 5 min, ≥ 300 ms spacing, one key per person; `AllSymbols` returns every TSE/IFB instrument in one call. TradingView `TSE:` = Tokyo.

- [ ] T028 [US2] Add scanner access (markets list with totals, paged browse with filters, `update_mode` → dataStatus, pricescale/minmov → precision) to server/tradingviewClient.js and expose `GET /api/symbols/markets` and `GET /api/symbols/browse` in server/index.js via server/symbolCatalog.js (FR-013)
- [ ] T029 [US5] Rename the Tehran exchange prefix to `TSETMC:` across server/tseSource.js, server/symbolCatalog.js and server/dataFeed.js, route `TSE:` to TradingView (Tokyo) (FR-013)
- [ ] T030 [US5] Load ALL BrsApi `AllSymbols` instruments (stocks, rights, funds, bonds, options) with one snapshot per minute for live prices and on-demand cached daily history, respecting the fair-use limits, in server/tseSource.js (FR-013, FR-007)
- [ ] T031 [US2] Add the market browser (market tabs, exchange/type filters, infinite scroll, status badges, FA/EN) to the symbol-search dialog in client/src/main.js and client/src/i18n.js (FR-013)

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
