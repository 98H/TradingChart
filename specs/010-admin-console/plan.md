# Implementation Plan: Admin Console (Back Office)

**Branch**: `010-admin-console` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-admin-console/spec.md`

## Summary

The Admin Console (Back Office) provides a dedicated, self-contained administrative portal mounted at `/admin` for platform operators. It is designed to deliver complete operational governance over the Chartivia trading platform without external dependencies. The subsystem implements a multi-vector administrative authentication model supporting: (1) ephemeral 12-hour session cookies (`tc_admin`) minted via master key verification (`server/data/admin_master.key` or `TRADINGCHART_MASTER_KEY`), (2) account role-based authorization (`role === 'admin'`), and (3) rate-limited automation header access (`X-Master-Key`).

The console client (`client/admin/admin.js`, `client/admin/core.js`, `client/admin/plans.js`, `client/admin/admin.css`) is a zero-dependency Vanilla JS single-page application featuring hash-based routing across six functional sections:
1. **Login Gate**: Master key unlock with password visibility toggle, attempt rate limiting, and language switching.
2. **Dashboard**: High-level business and operational KPIs, interactive SVG 30-day signup bar chart, MRR calculation, plan distribution, and a 3-way scope filter (Real users, All, Test accounts).
3. **Users Management**: Debounced search, multi-field filtering, sorting, pagination, formula-injection-safe UTF-8 BOM CSV export, multi-selection bulk operations (plan reassignment, verification, suspension, deletion), and a slide-over user drawer for detail management (roles, notes, display names, 2FA reset, manual password recovery code relay, individual/bulk session revocation, and self-protection guardrails).
4. **Plan Catalog Editor**: Real-time plan configuration with a live pricing card preview, feature quota controls (with unlimited $\infty$ toggles), instant in-memory entitlement hot-reloading, reordering, cloning, deletion with automatic fallback user migration, seed plan reset, and a comprehensive cross-plan comparison matrix.
5. **Audit Log**: Chronological, searchable, and filtered trail of all privileged actions sourced from an append-only, auto-rotating 2 MB JSONL audit store.
6. **Platform Settings & System Health**: Global switches for open registration, maintenance mode, localized announcement banner management (severity levels, Persian/English copy with character limits), test email domain rules, Node.js process and OS health telemetry, active admin session tracking with revocation, and the outbound message queue.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser ESM; Node.js v20+ ESM on Express backend).

**Primary Dependencies**:
- `express`: `^4.21.2` (REST routing, cookie handling, and administrative API endpoints).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography for admin console UI).
- `@fontsource/inter`: `^5.3.0` (Latin typography and numerals).
- `puppeteer-core`: `^24.3.1` (Headless browser testing harness).
- Standard Node.js `node:crypto`, `node:fs`, and `node:os` (Zero external crypto, auth, or logging dependencies).

**Storage**:
- Client `localStorage`:
  - `tc_admin_lang`: Persisted interface language (`'fa'` or `'en'`).
- Cookies:
  - `tc_admin`: 32-byte base64url random session token in HttpOnly, SameSite=Strict cookie (Max-Age=43200s / 12 hours). Appends `Secure` flag on HTTPS requests.
- Server Atomic JSON and Protected Files (`server/data/`, mode `0o600`):
  - `admin_master.key`: Mode `0o600` file containing a 24-byte base64url random secret, generated on first boot if `TRADINGCHART_MASTER_KEY` environment variable is unset.
  - `accounts/admin_sessions.json`: Mode `0o600` JSON store of active admin sessions `{ sessions: [{ id, tokenHash, ip, ua, userId, createdAt, expiresAt }] }`.
  - `accounts/audit.jsonl`: Mode `0o600` append-only JSONL log of privileged events, automatically rotated at 2 MB (`AUDIT_MAX_BYTES = 2097152`), retaining the newest 50% of lines.
  - `accounts/platform_settings.json`: Mode `0o600` JSON store for operational platform flags (registration, maintenance, banner, test domains).
  - `accounts/plans.json`: JSON store holding custom and built-in plan tier definitions, pricing, quotas, and sort order.
  - `accounts/users.json`: Master user account registry, updated during role, plan, status, or user deletions.
  - `accounts/sessions.json`: Active user device sessions, queried for device inspection and revoked via user drawer.
  - `accounts/outbox.json`: FIFO queue of dispatched verification and password recovery codes, inspected in System Health.
  - `accounts/states/state_u_<userId>.json`: Per-user cloud state files, unlinked upon administrative account deletion.

**Testing**:
- Puppeteer E2E and Probe Test Suites:
  - `tests/qa_admin_cycle1.cjs`: Real-browser functional E2E suite verifying gate unlock, navigation, dashboard KPIs, user list, filtering, sorting, CSV export, user drawer actions, and bulk verification.
  - `tests/qa_admin_cycle2.cjs`: Real-browser functional E2E suite verifying plans editor, draft dirty states, leave guards, comparison matrix, platform settings, audit log, system health, and logout.
  - `tests/qa_admin_settings_effects.cjs`: Real-browser E2E verifying settings propagation to the main trading platform (announcement banner, registration gating, maintenance mode).
  - `tests/legacy/qa_accounts_cycle12_plans_admin.cjs`: Legacy E2E suite for plan studio CRUD, feature toggles, quotas, reordering, and clone.
  - `tests/legacy/qa_accounts_cycle13_plans_ui_deep.cjs`: Deep interactive legacy QA of plans studio UI.
  - `tests/probes/admin_dom_facts.cjs`: DOM probe for topbar layout, RTL button icon direction, CSS variables, and contrast.
  - `tests/probes/admin_explore.cjs`: Exploratory probe testing console navigation, DOM facts, and logout.
  - `tests/probes/admin_mx_overflow.cjs`: DOM probe testing comparison matrix overflow and scroll behavior.

**Target Platform**: Responsive web application running on desktop ($\ge 1024$px) and mobile ($\le 860$px down to 390px), supporting Persian (RTL, default) and English (LTR).

**Project Type**: Express REST API backend mounted under `/api/admin/*`, serving standalone single-page frontend application from `client/admin/index.html`.

**Performance Goals**:
- Admin session authentication bootstrap (`GET /api/admin/session`) under 15 ms.
- Dashboard KPI aggregation across thousands of users under 50 ms.
- User search filtering with 280 ms debounce for smooth typing responsiveness.
- Instant in-memory plan catalog hot-reloading (<5 ms) without dropped WebSocket streams or server restarts.
- Automatic audit log rotation at 2 MB without blocking HTTP event loop (<10 ms).

**Constraints**:
- Zero external database engines: atomic JSON file operations with temporary file rename pattern (`.tmp` -> target) and `0o600` POSIX permissions.
- Zero external authentication libraries: timing-safe SHA-256 master key comparison, SHA-256 hashed session tokens at rest, and 12-hour expiration window.
- Mandatory self-protection rules: server forbids self-demotion, self-suspension, and self-deletion for the active operator.
- Minimum 44px touch targets on mobile bottom navigation and action buttons.
- Dynamic toast clearance ensuring no toast obscures persistent controls, bottom navigation, or sticky save bars.

**Scale/Scope**:
- 6 back-office console sections (Dashboard, Users, Plans, Audit, Settings, System).
- 27 REST endpoints under `/api/admin/*`.
- 47 canonical entitlement features managed dynamically per plan tier.
- 1000 users maximum per bulk action batch.

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | All dashboard metrics (user counts, signups 24h/7d/30d, active sessions, MRR, plan distributions) and system health stats (uptime, Node RSS/heap, load average, storage bytes) are computed dynamically from authentic records in `users.json`, `sessions.json`, `admin_sessions.json`, and OS telemetry. No placeholder or synthetic numbers are rendered. |
| II | Spec Before Code | VIOLATION | Feature was implemented across September–October 2026 prior to adopting Inverted SDD methodology; this retrofit formalizes normative requirements (`spec.md`) and descriptive Spec Kit documentation without modifying production code. |
| III | Real-Browser Zero-Defect Verification | PASS | Three comprehensive Puppeteer test suites (`qa_admin_cycle1.cjs`, `qa_admin_cycle2.cjs`, `qa_admin_settings_effects.cjs`) and three DOM probes verify console operations across desktop and mobile viewports in both English and Persian (`en`/`fa`). |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | All 6 console sections, dialogs, and login gate provide comprehensive Persian and English copy with RTL/LTR layout mirroring and Persian number formatting (`Intl.NumberFormat('fa-IR')`). However, minor gaps exist: `invalid_action` and `announcement_empty` error codes lack localized mappings in `client/admin/core.js:125-154`, falling back to generic `unknown`. |
| V | Mobile Fit and Interaction Safety | PASS | Viewports $\le 860$px replace the desktop sidebar with a fixed 6-button bottom navigation bar (`nav.bottom-nav`), and render the users table as stacked cards (`.mlist`). Viewports $\le 980$px split the plan list and editor into sequential screens with `#pe-back`. Touch targets satisfy $\ge 44$px requirements. Dynamic toast positioning engine (`placeToasts`) pins toasts to the top header band on mobile, clearing the bottom navigation and thumb zone. |
| VI | Security and Privacy by Default | PASS | Master key is never shipped to client bundles; candidate keys are evaluated using `crypto.timingSafeEqual`; 12-hour HttpOnly SameSite=Strict `tc_admin` session cookie uses SHA-256 token hashing at rest; `/api/admin/auth` is rate-limited to 5 req/min; `X-Master-Key` headers are throttled to 10 failures/min per IP; query-string keys are refused; CSV exports feature formula-injection escaping (`'`); self-protection rules block self-demotion, self-suspension, and self-deletion; server data files use `0o600` permissions. |
| VII | Single Source of Truth for Entitlements | PASS | Feature entitlement keys and plan definitions originate in `server/featuresCatalog.js` and `server/data/accounts/plans.json`. Admin edits immediately update the in-memory `PLANS` dictionary and flush to disk, taking effect across platform runtime gates without restart. |
| VIII | Performance Budget | PASS | Audit trail rotates at 2 MB (`AUDIT_MAX_BYTES = 2097152`), retaining the newest half of lines; user search query input is debounced 280 ms; admin sessions are auto-pruned upon save; garbage collection timers use `.unref()`; system health disk queries avoid tight recurring loops. |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Zero external packages added for back-office features (standard Node.js `crypto`, `fs`, `os`, and Express 4); typography leverages pre-existing `@fontsource/vazirmatn` and `@fontsource/inter`; vendor code is untouched. |
| X | Hybrid SDD | VIOLATION | Code existed in production prior to SDD pipeline ratification. This retrofit establishes normative and descriptive Spec Kit artifacts to govern all future maintenance and convergence cycles. |

## Project Structure

### Documentation (this feature)

```text
specs/010-admin-console/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-017, SC-001..SC-005)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R12, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/admin/* REST routes, auth, schemas, errors)
│   └── module-api.md           # Client module interfaces (admin.js, core.js, plans.js)
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
└── admin/
    ├── index.html              # Standalone HTML entry point, meta tags, root container #adm-root
    ├── admin.js                # Console controller: router, gate, dashboard, users, audit, settings, system
    ├── core.js                 # Shared runtime: i18n (FA/EN), formatting, icons, API client, toasts, dialogs
    ├── plans.js                # Plan catalog editor: live pricing preview, quotas, matrix, reorder, clone
    └── admin.css               # Back-office stylesheet: theme variables, sticky save bars, mobile bottom nav

server/
├── adminAuth.js                # Master key management, 12h admin sessions, header rate limit, JSONL audit log
├── adminApi.js                 # Admin REST API routes: overview, users, sessions, 2FA/reset, audit, settings, system
├── platformSettings.js         # Platform config store: registration, maintenance, announcement, test domains
├── accounts.js (lines 1066–1286) # Admin plan catalog endpoints: inspect, create, update, delete, reorder, clone, reset
├── featuresCatalog.js          # Canonical 47-feature entitlement catalog and category metadata
└── data/
    ├── admin_master.key        # Mode 0o600 file holding 24-byte random master key secret
    └── accounts/
        ├── admin_sessions.json # Mode 0o600 JSON store for active admin sessions
        ├── audit.jsonl         # Mode 0o600 append-only JSONL audit log (auto-rotated at 2 MB)
        ├── platform_settings.json # Mode 0o600 JSON store for platform operational settings
        ├── plans.json          # JSON store containing plan tier records and planOrder
        ├── users.json          # Master user account registry
        ├── sessions.json       # User device sessions
        ├── outbox.json         # Message dispatch queue for verification and reset codes
        └── states/             # Per-user cloud state workspace storage directory

tests/
├── qa_admin_cycle1.cjs         # Real-browser E2E: gate, navigation, dashboard, users list, drawer, bulk
├── qa_admin_cycle2.cjs         # Real-browser E2E: plans editor, leave guards, matrix, settings, audit, system, logout
├── qa_admin_settings_effects.cjs # Real-browser E2E: settings propagation to trading platform (/chart)
├── legacy/
│   ├── qa_accounts_cycle12_plans_admin.cjs   # Legacy E2E: plans admin studio CRUD, user migration
│   └── qa_accounts_cycle13_plans_ui_deep.cjs # Legacy E2E: deep interactive UI test of plans studio
└── probes/
    ├── admin_dom_facts.cjs     # DOM probe: topbar layout, RTL icon direction, CSS variables, contrast
    ├── admin_explore.cjs       # Exploratory probe: navigation, DOM facts, and logout
    └── admin_mx_overflow.cjs   # DOM probe: comparison matrix overflow and scroll behavior
```

**Structure Decision**: Clean decoupling between privileged administrative security primitives (`server/adminAuth.js`), administrative REST routing (`server/adminApi.js`), plan lifecycle management (`server/accounts.js`), and operational platform toggles (`server/platformSettings.js`). On the frontend, `client/admin/admin.js` serves as the central router and coordinator, leveraging `client/admin/core.js` for localization, accessible modals, and dynamic toast placement, and delegating complex tier and quota administration to `client/admin/plans.js`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| II: Built prior to SDD adoption | Implemented across September–October 2026 before adopting Hybrid SDD methodology. | Retrofit procedure creates complete Spec Kit artifacts without risking regressions in stable production code. |
| IV: Unmapped error codes in client dictionary | `invalid_action` and `announcement_empty` lack explicit entries in `core.js:errMsg()` dictionary. | Server and client validation catch these states before form submission in standard flows; tracked in `research.md` mismatches for Converge phase. |
| X: Retrofit feature governance | Feature existed in production prior to SDD pipeline ratification. | Retrofit protocol documents existing code contracts to enable future gated enhancements. |
