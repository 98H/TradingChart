# Module API Contract: Admin Console (Back Office)

**Branch**: `010-admin-console` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](../spec.md)

This document specifies the internal JavaScript module interfaces, shared state dictionaries, and exported functions across the client console modules in `client/admin/`.

---

## 1. Core Runtime (`client/admin/core.js`)

Provides shared localization, formatting, API transport, toasts, dialogs, and SVG iconography.

### State & Localization
- **`state`**: Reactive container `{ lang: 'fa' | 'en' }`. Initialized from `localStorage['tc_admin_lang']` or `localStorage['tradingchart_user_settings'].language`.
- **`isFa()` -> `boolean`**: Returns `true` if current language is Persian.
- **`setLang(lang: 'fa' | 'en') -> void`**: Sets runtime language, persists to `localStorage['tc_admin_lang']`, updates `document.documentElement.lang` and `dir`, and adjusts `document.title`.
- **`tr(fa: string, en: string) -> string`**: Selects language-appropriate string based on `isFa()`.

### Formatting Utilities
- **`fmtNum(n: number | string, opts?: Intl.NumberFormatOptions) -> string`**: Formats numerals using localized digits (Persian digits `۰-۹` in FA, Latin `0-9` in EN).
- **`plural(n: number, one: string, many?: string) -> string`**: Formats English singular/plural nouns based on count.
- **`fmtMoney(n: number | string) -> string`**: Formats currency amounts (`"$29.99"` in EN, `"۲۹٫۹۹ دلار"` in FA).
- **`fmtPct(r: number) -> string`**: Formats percentage ratios with 1 decimal place (`"12.5%"` or `"۱۲٫۵٪"`).
- **`fmtBytes(b: number) -> string`**: Formats file and state sizes into B, KB, or MB units.
- **`fmtDate(ts: number | string, withTime?: boolean) -> string`**: Localized date/time representation.
- **`fmtDay(isoDay: string) -> string`**: Formats ISO calendar dates (`YYYY-MM-DD`) into month/day abbreviations.
- **`fmtAgo(ts: number) -> string`**: Relative time formatting (`"just now"`, `"5 minutes ago"`, `"۲ ساعت قبل"`).
- **`fmtDuration(sec: number) -> string`**: Localized durations in non-breaking units (days, hours, minutes).
- **`esc(s: any) -> string`**: Escapes HTML special characters (`& < > " '`).
- **`safeColor(c: string) -> string`**: Validates 6-hex color code; defaults to `'#00F2B0'` if invalid.

### Network Client
- **`class ApiError extends Error`**: Error subclass wrapping HTTP status and error response body `{ status, data }`.
- **`setUnauthorizedHandler(fn: () => void) -> void`**: Registers callback invoked when an API request receives HTTP 403 `forbidden_admin_only`.
- **`api(url: string, opts?: { method?: string, body?: any, raw?: boolean }) -> Promise<any>`**: Standardized fetch wrapper configured with `credentials: 'same-origin'` and JSON serialization.
- **`errMsg(e: ApiError | Error | any) -> string`**: Translates backend error codes (`invalid_master_key`, `rate_limited`, `forbidden_admin_only`, `user_not_found`, `cannot_delete_self`, etc.) into localized Persian/English user feedback.

### UI Feedback & Dialogs
- **`icon(name: string, cls?: string) -> string`**: Returns inline SVG icon element string matching requested name (`'shield'`, `'dashboard'`, `'users'`, `'plans'`, `'audit'`, `'settings'`, `'system'`, etc.).
- **`toast(msg: string, type?: 'success' | 'error' | 'info', ms?: number) -> void`**: Dispatches accessible status notification (`role="status"`, `aria-live="polite"`). Auto-cleans stale successes, preserves errors, and invokes `placeToasts()`.
- **`placeToasts() -> void`**: Dynamic positioning engine: pins toasts to header band on mobile ($\le 860$px) to avoid bottom nav and thumb zones; on desktop, floats stack above sticky save/bulk bars and centers beside active drawers.
- **`openDialog(opts: DialogOptions) -> Promise<any>`**: Accessible modal dialog manager featuring Tab focus trap, Enter confirmation, Escape dismissal, background backdrop click handling, and inline error presentation.
- **`confirmDialog(opts: DialogOptions) -> Promise<boolean>`**: Convenience wrapper returning boolean outcome.

---

## 2. Plans Catalog Studio (`client/admin/plans.js`)

Manages the plan editor, live pricing card preview, feature quota controls, and comparison matrix.

