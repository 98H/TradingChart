# Quickstart & Verification: Admin Console (Back Office)

**Branch**: `010-admin-console` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This guide details instructions for launching the environment, manually verifying each of the five core user stories on a running Chartivia instance, and executing the automated real-browser E2E test suites.

---

## 1. Environment & Prerequisites

Ensure Node.js (v20+) is installed and the Chartivia server is running.

```bash
# Set base URL (defaults to port 8088)
export SDD_BASE_URL="http://127.0.0.1:8088"

# Check if the tradingchart service is running
curl -s -o /dev/null -w "%{http_code}\n" "${SDD_BASE_URL}/api/health" || echo "Server not running"

# If not running, start the server
npm run build && node server/index.js &

# Inspect or retrieve the master key
cat server/data/admin_master.key
```

The admin console is mounted at `${SDD_BASE_URL}/admin`.

---

## 2. Manual Verification by User Story

### Story 1: Secure Sign-in to the Console (P1)

1. **Verify Login Gate & Wrong Key Rejection**:
   - Open `${SDD_BASE_URL}/admin` in a browser window.
   - Enter an incorrect key (`wrong_key_123`) in `#gate-key` and click **ورود به پنل** / **Sign in** (`#gate-submit`).
   - Confirm that the button displays a loading spinner with `در حال بررسی…` / `Verifying…`, followed by the error message `کلید مدیریت نادرست است.` / `The admin key is incorrect.` in `#gate-err` with `aria-invalid="true"`.
   - Submit 5 invalid keys consecutively to verify that the rate limiter triggers with `تعداد تلاش‌ها بیش از حد مجاز است.` / `Too many attempts.`.
2. **Verify Password Visibility Toggle**:
   - Type a key and click the eye button (`#gate-eye`).
   - Confirm the input type switches from `password` to `text` and the icon updates.
3. **Verify Successful Unlock & Session Minting**:
   - Enter the valid key from `server/data/admin_master.key` and submit.
   - Confirm a success toast appears (`وارد پنل مدیریت شدید.` / `Signed in.`), the console navigation shell loads, and the browser routes to `#dashboard`.
   - Inspect browser dev tools: verify the `tc_admin` cookie is set with `HttpOnly`, `SameSite=Strict`, and a 12-hour expiration.
4. **Verify Direct Role-based Access**:
   - In another browser session, sign in at `/chart` as a user with `role === 'admin'`.
   - Open `/admin`: verify the console loads directly without prompting for the master key.
5. **Verify Logout**:
   - Click **خروج از پنل** / **Sign out** (`[data-act="logout"]`).
   - Confirm the modal asks for confirmation (`خروج از پنل مدیریت` / `Sign out of the console`).
   - Confirm logout: key-based sessions return to the gate (`#gate-form`) with cleared cookies; role-based accounts redirect to `/chart`.

---

### Story 2: Dashboard Overview & Analytics (P2)

1. **Verify KPI Cards**:
   - Sign in to `/admin` and navigate to `#dashboard`.
   - Verify the 16 metric cards render: Total Users, New (24h, 7d, 30d), Active (24h, 7d), Active User Sessions, Admin Sessions, Verified Users, 2FA Enabled, Suspended, Admins, Paid Users, Plan Upgrade Requests, MRR, and Total Plans.
2. **Verify 30-Day Signup Chart & Distribution**:
   - Confirm the 30-day SVG bar chart displays daily bars with peak signups highlighted.
   - If no signups exist in the window, verify the empty state placeholder renders.
   - Confirm the Plan Distribution chart shows proportional colored bars for each active tier.
3. **Verify Scope Filtering**:
   - Click the scope buttons in `#dash-scope`:
     - **کاربران واقعی** / **Real users**: Filters out accounts with test email domains (`@test.io`, etc.).
     - **همه** / **All**: Displays all registered accounts.
     - **حساب‌های آزمایشی** / **Test accounts**: Isolates test accounts only.
   - Verify that all KPI numbers, chart bars, and recent user rosters update immediately to match the selected scope.

