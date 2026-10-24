# Data Model: Internationalisation, RTL and Mobile

**Branch**: `011-i18n-rtl-mobile` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This document specifies the data entities, storage locations, schemas, validation rules, and lifecycles supporting internationalisation, bidirectional text shaping, and responsive mobile states.

---

## 1. Key Entities

### E1. Language Preference (Client & Sync)

The language preference represents the user's active interface language and typographic direction selection across the trading platform, landing page, and back-office console.

- **Storage**:
  - **Main App & Landing Page**: Client `localStorage` under key `tradingchart_user_settings` (as a field on the settings object) and legacy fallback `tradingchart_lang`.
  - **Admin Console**: Client `localStorage` under key `tc_admin_lang`.
  - **Server Cloud State**: Server atomic file `server/data/accounts/states/state_u_<userId>.json` (mode `0o600`).
- **Fields**:
  - `language`: `string` (`'en'` | `'fa'`). Default: `'fa'` on landing page, `'en'` default in chart app (unless detected/saved), `'fa'` in admin console.
- **Validation**:
  - Must strictly equal `'en'` or `'fa'`. Any other value is ignored and falls back to default.
- **Limits**:
  - 2 characters maximum.
- **Lifecycle**:
  - **Initialization**: On initial boot, `main.js` checks `localStorage['tradingchart_user_settings'].language`. If absent, defaults to `'en'`. Landing page (`landing.js:pickLang`) checks URL query `?lang=...`, then `localStorage['tradingchart_user_settings'].language`, then navigator language, defaulting to `'fa'`. Admin console (`admin/core.js`) checks `localStorage['tc_admin_lang']`, then `tradingchart_user_settings.language`, defaulting to `'fa'`.
  - **Mutation**: Updated when the user clicks `#btn-toggle-lang`, selects language in `#modal-settings`, triggers "Toggle Language FA/EN" in the command palette, or clicks `#gate-lang` in admin.
  - **Sync**: For signed-in users, `main.js` pushes the preference to the server via `PUT /api/user/state`. Upon logging in on a new device, `GET /api/user/state` restores the saved language.
  - **Retention**: Persistent in browser storage indefinitely until browser data is cleared.

```json
// Example: localStorage['tradingchart_user_settings']
{
  "theme": "dark",
  "language": "fa",
  "bullColor": "#00F2B0",
  "bearColor": "#FF4D5B",
  "gridLines": "both",
  "timezone": "Etc/UTC"
}
```

---

### E2. Translation Dictionaries (In-Memory Runtime)

The bilingual translation dictionaries provide static and dynamic key-to-string mappings, regex patterns, and indicator definitions.

- **Storage**: In-memory JavaScript modules loaded into browser memory on boot:
  - `client/src/i18n.js` (`translations.en`, `translations.fa`, `VELA_UI_FA`, `VELA_UI_PATTERNS`, `VELA_UI_MARKET_NAMES_FA`)
  - `client/src/i18nEngineFa.js` (`VELA_ENGINE_FA`)
  - `client/src/indicatorsFa.js` (`INDICATORS_FA`)
  - `client/landing/landing.js` (`EN`, `FA_FN`)
  - `client/admin/core.js` (`tr()` mapping function and formatters)
- **Fields**:
  - **App Dictionary Entry**: `Record<string, string>` mapping semantic UI keys (e.g. `navQuant`, `tabPine`, `wlTitle`) to translated strings.
  - **Vela Engine Mapping Entry**: `Record<string, string>` mapping exact Latin engine strings (e.g. `'Search tools…'`, `'ABCD Pattern'`) to Persian equivalents.
  - **Pattern Mapping Entry**: `Array<[RegExp, (match: RegExpMatchArray) => string]>` dynamically converting parameterized strings (e.g. `/^Indicators\s*\((\d+)\)$/` -> `'اندیکاتورها (۰-۹)'`).
  - **Indicator Metadata Entry**: `Record<string, { name: string, description: string }>` keyed by indicator identifier (e.g. `smc_fvg`, `supertrend`).
- **Validation**:
  - Values must be non-empty strings.
  - Indicator descriptions must conform to the formal register and include strict ZWNJ (`\u200C`) where appropriate.
- **Limits**:
  - Read-only in memory (~150 KB bundled).
- **Lifecycle**:
  - Created at bundler build time; instantiated once on module evaluation; retained in JavaScript memory for the lifetime of the tab.

