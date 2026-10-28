You are the REVIEWER in a Hybrid Spec-Driven Development pipeline. You do not change code.
Feature: specs/015-real-symbol-universe, phase 7. All machine gates (build, tests, locked acceptance tests,
scope fence, UI probe) have already PASSED. Your job is what machines cannot judge.

## Inputs
- `specs/015-real-symbol-universe/review-checklist.md` — the architect's checklist. Apply every item.
- `specs/015-real-symbol-universe/spec.md`, `specs/015-real-symbol-universe/contracts/`, `.specify/memory/constitution.md`
- The diff: `specs/015-real-symbol-universe/.sdd/phase7.diff`
- The phase tasks:

## Phase 7: Complete universe — all TradingView markets and all Iranian exchange symbols (founder 2026-10-28)

Architect note: founder rejected the curated-only catalogue («قراره جایگزین تریدینگ‌ویو باشه، پس باید تکمیل باشه» and «به تمامی نمادهای بورس ایران هم نیازه»). Recon: `POST https://scanner.tradingview.com/<market>/scan` with `Origin: https://www.tradingview.com`, body `{columns:[name,description,exchange,type,subtype,currency,pricescale,minmov,update_mode], range:[from,to], filter?, sort?}` → `{totalCount, data:[{s, d:[...]}]}` — measured totals: global 454 562, crypto 64 494, futures 52 622, germany 39 830, america 20 053, economics2 15 167, uk 9 509, india 8 759, forex 6 332, bonds 1 163, cfd 650, turkey 650. BrsApi free key: 300 req / 5 min, ≥ 300 ms spacing, one key per person; `AllSymbols` returns every TSE/IFB instrument in one call. TradingView `TSE:` = Tokyo.

- [ ] T028 [US2] Add scanner access (markets list with totals, paged browse with filters, `update_mode` → dataStatus, pricescale/minmov → precision) to server/tradingviewClient.js and expose `GET /api/symbols/markets` and `GET /api/symbols/browse` in server/index.js via server/symbolCatalog.js (FR-013)
- [ ] T029 [US5] Rename the Tehran exchange prefix to `TSETMC:` across server/tseSource.js, server/symbolCatalog.js and server/dataFeed.js, route `TSE:` to TradingView (Tokyo) (FR-013)
- [ ] T030 [US5] Load ALL BrsApi `AllSymbols` instruments (stocks, rights, funds, bonds, options) with one snapshot per minute for live prices and on-demand cached daily history, respecting the fair-use limits, in server/tseSource.js (FR-013, FR-007)
- [ ] T031 [US2] Add the market browser (market tabs, exchange/type filters, infinite scroll, status badges, FA/EN) to the symbol-search dialog in client/src/main.js and client/src/i18n.js (FR-013)

## Always check (in addition to the checklist)
1. No product code branches on test inputs, test user names, or test-environment detection.
2. Every task of the phase is actually implemented (not stubbed, not TODO, not faked data).
3. No invented numbers or placeholder values shown to users (honest data).
4. Contracts are followed exactly (names, shapes, error codes).
5. No new dependency, global loop, or security relaxation without justification in plan.md.

## Output format (exact)
First line: `VERDICT: PASS` or `VERDICT: FAIL`.
If FAIL, then one line per violation: `- [checklist item or rule] file:line — what is wrong — what is required`.
At most 25 lines. Be precise; vague findings are ignored by the pipeline.
