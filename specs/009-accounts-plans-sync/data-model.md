# Data Model: Accounts, Plans and Cloud Sync

Entities defined by `specs/009-accounts-plans-sync/spec.md` (Key Entities) and their realization in the codebase. All entities reside in server atomic JSON stores (`server/data/accounts/`), client `localStorage`, or in-memory runtime caches.

---

## 1. User (`User`)

The central user identity and account record.

- **Storage**: Server atomic JSON file `server/data/accounts/users.json` (array `users`, file mode `0o600`).
- **Fields**:
  - `id` (`string`, required): Unique identifier prefixed with `'u_'` followed by a UUID (e.g. `'u_f47ac10b-58cc-4372-a567-0e02b2c3d479'`).
  - `email` (`string`, required): Normalized lowercase email address. Validated by `EMAIL_RE` (`/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`).
  - `emailVerified` (`boolean`, required): Whether the user's email has been verified. Default `false`.
  - `verifyCode` (`string | null`): 6-digit verification code generated via `crypto.randomInt(100000, 999999)`.
  - `verifySentAt` (`number | null`): Epoch timestamp ms when the last verification code was issued (valid for 15 minutes).
  - `username` (`string`, required): Unique public handle (3–30 characters matching `/^[a-zA-Z0-9_]{3,30}$/`, checked against `USERNAME_BLOCK_RE`).
  - `usernameLower` (`string`, required): Lowercase version of username for case-insensitive uniqueness checks.
  - `usernameChanges` (`number`): Lifetime username change count. Clamped to maximum 2 (`USERNAME_CHANGE_LIMIT = 2`).
  - `displayName` (`string`, required): Public display name (max 64 chars). Defaults to `username`.
  - `salt` (`string`, required): 32-character hexadecimal string representing 16 cryptographically random bytes.
  - `hash` (`string`, required): 128-character hexadecimal string produced by `crypto.scryptSync(password, salt, 64)`.
  - `totpSecret` (`string | null`): 32-character base32-encoded 20-byte random secret used for RFC 6238 TOTP 2FA. `null` if disabled.
  - `pendingTotpSecret` (`string | null`): Unconfirmed base32 secret generated during `POST /api/auth/2fa/setup`. Cleared upon verification.
  - `plan` (`string`, required): Current plan tier ID (`'basic'`, `'essential'`, `'plus'`, `'premium'`, `'ultimate'`, or custom ID). Default `'basic'`.
  - `planSince` (`number`, required): Epoch timestamp ms when current plan was activated.
  - `planRequest` (`{ plan: string, at: number } | null`): Pending paid plan upgrade request awaiting admin approval.
  - `role` (`'user' | 'admin'`, required): Administrative privilege level. Default `'user'`.
  - `suspended` (`boolean`, optional): If `true`, login is blocked with HTTP 403 `account_suspended`.
  - `bio` (`string`, optional): Public biography text (max 280 characters).
  - `location` (`string`, optional): Geolocation or country text (max 80 characters).
  - `signature` (`string`, optional): Public trader signature (max 140 characters).
  - `avatarPreset` (`string`, optional): Selected preset icon identifier (max 24 characters, default `'mecha'`).
  - `timezone` (`string`, optional): IANA timezone identifier (max 48 characters, default `'UTC'`).
  - `currency` (`string`, optional): Preferred fiat/crypto display currency (max 8 characters, default `'USD'`).
  - `socialLinks` (`Record<string, string>`, optional): Map of allowed social networks (`x`, `youtube`, `facebook`, `instagram`, `website`). Plan-gated.
  - `resetCode` (`string | null`): 6-digit password reset code.
  - `resetExpiresAt` (`number | null`): Epoch timestamp ms when password reset code expires (15-minute TTL).
  - `createdAt` (`number`, required): Account creation timestamp ms.
  - `webhookTokenHash` (`string`, optional): SHA-256 hash of API secret for trade relay / webhook alerts.
