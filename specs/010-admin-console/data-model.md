# Data Model: Admin Console (Back Office)

**Branch**: `010-admin-console` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This document specifies the data model for the back-office admin console. It details all persistent and transient entities defined in `specs/010-admin-console/spec.md`, their concrete storage representations in server atomic JSON stores, cookies, and client memory, field definitions, validation rules, constraints, and operational lifecycles.

---

## 1. Admin Session (`AdminSession`)

Represents an active administrative session minted via master key unlock.

- **Storage**: Server atomic JSON file `server/data/accounts/admin_sessions.json` (array `sessions`, file mode `0o600`).
- **Fields**:
  - `id` (`string`, required): Unique session identifier formatted as `'as_' + crypto.randomBytes(6).toString('hex')` (e.g. `'as_f3b92a1c8e4d'`).
  - `tokenHash` (`string`, required): 64-character lowercase hexadecimal SHA-256 digest of the 32-byte base64url random session token (`crypto.createHash('sha256').update(token).digest('hex')`).
  - `ip` (`string`, required): Client IP address recorded at login (`req.ip` or empty string).
  - `ua` (`string`, required): Client `User-Agent` header, sliced to a maximum of 160 characters.
  - `userId` (`string | null`, required): User ID (`User.id`) if initiated by an account with the admin role, or `null` if unlocked purely via the master key.
  - `createdAt` (`number`, required): Epoch timestamp in milliseconds when the session was created.
  - `expiresAt` (`number`, required): Epoch timestamp in milliseconds when the session expires (`createdAt + 12 * 3600 * 1000`, 12 hours TTL).
  - *Transient Property* `token` (`string`, non-persisted): Raw 32-byte base64url random token. Attached to the return value of `createAdminSession()` and set in the client's `tc_admin` cookie. Never written to disk.
- **Validation**:
  - `tokenHash` must be a valid 64-character SHA-256 hex string.
  - Requests using the session are rejected if `Date.now() > expiresAt`.
- **Limits**:
  - Hard 12-hour lifespan (`ADMIN_SESSION_TTL_MS = 43,200,000`).
  - Expired sessions are filtered out on every write to `admin_sessions.json`.
- **Lifecycle**:
  - **Created**: Minted during `POST /api/admin/auth` upon successful master key verification.
  - **Verified**: Looked up on each request by `adminVia(req)` from the `tc_admin` cookie.
  - **Revoked**: Revoked individually via `POST /api/admin/logout` (clearing the cookie) or `DELETE /api/admin/sessions/:id`.
  - **Pruned**: Cleaned up automatically whenever `saveAdminSessions()` is invoked.

---

## 2. Audit Event (`AuditEvent`)

An immutable record of a privileged action or access attempt within the administrative subsystem.

- **Storage**: Server append-only JSONL file `server/data/accounts/audit.jsonl` (file mode `0o600`).
- **Fields**:
  - `id` (`string`, required): Unique event identifier formatted as `'ev_' + crypto.randomBytes(6).toString('hex')` (e.g. `'ev_7d2e4a8b1c90'`).
  - `at` (`number`, required): Epoch timestamp in milliseconds when the action occurred.
  - `action` (`string`, required): Dot-notated categorical action identifier:
    - Auth & Sessions: `'admin.unlock'`, `'admin.lock'`, `'admin.revoke_session'`
    - User Management: `'user.update'`, `'user.revoke_sessions'`, `'user.revoke_session'`, `'user.reset_2fa'`, `'user.send_reset'`, `'user.delete'`, `'users.bulk'`, `'users.export'`
    - Plans Catalog: `'plan.create'`, `'plan.update'`, `'plan.delete'`, `'plan.reorder'`, `'plan.clone'`, `'plan.reset'`
    - Platform Settings: `'settings.update'`
  - `ok` (`boolean`, required): Outcome of the operation (`true` for success, `false` for failure or rejection).
  - `actor` (`string`, required): Human-readable identifier of the acting identity:
    - User with admin role: username string (e.g. `'mohammadi'`)
    - Role session with master key: `'<username> (key)'`
    - Master key unlock: `'admin-session <6-hex>'`
    - Automation header: `'master-key'`
    - Unauthenticated guest attempt: `'guest'`
  - `actorVia` (`'role' | 'token' | 'key' | null`, required): Authentication vector used by the actor.
  - `ip` (`string`, required): Client IP address (`req.ip` or empty string).
  - `target` (`string | null`, optional): ID of the affected entity (e.g. user ID `'u_...'` or plan ID `'pro'`), or `null` for global actions.
  - `meta` (`Record<string, any> | null`, optional): Action-specific contextual payload:
    - User update: `{ username, changes: { field: [oldVal, newVal] } }`
    - User export: `{ count: number }`
    - Bulk action: `{ action, plan?, done, skipped }`
    - Plan deletion: `{ fallbackPlan, migratedUsers }`
    - Settings update: `{ fields: string[] }`
    - Auth failure: `{ reason: 'invalid_key' | 'rate_limited' }`
