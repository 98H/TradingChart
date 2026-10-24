# Research & Design Decisions: Admin Console (Back Office)

**Branch**: `010-admin-console` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This document formalizes the architectural decisions and implementation strategies embodied in the existing production codebase for the back-office admin console.

---

## R1. Master Key Dual-Source Architecture & Ephemeral Session Minting

- **Decision**: The administrative master key is loaded at server boot from the `TRADINGCHART_MASTER_KEY` environment variable. If unset, it is read from or automatically generated at `server/data/admin_master.key` (mode `0o600`) as a cryptographically random 24-byte base64url string. Submitting this key via `POST /api/admin/auth` mints a short-lived 12-hour admin session stored in `server/data/accounts/admin_sessions.json` and issued via an `HttpOnly`, `SameSite=Strict` cookie named `tc_admin`.
- **Rationale**: The raw master key is never exposed to client-side JavaScript, transmitted in client bundles, or stored in browser storage (`localStorage`/`sessionStorage`). Utilizing an ephemeral, HttpOnly session cookie mitigates credential theft via XSS, isolates administrative privilege to a revocable window, and allows the operator to unlock the console securely from any browser.
- **Alternatives considered**:
  - *Storing master key in browser localStorage*: Rejected because client storage is accessible to any script execution, creating severe security vulnerabilities.
  - *Requiring master key on every HTTP request*: Rejected because repeated transmission increases attack surface and prevents session revocation.
- **Evidence**: `server/adminAuth.js:loadMasterKey` (lines 33–44), `server/adminAuth.js:createAdminSession` (lines 72–84), `server/adminAuth.js:setAdminCookie` (lines 114–116).

---

## R2. Multi-Vector Administrative Authorization (`adminVia`)

- **Decision**: Administrative authorization across all `/api/admin/*` endpoints is centralized in `isReqAdmin(req)` / `adminVia(req)`. It evaluates three distinct access vectors in priority order:
  1. **User Account Role**: An authenticated user account with `role === 'admin'` or `isAdmin === true` (and not suspended) returns `'role'`.
  2. **Admin Session Cookie**: A valid, unexpired `tc_admin` cookie matching a hashed session row in `admin_sessions.json` returns `'token'`.
  3. **Automation Header**: A request carrying the `X-Master-Key` HTTP header matching `MASTER_KEY` returns `'key'`, provided the caller's IP is not rate-locked (>10 failed attempts/min).
  Query-string keys (`?key=...`) are explicitly rejected.
- **Rationale**: Supports seamless single sign-on for platform administrators navigating from the main chart workspace, standalone emergency operator access via master key unlock when account services are locked or broken, and secure headless server-to-server automation. Rejecting query-string keys prevents credential leakage into proxy access logs, browser history, and HTTP `Referer` headers.
- **Alternatives considered**:
  - *Dedicated admin user database*: Rejected because maintaining a duplicate user store violates the project's minimal footprint constraint.
  - *Query-string authentication parameter*: Rejected due to CWE-598 information exposure risks in server access logs and telemetry.
- **Evidence**: `server/adminAuth.js:adminVia` (lines 158–173), `server/adminAuth.js:isReqAdmin` (line 174), `server/adminAuth.js:keyLocked` (lines 144–149).

---

## R3. Append-Only Rotated JSONL Audit Trail (2 MB Threshold)

- **Decision**: Every privileged administrative action is recorded synchronously in `server/data/accounts/audit.jsonl` (mode `0o600`). Each event record includes a unique event ID (`ev_<hex>`), millisecond timestamp (`at`), categorical action string (`action`), boolean success flag (`ok`), actor display label (`actor`), authentication vector (`actorVia`), client IP (`ip`), affected target ID (`target`), and optional metadata object (`meta`). When `audit.jsonl` exceeds 2 MB (`AUDIT_MAX_BYTES = 2097152`), the file rotates by preserving the newest 50% of lines.
- **Rationale**: An append-only JSONL format provides immediate durability, atomic appending, and human-readable log inspection without requiring relational databases or external log shippers. Truncating the oldest half of lines upon reaching 2 MB prevents unbounded disk exhaustion while maintaining recent forensic history.
- **Alternatives considered**:
  - *Syslog or systemd journal logging*: Rejected because it couples application audit logs to specific host OS configurations and complicates in-app querying.
  - *Unbounded single file*: Rejected because it would eventually exhaust VPS disk budgets and degrade `readAudit()` performance.
