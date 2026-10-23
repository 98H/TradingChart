# Feature Specification: Accounts, Plans and Cloud Sync

**Feature Branch**: `009-accounts-plans-sync` (retrofit) — **HIGH RISK** (auth, security, plans)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Traders can use Chartivia as guests, then create an account to keep their whole workspace in the cloud across devices. Accounts must be secure (hashed passwords, sessions, 2FA, rate limits, verification, reset), plans must define what each user may do — enforced on the server where it matters — and upgrades must go through a clear plans page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register, verify and sign in (Priority: P1)

A guest creates an account (display name, email, username, password), verifies the email with a 6-digit code, signs out and signs in again with email or username; if 2FA is on, a 6-digit TOTP code is also required.

**Why this priority**: Without accounts nothing can be saved to the cloud or monetised.

**Independent Test**: Register a new user, verify with the code from the outbox, sign out, sign in by username, and see the avatar show the user.

**Acceptance Scenarios**:

1. **Given** valid fields, **When** the guest submits Sign Up, **Then** the account is created, a session cookie is set, the avatar shows the user and the verification flow opens.
2. **Given** an email or username already in use, **Then** registration fails with `email_taken` / `username_taken` shown on that field; a weak password gives `password_weak`.
3. **Given** wrong credentials, **Then** sign-in fails with `invalid_credentials`; a suspended account gets `account_suspended`.
4. **Given** a user with 2FA, **When** the password is correct, **Then** a 6-digit code step appears; a wrong code gives `invalid_totp`, the right code signs in.
5. **Given** registration closed by the admin, **Then** registration answers `registration_closed`; in maintenance mode auth answers `maintenance`.

---

### User Story 2 - Recover access (Priority: P1)

A user who forgot the password requests a reset code by email and sets a new password with the code.

**Acceptance Scenarios**:

1. **Given** "Forgot your password?", **When** an email is submitted, **Then** the response is always `ok` (no account enumeration) and, if the account exists, a 6-digit code is delivered (SMTP or, without SMTP, the admin outbox).
2. **Given** a valid code and a strong password, **Then** the password changes; an invalid code gives `invalid_code`.

---

### User Story 3 - Cloud sync of the workspace (Priority: P1)

A signed-in user's workspace (profile, settings, layouts, templates, watchlists, alerts, paper accounts, drawing favourites, Pine code, theme, journal, custom timeframes, layout sync, sound) is saved to the cloud and appears on another device; conflicting edits from two devices are merged, not lost; sync can be turned off.

**Acceptance Scenarios**:

1. **Given** a change on device A, **When** device B signs in, **Then** B shows the same workspace.
2. **Given** both devices changed list data since the last sync, **When** B pushes, **Then** the server answers `409 conflict` with its state, the client unions list data (watchlists, alerts, paper accounts, journal) and pushes again once.
3. **Given** a state above 2 MB, **Then** the push is rejected with `413 state_too_large`; **given** counts above the plan's limits, **Then** `403 limit_exceeded` with the violations.
4. **Given** a guest workspace, **When** the guest signs up or in, **Then** the guest workspace is kept (mirrored) and not silently lost; on sign-out the account workspace is not left behind for the next guest.
5. **Given** Sync: Off, **Then** no state is pushed or pulled until turned on again.

---

### User Story 4 - Manage the account (Priority: P2)

A user edits the public profile (7 avatar presets, display name, username with limited changes, bio ≤ 280, location, signature, social links allowed by plan), enables/disables 2FA, changes the password, reviews and revokes sessions, exports all data and deletes the account.

**Acceptance Scenarios**:

1. **Given** the Public profile tab, **When** a social network not allowed by the plan is set, **Then** the server rejects it with `plan_required` and the field is shown locked.
2. **Given** a password change, **Then** the current password is required and all other sessions are signed out.
3. **Given** the Sessions tab, **Then** active sessions with device, browser and last seen are listed; Revoke ends one, "Sign out all devices" ends all.
4. **Given** 2FA setup, **Then** a secret (and otpauth URL) is shown and 2FA turns on only after a valid code; disabling requires password and code.
5. **Given** Data, **When** the user downloads the export, **Then** a JSON with user, state and sessions is saved; deletion requires the password and typing "DELETE", then removes the account and its state.