- **Validation**:
  - Record must serialize to a single-line JSON object without unescaped newline characters.
- **Limits**:
  - File rotates when file size exceeds 2 MB (`AUDIT_MAX_BYTES = 2097152`), retaining the newest 50% of lines.
- **Lifecycle**:
  - **Created**: Appended synchronously via `audit()` in `server/adminAuth.js`.
  - **Read**: Queried and parsed in reverse-chronological order via `readAudit()`, sliced and filtered for `GET /api/admin/audit` and `GET /api/admin/users/:id`.

---

## 3. Platform Settings (`PlatformSettings`)

Global operational parameters controlling access, announcements, and environment classifications.

- **Storage**: Server atomic JSON file `server/data/accounts/platform_settings.json` (file mode `0o600`).
- **Fields**:
  - `registrationOpen` (`boolean`, required): Global gate for new account creation. When `false`, `POST /api/auth/register` returns `403 registration_closed`. Default `true`.
  - `maintenanceMode` (`boolean`, required): Global maintenance switch. When `true`, regular platform sign-ins and registrations are blocked; administrators continue to have access. Default `false`.
  - `announcementEnabled` (`boolean`, required): Controls display of the top notification banner on the main platform. Default `false`.
  - `announcementLevel` (`'info' | 'warning' | 'success'`, required): Severity styling for the announcement banner. Default `'info'`.
  - `announcementFa` (`string`, required): Persian announcement banner copy (max 280 characters).
  - `announcementEn` (`string`, required): English announcement banner copy (max 280 characters).
  - `testDomains` (`string[]`, required): Array of lowercase email domain strings (max 50, each matching `DOMAIN_RE`) categorized as test accounts. Default `['test.io', 'qa.test', 't.io', 'example.com', 'test.local']`.
  - `updatedAt` (`number`, required): Epoch timestamp in milliseconds of the last settings modification.
- **Validation**:
  - `announcementLevel` must be one of `['info', 'warning', 'success']`.
  - Each domain in `testDomains` must match `^[a-z0-9.-]{2,60}\.[a-z]{2,24}$`.
  - If `announcementEnabled` is `true`, at least one of `announcementFa` or `announcementEn` must be non-empty (`announcement_empty`).
  - Text fields are trimmed and capped at 280 characters.
- **Limits**:
  - Maximum 50 test domains.
  - Maximum 280 characters per language for announcement messages.
- **Lifecycle**:
  - **Loaded**: Read from disk into memory cache `_cache` on server boot.
  - **Queried**: Returned via `GET /api/admin/settings` (full object) and `publicPlatformInfo()` (sanitized public subset).
  - **Updated**: Modified via `PUT /api/admin/settings`, updating `updatedAt`, resetting `_cache`, and writing atomically via `.tmp` rename.

---

## 4. Master Key Secret (`MasterKey`)

The root cryptographic secret providing emergency and automation access to the console.

- **Storage**: Server filesystem `server/data/admin_master.key` (mode `0o600`) or environment variable `TRADINGCHART_MASTER_KEY`.
- **Fields**:
  - Secret string containing at least 16 characters (default generated: 24-byte base64url random string, 32 characters).
- **Validation**:
  - Compared using timing-safe SHA-256 digest comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
- **Limits**:
  - Must never be serialized into client bundles, HTML templates, or log files.
  - Protected by a sliding-window rate limit of 5 requests/minute on `POST /api/admin/auth` and 10 failed attempts/minute per IP for `X-Master-Key` headers.
- **Lifecycle**:
  - Initialized once during Node.js module evaluation in `server/adminAuth.js:loadMasterKey`.

---

## 5. Admin User Projection (`AdminUserRow`)

Enriched user representation returned to the admin console for user listing, filtering, and detail drawers.

- **Storage**: In-memory projection constructed dynamically from `server/data/accounts/users.json` and `server/data/accounts/sessions.json`.
- **Fields**:
  - All public fields from `User` entity (defined in `specs/009-accounts-plans-sync/data-model.md`):
    - `id` (`string`): User UUID `'u_...'`.
    - `email` (`string`): User email address.
    - `username` (`string`): Unique user handle.
    - `displayName` (`string`): Public display name.
    - `plan` (`string`): Current plan ID.
    - `planSince` (`number`): Timestamp when current plan was granted.
    - `planRequest` (`{ plan: string, at: number } | null`): Pending upgrade request.
    - `role` (`'user' | 'admin'`): Account privilege role.
    - `isAdmin` (`boolean`): Convenience boolean mirroring `role === 'admin'`.
    - `emailVerified` (`boolean`): Email verification state.
    - `totpEnabled` (`boolean`): Whether 2FA is active.
    - `timezone` (`string`): IANA timezone string.
    - `currency` (`string`): Base currency.
    - `createdAt` (`number`): Account creation timestamp.
    - `usernameChangesLeft` (`number`): Remaining username modifications.
  - Admin-specific additions:
    - `isTest` (`boolean`): Evaluated via `isTestUser(u)` (domain match or manual override).
    - `testOverride` (`boolean`): Whether `u.testAccount` is explicitly set as a boolean.
    - `suspended` (`boolean`): Account suspension flag.
    - `suspendedAt` (`number | null`): Timestamp of suspension.
    - `suspendReason` (`string`): Internal explanation for suspension.
    - `notes` (`string`): Admin internal notes (up to 1000 characters).
    - `lastSeen` (`number | null`): Latest active session timestamp across all devices.
    - `sessions` (`number`): Count of currently active, non-expired sessions.
    - `planName` (`string`): English display name of current plan tier.
    - `planKnown` (`boolean`): Whether plan exists in active `PLANS` dictionary.