- **Validation**:
  - `email` must be valid syntax and globally unique.
  - `username` must match `/^[a-zA-Z0-9_]{3,30}$/`, avoid blocklisted names (`admin`, `root`, `support`, etc.), and be globally unique.
  - `password` must pass `passwordOk` (string length $\ge 8$, non-empty).
  - `socialLinks` keys must belong to allowed set for the user's plan.
- **Limits**: Stored in `users.json`. Maximum 2 username modifications per lifetime.
- **Lifecycle**: Created via `POST /api/auth/register`; modified via `PATCH /api/auth/me`; deleted permanently via `DELETE /api/auth/me`.

---

## 2. Session (`Session`)

Represents an authenticated device session token.

- **Storage**: Server atomic JSON file `server/data/accounts/sessions.json` (array `sessions`, file mode `0o600`).
- **Fields**:
  - `id` (`string`, required): Internal session identifier prefixed with `'s_'` followed by a UUID (e.g. `'s_183491ba-0bb7-4566-a2dc-775cf518ef31'`).
  - `tokenHash` (`string`, required): 64-character hexadecimal SHA-256 hash of the 32-byte raw base64url token.
  - `userId` (`string`, required): Foreign key matching `User.id`.
  - `device` (`string`, required): Friendly device description derived from User-Agent: `'Desktop Browser'` or `'Mobile Browser'`.
  - `ua` (`string`, required): Client User-Agent header (truncated to max 180 chars).
  - `ip` (`string`, required): Client IP address (or `'unknown'`).
  - `createdAt` (`number`, required): Session issue timestamp ms.
  - `lastSeen` (`number`, required): Epoch timestamp ms of latest authenticated request.
  - `expiresAt` (`number`, required): Epoch timestamp ms when session becomes invalid (`createdAt + 30 * 24 * 3600 * 1000`).
  - *Transient Property* `token` (`string`, non-enumerable): The raw 32-byte base64url random token. Attached only on initial creation and delivered to the client via `Set-Cookie: tc_session=...`. Never serialized to disk.
- **Validation**: `tokenHash` must be exact 64-hex SHA-256 digest. Requests rejected if `Date.now() > expiresAt`.
- **Limits**: 30-day lifespan (`SESSION_TTL_MS = 2,592,000,000`).
- **Lifecycle**: Created on `login` or `register`; touched on every authenticated request (`lastSeen = Date.now()`); revoked individually via `DELETE /api/user/sessions/:sid`, collectively via `POST /api/auth/logout-all` or `POST /api/auth/change-password`, or pruned hourly by background GC timer (`gcExpiredSessions`).

---

## 3. Plan (`Plan`)

Canonical subscription tier defining entitlements, feature flags, and pricing.

- **Storage**: Server file `server/data/accounts/plans.json` (object `plans`, array `planOrder`, file mode `0o600`), seeded from `SEED_PLANS` in `server/accounts.js`.
- **Fields**:
  - `id` (`string`, required): Slug identifier (2–32 alphanumeric chars, hyphens, or underscores).
  - `priceUSD` (`number`, required): Monthly subscription price in USD (rounded to 2 decimals, min 0, max 100,000).
  - `priceYearlyUSD` (`number`, required): Yearly subscription price in USD.
  - `billingCycle` (`string`, required): Billing cadence (e.g. `'monthly'`).
  - `nameEn` (`string`, required): English plan title (max 40 chars).
  - `nameFa` (`string`, required): Persian plan title with proper ZWNJ (max 40 chars).
  - `descriptionEn` (`string`, required): English plan description (max 240 chars).
  - `descriptionFa` (`string`, required): Persian plan description (max 240 chars).
  - `badge` (`string`, required): English badge label (e.g. `'FREE'`, `'POPULAR'`, `'RECOMMENDED'`, `'PRO'`, `'VIP'`, max 16 chars).
  - `badgeFa` (`string`, required): Persian badge label (e.g. `'رایگان'`, `'محبوب'`, `'پیشنهادی'`, `'حرفه‌ای'`, `'ویژه'`, max 16 chars).
  - `color` (`string`, required): Hex color code matching `/^#[0-9a-fA-F]{6}$/`.
  - `order` (`number`, required): Sorting index in plan comparison matrix.
  - `isDefault` (`boolean`, required): Exactly one active plan must have `isDefault: true` (fallback tier, default `'basic'`).
  - `isActive` (`boolean`, required): Whether the plan is visible and selectable by non-admin users.
  - `features` (`Record<string, number | boolean>`, required): Dictionary mapping all 47 feature IDs from `FEATURES_CATALOG` to numeric quotas ($\ge 0$ or $-1$ for unlimited) or boolean flags.