---

### User Story 5 - Plans and upgrades (Priority: P1)

Any visitor compares plans (cards with prices and a feature matrix); a signed-in user requests a plan: free plans switch immediately, paid plans become a pending request until approved (or apply immediately in simulated billing mode) and can be withdrawn. When a user hits a limit anywhere in the app, a localized toast names the limit and the next plan.

**Acceptance Scenarios**:

1. **Given** the plans dialog, **Then** every active plan shows its price, badge and the feature comparison matrix; the current plan is marked.
2. **Given** a paid plan request, **Then** the response is `202 pending` and "Withdraw request" is offered; withdrawing clears it.
3. **Given** an unknown or inactive plan, **Then** the request fails with `unknown_plan` / `plan_inactive`.
4. **Given** a numeric limit reached, **Then** the toast reads "You've reached your plan's <label> limit (<limit>). Upgrade to <nextPlan> (<price>) to raise it." (Persian equivalent in FA); a disabled feature reads "The "<label>" feature is disabled in your current plan — upgrade to <nextPlan> (<price>)".

---

### Edge Cases

- Rate limits: register 5/min, login 10/min, request-reset 5/min, reset 10/min, request-verify 3/min, 2FA enable/disable 6/min, account deletion 3/min → `429 rate_limited`.
- Session cookie: HttpOnly, SameSite=Lax, 30-day lifetime, Secure over HTTPS; tokens stored hashed; expired sessions pruned hourly.
- Offline during sync → local state is kept and sync retries later.
- User whose plan no longer exists → treated as the default (basic) plan.
- Script tags in profile fields are neutralised (no XSS).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `POST /api/auth/register` MUST validate email, username (policy and blocklist) and password strength, reject duplicates with field errors (`email_taken`, `username_taken`), honour `registration_closed` and `maintenance`, create the user with a scrypt-hashed password and start a session.
- **FR-002**: `POST /api/auth/login` MUST accept email or username plus password, return `totpRequired` when 2FA is on and no valid code is given, and answer `invalid_credentials`, `invalid_totp`, `account_suspended` or `maintenance` as applicable.
- **FR-003**: Sessions MUST use a random 32-byte token in an HttpOnly, SameSite=Lax cookie (Secure over HTTPS) valid 30 days, stored only as a SHA-256 hash, with expired sessions removed hourly; `POST /api/auth/logout` and `logout-all` MUST end the current / all sessions.
- **FR-004**: Email verification MUST send a 6-digit code (`request-verify`, 3/min) and `POST /api/auth/verify` MUST mark the email verified or answer `invalid_code`.
- **FR-005**: Password reset MUST answer `ok` to `request-reset` regardless of account existence, deliver a 6-digit code when the account exists, and `POST /api/auth/reset` MUST set a new strong password or answer `invalid_code` / `password_weak`.
- **FR-006**: Codes MUST be delivered by SMTP when configured, otherwise queued in the admin outbox (max 200 messages), and `GET /api/platform` MUST report `emailDelivery` so the UI can tell the user how codes arrive.
- **FR-007**: TOTP 2FA MUST be set up (`2fa/setup` → secret + otpauth URL), enabled only with a valid code (`2fa/enable`), and disabled only with password and code (`2fa/disable`), with `already_enabled`, `no_pending_setup`, `not_enabled`, `invalid_code` errors.
- **FR-008**: `POST /api/auth/change-password` MUST require the current password, enforce strength and revoke the user's other sessions.
- **FR-009**: `PATCH /api/auth/me` MUST update username (limited lifetime changes → `username_limit`), display name, bio (≤ 280), location, signature, avatar preset, timezone, currency, email (triggers re-verification) and social links, rejecting networks not allowed by the plan with `plan_required` (basic: X, YouTube; essential/plus: + Facebook, Instagram; premium/ultimate: + website).
- **FR-010**: `GET /api/user/sessions` MUST list the user's sessions (device, user agent, IP, created, last seen, current) and `DELETE /api/user/sessions/:sid` MUST revoke one (`404 not_found` otherwise).
- **FR-011**: `GET /api/user/export` MUST return the user's safe profile, state and sessions; `DELETE /api/auth/me` MUST require the password (and the UI the typed confirmation "DELETE") and remove the user, sessions and state.
- **FR-012**: `GET /api/user/state` MUST return `{state, updatedAt, plan}`; `PUT /api/user/state` MUST reject states above 2 MB (`413 state_too_large`), stale `baseUpdatedAt` (`409 conflict` with server state), invalid payloads (`400 invalid_state`) and counts above the plan's `savedLayouts`, `savedTemplates`, `watchlists`, `priceAlerts` and `paperAccounts` (`403 limit_exceeded` with violations).
- **FR-013**: The client MUST sync the 19 mapped workspace keys, union list data on a 409 and retry once, keep local state when offline, preserve the guest workspace across sign-up/sign-in/sign-out, and offer a persistent Sync on/off toggle.
- **FR-014**: `GET /api/plans` MUST return active plans, order, the user's current plan, usage and admin flag; the plans dialog MUST show cards with prices and the feature comparison matrix and mark the current plan.
- **FR-015**: `POST /api/user/plan` MUST switch free plans immediately, create a pending request for paid plans (`202`) unless simulated billing is enabled, reject `unknown_plan` / `plan_inactive`, and `DELETE /api/user/plan-request` MUST withdraw a pending request.
- **FR-016**: The server MUST enforce the plan's `histBars` (005), `webhookAlerts` (006), social links (FR-009) and synced-state quotas (FR-012); every other entitlement MUST be enforced in the client with the localized upgrade toast naming the limit, the next plan and its price, and panels MUST show the locked placeholder.
- **FR-017**: All auth endpoints MUST apply the rate limits listed in Edge Cases and answer `429 rate_limited` above them.
- **FR-018**: The avatar menu MUST show guests the sign-in, sign-up and plans entries, and signed-in users their name, `@username`, plan badge, email verification state and entries for profile, account & billing, devices, plans, sync toggle and sign out; admins MUST be able to open the back office with Ctrl/Cmd+Shift+A.
- **FR-019**: All account dialogs MUST work in English and Persian (rtl) on desktop and mobile, and user-provided text MUST be rendered without executing markup.

