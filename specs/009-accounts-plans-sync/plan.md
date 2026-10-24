# Implementation Plan: Accounts, Plans and Cloud Sync

**Branch**: `009-accounts-plans-sync` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-accounts-plans-sync/spec.md`

## Summary

The Accounts, Plans, and Cloud Sync subsystem provides end-to-end user identity management, multi-tier entitlement enforcement, and cross-device workspace synchronization for the Chartivia web charting platform. It encompasses zero-dependency authentication (`scrypt` password hashing, hashed session tokens, RFC 6238 TOTP 2FA, sliding-window rate limiting), email verification and password recovery with dual delivery (outbound SMTP or self-hosted admin outbox fallback), a canonical 47-feature entitlement catalog (`featuresCatalog.js`, `plans.json`) supporting five default tiers (Basic, Essential, Plus, Premium, Ultimate), and an optimistic-concurrency cloud state synchronization engine (2MB storage budget, 409 conflict detection with in-memory list union rebase, guest-to-account mirror handoff). Client-side components in `client/src/authManager.js` and `client/src/userProfileModal.js` coordinate responsive modals (login, registration, reset, 2FA, account & billing with 5 tabs, plans comparison matrix, offline backup & restore), topbar avatar status badges, and localized upgrade toasts.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser ESM; Node.js v20+ ESM on Express backend).

**Primary Dependencies**:
- `express`: `^4.21.2` (HTTP router, session middleware, REST endpoints).
- `nodemailer`: `^10.1.7` (Optional outbound SMTP delivery transport).
- `cors`: `^2.8.5` (CORS handling).
- `@luxalgo/journal-core`: `^0.1.0` (Round-trip trade analytics in user profile modal).
- `@fontsource/vazirmatn`: `^5.3.0` (Persian typography for account surfaces and modals).
- `@fontsource/inter`: `^5.3.0` (Latin typography).
- `puppeteer-core`: `^24.3.1` (Headless browser testing harness).
- Standard Node.js `node:crypto` and `node:fs` (Zero external crypto/auth dependencies).

**Storage**:
- Client `localStorage`:
  - `tradingchart_sync_enabled`: `'1'` (enabled) or `'0'` (disabled).
  - `tradingchart_auth_mirror`: Stashed guest workspace dictionary `{ at: number, mirror: { [cloudKey]: string } }` captured on signup/login/logout.
  - `tradingchart_user_profile`: JSON object `{ name, handle, avatar, bio, defaultAsset, defaultTimeframe, defaultRiskPct, defaultLeverage, defaultStartingCapital, timezone, currency, soundEnabled }`.
  - 19 mapped cloud keys: `profile`, `settings`, `layouts`, `currentLayout`, `templates`, `userWatchlists`, `watchlists`, `alerts`, `paperAccounts`, `paperActive`, `watchlistFlags`, `priceStyle`, `drawingFavorites`, `pineCode`, `theme`, `tradeJournal`, `customTimeframes`, `layoutSync`, `soundMuted`.
- Cookies:
  - `tc_session`: 32-byte base64url random token in HttpOnly, SameSite=Lax cookie (Max-Age=2592000s / 30 days). Appends `Secure` flag on HTTPS requests.
- Server Atomic JSON Stores (`server/data/accounts/`, mode `0o600`):
  - `users.json`: Persistent user registry (scrypt salt/hash, 2FA secrets, plan tiers, profile attributes).
  - `sessions.json`: Active sessions stored as SHA-256 hashes (`tokenHash`), device metadata, IP, UA, expiration timestamp.
  - `plans.json`: Plan tier definitions, prices, badges, and 47-feature entitlement matrices.
  - `outbox.json`: Self-hosted delivery queue for 6-digit verification and password reset codes (capped at 200 FIFO).
  - `states/state_${userId}.json`: Per-user cloud state workspace JSON blobs (capped at 2MB).
  - `audit.jsonl`: Append-only audit trail logging administrative and user events.
  - `server/data/smtp.json`: Optional SMTP credentials configuration file.

**Testing**:
- Puppeteer E2E Test Harness (13 test suites):
  - `tests/qa_accounts_cycle1.cjs`: Register, login, session persistence across reloads, logout, error states.
  - `tests/qa_accounts_cycle2.cjs`: Multi-device cloud sync (desktop mutate -> mobile pull), local persistence.
  - `tests/qa_accounts_cycle3.cjs`: Plan tiers entitlement gates, upgrade toasts, comparison modal.
  - `tests/qa_accounts_cycle4.cjs`: Persian/English RTL parity, mobile viewport fit, input validation errors.
  - `tests/qa_accounts_cycle5.cjs`: Account & Billing modal (2FA toggle, session revocation, data export, account deletion).
  - `tests/qa_accounts_cycle6.cjs`: Password reset via outbox code, keyboard navigation, rate-limit UX.
  - `tests/qa_accounts_cycle7.cjs`: Public profile, avatar presets, username policy, social plan gates, 2FA lifecycle, histBars gate.
  - `tests/qa_accounts_cycle8.cjs`: Exploratory dogfooding across all 5 account tabs, mobile/desktop viewports, FA/EN.
  - `tests/qa_accounts_cycle9.cjs`: Adversarial security (XSS neutralization, double submit, session revoke on pw change, 2MB cap 413, downgrade limits).
  - `tests/qa_accounts_cycle10.cjs`: Sync semantics: 409 conflict rebase, guest-to-user mirror, email reverification, sync toggle.
  - `tests/qa_accounts_cycle11.cjs`: Exploratory edge cases: profile modal while signed in, mobile FA guest menu, live language switch.
  - `tests/legacy/qa_accounts_cycle12_plans_admin.cjs`: Back-office plans studio CRUD, feature toggles, user migration on delete.
  - `tests/legacy/qa_accounts_cycle13_plans_ui_deep.cjs`: Deep interactive QA of plans studio UI, clone, reset, reorder.

**Target Platform**: Responsive web application running on desktop (>=1024px) and mobile (<=768px down to 390px), supporting Persian (RTL) and English (LTR).

**Project Type**: Express REST API backend mounted under `/api/auth`, `/api/user`, `/api/plans`, and `/api/platform`, with client coordinator in `client/src/authManager.js` and `client/src/userProfileModal.js`.

**Performance Goals**:
- Session bootstrap via `GET /api/auth/me` under 50 ms.
- Password hashing with `scrypt` calibrated for security without stalling Node event loop (<100 ms per hash).
- Cloud state payload transfer under 2MB; debounced push interval of 8 seconds on storage writes.
- 409 conflict resolution and list union rebase executed client-side in <20 ms.
- Hourly session GC pruning expired tokens in <5 ms.

**Constraints**:
- Zero external database engines: atomic JSON file operations with temporary file rename pattern and `0o600` POSIX file modes.
- Session tokens stored exclusively as SHA-256 hashes at rest; passwords stored with unique 16-byte random salt and `scrypt` derivation.
- Strict per-IP sliding-window rate limiting on all auth endpoints (5-10 req/min).
- Minimum 44px touch targets on mobile modal buttons and list items.

**Scale/Scope**:
- 5 built-in plan tiers (Basic, Essential, Plus, Premium, Ultimate) and dynamic custom plan support.
- 47 canonical entitlement features categorized into 6 domains (`chart`, `alerts`, `screener`, `trading`, `backtest`, `platform`).
- 19 synchronized workspace keys.
- Up to 2 lifetime username changes per account (`USERNAME_CHANGE_LIMIT = 2`).

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | All user records, password hashes, session hashes, TOTP secrets, and cloud state timestamps are authentic. Billing is explicitly documented as simulated / admin-approved without fake payment confirmations. No synthetic metrics or fabricated account figures are displayed. |
| II | Spec Before Code | VIOLATION | Feature was implemented across September–October 2026 prior to adopting Inverted SDD methodology; this retrofit formalizes normative requirements (`spec.md`) and descriptive Spec Kit documentation without modifying production code. |
| III | Real-Browser Zero-Defect Verification | PASS | Eleven comprehensive Puppeteer test suites (`qa_accounts_cycle1.cjs` through `qa_accounts_cycle11.cjs`) verify authentication, cloud sync across simulated desktop/mobile devices, 2FA lifecycle, 409 conflict rebase, adversarial XSS, rate limiting, and bilingual layout cells. |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | Core modals and menu items have 100% Persian/English translations. However, minor gaps exist: untranslated device strings (`s.device` `'Desktop Browser'` / `'Mobile Browser'`) in `authManager.js:1687`, hardcoded English URLs in social placeholders in `authManager.js:1124-1127`, hardcoded Persian default name `'حسین محمدی'` and bio in `userProfileModal.js:35,38` shown in English mode, and static HTML `title="Institutional Desk: TC-8942-INST"` in `client/chart/index.html:153`. |
| V | Mobile Fit and Interaction Safety | PASS | Modals and account dropdown menu dynamically clamp inside the viewport (`authManager.js:675-677`); touch targets meet 44px requirements; responsive CSS adapts cleanly to 390px viewports without horizontal overflow (`client/styles/main.css`). |
| VI | Security and Privacy by Default | PASS | Passwords hashed with `scrypt`; session tokens stored as SHA-256 hashes; sessions use 30-day HttpOnly, SameSite=Lax cookies with Secure flag over HTTPS; master key never sent to client; TOTP secret shown once on setup; sensitive fields stripped from `/api/user/export`; XSS neutralized via `escapeHtml()`; per-IP sliding window rate limiting on all sensitive endpoints; atomic JSON file writes with mode `0o600`. |
| VII | Single Source of Truth for Entitlements | VIOLATION | Plan quotas and feature flags are defined in `server/featuresCatalog.js` and `server/accounts.js`. While server enforces `histBars`, `webhookAlerts`, social links, and 5 cloud-state quotas (`savedLayouts`, `savedTemplates`, `watchlists`, `priceAlerts`, `paperAccounts`), 42 other feature flags are client-enforced in `authManager.js:enforce()` without server-side gate validation. |
| VIII | Performance Budget | PASS | Cloud state size is strictly budgeted and capped at 2MB (`STATE_MAX_BYTES = 2097152` -> 413); auto-sync is throttled and debounced to at most once per 8 seconds via `_dirty` flag; session garbage collection runs once per hour with `.unref()`; no perpetual tight polling loops. |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Zero external dependencies for crypto/auth (uses `node:crypto`); optional outbound email uses standard `nodemailer`; no vendor packages edited in place. |
| X | Hybrid SDD | VIOLATION | Code was developed before SDD ratification. This retrofit creates complete descriptive Spec Kit artifacts to govern all future maintenance and convergence cycles. |

## Project Structure

### Documentation (this feature)

```text
specs/009-accounts-plans-sync/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-019, SC-001..SC-006)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R12, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/auth/*, /api/user/*, /api/plans, /api/platform)
│   └── module-api.md           # Client module interfaces, methods, and wiring
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Topbar user avatar element (.user-avatar-badge), modal mount points
├── src/
│   ├── authManager.js          # Client account coordinator, session bootstrap, modals, sync engine
│   ├── userProfileModal.js     # Institutional trader profile modal, stats, local JSON backup/restore
│   ├── main.js                 # App coordinator, avatar badge binding, plan enforcement on docks
│   └── i18n.js                 # Localization helper and Persian digit formatting
├── styles/
│   └── main.css                # CSS styles for user badge, modals, tabs, plan cards, active states
server/
├── accounts.js                 # Core account system: auth, sessions, TOTP, cloud sync, plan routing
├── mailer.js                   # Outbound SMTP email delivery with outbox queue fallback
├── featuresCatalog.js          # Canonical 47-feature entitlement dictionary with EN/FA metadata
├── adminAuth.js                # Admin session verification, master key auth, audit log appender
├── platformSettings.js         # Maintenance mode, open registration toggle, announcement banner
├── index.js                    # Express HTTP server mounting accounts, /api/candles depth gate
└── data/accounts/
    ├── users.json              # Persistent user store (scrypt passwords, TOTP secrets, plans)
    ├── sessions.json           # Active session tokens (SHA-256 hashed at rest)
    ├── plans.json              # Plan tier definitions and feature matrices
    ├── outbox.json             # Verification & reset code delivery queue
    ├── states/                 # Directory holding per-user cloud state JSON blobs
    │   └── state_${userId}.json
    └── audit.jsonl             # Append-only audit log
tests/
├── qa_accounts_cycle1.cjs      # E2E test: auth basics, sessions, cookies, error codes
├── qa_accounts_cycle2.cjs      # E2E test: cloud sync across desktop and mobile devices
├── qa_accounts_cycle3.cjs      # E2E test: plan tiers entitlement gates and comparison modal
├── qa_accounts_cycle4.cjs      # E2E test: i18n/RTL parity, mobile viewport fit, field validation
├── qa_accounts_cycle5.cjs      # E2E test: Account & Billing modal, 2FA, session revoke, deletion
├── qa_accounts_cycle6.cjs      # E2E test: password reset outbox flow, keyboard nav, rate limiting
├── qa_accounts_cycle7.cjs      # E2E test: public profile, avatar presets, username policy, social gates
├── qa_accounts_cycle8.cjs      # E2E test: exploratory dogfooding across all 5 account tabs
├── qa_accounts_cycle9.cjs      # E2E test: adversarial security (XSS, double-submit, 2MB cap 413)
├── qa_accounts_cycle10.cjs     # E2E test: sync semantics: 409 conflict rebase, guest-to-user mirror
├── qa_accounts_cycle11.cjs     # E2E test: exploratory edge cases: profile while signed in, mobile menu
├── legacy/
│   ├── qa_accounts_cycle12_plans_admin.cjs   # E2E test: plans admin studio CRUD, user migration
│   └── qa_accounts_cycle13_plans_ui_deep.cjs # E2E test: deep interactive QA of plans studio UI
```

**Structure Decision**: Centralized account architecture with separation between backend security/storage primitives (`server/accounts.js`), outbound mail delivery (`server/mailer.js`), and feature definitions (`server/featuresCatalog.js`). On the frontend, `client/src/authManager.js` orchestrates user authentication, progressive modals, entitlement gates, and cloud synchronization, collaborating with `client/src/userProfileModal.js` for institutional trader performance analytics and offline workstation JSON backups.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| II: Built prior to SDD adoption | Implemented across September–October 2026 before adopting Hybrid SDD methodology. | Retrofit procedure creates complete Spec Kit artifacts without risking regressions in stable production code. |
| IV: Untranslated device strings & hardcoded placeholders | Device detection string from server is passed directly into client DOM; English example URLs used in social input placeholders. | Minor cosmetic defects logged in research.md mismatches to be corrected in the Converge phase. |
| IV: Hardcoded default trader profile name in Persian | Initial institutional trader mockup defaulted to 'حسین محمدی' in `userProfileModal.js`. | Retained during retrofit to avoid breaking existing visual layout; logged for bilingual adjustment in Converge phase. |
| VII: Client-only enforcement for 42 features | Canvas indicators, dock tabs, and chart overlays execute client-side and cannot incur network roundtrips on every interaction. | Server-side validation of full workspace layout would require heavy JSON AST parsing on every candle render; deferred to Converge phase. |
| X: Retrofit feature governance | Feature existed in production prior to SDD pipeline ratification. | Retrofit protocol documents existing code contracts to enable future gated enhancements. |