- **Evidence**: `server/adminAuth.js:audit` (lines 186–209), `server/adminAuth.js:readAudit` (lines 210–216).

---

## R4. In-Memory Entitlement Hot-Reload and Dynamic Mutation

- **Decision**: When an operator updates plan pricing, badges, descriptions, or feature quotas via `PUT /api/admin/plans/:id`, the server immediately mutates the live in-memory `PLANS` dictionary and commits the change to `server/data/accounts/plans.json` via an atomic `.tmp` file rename. Platform entitlement checks across the chart, candle history gates (`/api/candles`), and webhook alert relays read the shared `PLANS` reference directly.
- **Rationale**: Entitlement updates take effect instantly across all connected clients without requiring a Node.js process restart, dropped WebSocket connections, or service interruptions for active traders.
- **Alternatives considered**:
  - *Database queries on every entitlement check*: Rejected due to zero external database architecture.
  - *Periodic polling or TTL caching*: Rejected because it introduces synchronization lag and inconsistent gate behavior.
  - *Requiring server restart on plan edits*: Rejected because restarting drops active WebSocket tick subscriptions and trading state.
- **Evidence**: `server/accounts.js:1117–1156`, `server/accounts.js:savePlansStore` (lines 201–207).

---

## R5. Safe Plan Deletion with Automatic Fallback User Migration

- **Decision**: When a custom plan is deleted via `DELETE /api/admin/plans/:id`, the server identifies all users currently assigned to that plan in `server/data/accounts/users.json` and automatically reassigns them to the active default plan (or `basic`), flushing the updated account registry immediately. The server strictly forbids:
  - Deleting the last remaining plan (`cannot_delete_last_plan`).
  - Deleting the designated default plan (`cannot_delete_default_plan`).
  - Deleting built-in seed tiers (`basic`, `pro`, `premium`) (`cannot_delete_builtin_plan`).
- **Rationale**: Prevents orphaned user records that reference non-existent plan IDs, which would lead to runtime quota calculation crashes and broken client UI rendering. Guarding default and built-in plans preserves system baseline integrity across restarts.
- **Alternatives considered**:
  - *Blocking deletion if assigned users exist*: Rejected because requiring operators to manually reassign hundreds or thousands of users is tedious and error-prone.
  - *Deleting users on plan deletion*: Rejected as catastrophically destructive.
- **Evidence**: `server/accounts.js:1159–1205`.

---

## R6. Operator Self-Protection Guardrails (Demote, Suspend, Delete)

- **Decision**: The backend explicitly prevents an authenticated operator from demoting their own admin role (`cannot_demote_self`), suspending their own account (`cannot_suspend_self`), or deleting their own account (`cannot_delete_self`). In `POST /api/admin/users/bulk`, the caller's own account is automatically skipped for suspend and delete operations. On the frontend, the role dropdown, suspend button, and delete button are disabled in the user drawer when inspecting one's own account.
- **Rationale**: Eliminates catastrophic administrative lockout where a lone operator accidentally strips their own privileges or deletes their administrative identity.
- **Alternatives considered**:
  - *Client-side confirmation dialogs only*: Rejected because client-side checks can be bypassed by direct API calls or script errors.
  - *Dual-custody multi-admin approval*: Rejected because Chartivia operates under a single-founder governance model.
- **Evidence**: `server/adminApi.js:isSelf` (line 30), `server/adminApi.js:244`, `server/adminApi.js:252`, `server/adminApi.js:343`, `server/adminApi.js:361`, `client/admin/admin.js:755,768,793,929,930`.