### Key Entities

- **User**: id, email (+verified), username (+changes left), display name, password hash, TOTP secret/enabled, plan, pending plan request, profile fields, social links, role, status (active/suspended), webhook token hash.
- **Session**: token hash, user, device, user agent, IP, created, last seen, expiry.
- **Plan**: id, EN/FA names, price, badge, active/default flags, entitlements (47 catalogue keys: booleans and quotas).
- **Cloud State**: map of 19 workspace keys → serialized values, updatedAt.
- **Outbox Message**: kind (verify/reset), email, code, time.
- **Audit Event**: append-only record of plan changes, resets and user events.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A guest can register and reach a verified, signed-in state in under 2 minutes.
- **SC-002**: A workspace change on one device is visible on a second device after sign-in in 100% of runs.
- **SC-003**: Concurrent edits from two devices lose zero list items (watchlists, alerts, paper accounts, journal executions).
- **SC-004**: 100% of server-enforced limits (state size, synced quotas, histBars, social links, webhook) reject violations with the documented status and error code.
- **SC-005**: No password, session token or TOTP secret is ever stored or returned in plain text, except the TOTP secret once during setup.
- **SC-006**: Account suites (cycles 1-11) report zero defects in both languages and on mobile.

## Assumptions

- Payments are not integrated: paid plans are granted by admin approval (or immediately with `TC_BILLING_MODE=simulated`).
- Admin plan management (plans studio) is specified in 010-admin-console.
- "Gift subscription" (اشتراک هدیه) does not exist in the code; the open question is tracked once, in 010.
- Known gaps for Converge: 42 of 47 entitlements are client-only; silent failures in sync, plans and sessions fetches without user feedback; untranslated device names and social placeholders; a hard-coded Persian default name and bio in the trader profile shown in English; a hard-coded English desk title; mailer load errors not exposed in platform status.