---

### Story 3: Manage Users & Bulk Actions (P1)

1. **Verify Debounced Search & Filters**:
   - Navigate to `#users`.
   - Type a search query in `#u-q`. Verify the table updates after a 280 ms debounce without page reload.
   - Filter by Plan, Role, and Status (Active, Suspended, Unverified, 2FA, Plan Request). Verify that `#u-list` displays matching records.
2. **Verify CSV Export**:
   - Click **خروجی CSV** / **Export CSV** (`#u-export`).
   - Inspect the downloaded file: confirm it contains a UTF-8 BOM (`\ufeff`), valid CSV headers, and formula-injection escaping (`'` before `=`, `+`, `-`, `@`).
3. **Verify User Detail Drawer**:
   - Click any user row to open the slide-over drawer (`.drawer`).
   - **Overview Tab**:
     - Change the user's plan via `#dr-plan`: confirm change dialog and immediate entitlement update.
     - Edit display name (`#dr-name`) and notes (`#dr-notes`): confirm save buttons activate and toast notifications appear upon saving.
     - Toggle email verification status (`#dr-verify`).
     - Reset 2FA (`#dr-2fa`): confirm prompt disables user TOTP.
     - Send password reset (`#dr-reset`): if SMTP is disabled, verify that the 6-digit code (valid for 15 minutes) is presented directly in a modal dialog.
   - **Sessions Tab**:
     - Inspect active device list. Revoke an individual session (`[data-revoke]`) or all sessions (`#dr-revoke-all`).
   - **Footer Actions**:
     - Click **تعلیق حساب** / **Suspend account** (`#dr-suspend`): enter reason and confirm suspension. Verify user status updates to suspended and active sessions are revoked. Click **رفع تعلیق** to restore.
     - Click **حذف حساب** / **Delete account** (`#dr-delete`): verify that deleting requires typing the exact username in `#del-confirm`.
4. **Verify Self-Protection**:
   - Open your own administrative user account in the drawer.
   - Verify that the Role select is disabled, and the Suspend and Delete buttons in `.drawer-foot` are disabled.
5. **Verify Bulk Operations**:
   - Select multiple users via row checkboxes (`input[data-sel]`) or header select-all (`#u-all`).
   - Confirm the sticky bulk bar appears (`#u-bulk .bulkbar`).
   - Apply a bulk action: Plan change, Verify, Suspend, Unsuspend, or Delete.
   - Confirm that bulk delete requires typing `DELETE` / `حذف`, and the server returns the count of completed and skipped accounts.

---

### Story 4: Plan Catalog Editor & Comparison Matrix (P1)

1. **Verify Plan Editor & Live Preview**:
   - Navigate to `#plans`.
   - Select a plan from the list. Verify that the live pricing card preview (`#pf-preview`) renders with matching name, badges, price, and color swatch.
   - Modify the monthly price (`#pf-priceUSD`) or yearly price (`#pf-priceYearlyUSD`): verify the preview and yearly savings badge update in real time.
   - Edit feature quotas (e.g. `savedLayouts`, `maxChartsPerLayout`). Click the $\infty$ button to set unlimited (`-1`).
2. **Verify Dirty State & Leave Guards**:
   - Make an edit: confirm that the sticky save bar (`#pe-save`, `#pe-discard`) appears with a dirty indicator dot.
   - Click another navigation link (e.g. `#dashboard`): verify that a leave confirmation modal appears blocking navigation. Click "Keep editing" to stay, or "Discard changes" to proceed.
3. **Verify Saving & Runtime Hot-Reload**:
   - Click **ذخیره تغییرات** / **Save changes** (`#pe-save`) or press `Ctrl+S` / `Cmd+S`.
   - Confirm success toast. In a separate tab at `/chart`, verify that the updated quota takes effect immediately without server restart.
