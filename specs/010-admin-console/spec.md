# Feature Specification: Admin Console (Back Office)

**Feature Branch**: `010-admin-console` (retrofit) — **HIGH RISK** (admin auth, user management, plans)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "As the operator I need a secure back office at /admin: see the business at a glance, find and manage any user, approve plan requests, edit the plan catalogue and its features without code, control registration, maintenance and announcements, read an audit trail of every privileged action, and check system health — in Persian and English, on desktop and phone."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure sign-in to the console (Priority: P1)

The operator opens `/admin` and signs in with the master key, or arrives already signed in as a user with the admin role; anyone else is refused.

**Why this priority**: Every other console function depends on trustworthy admin authentication.

**Independent Test**: Enter a wrong key (error shown), then the right key (dashboard shown); call an admin API without a session (403).

**Acceptance Scenarios**:

1. **Given** the gate, **When** a wrong key is submitted, **Then** "The admin key is incorrect." (Persian equivalent in FA) is shown and the field is marked invalid; after 5 attempts per minute further attempts are rate-limited.
2. **Given** the correct key, **Then** an admin session cookie (HttpOnly, SameSite=Strict, 12 h) is set and the dashboard opens.
3. **Given** a signed-in account with the admin role, **Then** the console opens without the key.
4. **Given** no admin credential, **When** any `/api/admin/*` route is called, **Then** it answers `403 forbidden_admin_only`; when a session expires mid-use the console shows the expiry toast and the gate.
5. **Given** Sign out, **Then** a confirmation is asked; key sessions are revoked and return to the gate, role sessions return to `/chart`.

---

### User Story 2 - Dashboard (Priority: P2)

The operator sees KPIs (users, new 24 h / 7 d / 30 d, active, sessions, verified, 2FA, suspended, admins, paid, plan requests, MRR), a 30-day sign-up chart, plan distribution, recent users and recent audit events, scoped to real users, all users or test accounts.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** the scope is switched between Real users, All and Test accounts, **Then** every KPI and chart reflects that scope.
2. **Given** no sign-ups in the window, **Then** the chart shows an empty state instead of bars.

---

### User Story 3 - Manage users (Priority: P1)

The operator searches and filters users (type, plan, status, role), sorts and pages, exports CSV, selects several users for bulk actions, and opens a user to change plan or role, edit name and notes, verify email, send a password reset, reset 2FA, mark as test account, approve or reject a plan request, revoke sessions, suspend or delete.

**Acceptance Scenarios**:

1. **Given** the users list, **When** the operator types a query, **Then** after a short debounce only matching users are listed and the CSV button shows the matching count.
2. **Given** Export CSV, **Then** a UTF-8 (BOM) CSV of the filtered users downloads with formula-injection-safe cells and the export is audited.
3. **Given** selected users and a bulk action (plan, verify, suspend, unsuspend, delete), **Then** a confirmation is required (delete: typing DELETE), the server reports done/skipped counts, and the list refreshes; the operator's own account is skipped for suspend and delete.
4. **Given** a user with a pending plan request, **When** the operator approves or rejects it, **Then** the user's plan changes (or not) and the request clears.
5. **Given** "Send password reset" without SMTP, **Then** the 6-digit code (15 min) is shown to the operator for manual delivery.
6. **Given** the operator's own account, **Then** demote, suspend and delete are disabled in the UI and refused by the server (`cannot_demote_self`, `cannot_suspend_self`, `cannot_delete_self`).
7. **Given** delete, **Then** typing the username is required; the user, sessions and cloud state are removed.

---

### User Story 4 - Plan catalogue editor (Priority: P1)

The operator edits plans: names, badges, descriptions (FA/EN), monthly and yearly price, colour, active/default flags, feature toggles and numeric quotas (with unlimited), with a live pricing-card preview; creates, duplicates, reorders, deletes (migrating users to the default plan) and resets plans; and views a comparison matrix of all plans.

**Acceptance Scenarios**:

1. **Given** an edit, **Then** the preview updates live, a dirty indicator and sticky save bar appear, and leaving the section asks for confirmation.
2. **Given** Save (button or Ctrl/Cmd+S), **Then** invalid fields are focused client-side; valid changes are saved and immediately become the entitlements used by the platform.
3. **Given** delete of a custom plan, **Then** typing its id is required and its users move to the default plan; deleting the default, the last or a built-in plan is refused.
4. **Given** unsetting or deactivating the default plan, **Then** it is refused (`cannot_unset_default`, `default_must_be_active`).
5. **Given** Reset plans, **Then** typing RESET is required and the seed plans are restored.

---

### User Story 5 - Platform settings, audit and system health (Priority: P2)

The operator toggles registration and maintenance mode, edits the announcement (FA/EN, level) and test-account domains; reads and filters the audit log; checks uptime, memory, load, storage, mail status, the outbox and active admin sessions (revoking them).

**Acceptance Scenarios**:

1. **Given** registration closed, **Then** sign-up on the platform answers `registration_closed`; **given** maintenance on (after confirmation), **Then** platform auth answers `maintenance`; **given** an announcement, **Then** the platform banner shows it in the user's language.
2. **Given** the audit log, **When** filtered by text, action or status, **Then** only matching events are listed with time, localized action, actor, detail, IP and status.
3. **Given** system health, **Then** server, storage, mail and outbox figures and admin sessions are shown; revoking a session ends it (revoking one's own signs out).

---

### Edge Cases

- `X-Master-Key` header access is allowed for automation but locked for the IP after 10 failed attempts per minute; keys in query strings are refused.
- Audit log rotates at 2 MB keeping the newest half.
- Switching language keeps unsaved drafts.
- Mobile (≤ 860 px): sidebar becomes a 6-button bottom navigation and the users table becomes cards; plan list and editor become separate screens below 980 px.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every `/api/admin/*` route MUST require an admin: a user with the admin role, a valid `tc_admin` session, or the `X-Master-Key` header; otherwise `403 forbidden_admin_only`.
- **FR-002**: `POST /api/admin/auth` MUST verify the master key (from `TRADINGCHART_MASTER_KEY` or a generated 0600 key file), limit attempts to 5/minute (`429 rate_limited`), answer `invalid_master_key` on mismatch, and on success set an HttpOnly, SameSite=Strict, 12-hour `tc_admin` cookie (Secure over HTTPS) backed by a hashed session record.
- **FR-003**: Failed `X-Master-Key` attempts MUST be limited to 10/minute per IP; master keys in query strings MUST be refused.
- **FR-004**: `GET /api/admin/session` MUST report whether the caller is admin, how (role, token, key), the actor and expiry; `POST /api/admin/logout` MUST revoke the session and clear the cookie.
- **FR-005**: `GET /api/admin/overview?type=all|real|test` MUST return the KPI set, plan distribution, 30-day sign-ups, recent users and recent events for that scope.
- **FR-006**: `GET /api/admin/users` MUST filter by `q, plan, role, status, type`, sort by username, plan, created, last seen or sessions, and paginate; `GET /api/admin/users.csv` MUST export the same filter as UTF-8 BOM CSV with formula-injection escaping and audit the export.
- **FR-007**: `GET /api/admin/users/:id` MUST return the user, sessions, usage (layouts, templates, watchlists, alerts, paper accounts, state size/time) and recent events, or `404 user_not_found`.
- **FR-008**: `PATCH /api/admin/users/:id` MUST change plan, clear a plan request, role, suspension (+reason), email verification, display name, test-account flag and notes, refusing `unknown_plan`, `cannot_demote_self`, `cannot_suspend_self`, `invalid_display_name`.
- **FR-009**: The admin MUST be able to revoke one or all sessions of a user, reset a user's 2FA (`twofa_not_enabled` if off), and send a password reset that returns the 6-digit code (15 min) when mail is not configured.
- **FR-010**: `DELETE /api/admin/users/:id` MUST require the matching confirmation (`confirm_mismatch`), refuse self-deletion, and remove user, sessions and state; `POST /api/admin/users/bulk` MUST apply suspend, unsuspend, plan, verify or delete to the given ids, skipping the caller for suspend/delete, and return done/skipped counts (`invalid_ids`, `invalid_action`, `unknown_plan`).
- **FR-011**: The plans API MUST list plans with catalogue, categories, built-ins and user counts; create, update, clone, reorder, delete (migrating users to the default plan) and reset to seed; and refuse `invalid_plan_id`, `plan_exists`, `validation_failed`, `plan_not_found`, `source_plan_not_found`, `invalid_order`, `cannot_delete_last_plan`, `cannot_delete_default_plan`, `cannot_delete_builtin_plan`, `cannot_unset_default`, `default_must_be_active`.
- **FR-012**: Plan changes MUST take effect for the platform's entitlement checks without restart.
- **FR-013**: `GET/PUT /api/admin/settings` MUST read and update registration, maintenance, announcement (enabled, level, FA, EN) and test domains with field validation errors, and the platform MUST honour them (registration_closed, maintenance, banner).
- **FR-014**: `GET /api/admin/audit` MUST filter and paginate the audit trail; every privileged action (auth, user changes, exports, bulk actions, plan changes, settings changes, session revocations) MUST append an event with time, action, result, actor, method, IP, target and metadata; the log MUST rotate at 2 MB.
- **FR-015**: `GET /api/admin/system` MUST report server (uptime, Node, memory, load, CPUs, key source), storage counts, outbox and mail status; `GET/DELETE /api/admin/sessions` MUST list and revoke admin sessions.
- **FR-016**: The console UI MUST provide the gate, dashboard, users (list + drawer), plans (editor + matrix), audit, settings and system sections with hash routing, leave-guards on unsaved edits, confirmation dialogs for destructive actions (typed confirmation for delete and reset), focus-trapped dialogs and toasts that avoid navigation areas.
- **FR-017**: The console MUST work in Persian (default, rtl) and English, remember the language, preserve drafts on language switch, and adapt to mobile (bottom navigation ≤ 860 px, card lists, split plan screens ≤ 980 px).

### Key Entities

- **Admin Session**: id, token hash, IP, user agent, user (if role-based), created, expiry (≤ 12 h).
- **Audit Event**: id, time, action, ok, actor, actor method, IP, target, metadata.
- **Platform Settings**: registrationOpen, maintenanceMode, announcement (enabled, level, FA, EN), testDomains, updatedAt.
- **Plan** and **User** as in 009.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `/api/admin/*` routes refuse callers without an admin credential.
- **SC-002**: 100% of privileged actions produce an audit event.
- **SC-003**: A plan quota changed in the editor is enforced on the platform for the next request without restart.
- **SC-004**: The operator can find a user by email or username and change their plan in under 30 seconds.
- **SC-005**: Admin suites (cycles 1-2, settings effects) report zero defects on desktop and mobile in both languages.

## Assumptions

- The console is a separate app at `/admin` sharing the account store with the platform (009).
- Gift subscriptions (dated or unlimited), requested by the founder on 2026-10-23, are specified as new work in 013-gift-subscriptions.
- Known gaps for Converge (high risk, architect review): nothing prevents demoting, suspending or deleting the **last** administrator; header-key lockout is IP-wide; `invalid_action` and `announcement_empty` lack localized messages; the settings form ignores server errors other than test domains; an unused helper.
