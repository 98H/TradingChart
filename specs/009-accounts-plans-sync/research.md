# Research: Accounts, Plans and Cloud Sync

History: `git log --format='%h %ad %s' --date=short -- server/accounts.js client/src/authManager.js server/featuresCatalog.js server/mailer.js client/src/userProfileModal.js`
— Initial account and session framework (`server/accounts.js`, `client/src/authManager.js`), cloud state synchronization with 409 conflict detection, 47-feature catalog integration (`server/featuresCatalog.js`), 2FA TOTP lifecycle, outbox queue delivery fallback (`server/mailer.js`), institutional profile integration (`client/src/userProfileModal.js`), and QA hardening cycles 1–13.

## R1. Zero-dependency native cryptography (`node:crypto` scrypt + SHA-256)

- **Decision**: Hash user passwords using Node.js built-in `crypto.scryptSync` with a unique 16-byte cryptographically random salt (`crypto.randomBytes(16)`), producing a 64-byte derived key. Session tokens are hashed using SHA-256 (`crypto.createHash('sha256')`).
- **Rationale**: Aligns strictly with Chartivia Constitution Principle VI ("Auth, sessions, TOTP and admin access stay zero-dependency and server-enforced"). Eliminates external native C++ dependency compilation risks (e.g. `bcrypt`, `argon2`) and supply-chain vulnerabilities. Scrypt is memory-hard and computationally intensive, protecting against GPU-based offline dictionary and rainbow-table attacks.
- **Alternatives considered**:
  - `bcrypt` npm package (rejected: introduces binary native dependency and slows cross-platform deploys).
  - Unsalted SHA-256 or MD5 (rejected: vulnerable to rainbow tables and fast ASIC brute force).
- **Evidence**: `server/accounts.js:410-440` (`hashPassword`, `verifyPassword`, `hashSessionToken`).

## R2. Session tokens stored hashed at rest in HttpOnly cookies

- **Decision**: Issue 32-byte base64url random tokens (`crypto.randomBytes(32).toString('base64url')`) stored inside an `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` (30-day TTL) cookie named `tc_session`. The server only persists the SHA-256 hash (`tokenHash`) in `server/data/accounts/sessions.json`. Requests arriving over HTTPS automatically receive the `; Secure` flag via `req.secure`.
- **Rationale**: Storing tokens hashed at rest guarantees that even if `sessions.json` leaks via backup exposure or disk read vulnerabilities, no attacker can replay the tokens to hijack sessions. `HttpOnly` and `SameSite=Lax` prevent token exfiltration via client-side XSS and cross-site request forgery.
- **Alternatives considered**:
  - JWT tokens stored in browser `localStorage` (rejected: vulnerable to client-side script theft via XSS; revoking individual JWTs requires complex distributed blacklists).
  - Storing raw plaintext tokens in `sessions.json` (rejected: security vulnerability on storage leak).
- **Evidence**: `server/accounts.js:555-601`, `server/accounts.js:926-941`.

## R3. Native RFC 6238 TOTP two-factor authentication

- **Decision**: Implement RFC 6238 Time-based One-Time Password (TOTP) verification using standard `node:crypto` HMAC-SHA1. Setup generates a random 20-byte base32 secret and standard `otpauth://` URI (`server/accounts.js:881-893`). Verification allows $\pm 1$ time step tolerance (30-second clock drift in either direction). Enabling requires a valid live code, and disabling requires both current password and a live code.
- **Rationale**: Zero external npm dependencies while maintaining 100% interoperability with standard mobile authenticator apps (Google Authenticator, Apple Passwords, 1Password, Aegis). Requiring password plus code on disable prevents an attacker with a stolen session cookie from turning off 2FA.
- **Alternatives considered**:
  - `otplib` or `speakeasy` npm libraries (rejected: violates zero-dependency constitution rule).
  - SMS-based 2FA (rejected: vulnerable to SIM swapping, carrier fees, external gateway dependencies).
- **Evidence**: `server/accounts.js:441-454,876-921`.

## R4. Optimistic concurrency cloud state sync with 409 conflict and in-memory union rebase

- **Decision**: Client pushes its serialized workspace dictionary to `PUT /api/user/state` alongside `baseUpdatedAt`. The server checks if its stored `updatedAt` is greater than `baseUpdatedAt`; if so, it responds with HTTP 409 Conflict containing `serverUpdatedAt` and `serverState`. The client merges server state (cloud wins for shared keys, local-only keys preserved) and performs set/map unions for cached in-memory list collections (`tradeJournal`, `watchlists`, `alerts`, `paperAccounts`), applies the merged result to `localStorage`, and immediately re-pushes once with the server timestamp.
- **Rationale**: Solves concurrent multi-device synchronization (e.g. desktop and mobile open simultaneously) without losing user data or suffering from destructive last-write-wins overwrites.
- **Alternatives considered**:
  - Unconditional last-write-wins (rejected: wipes out edits made on secondary devices).
  - Operational Transformation (OT) or CRDTs (rejected: excessive complexity for episodic workspace layout blobs).