```json
// Example: indicatorsFa.js entry
{
  "smc_fvg": {
    "name": "شناساگر شکاف ارزش منصفانه (FVG / SMC)",
    "description": "شناساگر عدم تعادل سه‌کندلی که شکاف‌های ارزش منصفانهٔ صعودی و نزولی و سطح ۵۰٪ نقطهٔ تعادل (CE) را علامت‌گذاری می‌کند."
  }
}
```

---

### E3. Platform Announcement Entity

Represents administrative announcements broadcast across the platform, rendered conditionally in English or Persian.

- **Storage**:
  - **Server Store**: `server/data/accounts/platform_settings.json` (mode `0o600`).
  - **Client Dismissal Record**: Client `localStorage` under key `tc_announcement_dismissed`.
- **Fields**:
  - `announcementEnabled`: `boolean` (flag indicating whether the banner is active).
  - `announcementLevel`: `string` (`'info'` | `'warning'` | `'success'`). Default: `'info'`.
  - `announcementFa`: `string` (Persian announcement message). Max 280 characters.
  - `announcementEn`: `string` (English announcement message). Max 280 characters.
  - `updatedAt`: `number` (Unix timestamp in milliseconds representing the last edit time).
- **Validation**:
  - Level must be one of `['info', 'warning', 'success']`.
  - If `announcementEnabled` is true, at least one of `announcementFa` or `announcementEn` must be non-empty.
  - Max length: 280 characters per language.
- **Limits**:
  - Single active global announcement record.
- **Lifecycle**:
  - **Creation/Update**: Created or updated by an administrator via `PUT /api/admin/settings`.
  - **Distribution**: Fetched by client workspace every 5 minutes via `GET /api/platform`.
  - **Dismissal**: When a user clicks `#tc-platform-banner .tc-pb-close`, the client writes `String(announcement.updatedAt)` to `localStorage['tc_announcement_dismissed']`.
  - **Re-display**: If the administrator modifies the announcement, `updatedAt` changes, causing the dismissal check (`dismissedRev() === String(a.updatedAt)`) to evaluate to false and redisplaying the banner.

```json
// Example: platform_settings.json
{
  "registrationOpen": true,
  "maintenanceMode": false,
  "announcementEnabled": true,
  "announcementLevel": "warning",
  "announcementFa": "تعمیرات دوره‌ای سرور دوشنبه ساعت ۰۲:۰۰ بامداد انجام خواهد شد.",
  "announcementEn": "Scheduled server maintenance on Monday at 02:00 AM UTC.",
  "updatedAt": 1729785600000
}
```

---

### E4. User Cloud State Entity (`state_u_<userId>.json`)

The cloud state encapsulates the user's personal layout, watchlists, drawing tools, and user settings across multiple devices.

- **Storage**: Server file `server/data/accounts/states/state_u_<userId>.json` (mode `0o600`).
- **Fields**:
  - `state`: `object` containing:
    - `tradingchart_user_settings`: `object` containing `language` (`'fa'` | `'en'`), `theme`, colors, etc.
    - Workspace layouts, watchlists, alerts, drawings.
  - `updatedAt`: `number` (Unix timestamp in milliseconds of last cloud write).
  - `version`: `number` (Schema revision counter).
- **Validation**:
  - `state` must be an object.
  - Serialized payload size must not exceed 2 MB (`STATE_MAX_BYTES = 2097152`).
  - Feature quotas must not violate the user's active plan entitlements (`validateStateAgainstPlan`).
- **Limits**:
  - 2 MB hard cap per user.
- **Lifecycle**:
  - Created when the user first syncs settings.
  - Updated via `PUT /api/user/state` with optimistic concurrency checking (`baseUpdatedAt`).
  - Read via `GET /api/user/state` upon sign-in.
  - Purged upon administrative account deletion (`DELETE /api/admin/users/:id`).

---

## 2. Storage Mapping Summary

| Entity | Primary Storage | Fallback / Redundancy | Key / Path | Expiration / Retention |
|---|---|---|---|---|
| Language Preference | Client `localStorage` | Cloud state / `localStorage['tradingchart_lang']` | `tradingchart_user_settings.language` | Indefinite until manual clear or reset |
| Admin Console Language | Client `localStorage` | None | `tc_admin_lang` | Indefinite |
| Announcement Dismissal | Client `localStorage` | In-memory dismiss | `tc_announcement_dismissed` | Valid until `updatedAt` changes |
| Dictionaries | Bundled JS runtime | None | Memory objects in `i18n.js`, etc. | Tab lifespan |
| Global Announcements | Server JSON file | In-memory `_cache` | `server/data/accounts/platform_settings.json` | Persistent on disk |
| User Cloud State | Server JSON file | None | `server/data/accounts/states/state_u_<id>.json` | Persistent until user deletion |
