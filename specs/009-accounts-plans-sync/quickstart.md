# Quickstart: Accounts, Plans and Cloud Sync

Step-by-step manual verification procedures for each user story on a running Chartivia instance, along with automated test runner commands.

---

## 1. Environment & Setup

Ensure Node.js v20+ is installed and dependencies are bundled.

```bash
# Set base test URL (default port 8088)
export SDD_BASE_URL="${SDD_BASE_URL:-http://127.0.0.1:8088}"

# Start the application server
npm run start
# Or launch development mode with live reload:
npm run dev
```

Open `${SDD_BASE_URL}/chart` in an evergreen web browser (Chromium, Firefox, Safari, Edge).

---

## 2. Manual Verification by User Story

### User Story 1 — Register, verify and sign in (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Locate the topbar avatar badge `.user-avatar-badge` (in guest mode, displays default icon or "Sign In").
3. Click the avatar badge:
   - **Verification**: Dropdown `#tc-account-menu` opens with header "No account yet" / "حساب کاربری ندارید".
4. Click "Create Free Account" / "ایجاد حساب رایگان" (`#tc-account-menu [data-act="signup"]`):
   - **Verification**: Auth modal `#tc-auth-modal` opens with the Sign Up tab active.
5. Fill in registration form:
   - Display Name: `Test Trader`
   - Username: `test_trader_01`
   - Email: `test_trader@example.com`
   - Password: `Password123!`
   - Click "Create account" / "ایجاد حساب کاربری".
6. **Verification**:
   - Success toast appears: "Account created! Welcome to Chartivia" / "حساب کاربری با موفقیت ایجاد شد".
   - Topbar avatar updates to reflect user's initials or preset.
   - Verification modal `#tc-verify-modal` automatically opens prompting for a 6-digit code.
7. Retrieve verification code:
   - Check `server/data/accounts/outbox.json` (or outbound SMTP inbox).
   - Enter the 6-digit code into `#tc-verify-code` and click "Verify" / "تأیید".
   - **Verification**: Email is verified; modal closes; avatar menu shows verified checkmark `✓ Verified` / `✓ تأییدشده`.
8. Sign out and sign back in:
   - Click avatar badge -> click "Sign Out" / "خروج از حساب" (`[data-act="logout"]`).
   - Avatar badge resets to guest mode.
   - Click avatar badge -> click "Sign In" / "ورود به حساب" (`[data-act="login"]`).
   - Enter `test_trader_01` (or `test_trader@example.com`) and `Password123!`.
   - Click "Sign In" / "ورود به حساب".
   - **Verification**: Signs in smoothly, avatar badge displays user, workspace loads.

---

### User Story 2 — Recover access (Priority: P1)

1. Ensure you are signed out (`${SDD_BASE_URL}/chart`).
2. Click avatar badge -> click "Sign In" / "ورود به حساب".
3. In `#tc-auth-modal`, click "Forgot your password?" / "گذرواژه را فراموش کرده‌اید؟" (`#tc-auth-forgot`):
   - **Verification**: Reset modal `#tc-reset-modal` opens in Step 1.
4. Enter registered email `test_trader@example.com` and click "Send code" / "ارسال کد":
   - **Verification**: Message indicates code was sent; modal transitions to Step 2 (code and new password inputs).
5. Retrieve 6-digit reset code from `server/data/accounts/outbox.json`.
6. Enter the 6-digit code into `#tc-reset-code` and new password `NewPassword456!` into `#tc-reset-pass`.
7. Click "Set new password" / "تغییر گذرواژه":
   - **Verification**:
     - Success toast appears: "Password updated successfully" / "گذرواژه با موفقیت تغییر کرد".
     - Modal closes.
     - User can now sign in with `NewPassword456!`.

---

### User Story 3 — Cloud sync of the workspace (Priority: P1)

1. Open Device A (e.g. desktop browser tab) and sign in as `test_trader_01`.
2. Add a new symbol to the watchlist (e.g. `SOLUSDT`).
3. Draw a trend line or add an indicator (e.g. `RSI`).
4. Wait 8 seconds for debounced auto-sync to push to server (or trigger an action that saves state).
5. Open Device B (e.g. a second incognito browser window or mobile emulation at 390px):
   - Sign in as `test_trader_01`.
   - **Verification**: Device B automatically pulls cloud state on login; `SOLUSDT` is present in the watchlist; `RSI` appears on the chart canvas.
6. Verify 409 Conflict Union Rebase:
   - On Device A (offline or simulated lag), add symbol `DOGEUSDT` to watchlist.
   - On Device B, add symbol `ADAUSDT` to watchlist and push to server.
   - On Device A, push state:
     - **Verification**: Server returns HTTP 409 Conflict; Device A merges server state and local state, unions watchlist symbols (`SOLUSDT`, `DOGEUSDT`, `ADAUSDT`), and re-pushes. Neither symbol is lost.
7. Verify Sync Toggle:
   - Open avatar menu -> click "Sync: On" (`[data-act="sync"]`).
   - **Verification**: Label toggles to "Sync: Off" / "همگام‌سازی: خاموش"; toast confirms sync disabled; local mutations no longer push to cloud until toggled back on.

---

### User Story 4 — Manage the account (Priority: P2)

1. Sign in as `test_trader_01`.
2. Click avatar badge -> click "Account & Billing" / "حساب و صورت‌حساب" (`[data-act="account"]`):
   - **Verification**: Modal `#tc-account-settings-modal` opens with 5 navigation tabs: Profile, Account, Security, Sessions, Data.
3. Public Profile Tab:
   - Select preset avatar icon (e.g. `cyber`).
   - Enter Bio: `Professional algorithmic trader.`
   - Set X Handle: `@test_trader`
   - Click "Save Changes" / "ذخیره تغییرات":
     - **Verification**: Avatar icon updates in topbar and modal; bio and handle persist.