- **Evidence**: `server/accounts.js:965-977`, `client/src/authManager.js:314-395`.

## R5. 2MB hard payload budget for cloud state documents

- **Decision**: `PUT /api/user/state` measures byte length of the incoming serialized state blob via `Buffer.byteLength(JSON.stringify(state))` and rejects payloads exceeding 2MB (`STATE_MAX_BYTES = 2 * 1024 * 1024 = 2097152`) with HTTP 413 `state_too_large`.
- **Rationale**: Prevents denial-of-service via disk exhaustion or memory ballooning on the Express server. Ensures rapid network transfer speeds over mobile network connections and adheres to systemd memory budgets.
- **Alternatives considered**:
  - Unrestricted state size (rejected: severe vulnerability to disk abuse).
  - 10MB budget (rejected: unnecessarily large for 19 JSON workspace settings keys).
- **Evidence**: `server/accounts.js:27,956-960`.

## R6. Progressive guest workspace with mirror migration on auth state transition

- **Decision**: Chartivia enables full workspace functionality in guest mode without registration. On sign-up or sign-in, existing `localStorage` keys mapped by `SYNC_MAP` are snapshotted into `localStorage.tradingchart_auth_mirror`. If the authenticating user account has no cloud state yet, the local guest state is uploaded to the cloud (`pushCloudState({ force: true })`). On sign-out, the guest mirror is preserved, session cleared, and workspace reset.
- **Rationale**: TradingView parity: friction-free guest onboarding. Users can draw lines, configure indicators, and build watchlists before registering, without losing their work when they decide to create an account.
- **Alternatives considered**:
  - Mandatory registration wall on page load (rejected: severely harms user conversion and initial utility).
  - Discarding guest storage on login (rejected: unacceptable data loss for prospective users).
- **Evidence**: `client/src/authManager.js:220-237,294-299,508-518`.

## R7. Sliding-window per-IP rate limiting on sensitive auth endpoints

- **Decision**: In-memory sliding timestamp bucket map (`rateBuckets = new Map()`) indexed by `${ip}:${action}`. Thresholds: `register` (5/min), `login` (10/min), `request-reset` (5/min), `reset` (10/min), `request-verify` (3/min), `twofa` (6/min), `delete_account` (3/min), `plan_request` (10/min). Exceeding the threshold returns HTTP 429 `{ ok: false, error: 'rate_limited' }`. The bucket map automatically clears if its size exceeds 5,000 entries.
- **Rationale**: Protects against credential stuffing, brute-force password guessing, email flooding, and automated resource exhaustion without adding external Redis or Memcached daemons.
- **Alternatives considered**:
  - `express-rate-limit` npm dependency (rejected: unnecessary extra dependency).
  - Distributed Redis rate limiter (rejected: breaks self-contained zero-external-database architecture).
- **Evidence**: `server/accounts.js:455-474,659,696,825,838,856,898,912,1018,1302`.

## R8. Dual-mode verification/reset delivery: SMTP with admin outbox fallback

- **Decision**: 6-digit verification and password reset codes are sent via `nodemailer` when SMTP is configured via `TC_SMTP_*` environment variables or `server/data/smtp.json`. Regardless of SMTP availability, every generated code is prepended to `server/data/accounts/outbox.json` (retaining up to 200 messages FIFO). `GET /api/platform` exposes `emailDelivery: boolean` so the frontend accurately informs the user whether codes arrive by email or admin delivery.
- **Rationale**: Chartivia is often deployed on private self-hosted servers or air-gapped workstations where outbound SMTP is unconfigured. The outbox queue ensures that administrators can manually inspect and deliver codes via the back-office console without blocking registration.
- **Alternatives considered**:
  - Failing registration when SMTP is unconfigured (rejected: makes local development and self-hosting impossible).
  - Storing codes in ephemeral memory (rejected: lost on server restart).
- **Evidence**: `server/mailer.js:1-74`, `server/accounts.js:475-494,1037-1040`.

## R9. Single source of truth for entitlements in `featuresCatalog.js` with hybrid enforcement

- **Decision**: Maintain a canonical catalog of 47 entitlement quotas and boolean flags in `server/featuresCatalog.js`. Server-side routes enforce security-sensitive quotas: candle history depth in `server/index.js` (`histBars` clamped via `X-History-Limit`), webhook alerts in `server/tradeRelayApi.js` (`webhookAlerts`), social links in `server/accounts.js:775-784`, and 5 persistent cloud state collections in `server/accounts.js:512-540` (`savedLayouts`, `savedTemplates`, `watchlists`, `priceAlerts`, `paperAccounts`). The client mirrors all 47 entitlements via `AuthManager.enforce()` and `AuthManager.feature()`, triggering localized upgrade toasts and locked UI placeholders.
- **Rationale**: WebGL canvas render loops and desktop panel interactions cannot perform synchronous network round-trips to the server on every candle tick or tool click. Splitting enforcement ensures client responsiveness while maintaining strict server data security.
- **Alternatives considered**:
  - Client-only enforcement (rejected: users could bypass plan limits by crafting HTTP requests).
  - Server-only enforcement (rejected: cannot gate client-side DOM elements or canvas indicator counts in real-time).