- **Validation**: Input validated by `validatePlanInput()` in `server/accounts.js:210-250`. Default plan cannot be deactivated or deleted.
- **Limits**: Minimum 1 plan must exist. Built-in seed plans cannot be deleted (must be deactivated instead).
- **Lifecycle**: Seeded on startup; retrieved via `GET /api/plans`; managed by administrators via `/api/admin/plans`.

---

## 4. Cloud State (`CloudState`)

The per-user synchronized workspace document.

- **Storage**: Individual JSON files under `server/data/accounts/states/state_${userId}.json` (mode `0o600`), cached in-memory via `stateCache: Map<userId, { state, updatedAt }>`.
- **Fields**:
  - `updatedAt` (`number`, required): Epoch timestamp ms of last successful server write.
  - `state` (`Record<string, string | object>`, required): Key-value map of up to 19 client workspace settings:
    1. `profile` (`tradingchart_user_profile`): Institutional trader profile and preferences.
    2. `settings` (`tradingchart_user_settings`): General UI preferences and chart flags.
    3. `layouts` (`tradingchart_user_layouts`): Saved multi-chart layouts.
    4. `currentLayout` (`tradingchart_current_layout`): Active canvas layout state.
    5. `templates` (`tradingchart_user_templates`): Indicator bundle templates.
    6. `userWatchlists` (`tradingchart_user_watchlists`): Custom multi-watchlist collections.
    7. `watchlists` (`tradingchart_custom_watchlist`): Active watchlist symbol list.
    8. `alerts` (`tradingchart_alerts`): Active price and technical alert configurations.
    9. `paperAccounts` (`tradingchart_paper_accounts`): Paper trading portfolios and balances.
    10. `paperActive` (`tradingchart_paper_active`): Selected active paper account ID.
    11. `watchlistFlags` (`tradingchart_watchlist_flags`): Color flag tags for watchlist items.
    12. `priceStyle` (`tradingchart_price_style`): Selected candle/bar price rendering style.
    13. `drawingFavorites` (`tradingchart_drawing_favorites`): Pinned drawing tool favorites.
    14. `pineCode` (`tradingchart_pine_code`): Active custom Pine script in Pine Studio.
    15. `theme` (`tradingchart_theme`): Visual theme preference (`'dark'` / `'light'`).
    16. `tradeJournal` (`tradingchart_trade_journal`): Recorded trade executions and journal logs.
    17. `customTimeframes` (`tradingchart_custom_timeframes`): Pinned custom interval strings.
    18. `layoutSync` (`tradingchart_layout_sync`): Multi-chart symbol/crosshair sync preferences.
    19. `soundMuted` (`tradingchart_sound_muted`): Audio alert mute state (`'true'` / `'false'`).
- **Validation**:
  - Total JSON serialized byte length must not exceed 2MB (`STATE_MAX_BYTES = 2097152`), else HTTP 413.
  - Counts of `layouts`, `templates`, `userWatchlists`, `alerts`, `paperAccounts` must not exceed user's plan quotas, else HTTP 403 `limit_exceeded`.
  - Stale `baseUpdatedAt` returns HTTP 409 `conflict`.