4. Security Tab:
   - Click "Enable 2FA" / "فعال‌سازی تأیید دومرحله‌ای" (`#acc-2fa-open-enable`):
     - Displays base32 secret and QR URI.
     - Generate TOTP code using an authenticator app (or Node CLI helper).
     - Enter 6-digit code and click "Verify & Enable" (`#acc-2fa-enable-btn`).
     - **Verification**: 2FA status flips to Enabled; subsequent logins require TOTP challenge step.
5. Sessions Tab:
   - Verify active sessions table lists current device with green "Current" badge.
   - From another browser window, sign in to create a secondary session.
   - In Sessions tab, click "Revoke" / "خروج" (`.acc-revoke`) on the secondary session.
   - **Verification**: Secondary session is revoked; refreshing the other window requires re-login.
6. Data Tab:
   - Click "Download Data" / "دانلود داده‌ها" (`#acc-export-btn`):
     - **Verification**: Browser downloads `tradingchart-account-export-*.json` containing safe profile, state, and sessions.
   - Account Deletion Test:
     - In Danger Zone, enter current password into `#acc-del-pass` and type `"DELETE"` into `#acc-del-confirm`.
     - Click "Permanently Delete Account" / "حذف دائم حساب":
     - **Verification**: Account, sessions, and cloud state are purged; user is signed out and redirected to clean guest workspace.

---

### User Story 5 — Plans and upgrades (Priority: P1)

1. Open `${SDD_BASE_URL}/chart` (as guest or Basic user).
2. Click avatar badge -> click "Plans & Upgrade" / "پلن‌ها و ارتقا" (`[data-act="plans"]`):
   - **Verification**:
     - Modal `#tc-plans-modal` opens.
     - Displays horizontal plan cards for Basic, Essential, Plus, Premium, Ultimate.
     - Active plan is marked with "Current Plan" / "پلن فعلی" badge.
     - Feature matrix displays 22 comparison rows with checkmarks, numbers, and tooltips.
3. Request Plan Upgrade:
   - On the `Plus` card, click "Upgrade to Plus" / "ارتقا به پلاس".
   - **Verification**:
     - If `TC_BILLING_MODE=simulated`: Plan switches immediately to Plus; user gains 4 charts per tab, 10 indicators, and webhook alerts.
     - If standard mode: Enters pending approval state; button reflects "Pending Approval" / "در انتظار تأیید"; "Withdraw request" option appears.
4. Localized Quota Toast Verification:
   - With Basic tier (quota = 2 indicators), add 2 indicators to chart canvas.
   - Attempt to add a 3rd indicator from the library dialog:
   - **Verification**:
     - Indicator is blocked.
     - Toast appears:
       - EN: `You've reached your plan's indicators per chart limit (2). Upgrade to Essential ($12.95) to raise it.`
       - FA: `به سقف ۲ اندیکاتور در هر چارت در پلن فعلی خود رسیده‌اید. برای افزایش این سقف، پلن خود را به اسنشیال (۱۲٫۹۵ دلار) ارتقا دهید.`

---

## 3. Automated Test Suites

Execute the following Puppeteer suites from the repository root:

### Cycle 1 — Authentication Basics & Persistence
Tests register, login, session cookie, logout, reload persistence, and error states:
```bash
node tests/qa_accounts_cycle1.cjs
```

### Cycle 2 — Multi-Device Cloud Sync
Tests cross-device workspace synchronization (desktop edit -> mobile reflection):
```bash
node tests/qa_accounts_cycle2.cjs
```

### Cycle 3 — Plan Tiers & Entitlement Gating
Tests plan quotas, comparison modal matrix, and upgrade toasts:
```bash
node tests/qa_accounts_cycle3.cjs
```

### Cycle 4 — Bilingual Parity & Mobile Responsive UX
Tests Persian/English RTL parity, mobile viewport fit (390px), and field errors:
```bash
node tests/qa_accounts_cycle4.cjs
```

### Cycle 5 — Account & Billing Modal (Security & Data)
Tests 2FA lifecycle, session revocation, data export, and account deletion:
```bash
node tests/qa_accounts_cycle5.cjs
```

### Cycle 6 — Adversarial Security & Recovery
Tests password reset outbox flow, keyboard accessibility, and rate limiting:
```bash
node tests/qa_accounts_cycle6.cjs
```

### Cycle 7 — Public Profile & Parity Features
Tests avatar presets, username policy limits, social link gating, and histBars gate:
```bash
node tests/qa_accounts_cycle7.cjs
```

### Cycle 8 — Exploratory Account Dogfooding
Deep dogfooding of all 5 account tabs across mobile/desktop in both languages:
```bash
node tests/qa_accounts_cycle8.cjs
```

### Cycle 9 — Security Hardening & Size Caps
Tests XSS neutralization, double submit prevention, and 2MB cloud state cap (HTTP 413):
```bash
node tests/qa_accounts_cycle9.cjs
```

### Cycle 10 — Sync Concurrency & Guest Migration
Tests 409 conflict rebase, guest-to-user mirror migration, and sync toggle:
```bash
node tests/qa_accounts_cycle10.cjs
```

### Cycle 11 — Edge Cases & Live Language Switching
Tests profile modal while signed in, mobile FA guest menu, and dynamic language flipping:
```bash
node tests/qa_accounts_cycle11.cjs
```

### Admin Cycles 12 & 13 — Back-Office Plans Studio
Tests back-office plan management, feature toggles, quota configuration, and UI interactions:
```bash
node tests/legacy/qa_accounts_cycle12_plans_admin.cjs
node tests/legacy/qa_accounts_cycle13_plans_ui_deep.cjs
```
