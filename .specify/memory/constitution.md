# Chartivia Constitution

Chartivia (formerly TradingChart) is a white-label, bilingual (FA/EN) charting and trading
platform built on the open LuxAlgo stack (Vela, PineTS, prop-firm-sim-core, journal-core).
It is developed by a single founder with Hermes Agent as the whole engineering team, using
Inverted Spec-Driven Development: the founder states intent, the agent writes and executes
the spec, plan and tasks, and the founder only approves.

## Core Principles

### I. Honest Data (NON-NEGOTIABLE)

- Every number shown to a user MUST come from a real source or be labelled as demo/synthetic
  in the UI next to the value. Live crypto and labelled demo markets are kept visibly apart.
- Fake metrics, placeholder latencies, invented backtest results or decorative "live" badges
  MUST NOT ship. A backtest MUST run the real Pine/PineTS engine on real bars.
- Alternative-data rows (SEC, Congress, 13F, FINRA) MUST carry their `sourceUrl`.

Rationale: trust is the product. One invented number destroys a trading tool's credibility.

### II. Spec Before Code, Agent Writes the Spec

- Every new feature or behaviour change MUST start as `specs/NNN-name/spec.md`, followed by
  `plan.md` and `tasks.md`, before source files change. Bug fixes that change no contract
  MAY skip the spec but MUST reference the spec they restore.
- The founder MUST NOT be asked to write specs. The agent drafts them from a 1-2 line intent
  (text or voice), then sends a short summary for a single approval.
- At most 3 `[NEEDS CLARIFICATION]` items per spec; everything else uses documented defaults.
- Tasks MUST name exact file paths and MUST be checked off only after the code exists and
  its verification has passed.

Rationale: the founder is the scarcest resource; specs keep a single agent from drifting.

### III. Real-Browser Zero-Defect Verification

- A feature is done only when its real-browser suite passes in every supported matrix cell:
  `desktop|mobile` × `fa|en`.
- An exit code is not a pass. Suites are judged by content (defect lines, result tables,
  `defects` arrays). Clicks MUST be real (`elementFromPoint` checked), never `el.click()`.
- Browser/app-touching runs MUST go through the shared QA lock (`scripts/qa/qa_run.sh`).
  Rate limiters MUST NOT be weakened for tests.
- After machine checks are clean, evidence screenshots MUST be regenerated and reviewed
  visually; every visual claim is a hypothesis settled from code before any change.
- Only code that was tested may be committed.

Rationale: the history of this repo shows DOM checks alone miss covered buttons, stale
toasts and bidi breakage.

### IV. Bilingual Parity and RTL Correctness

- Every user-visible string MUST exist in both EN and formal Persian (uniform respectful
  register, strict ZWNJ, Persian digits in FA). Units live in `featuresCatalog` or `tr()`.
- Prices, IDs, codes and credentials stay LTR inside RTL (`<bdi dir="ltr">`, `dir=ltr`
  inputs); free-text fields use `dir="auto"`. A Latin acronym followed by a number in
  Persian copy gets an RLM after the acronym.
- Language switching MUST re-localize open surfaces in place without reload.

### V. Mobile Fit and Interaction Safety

- Touch targets are at least 44px. No horizontal overflow at 390px.
- Toasts MUST never cover a reachable control; one toast per action; phone toasts stay
  on one line. Any new bottom-fixed bar joins the toast-placement avoid list.
- Horizontally scrollable regions show a visible scroll cue.

### VI. Security and Privacy by Default

- Auth, sessions, TOTP and admin access stay zero-dependency and server-enforced.
  Passwords use scrypt; sessions and admin sessions are stored hashed.
- The admin master key never reaches a client bundle. Paid plans are never self-granted.
- CSP, same-origin writes, per-IP rate limits and generic 5xx bodies stay on for every route.
- `server/data/` (users, sessions, keys, env) MUST NEVER be committed; every push diff is
  scanned for secrets and data paths.

### VII. Single Source of Truth for Entitlements

- Plan quotas and feature flags are defined only in `server/featuresCatalog.js` and enforced
  on the server (`/api/candles` history limit, state caps, downgrade rules). Client gates
  (`enforce`, `feature`) only mirror the server; they never replace it.

### VIII. Performance Budget

- The chart MUST stay smooth at 60 FPS with 50,000 bars.
- Tick streams are coalesced to at most one emit per 250 ms per subscriber; new stream
  consumers MUST throttle the same way.