- **Evidence**: `server/featuresCatalog.js:1-592`, `server/accounts.js:512-540,775-784`, `server/index.js:93-97`, `client/src/authManager.js:98-200`.

## R10. Simulated billing vs admin approval for tier upgrades

- **Decision**: Switching to a free/default tier takes effect immediately. Requesting a paid tier (`priceUSD > 0`) creates a pending request (`req.user.planRequest = { plan, at }`) returning HTTP 202 `{ ok: true, pending: true }` which awaits administrator approval in the console, UNLESS `process.env.TC_BILLING_MODE === 'simulated'`, in which case paid plans activate immediately without payment.
- **Rationale**: Allows commercial deployments to hold user requests until out-of-band payment is confirmed, while enabling automated testing, staging environments, and self-hosted instances to evaluate all plan tiers without real payment gateway credentials.
- **Alternatives considered**:
  - Embedding fake credit card forms (rejected: deceptive and violates honest UX principles).
  - Restricting all instances to Basic tier only (rejected: prevents testing and demonstrating premium features).
- **Evidence**: `server/accounts.js:1287-1313`.

## R11. TradingView-parity username change policy

- **Decision**: Each user is permitted a maximum of 2 lifetime username changes (`USERNAME_CHANGE_LIMIT = 2`), tracked in `u.usernameChanges` and exposed as `usernameChangesLeft` in `publicUser`. Exceeding this limit returns HTTP 403 `{ ok: false, errors: [{ field: 'username', code: 'username_limit' }] }`.
- **Rationale**: Matches TradingView's policy to prevent identity churn, social handle squatting, and confusion in community spaces, while still giving users the flexibility to fix registration typos.
- **Alternatives considered**:
  - Unlimited username changes (rejected: handle poaching and user tracking chaos).
  - Completely immutable usernames (rejected: too harsh for users who registered with placeholder handles).
- **Evidence**: `server/accounts.js:387,613,756-763`.

## R12. Local workstation JSON backup & restore independent of cloud account

- **Decision**: Institutional user profile modal (`client/src/userProfileModal.js`) includes a "Data & Security" tab offering client-side full backup export (`exportFullBackup()`) and import (`importFullBackup()`) of 15 `tradingchart_*` storage keys in a single JSON payload (`tradingchart_complete_backup`), along with dedicated buttons to reset paper trading accounts and chart layouts.
- **Rationale**: Empowers privacy-conscious traders, offline users, and guest users to maintain portable snapshots of their entire workstation (layouts, templates, alerts, journals) without creating a cloud account.
- **Alternatives considered**:
  - Cloud-only data export (rejected: fails to serve guest users and violates offline autonomy).
- **Evidence**: `client/src/userProfileModal.js:485-570,723-868`.

---

## Spec/code mismatches

- FR-006: `server/mailer.js:48` catches nodemailer load failure and leaves transport null, but does not expose `lastError` on `GET /api/platform` (reports only `emailDelivery: false`).
- FR-009: `client/src/authManager.js:1124-1127` uses hardcoded English URLs for social placeholders (`'https://youtube.com/@channel'`, `'https://facebook.com/page'`, `'https://instagram.com/user'`, `'https://example.com'`) instead of localized Persian examples.
- FR-010: `client/src/authManager.js:1454,1677` silently ignores fetch errors with `catch (e) { /* ignore */ }` when fetching `/api/user/sessions` in `renderAccountTab` and `openDevicesModal`.
- FR-012: `server/accounts.js:512-515` validates only 5 array quotas (`savedLayouts`, `savedTemplates`, `watchlists`, `priceAlerts`, `paperAccounts`) on `PUT /api/user/state`; remaining 42 features from `featuresCatalog.js` are not checked during cloud state persistence.
- FR-013: `client/src/authManager.js:300` and `client/src/authManager.js:394` silently swallow errors (`catch (e) { /* offline: stay local */ }` and `catch (e) { /* next auto-sync tick retries */ }`) without alerting the user or updating sync status indicators in the UI.
- FR-014: `client/src/authManager.js:1320` silently swallows fetch errors with `catch (e) { /* leave placeholder */ }` when fetching `/api/plans` in `renderAccountTab` without an error banner.
- FR-018: `client/src/authManager.js:1687` renders raw untranslated server device strings `s.device` (`'Desktop Browser'` / `'Mobile Browser'`) directly in the sessions list in Persian mode.
- FR-019: `client/src/userProfileModal.js:35,38` hardcodes Persian default name `'حسین محمدی'` and bio unconditionally even when active language is English (`getLanguage() === 'en'`).
- FR-019: `client/chart/index.html:153` has static attribute `title="Institutional Desk: TC-8942-INST"` hardcoded in English before client runtime localization initializes.
