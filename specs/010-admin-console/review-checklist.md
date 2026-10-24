# Review checklist — specs/010-admin-console

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

---

## Behaviour beyond the tests

- [ ] Master key authentication compares candidate SHA-256 hash against `server/data/admin_master.key` (or `TRADINGCHART_MASTER_KEY`) using `crypto.timingSafeEqual`; the master key is never sent to the browser or stored in client storage.
- [ ] Admin session cookie `tc_admin` is set with `HttpOnly; Path=/; SameSite=Strict; Max-Age=43200`, dynamically including `; Secure` when the incoming request is over HTTPS (`res.req && res.req.secure`).
- [ ] Sliding-window rate limiters protect both gate unlock (`POST /api/admin/auth`: 5 req/min via `rateGate`) and automation headers (`X-Master-Key`: >10 failures/min locks header auth for that IP via `keyLocked`).
- [ ] Master keys submitted in URL query strings are strictly refused (`server/adminAuth.js:164–172`).
- [ ] Privileged audit log `server/data/accounts/audit.jsonl` writes append-only JSON lines (mode `0o600`) and automatically rotates when exceeding 2 MB (`AUDIT_MAX_BYTES = 2097152`), retaining the newest half of lines.
- [ ] User export `GET /api/admin/users.csv` includes UTF-8 BOM (`\ufeff`) and escapes formula injection characters (`=`, `+`, `-`, `@`, `\t`, `\r`) by prepending `'`.
- [ ] Server-enforced self-protection prevents an admin from demoting (`cannot_demote_self`), suspending (`cannot_suspend_self`), or deleting (`cannot_delete_self`) their own account; bulk operations skip the caller for suspend/delete.
- [ ] Deleting a plan via `DELETE /api/admin/plans/:id` migrates all assigned users to the default fallback plan; deleting the default plan, last plan, or built-in plans (`basic`, `pro`, `premium`) is refused.
- [ ] In-memory plan hot-reload: modifying plan quotas, prices, or badges via `PUT /api/admin/plans/:id` immediately updates `server/accounts.js:PLANS` in memory and writes atomically to `server/data/accounts/plans.json` via `.tmp` rename without server restart.
- [ ] Offline password reset: when SMTP is disabled, `POST /api/admin/users/:id/send-reset` pushes the 6-digit code (15 min TTL) to `outbox.json` and returns it directly in JSON for manual operator relay.
- [ ] Maintenance mode and registration switches in `server/platformSettings.js` take immediate effect across public platform endpoints (`/api/auth/register`, `/api/auth/login`).
- [ ] Keyboard shortcuts: `Ctrl+S` / `Cmd+S` saves active plan edits in `client/admin/plans.js`.
- [ ] Accessible modal dialogs trap Tab focus within the dialog, confirm on Enter, dismiss on Escape, and close on background backdrop click.

---

## Architecture boundaries

- [ ] Master key loading, 12h admin session minting/revocation, header throttling, and JSONL audit trail reside exclusively in `server/adminAuth.js`.
- [ ] Admin REST API endpoints (overview, users, sessions, 2FA/reset, audit, settings, system) reside exclusively in `server/adminApi.js`.
- [ ] Operational platform settings (registration, maintenance, announcement, test domains) reside exclusively in `server/platformSettings.js`.
- [ ] Plan catalog management endpoints (create, update, delete, reorder, clone, reset) reside exclusively in `server/accounts.js` (lines 1066–1286).
- [ ] Console router, shell layout, gate, dashboard, users list, drawer, audit, settings, and system health reside in `client/admin/admin.js`.
- [ ] Shared console runtime (i18n, formatting, SVG icons, API fetch wrapper, toast clearance, modal dialogs) resides in `client/admin/core.js`.
- [ ] Plan catalog editor, feature quota toggles, comparison matrix, and live pricing preview reside in `client/admin/plans.js`.
- [ ] Stylesheet rules, theme variables, and responsive layout definitions reside in `client/admin/admin.css`.
- [ ] No cross-module reach-through or duplicated persistence stores.

---

## Forbidden shortcuts

- [ ] No branches on test runners or environment detection (`NODE_ENV === 'test'`) in admin authentication, authorization, or plan entitlement logic.
- [ ] No placeholder, synthetic, or invented metrics displayed in dashboard KPIs or system health; all figures derive from authentic user records, session rows, and OS telemetry.
- [ ] No plaintext storage of master keys or admin session tokens on disk or in client storage.
- [ ] No bypassing of leave-guard confirmation modals when navigating away from dirty form drafts in plans or settings.
- [ ] No new external runtime dependencies added; cryptographic, filesystem, and OS operations rely solely on native Node.js modules (`node:crypto`, `node:fs`, `node:os`).
- [ ] Rate limiters must not be weakened or disabled for tests.

---

## Copy and UX (only items tests cannot see)

- [ ] Respectful formal Persian register with zero informal imperatives (e.g. `ورود به پنل مدیریت`, `کلید مدیریت نادرست است.`, `وارد پنل مدیریت شدید.`, `خروج از پنل`, `تغییرات ذخیره نشده است`).
- [ ] Strict ZWNJ usage in Persian words and compound phrases.
- [ ] Persian numerals (`fmtNum`) applied to figures, counts, prices, and dates in FA mode.
- [ ] Numbers, emails, usernames (`@handle`), user IDs (`u_...`), IP addresses, reset codes, and prices maintain strict LTR orientation (`<span class="ltr">`, `dir="ltr"`).
- [ ] Viewports $\le 860$px cleanly transition sidebar to a fixed 6-button bottom navigation bar (`nav.bottom-nav`) and table to cards (`.mlist`) without horizontal scrollbars.
- [ ] Viewports $\le 980$px split plan list and editor card into sequential screens with `#pe-back`.
- [ ] Dynamic toast placement engine (`placeToasts`) positions toasts in header band on mobile to ensure bottom navigation and thumb zone remain completely clear.
- [ ] User-provided strings (display names, notes, announcement texts) are sanitized via `esc()` before insertion into `innerHTML`.