- No perpetual DOM loop faster than 1000 ms, and every interval skips while
  `document.hidden`. The service stays inside its systemd budget (MemoryMax 420M).

### IX. Minimal Dependencies, No Vendor Edits

- New runtime dependencies require a written justification in the feature's `plan.md`.
- `node_modules` is never patched in place; vendor behaviour is changed through build
  transforms (see `vela-axis-locale` in `vite.config.js`) or wrappers.

### X. Hybrid SDD (NON-NEGOTIABLE)

- Roles: the founder gives intent and one approval per feature. The architect (Opus, medium
  reasoning) writes only documents. A cheap model (Gemini 3.8 Flash High) writes acceptance tests
  (test author), product code (implementer, ultra reasoning) and verdicts (reviewer), each in a
  separate one-shot session.
- Traceability: every requirement is `FR-xxx` and machine-checkable; every task cites exact paths
  and its FRs; every FR is covered by an acceptance test tagged `@spec NNN @covers FR-xxx`.
- No self-grading: acceptance tests are written before code by a session that never sees the
  implementation, red-checked, then locked by hash (`scripts/sdd/lock_tests.mjs`).
- Machine judges: a phase passes only when lock, scope fence, build, tests (judged by output
  content), UI probe and spec gate all pass, then the reviewer checklist. Gates fail closed.
- Architect budget: Opus is called once per feature and again only on escalation (3 failed
  attempts, spec problem, high-risk path listed in `.sdd/config.json`, reviewer doubt), and then
  reads verdict files, not diffs, except for high-risk paths.
- Tasks are ticked only by the pipeline after a PASS verdict.

## Technology and Operating Constraints

- Runtime: Node.js (ESM) + Express 4 + `ws`; client built by Vite 6 with three entries:
  landing `/`, chart app `/chart`, admin console `/admin`.
- Chart engine: `@luxalgo/vela` (WebGL2 with Canvas2D fallback); scripting: `pinets` and
  `@luxalgo/vela-pinets` executed client-side only.
- Storage: atomic JSON stores under `server/data/`; no external database until a spec
  justifies one.
- Deploy: `bash scripts/build_and_restart.sh`; success is `BUILD_EXIT=0` and `SVC_HTTP=200`
  on port 8088 (systemd unit `tradingchart`, public brand Chartivia).
- Data waterfall order: Binance Vision → exchange failover pool → labelled demo feeds.

## Development Workflow (Inverted SDD with Hermes)

1. Intent: the founder sends 1-2 lines or a voice note.
2. Specify: Hermes runs `speckit-specify` and writes `specs/NNN-name/spec.md`.
3. Plan and tasks: Hermes runs `speckit-plan` and `speckit-tasks` (contracts, data model,
   exact file paths), then `speckit-analyze` for consistency against this constitution.
4. Approval gate: Hermes sends a summary of at most 10 lines (stories, risk, task count,
   affected files). The founder answers "approve" or a one-line correction. This is the
   only founder step.
5. Implement: Hermes delegates `speckit-implement` to the implementation model, checking tasks
   off as code lands.

Model split (founder rule, 2026-10-23) — see Principle X; canonical method:
https://github.com/98H/hybrid-sdd (METHOD.md).
- Architect: Claude Opus 5.5 at medium reasoning produces ONLY documentation and framing.
- Implementer: Gemini 3.8 Flash High (`ag/gemini-3.8-flash-high`) at ultra reasoning, launched by
  `scripts/sdd/run_phase.sh` as a separate process, one `tasks.md` phase per run.
- Zero-token gates (`scripts/sdd/gates.mjs`, config `.sdd/config.json`) decide pass/fail.
6. Verify: real-browser suites for the touched surfaces in all four matrix cells, regression
   chain, visual review (Principle III).
7. Ship: commit on a feature branch, build and restart, report evidence to the founder.

## Governance

- This constitution supersedes ad-hoc practice. Every `plan.md` contains a Constitution
  Check; violations go in Complexity Tracking with a justification or the plan is rejected.
- Amendments: proposed by the agent or the founder, recorded here with a semantic version
  bump (MAJOR: principle removed or redefined; MINOR: principle or section added;
  PATCH: wording). The founder approves amendments.
- Retrofit note: the features under `specs/` were reverse-specified from the existing
  codebase on 2026-10-22 so the whole product is governed as if it had been built spec-first.
- Runtime guidance for agents: `docs/SDD.md`.

**Version**: 1.2.0 | **Ratified**: 2026-09-17 | **Last Amended**: 2026-10-23