- **Lifecycle**:
  - Dynamically synthesized on request during `GET /api/admin/users`, `GET /api/admin/users/:id`, and `GET /api/admin/overview`.

---

## 6. Plan Record & Catalog (`Plan`)

The entitlement definition governing platform quotas and features.

- **Storage**: Server atomic JSON file `server/data/accounts/plans.json` (keys `plans` and `planOrder`).
- **Fields**:
  - `id` (`string`, required): Immutable lowercase plan identifier (2–32 alphanumeric characters, hyphens, or underscores).
  - `nameEn` (`string`, required): English name (max 40 characters).
  - `nameFa` (`string`, required): Persian name (max 40 characters).
  - `badge` (`string`, optional): English badge pill label (max 16 characters).
  - `badgeFa` (`string`, optional): Persian badge pill label (max 16 characters).
  - `descriptionEn` (`string`, optional): English plan description (max 240 characters).
  - `descriptionFa` (`string`, optional): Persian plan description (max 240 characters).
  - `priceUSD` (`number`, required): Monthly price in USD ($\ge 0$, max 100,000).
  - `priceYearlyUSD` (`number`, required): Annual price in USD ($\ge 0$, max 100,000).
  - `color` (`string`, required): Hex color code matching `/^#[0-9a-fA-F]{6}$/`.
  - `isActive` (`boolean`, required): Whether the plan is active and available for selection.
  - `isDefault` (`boolean`, required): Whether this tier is the system default. Exactly one plan must be default.
  - `order` (`number`, required): Display sort index.
  - `features` (`Record<string, boolean | number>`, required): Dictionary mapping 47 canonical feature IDs to boolean flags or numeric quotas (`-1` represents unlimited).
- **Validation**:
  - `validatePlanInput()` enforces non-empty names, character caps, non-negative prices, valid hex colors, and feature value types.
  - `isDefault` cannot be directly unset (`cannot_unset_default`); another plan must be marked default.
  - Default plan must remain active (`default_must_be_active`).
  - Built-in plans (`basic`, `pro`, `premium`) cannot be deleted (`cannot_delete_builtin_plan`).
- **Limits**:
  - Maximum 100,000 USD for monthly and annual prices.
  - Quotas bounded by `max` values defined in `server/featuresCatalog.js`.
- **Lifecycle**:
  - Managed via `/api/admin/plans` endpoints (create, update, clone, reorder, delete, reset). Updates flush to `plans.json` and immediately update in-memory `PLANS`.

---

## 7. Client Console State (`ConsoleState`)

In-memory reactive state managing UI views, form drafts, filters, and modals.

- **Storage**: Client memory (`client/admin/admin.js:app`, `client/admin/plans.js:S`, `client/admin/core.js:state`) and browser `localStorage`.
- **Fields**:
  - `localStorage['tc_admin_lang']`: Persistent language code (`'fa'` or `'en'`).
  - `core.js:state.lang`: Active language runtime reference.
  - `admin.js:app.session`: Active session metadata `{ isAdmin, via, actor, userId, username, expiresAt }`.
  - `admin.js:app.section`: Active navigation section (`'dashboard'`, `'users'`, `'plans'`, `'audit'`, `'settings'`, `'system'`).
  - `admin.js:app.users`: User table state `{ q, plan, role, status, type, sort, dir, page, pageSize, selected: Set, data }`.
  - `admin.js:app.audit`: Audit view filter state `{ q, action, status, page, data }`.
  - `admin.js:app.dashType`: Current dashboard scope (`'real'`, `'all'`, `'test'`).
  - `admin.js:app.settingsEdit`: Form draft for platform settings `{ s, orig, draft }`, surviving language toggles.
  - `plans.js:S`: Plan editor state `{ data, sel, draft, orig, raw, errors, mode, mobile, q, onlyChanged }`, surviving language toggles.
- **Lifecycle**:
  - Initialized on boot via `boot()`; preserved in memory during view routing and language toggling; destroyed upon tab reload or logout.