- **Limits**: Maximum 2MB total payload size.
- **Lifecycle**: Retrieved via `GET /api/user/state`; written via `PUT /api/user/state`; deleted on account removal via `DELETE /api/auth/me`.

---

## 5. Outbox Message (`OutboxMessage`)

Queue entry for self-hosted verification and password reset code delivery.

- **Storage**: Server atomic JSON file `server/data/accounts/outbox.json` (array `messages`, file mode `0o600`).
- **Fields**:
  - `id` (`string`, required): UUID generated via `crypto.randomUUID()`.
  - `kind` (`'verify' | 'reset'`, required): Type of authentication message.
  - `email` (`string`, required): Recipient email address.
  - `code` (`string`, required): 6-digit decimal authentication code.
  - `at` (`string`, required): ISO-8601 UTC timestamp of creation.
- **Validation**: Automatically created by `outboxPush(kind, email, code)`.
- **Limits**: FIFO retention capped at exactly 200 messages (`if (box.messages.length > 200) box.messages.length = 200`).
- **Lifecycle**: Added on registration, email change, `request-verify`, or `request-reset`. Inspected by administrators via back-office console or helper function `outboxRead()`.

---

## 6. Audit Event (`AuditEvent`)

Append-only record of security and administrative operations.

- **Storage**: Append-only newline-delimited JSON file `server/data/accounts/audit.jsonl` (mode `0o600`), rotated when exceeding 2MB (`AUDIT_MAX_BYTES`).
- **Fields**:
  - `at` (`string`, required): ISO-8601 UTC timestamp.
  - `action` (`string`, required): Operation slug (e.g. `'plan.create'`, `'plan.update'`, `'plan.delete'`, `'user.plan_request'`).
  - `target` (`string | null`): Identifier of the affected entity (e.g. plan ID or user ID).
  - `ip` (`string`, required): Client IP address.
  - `adminSessionId` (`string | null`): Active admin session identifier, if privileged.
  - `adminUserId` (`string | null`): Active admin user identifier, if applicable.
  - `details` (`object`, required): Contextual payload (e.g. changed fields, previous/new values).
- **Validation**: Handled via `audit(req, action, target, details)` in `server/adminAuth.js`.
- **Limits**: Capped at 2MB with automatic rotation to `.1`.
- **Lifecycle**: Written synchronously upon privileged actions; read by administrators in back-office audit tab.

---

## 7. Auxiliary Client DTOs

### 7.1 Public User (`PublicUser`)
Sanitized user object returned by `/api/auth/me`, `/api/auth/login`, and `/api/auth/register`. Excludes `salt`, `hash`, `totpSecret`, `pendingTotpSecret`, `verifyCode`, and `resetCode`.
- **Fields**: `id`, `email`, `username`, `displayName`, `bio`, `avatarPreset`, `location`, `signature`, `socialLinks`, `plan`, `planSince`, `role`, `isAdmin`, `emailVerified`, `createdAt`, `usernameChangesLeft`, `totpEnabled`, `timezone`, `currency`, `planRequest`.

### 7.2 Safe User (`SafeUser`)
Export payload included in `/api/user/export`. Strips credentials and authentication secrets while preserving configuration and profile history.

### 7.3 Guest Workspace Mirror (`GuestWorkspaceMirror`)
Client `localStorage` key `'tradingchart_auth_mirror'`.
- **Fields**: `{ at: number, mirror: Record<string, string> }` storing all 19 workspace keys captured during session transitions.

### 7.4 Workstation Complete Backup (`WorkstationCompleteBackup`)
Offline JSON backup export generated by `userProfileModal.js` under filename `tradingchart-complete-backup-<date>.json`. Contains 15 workspace keys plus `exportedAt` and `app: 'tradingchart'`.