### Exported Functions
- **`renderPlans(view: HTMLElement, ctx: ConsoleContext) -> Promise<void>`**: Mounts the plans studio inside the provided view container. Binds keyboard shortcuts (`Ctrl+S`/`Cmd+S`), renders plan list or matrix, and synchronizes dirty state.
- **`plansDirty() -> boolean`**: Evaluates whether active plan draft in `S.draft` diverges from the clean snapshot in `S.orig`.
- **`confirmLeavePlans() -> Promise<boolean>`**: Intercepts view navigation or hash changes when unsaved plan edits exist, displaying a modal confirmation prompt. Returns `true` if safe to navigate (edits discarded).

### Internal State & Subsystems
- **`S` (Studio State)**:
  - `data`: Complete catalog payload from `GET /api/admin/plans`.
  - `sel`: Currently selected plan ID.
  - `draft`: Editable copy of plan attributes and feature quota values.
  - `orig`: JSON string snapshot of clean plan state for change detection.
  - `raw`: String cache for numeric input fields to preserve operator typing.
  - `errors`: Map of field validation error messages.
  - `mode`: View mode (`'editor'` or `'matrix'`).
  - `mobile`: Screen state for narrow viewports ($\le 980$px: `'list'` or `'editor'`).
  - `q`: Search query string for filtering the 47-feature list.
  - `onlyChanged`: Toggle to filter feature list to modified items only.
- **Live Pricing Preview (`#pf-preview`)**: Dynamically updates title, badges, monthly price, yearly price, and savings pill as form inputs change.
- **Unlimited Quota Switches**: Toggling the $\infty$ button disables numeric input and assigns `-1`.

---

## 3. Console Controller & Router (`client/admin/admin.js`)

Central orchestrator managing authentication lifecycle, topbar, navigation shell, and functional views.

### Application Coordinator (`app`)
- **`app.session`**: Active administrative session descriptor `{ isAdmin, via, actor, userId, username, expiresAt }`.
- **`app.section`**: Active section identifier (`'dashboard'`, `'users'`, `'plans'`, `'audit'`, `'settings'`, `'system'`).
- **`app.plansMeta`**: Cached plans catalog metadata.
- **`app.users`**: Filter and pagination state for users list `{ q, plan, role, status, type, sort, dir, page, pageSize, selected, data }`.
- **`app.audit`**: Filter and pagination state for audit log `{ q, action, status, page, data }`.
- **`app.dashType`**: Active dashboard scope filter (`'real'`, `'all'`, `'test'`).
- **`app.settingsEdit`**: In-progress settings draft `{ s, orig, draft }` preserved across language toggling.

### Core Lifecycle & Navigation
- **`boot() -> Promise<void>`**: Verifies existing session via `GET /api/admin/session`. Routes to shell on success or renders login gate on failure.
- **`renderGate(errorCode?: string) -> void`**: Mounts master key unlock card with password visibility toggle, attempt rate-limit display, and language switcher.
- **`renderShell() -> void`**: Renders sidebar navigation, responsive topbar with operator badge, bottom mobile navigation bar, and view container.
- **`route(force?: boolean) -> Promise<void>`**: Reads hash fragment (`#/<section>`), handles leave guards, updates active navigation indicators (`aria-current="page"`), and renders target view.
- **`go(section: string) -> void`**: Updates `location.hash` with leave-guard interception.
- **`logout() -> Promise<void>`**: Confirms intent; redirects to `/chart` if role-based, or revokes session and clears cookie via `POST /api/admin/logout` if key-based.

### View Renderers
- **`renderDashboard(view: HTMLElement) -> Promise<void>`**: Fetches `GET /api/admin/overview?type=...`, renders 16 KPI cards, SVG 30-day signup chart with peak badge, plan distribution bars, recent users, and latest audit events.
- **`renderUsers(view: HTMLElement) -> Promise<void>`**: Renders debounced search input (280 ms), filter dropdowns, sortable table headers, mobile cards (`.mlist`), pager, bulk actions toolbar, and CSV export.
- **`openUser(id: string, onChange?: () => void) -> Promise<void>`**: Opens slide-over drawer (`aside.drawer`) with scrim backdrop. Mounts tabs: Overview (plan select, role select, display name, notes, email verification, password reset code relay, 2FA reset, test account toggle, suspension, deletion), Sessions (device list, revocation), and Admin History.
- **`renderAudit(view: HTMLElement) -> Promise<void>`**: Renders audit trail table with action and status filters, event details modal, actor badges, and relative timestamps.
- **`renderSettings(view: HTMLElement) -> Promise<void>`**: Renders registration switch, maintenance mode toggle (with confirmation modal), bilingual announcement editor (severity, FA/EN text, character counters), test domain tags, and sticky save bar.
- **`renderSystem(view: HTMLElement) -> Promise<void>`**: Renders server telemetry (uptime, Node RSS/heap, CPU load, storage files/bytes), active admin sessions table with revocation buttons, and message outbox.
