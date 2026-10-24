# Tasks: Accounts, Plans and Cloud Sync

**Input**: Design documents from `/specs/009-accounts-plans-sync/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-24)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML containers, CSS styling, backend entitlement catalog, and platform settings

- [x] T001 [P] Mount `.user-avatar-badge` and modal mount containers in client/chart/index.html (infra)
- [x] T002 [P] Define responsive CSS for avatar badge, dropdown menu, and modal overlays in client/styles/main.css (infra)
- [x] T003 [P] Define canonical 47-feature entitlement catalog and category metadata in server/featuresCatalog.js (infra)
- [x] T004 [P] Implement maintenance mode and registration toggles in server/platformSettings.js (infra)
- [x] T005 [P] Implement admin session verification and master key security in server/adminAuth.js (infra)

---

## Phase 2: Foundational (Core Storage, Crypto & Delivery Infrastructure)

**Purpose**: Scrypt password hashing, session tokens, outbox delivery queue, and rate limiting

- [x] T006 [P] Implement scrypt password hashing and SHA-256 session token hashing in server/accounts.js (FR-001, FR-003)
- [x] T007 [P] Implement sliding-window per-IP rate limiting across auth actions in server/accounts.js (FR-017)
- [x] T008 [P] Configure outbound SMTP transport with fallback to outbox queue in server/mailer.js (FR-006)
- [x] T009 [P] Implement self-hosted code queue with 200 FIFO retention in server/accounts.js (FR-006)
- [x] T010 [P] Implement storage write event bus interceptor in client/src/authManager.js (infra)

---

## Phase 3: User Story 1 - Register, verify and sign in (Priority: P1) 🎯 MVP

**Goal**: Guests can create an account, verify their email with a 6-digit code, sign in with email or username, and satisfy 2FA challenges.

- [x] T011 [US1] Implement registration validation, duplicate checks, and user creation in server/accounts.js (FR-001)
- [x] T012 [US1] Implement login credential verification, suspension checks, and TOTP step in server/accounts.js (FR-002)
- [x] T013 [US1] Implement 30-day HttpOnly session cookie issuance and hourly GC pruning in server/accounts.js (FR-003)
- [x] T014 [US1] Implement 6-digit email verification code generation and confirmation in server/accounts.js (FR-004)
- [x] T015 [US1] Implement progressive authentication modal and tab switching in client/src/authManager.js (FR-001, FR-002)
- [x] T016 [US1] Implement email verification modal flow and resend throttling in client/src/authManager.js (FR-004)
- [x] T017 [US1] Implement login TOTP 6-digit code challenge input step in client/src/authManager.js (FR-002)
- [x] T018 [US1] Implement session termination for single device and all devices in server/accounts.js (FR-003)

---

## Phase 4: User Story 2 - Recover access (Priority: P1)

**Goal**: Users who forgot their password can request a 6-digit reset code and set a new strong password.

- [x] T019 [US2] Implement account-enumeration-safe password reset code issuance in server/accounts.js (FR-005)
- [x] T020 [US2] Implement password reset confirmation, strength validation, and session revoking in server/accounts.js (FR-005)
- [x] T021 [US2] Implement 2-step password reset modal dialog and field bindings in client/src/authManager.js (FR-005)

---

## Phase 5: User Story 3 - Cloud sync of the workspace (Priority: P1)

**Goal**: Traders can synchronize their entire workspace across devices, resolve concurrent 409 conflicts, and toggle sync.

- [x] T022 [US3] Implement cloud state read and write endpoints with 2MB payload cap in server/accounts.js (FR-012)
- [x] T023 [US3] Enforce savedLayouts, templates, watchlists, alerts, and paperAccounts quotas in server/accounts.js (FR-012)
- [x] T024 [US3] Detect stale baseUpdatedAt and return 409 Conflict with server copy in server/accounts.js (FR-012)
- [x] T025 [US3] Implement 19-key workspace collection and application in client/src/authManager.js (FR-013)
- [x] T026 [US3] Implement 409 conflict resolution and list union rebase in client/src/authManager.js (FR-013)
- [x] T027 [US3] Implement guest workspace mirror capture and first-login cloud migration in client/src/authManager.js (FR-013)
- [x] T028 [US3] Implement 8-second debounced auto-sync timer and manual sync toggle in client/src/authManager.js (FR-013)

---

## Phase 6: User Story 4 - Manage the account (Priority: P2)

**Goal**: Users can edit their public profile, configure TOTP 2FA, change passwords, inspect/revoke active devices, export data, and delete accounts.

- [x] T029 [US4] Implement profile PATCH endpoint with username limit and plan-gated social links in server/accounts.js (FR-009)
- [x] T030 [US4] Implement RFC 6238 TOTP 2FA setup, enable, and password-guarded disable in server/accounts.js (FR-007)
- [x] T031 [US4] Implement password change requiring current password and revoking other devices in server/accounts.js (FR-008)
- [x] T032 [US4] Implement active session enumeration and individual session revocation in server/accounts.js (FR-010)
- [x] T033 [US4] Implement safe account data export in server/accounts.js (FR-011)
- [x] T034 [US4] Implement permanent account deletion requiring password in server/accounts.js (FR-011)
- [x] T035 [US4] Implement 5-tab Account & Billing modal interface in client/src/authManager.js (FR-007, FR-008, FR-009, FR-010, FR-011)
- [x] T036 [US4] Implement active devices modal with session revocation controls in client/src/authManager.js (FR-010)
- [x] T037 [US4] Implement offline workstation complete JSON backup and restore in client/src/userProfileModal.js (FR-011)

---

## Phase 7: User Story 5 - Plans and upgrades (Priority: P1)

**Goal**: Visitors can compare plan tiers; users can request plan upgrades; limits throughout the application trigger upgrade toasts.

- [x] T038 [US5] Implement plans catalog endpoint with user usage metrics in server/accounts.js (FR-014)
- [x] T039 [US5] Implement plan switching with pending approval state for paid tiers in server/accounts.js (FR-015)
- [x] T040 [US5] Implement pending plan request cancellation in server/accounts.js (FR-015)
- [x] T041 [US5] Implement plan comparison modal with 22-row feature matrix in client/src/authManager.js (FR-014)
- [x] T042 [US5] Enforce plan historical bars limit and header in server/index.js (FR-016)
- [x] T043 [US5] Enforce webhook alerts plan permission in server/tradeRelayApi.js (FR-016)
- [x] T044 [US5] Implement client-side entitlement check and localized upgrade toasts in client/src/authManager.js (FR-016)
- [x] T045 [US5] Render locked upgrade placeholder cards on docked side panels in client/src/main.js (FR-016)

---

## Phase 8: Polish & Cross-Cutting Integration

**Purpose**: Navigation bar avatar badge, bilingual layout parity, keyboard shortcuts, and XSS sanitization

- [x] T046 Render topbar avatar badge and dynamic account dropdown menu in client/src/authManager.js (FR-018)
- [x] T047 Bind Ctrl/Cmd+Shift+A keyboard shortcut to open back office for admin users in client/src/main.js (FR-018)
- [x] T048 Re-render open account dialogs upon dynamic language switch in client/src/authManager.js (FR-019)
- [x] T049 Sanitize user-provided text inputs via escapeHtml to neutralize XSS in client/src/authManager.js (FR-019)
- [x] T050 Support responsive mobile layout clamping and touch targets in client/src/authManager.js (FR-019)