4. **Verify Plan Actions (New, Duplicate, Delete, Reset)**:
   - Click **پلن جدید** / **New plan** (`#pl-new`): create a custom tier with ID `custom_tier`.
   - Click **تکثیر** / **Duplicate** (`#pe-clone`): duplicate a plan under a new ID.
   - Click **حذف** / **Delete** (`#pe-delete`): verify that deleting requires typing the plan ID, and assigned users are automatically migrated to the default plan. Confirm that built-in plans cannot be deleted.
   - Click **بازنشانی پلن‌ها** / **Reset plans** (`#pl-reset`): type `RESET` / `بازنشانی` to restore default seed plans (`basic`, `pro`, `premium`).
5. **Verify Comparison Matrix**:
   - Click **جدول مقایسه** / **Comparison** (`button[data-mode="matrix"]`).
   - Confirm that all 47 features are listed by category with checkboxes for booleans and formatted numbers/unlimited badges for quotas.

---

### Story 5: Platform Settings, Audit & System Health (P2)

1. **Verify Platform Settings**:
   - Navigate to `#settings`.
   - Toggle **ثبت‌نام کاربر جدید** / **New user registration** (`#s-reg`): turn off and save. Verify that trying to register at `/chart` returns `registration_closed`.
   - Toggle **حالت نگهداری** / **Maintenance mode** (`#s-maint`): confirm warning dialog and save. Verify that non-admin login at `/chart` returns `maintenance`.
   - Configure **اطلاعیه سراسری** / **Global announcement**: select severity level (`warning`), enter Persian and English text, and save. Open `/chart` and confirm the banner renders at top of page in the active language.
   - Edit **دامنه‌های ایمیل آزمایشی** / **Test email domains** (`#s-domains`).
2. **Verify Audit Trail**:
   - Navigate to `#audit`.
   - Verify that all recent actions from Stories 1–5 are present with accurate timestamps, localized action labels, actor badges (`@username` or `admin-session`), client IPs, and status pills.
   - Filter by action or search by keyword to verify instant table filtering.
3. **Verify System Health & Admin Sessions**:
   - Navigate to `#system`.
   - Inspect uptime, Node.js memory (RSS and Heap), CPU load averages, and storage file/byte counts.
   - View active admin sessions in the **نشست‌های فعال پنل مدیریت** card. Confirm current session is badged `همین مرورگر` / `This browser`.
   - Click **پایان نشست** / **End session** on a non-current session to revoke it remotely.
   - Inspect the Code Outbox table to verify recent verification and password recovery codes.

---

## 3. Automated E2E Test Suites

Run the automated Puppeteer test suites from the repository root:

```bash
# 1. Admin Console Cycle 1: Gate, Navigation, Dashboard, Users List, Drawer, Bulk Actions
node tests/qa_admin_cycle1.cjs desktop en
node tests/qa_admin_cycle1.cjs desktop fa
node tests/qa_admin_cycle1.cjs mobile en
node tests/qa_admin_cycle1.cjs mobile fa

# 2. Admin Console Cycle 2: Plans Studio, Dirty Guards, Matrix, Settings, Audit, System, Logout
node tests/qa_admin_cycle2.cjs desktop en
node tests/qa_admin_cycle2.cjs desktop fa
node tests/qa_admin_cycle2.cjs mobile en
node tests/qa_admin_cycle2.cjs mobile fa

# 3. Settings Effects on Platform: Banner, Registration lock, Maintenance mode
node tests/qa_admin_settings_effects.cjs desktop
node tests/qa_admin_settings_effects.cjs mobile

# 4. Legacy Plans Admin Studio & Quotas Tests
node tests/legacy/qa_accounts_cycle12_plans_admin.cjs
node tests/legacy/qa_accounts_cycle13_plans_ui_deep.cjs

# 5. DOM Probes: Header layout, RTL icon orders, CSS contrast, Matrix overflow
node tests/probes/admin_dom_facts.cjs
node tests/probes/admin_explore.cjs
node tests/probes/admin_mx_overflow.cjs
```