---

## R7. Formula-Injection Guarded UTF-8 BOM CSV Export

- **Decision**: User export via `GET /api/admin/users.csv` prepends a UTF-8 Byte Order Mark (`\ufeff`) to the response stream and sanitizes every cell. Any field value beginning with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prepended with an apostrophe (`'`).
- **Rationale**: Prepending `\ufeff` ensures Microsoft Excel on Windows parses Persian UTF-8 text correctly without encoding corruption. Neutralizing formula trigger characters mitigates CSV Formula Injection (CWE-1236), protecting operators who open exported user rosters in spreadsheet applications from executing arbitrary external commands.
- **Alternatives considered**:
  - *Standard UTF-8 without BOM*: Rejected because Excel defaults to legacy ANSI codepages when opening CSVs without a BOM, corrupting Persian characters.
  - *Stripping leading special characters*: Rejected because it permanently alters legitimate usernames, emails, or notes.
- **Evidence**: `server/adminApi.js:187–202`.

---

## R8. Dynamic Layout Adaptation: Sidebar to Bottom Navigation and Cards

- **Decision**: The console UI automatically adapts to varying viewport dimensions:
  - At viewports $\le 860$px, the desktop sidebar (`aside.sidebar`) is hidden and replaced by a fixed 6-button bottom navigation bar (`nav.bottom-nav`). The users table transitions to responsive card stacks (`.mlist`).
  - At viewports $\le 980$px, the plan list and editor card become separate sequential screens, navigated via a back button (`#pe-back`).
- **Rationale**: Ensures that operators can inspect business metrics, approve plan requests, and triage user issues from mobile phones without horizontal overflow, tiny touch targets, or broken comparison tables.
- **Alternatives considered**:
  - *Horizontal scrolling tables only*: Rejected because wide tables with multiple action buttons provide an unusable mobile experience.
  - *Desktop-only admin console*: Rejected because critical operational events (outages, emergency user suspensions) frequently occur when operators only have mobile phone access.
- **Evidence**: `client/admin/admin.css:577–689`, `client/admin/admin.js:179–183`, `client/admin/plans.js:40,wireList,pickPlan`.

---

## R9. Dynamic Toast Placement and Clearance Engine

- **Decision**: A custom layout measurement engine (`placeToasts`) recalculates toast positioning on every animation frame while toasts are visible. On mobile ($\le 860$px), toasts are anchored inside the top header band over non-interactive titles and constrained before header action buttons, leaving the bottom navigation and mobile thumb zone clear. On desktop, toasts float above sticky save bars (`.sticky-save`), stuck bulk bars (`#u-bulk .bulkbar`), and drawer action footers (`.drawer-foot`), dynamically centering across free screen space beside open drawers.
- **Rationale**: Prevents notification toasts from obscuring actionable controls, primary navigation buttons, or sticky confirmation footers, satisfying Constitution Principle V.
- **Alternatives considered**:
  - *Static bottom-right or top-right toast positioning*: Rejected because static positions overlap with sticky bottom toolbars, side drawers, and mobile navigation bars.
  - *Modal alerts for all notifications*: Rejected because blocking dialogs disrupt fluid administrative workflows.
- **Evidence**: `client/admin/core.js:200–250`.

---

## R10. Client Draft Preservation Across Language Switching and Navigation

- **Decision**: In-progress edits in the Plan Catalog Editor (`client/admin/plans.js:S.draft`) and Platform Settings (`client/admin/admin.js:app.settingsEdit`) are maintained in module-scoped memory. Switching interface language via `setLang` re-renders the shell and views without clearing unsaved form states. Furthermore, attempts to navigate away from dirty views trigger leave-guard confirmation dialogs (`confirmLeavePlans`, `confirmLeaveSettings`), and closing the browser tab triggers `beforeunload` warnings.
- **Rationale**: Prevents operators from losing intricate quota adjustments, pricing rules, or bilingual announcement copy when toggling languages to verify localization or accidentally clicking navigation links.
- **Alternatives considered**:
  - *Blocking language switching while dirty*: Rejected because reviewing both Persian and English copy is a standard part of configuring announcements and plans.
  - *Auto-saving drafts on language switch*: Rejected because saving incomplete or unvalidated data would corrupt production configurations.
