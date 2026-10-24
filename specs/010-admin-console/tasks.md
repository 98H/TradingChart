# Tasks: Admin Console (Back Office)

**Input**: Design documents from `/specs/010-admin-console/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-24)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML containers, CSS stylesheet, shared console runtime, and theme variables

- [x] T001 [P] Mount document shell, viewport meta, theme colors, and `#adm-root` container in client/admin/index.html (infra)
- [x] T002 [P] Define dark theme variables, responsive layouts, sticky save bars, and mobile bottom nav in client/admin/admin.css (infra)
- [x] T003 [P] Implement bilingual runtime, number/date formatting, and SVG iconography dictionary in client/admin/core.js (infra)
- [x] T004 [P] Implement API fetch wrapper with JSON serialization and 403 unauthorized interception in client/admin/core.js (infra)

---

## Phase 2: Foundational (Core Authentication & Security Infrastructure)

**Purpose**: Master key management, ephemeral session minting, audit logging, and route guards

- [x] T005 [P] Implement master key file generation (mode 0o600) and timing-safe hash comparison in server/adminAuth.js (FR-002)
- [x] T006 [P] Implement 12-hour HttpOnly SameSite=Strict `tc_admin` session cookie issuance and SHA-256 token hashing in server/adminAuth.js (FR-002)
- [x] T007 [P] Enforce multi-vector administrative authorization (`role`, `token`, `key`) and 403 guard on `/api/admin/*` in server/adminAuth.js (FR-001)
- [x] T008 [P] Enforce IP-wide rate-limit lockout for failed `X-Master-Key` attempts and reject query-string keys in server/adminAuth.js (FR-003)
- [x] T009 [P] Implement append-only JSONL audit log with 2 MB half-file rotation in server/adminAuth.js (FR-014)

---

## Phase 3: User Story 1 - Secure sign-in to the console (Priority: P1) 🎯 MVP

**Goal**: Operators can authenticate via the master key or access the console directly with an administrative account role, with session persistence and rate limiting.

- [x] T010 [US1] Implement master key unlock endpoint `POST /api/admin/auth` with 5 req/min rate limit in server/adminApi.js (FR-002)
- [x] T011 [US1] Implement session inspection endpoint `GET /api/admin/session` and logout endpoint `POST /api/admin/logout` in server/adminApi.js (FR-004)
- [x] T012 [US1] Render login gate `#gate-form` with password eye toggle and attempt rate-limit alert in client/admin/admin.js (FR-002, FR-016)
- [x] T013 [US1] Bootstrap console authentication and redirect to dashboard or gate in client/admin/admin.js (FR-004, FR-016)
- [x] T014 [US1] Implement sign-out workflow with confirmation dialog and cookie revocation in client/admin/admin.js (FR-004, FR-016)

---

## Phase 4: User Story 2 - Dashboard (Priority: P2)

**Goal**: Operators see comprehensive platform KPIs, 30-day signup trajectories, plan distributions, and recent events scoped by user type.

- [x] T015 [US2] Implement overview metrics endpoint `GET /api/admin/overview` with 3-way scope filtering (`type=all|real|test`) in server/adminApi.js (FR-005)
- [x] T016 [US2] Render 16 KPI metric cards and plan distribution bars in client/admin/admin.js (FR-005, FR-016)
- [x] T017 [US2] Render interactive SVG 30-day signup bar chart with peak highlight and empty state handling in client/admin/admin.js (FR-005, FR-016)
- [x] T018 [US2] Render recent user registrations and latest audit trail feed in client/admin/admin.js (FR-005, FR-016)
- [x] T019 [US2] Implement 3-way scope selector buttons (`Real users`, `All`, `Test accounts`) in client/admin/admin.js (FR-005, FR-016)

---

## Phase 5: User Story 3 - Manage users (Priority: P1)

**Goal**: Operators can search, filter, paginate, export, bulk-modify, and manage individual user accounts, sessions, and recovery credentials.

- [x] T020 [US3] Implement filtered and paginated user query endpoint `GET /api/admin/users` in server/adminApi.js (FR-006)
- [x] T021 [US3] Implement formula-injection-safe UTF-8 BOM CSV export endpoint `GET /api/admin/users.csv` in server/adminApi.js (FR-006)
- [x] T022 [US3] Implement user detail and cloud state usage endpoint `GET /api/admin/users/:id` in server/adminApi.js (FR-007)
- [x] T023 [US3] Implement user attributes update endpoint `PATCH /api/admin/users/:id` with self-protection checks in server/adminApi.js (FR-008)
- [x] T024 [US3] Implement session revocation endpoints `POST /api/admin/users/:id/revoke-sessions` and `DELETE /api/admin/users/:id/sessions/:sid` in server/adminApi.js (FR-009)
- [x] T025 [US3] Implement TOTP reset endpoint `POST /api/admin/users/:id/reset-2fa` in server/adminApi.js (FR-009)
- [x] T026 [US3] Implement password reset code generator with offline fallback in `POST /api/admin/users/:id/send-reset` in server/adminApi.js (FR-009)
- [x] T027 [US3] Implement user deletion `DELETE /api/admin/users/:id` and bulk operations `POST /api/admin/users/bulk` in server/adminApi.js (FR-010)
- [x] T028 [US3] Render debounced user search, filter dropdowns, sorting headers, and pagination in client/admin/admin.js (FR-006, FR-016)
- [x] T029 [US3] Render multi-selection checkboxes and sticky bulk actions toolbar (`#u-bulk`) in client/admin/admin.js (FR-010, FR-016)
- [x] T030 [US3] Render slide-over user drawer (`.drawer`) with Overview, Sessions, and Activity tabs in client/admin/admin.js (FR-007, FR-008, FR-009, FR-016)
- [x] T031 [US3] Implement offline password recovery modal displaying 6-digit code for manual relay in client/admin/admin.js (FR-009, FR-016)
- [x] T032 [US3] Enforce disabled states for self-demote, self-suspend, and self-delete in client/admin/admin.js (FR-008, FR-010, FR-016)

