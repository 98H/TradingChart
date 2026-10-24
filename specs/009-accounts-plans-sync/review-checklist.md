# Review checklist — specs/009-accounts-plans-sync

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

---

## Behaviour beyond the tests

- [ ] Password hashing uses Node.js `node:crypto` `scrypt` with a unique 16-byte random salt and 64-byte key; session tokens are hashed with SHA-256; no plaintext credentials or tokens are persisted to disk.
- [ ] Session cookie `tc_session` is issued with `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`, and dynamically includes `; Secure` when the incoming request is over HTTPS (`req.secure`).
- [ ] Sliding-window per-IP rate limiting guards all sensitive auth actions (`register` 5/min, `login` 10/min, `reset` 10/min, `twofa` 6/min, `delete_account` 3/min), returning HTTP 429 `rate_limited` when thresholds are exceeded.
- [ ] Verification and password reset codes fall back to `server/data/accounts/outbox.json` (FIFO capped at 200 items) when SMTP is unconfigured; `GET /api/platform` accurately exposes `emailDelivery: boolean`.
- [ ] Cloud state push `PUT /api/user/state` enforces 2MB limit with HTTP 413 `state_too_large` and checks 5 array quotas (`savedLayouts`, `savedTemplates`, `watchlists`, `priceAlerts`, `paperAccounts`), returning HTTP 403 `limit_exceeded` with specific violations if breached.
- [ ] Stale `baseUpdatedAt` on state push triggers HTTP 409 `conflict` with server state; client performs set/map union on list items (`watchlists`, `alerts`, `paperAccounts`, `tradeJournal`), updates `localStorage`, and re-pushes once with the updated server timestamp.
- [ ] Guest workspace mirror (`tradingchart_auth_mirror`) is captured on signup, login, and logout; fresh accounts inherit local guest work on first login via `pushCloudState({ force: true })`.
- [ ] Permanent account deletion via `DELETE /api/auth/me` requires the current password (and UI typing "DELETE"), cleanly unlinking user row, active sessions, and per-user cloud state file.
- [ ] Paid plan upgrades enter a pending approval state (`202 pending`) unless `TC_BILLING_MODE=simulated`, and pending requests can be cancelled via `DELETE /api/user/plan-request`.
- [ ] Server enforces `histBars` historical candle depth in `/api/candles`, clamping query limit and returning the `X-History-Limit` response header.

---

## Architecture boundaries

- [ ] Core authentication, sessions, TOTP 2FA, and cloud state sync logic reside exclusively in `server/accounts.js`.
- [ ] Outbound SMTP email delivery and code dispatch reside in `server/mailer.js`.
- [ ] Platform maintenance mode and open registration flags reside in `server/platformSettings.js`.
- [ ] Back-office admin session verification, master key auth, and audit log appender reside in `server/adminAuth.js`.
- [ ] Canonical 47-feature entitlement dictionary and category definitions reside exclusively in `server/featuresCatalog.js`.
- [ ] Client authentication coordinator, modal rendering, and cloud sync engine reside in `client/src/authManager.js`.
- [ ] Institutional trader profile dialog, live performance metrics, and offline workstation JSON backup/restore reside in `client/src/userProfileModal.js`.
- [ ] Topbar avatar badge, app-level plan enforcement, and admin shortcut (`Ctrl+Shift+A`) reside in `client/src/main.js`.
- [ ] Plan entitlements are defined on the server in `server/data/accounts/plans.json` and mirrored in `client/src/authManager.js:PLANS`.

---

## Forbidden shortcuts

- [ ] No branches on test inputs (`NODE_ENV === 'test'`), test runners, or user-agent sniffing in authentication or entitlement code.
- [ ] No plaintext storage or transmission of passwords, session tokens, or TOTP secrets (except secret once during initial setup).
- [ ] No client-side self-granting of paid plans; paid plans require back-office admin approval in production mode.
- [ ] No perpetual DOM timers faster than 1000 ms; auto-sync pushes at most once per 8 seconds via `_dirty` flag; session GC runs hourly with `.unref()`.
- [ ] No external database engines or unapproved runtime packages; crypto/auth operations rely solely on native `node:crypto`.
- [ ] No invented metrics or synthetic account balances shown in trader profile or billing dialogs.

---

## Copy and UX (only items tests cannot see)

- [ ] Persian copy follows uniform respectful formal register with zero informal imperatives (e.g. `ورود به حساب`, `ثبت‌نام`, `تأیید ایمیل`, `گذرواژه را فراموش کرده‌اید؟`, `همگام‌سازی: روشن`, `پلن‌ها و ارتقا`).
- [ ] Strict ZWNJ usage in Persian words and compound phrases.
- [ ] Persian numerals (`toPersianDigits`) are applied to figures, counts, and prices in FA mode.
- [ ] Numbers, emails, handles, session IDs, and secret codes maintain strict LTR orientation (`<bdi dir="ltr">`, `dir="ltr"`).
- [ ] Avatar dropdown menu `#tc-account-menu` dynamically clamps within viewport boundaries on desktop and mobile viewports.
- [ ] Interactive touch targets meet or exceed 44px on primary modal buttons, menu items, and tab headers.
- [ ] User-provided strings (display names, handles, bios, locations, signatures) are sanitized via `escapeHtml()` prior to insertion into `innerHTML`.