- **Evidence**: `client/admin/admin.js:31–35,48–56,184–187`, `client/admin/plans.js:76–86`.

---

## R11. Test Account Isolation via Domain Rules & Manual Overrides

- **Decision**: Operational settings maintain a list of test email domains (`testDomains`). Any user registered with a matching domain is automatically flagged as `isTest`. Operators can manually override this classification per user (`testAccount: true|false|null`) via the user drawer. The dashboard provides a 3-way scope selector (`Real users`, `All`, `Test accounts`) that scopes all KPI totals, MRR calculations, and 30-day signup curves.
- **Rationale**: Automated E2E test runs generate dozens of ephemeral accounts. Isolating test accounts guarantees that business metrics (paid plans, MRR, retention) accurately reflect genuine trading users without requiring test data to be immediately purged.
- **Alternatives considered**:
  - *Deleting test accounts after test completion*: Rejected because deleting test data prevents post-test debugging and breaks state linkage.
  - *Separate test and production environments*: Rejected to maintain single-instance simplicity on the VPS host.
- **Evidence**: `server/platformSettings.js:43–46`, `server/adminApi.js:45–46,98–100`, `client/admin/admin.js:25–27,272–277`.

---

## R12. Offline/Non-SMTP Manual Relay for Password Recovery

- **Decision**: When outbound SMTP email is unconfigured (`mailEnabled() === false`), triggering a password reset via `POST /api/admin/users/:id/send-reset` enqueues the code in `server/data/accounts/outbox.json` and returns the generated 6-digit code directly in the API response `{ ok: true, mailed: false, code: '123456' }`. The console displays the code in a prominent dialog with instructions to deliver it only to the verified account owner.
- **Rationale**: Ensures that account recovery operations remain fully functional in offline test harnesses, development sandboxes, and self-hosted deployments where SMTP mailers are not configured.
- **Alternatives considered**:
  - *Disabling password recovery when SMTP is disabled*: Rejected because it prevents operators from recovering locked accounts in offline or air-gapped environments.
  - *Printing codes to server console logs*: Rejected because web operators may lack direct SSH or terminal access to the host machine.
- **Evidence**: `server/adminApi.js:324–328`, `client/admin/admin.js:873–884`.

---

## Spec/code mismatches

- **FR-008, FR-010**: Neither `PATCH /api/admin/users/:id`, `DELETE /api/admin/users/:id`, nor `POST /api/admin/users/bulk` checks if the target user is the last remaining administrator account (`server/adminApi.js:244`, `server/adminApi.js:343`, `server/adminApi.js:361`).
- **FR-003**: The header-key brute-force lockout is applied per IP rather than per key, locking all automation header requests for that IP across all keys upon 10 failed attempts (`server/adminAuth.js:142–156`).
- **FR-010**: Server error code `invalid_action` returned by `POST /api/admin/users/bulk` lacks an explicit entry in `errMsg()` in `client/admin/core.js:125–154`, falling back to the generic `unknown` message.
- **FR-013**: Server error code `announcement_empty` returned by `PUT /api/admin/settings` lacks an explicit entry in `errMsg()` in `client/admin/core.js:125–154`, falling back to the generic `unknown` message.
- **FR-013**: The client settings error handler in `renderSettings` specifically surfaces `testDomains` field errors, but does not provide visual field binding for other potential server validation errors like `announcementLevel` (`client/admin/admin.js:1159`).
- **FR-005, FR-015**: Helper function `adminCount` is declared in `server/adminApi.js:31` but is never referenced in `adminApi.js`.