---

## Phase 6: User Story 4 - Plan catalogue editor (Priority: P1)

**Goal**: Operators can configure plan definitions, pricing, feature quotas, and toggles with live preview, instant hot-reloading, reordering, and comparison matrix.

- [x] T033 [US4] Implement plans catalog inspection endpoint `GET /api/admin/plans` with user counts in server/accounts.js (FR-011)
- [x] T034 [US4] Implement plan creation `POST /api/admin/plans` and update `PUT /api/admin/plans/:id` in server/accounts.js (FR-011)
- [x] T035 [US4] Implement plan deletion `DELETE /api/admin/plans/:id` with automatic user migration fallback in server/accounts.js (FR-011)
- [x] T036 [US4] Implement plan reordering `POST /api/admin/plans/reorder`, cloning `POST /api/admin/plans/clone`, and seed reset `POST /api/admin/plans/reset` in server/accounts.js (FR-011)
- [x] T037 [US4] Enforce live in-memory plan mutation on `server/accounts.js:PLANS` without requiring server restart in server/accounts.js (FR-012)
- [x] T038 [US4] Render plan catalog studio with live pricing card preview (`#pf-preview`) and color swatches in client/admin/plans.js (FR-011, FR-016)
- [x] T039 [US4] Render 47-feature entitlement toggles and numeric quota fields with unlimited $\infty$ toggles in client/admin/plans.js (FR-011, FR-016)
- [x] T040 [US4] Implement dirty tracking, sticky save bar (`#pe-save`), and `Ctrl+S` / `Cmd+S` keyboard shortcuts in client/admin/plans.js (FR-011, FR-016)
- [x] T041 [US4] Implement navigation leave guards (`confirmLeavePlans`) blocking unsaved edit loss in client/admin/plans.js (FR-016)
- [x] T042 [US4] Implement new plan modal, duplicate plan modal, typed delete confirmation, and seed reset dialog in client/admin/plans.js (FR-011, FR-016)
- [x] T043 [US4] Render comprehensive 47-feature comparison matrix with boolean badges and quota units in client/admin/plans.js (FR-011, FR-016)

---

## Phase 7: User Story 5 - Platform settings, audit and system health (Priority: P2)

**Goal**: Operators can toggle registration and maintenance, broadcast announcements, define test domains, review audit logs, and monitor server health.

- [x] T044 [US5] Implement platform settings endpoints `GET/PUT /api/admin/settings` with field validation in server/platformSettings.js (FR-013)
- [x] T045 [US5] Implement filtered audit trail query endpoint `GET /api/admin/audit` in server/adminApi.js (FR-014)
- [x] T046 [US5] Implement system telemetry endpoint `GET /api/admin/system` and session revocation `DELETE /api/admin/sessions/:id` in server/adminApi.js (FR-015)
- [x] T047 [US5] Render platform settings form with maintenance confirmation modal and bilingual announcement textareas in client/admin/admin.js (FR-013, FR-016)
- [x] T048 [US5] Render audit log table with keyword search, action filters, outcome badges, and detail modals in client/admin/admin.js (FR-014, FR-016)
- [x] T049 [US5] Render system health view with uptime, memory, CPU load, storage files/bytes, and code outbox in client/admin/admin.js (FR-015, FR-016)
- [x] T050 [US5] Render active admin sessions list with "This browser" badge and remote session termination in client/admin/admin.js (FR-015, FR-016)

---

## Phase 8: Polish & Cross-Cutting Integration

**Purpose**: Responsive layout adaptations, dynamic toast clearance, focus trapping, and bilingual parity

- [x] T051 [P] Implement responsive sidebar-to-bottom-nav transition at $\le 860$px in client/admin/admin.css (FR-017)
- [x] T052 [P] Implement user table-to-card list transition (`.mlist`) at $\le 860$px in client/admin/admin.js (FR-017)
- [x] T053 [P] Implement sequential plan list and editor screens with back navigation at $\le 980$px in client/admin/plans.js (FR-017)
- [x] T054 [P] Implement dynamic toast placement engine (`placeToasts`) avoiding mobile nav and sticky toolbars in client/admin/core.js (FR-016)
- [x] T055 [P] Implement accessible modal dialog focus trap and keyboard navigation in client/admin/core.js (FR-016)
- [x] T056 [P] Support dynamic language toggle preserving in-memory plan and settings form drafts in client/admin/admin.js (FR-017)
- [x] T057 [P] Enforce LTR isolation for user IDs, emails, IP addresses, code values, and prices in client/admin/admin.js (FR-017)
