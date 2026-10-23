# Chartivia — Inverted Spec-Driven Development (SDD) Guide

Chartivia (repo name TradingChart) is built with **Inverted SDD**: the founder states intent in
1-2 lines (text or voice); Hermes writes spec → plan → tasks, asks for one approval, then
implements and verifies. The governing document is `.specify/memory/constitution.md`.

## Where things are

| Need | Location |
|---|---|
| Principles, gates, workflow | `.specify/memory/constitution.md` |
| Feature specs (source of truth for behaviour) | `specs/NNN-name/` — `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, `contracts/`, `checklists/` |
| Feature map | `specs/README.md` |
| Spec gate (must exit 0) | `node scripts/sdd/verify_specs.mjs` |
| Spec Kit templates and scripts | `.specify/templates/`, `.specify/scripts/bash/` |
| Claude Code skills (`speckit-*`) | `.claude/skills/` |
| Architecture overview | `ARCHITECTURE.md` (marketing-heavy; specs win on conflict) |
| QA harness (shared lock) | `scripts/qa/qa_run.sh`, `qa_wait.sh`, `run_regression.sh` |

## The founder's loop (about one minute per feature)

1. **Intent** — e.g. "Add a ruler tool that shows price change, % and bar count."
2. **Approval** — Hermes replies with a summary of at most 10 lines: user stories, risks,
   task count, files touched, open questions (at most 3). Answer "approve" or one correction.
3. **Report** — Hermes returns with test evidence and the deployed result.

## Model split

- **Architect — Claude Opus 5.5, medium reasoning:** constitution, specs, plans, contracts,
  tasks, analysis and review. Never writes product code.
- **Implementer — Gemini 3.8 Flash High (`ag/gemini-3.8-flash-high`), ultra reasoning:** all
  code and tests, one `tasks.md` phase per delegation.
- The architect accepts a phase only after checking it against the spec and real test output.

## Hermes' loop

1. Find the owning spec in `specs/README.md`. New capability → new `specs/NNN-name/`
   (`speckit-specify`). Behaviour change → amend the owning spec first.
2. `speckit-plan` (Constitution Check table I-IX), `speckit-tasks` (exact file paths),
   `speckit-analyze` (cross-artifact consistency).
3. Approval gate (above).
4. `speckit-implement`; a task becomes `[x]` only after its code exists and its check passed.
5. Verify with the feature's `quickstart.md` through the QA lock, desktop|mobile × fa|en.
6. `node scripts/sdd/verify_specs.mjs` passes → commit on a feature branch → deploy with
   `bash scripts/build_and_restart.sh` (`BUILD_EXIT=0`, `SVC_HTTP=200`).

## Converge backlog

Every spec ends with `Phase N: Converge — open gaps`. These unchecked tasks are the honest
backlog found while reverse-specifying the existing code. Hermes works through them with the
same loop (`speckit-converge` re-scans code against specs and appends new gaps).

## Hybrid SDD tooling in this repo

- Gates and pipeline: `scripts/sdd/` (copied from https://github.com/98H/hybrid-sdd), config `.sdd/config.json`.
- `highRisk` paths (architect always reviews): accounts, admin auth/API, security, features catalog,
  trade relay, authManager.
- UI probe baseline (2026-10-23, `.sdd/baseline/ui_probe_2026-10-23.json`): landing page clean in all
  4 cells; `/chart` has 2 covered controls on desktop (Vela undo button and attribution under the
  quick-trade panel / an svg) and 11 sub-44px touch targets on mobile. These are the first Converge items.

## Acceptance tests and the app under test
`gates.mjs` builds and starts Chartivia from the phase worktree on port 18088 (copy of server/data), never
the production service on 8088. Acceptance tests MUST read `process.env.SDD_BASE_URL` (fallback
`http://127.0.0.1:8088` only for manual runs). All existing `tests/*.cjs|js` and `scripts/qa/security_smoke.sh` read `SDD_BASE_URL` (converted 2026-10-23;
verified: security smoke 27/27 against a separate instance on 18088).
