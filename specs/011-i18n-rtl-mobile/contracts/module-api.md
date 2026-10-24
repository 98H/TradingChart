# Module API & Events Contract: Internationalisation, RTL and Mobile

**Branch**: `011-i18n-rtl-mobile` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This contract specifies the internal JavaScript interfaces, function signatures, exported utilities, and DOM events that coordinate localization and mobile responsive behaviors across client modules.

---

## 1. Core i18n Engine (`client/src/i18n.js`)

### `setLanguage(lang: 'en' | 'fa'): void`
- **Description**: Sets active platform language, mutates `document.documentElement` attributes (`lang`, `dir`), toggles `body.persian-mode`, triggers axis word localization, updates DOM labels, localizes the mobile drawer, runs `autoLocalizeUI()`, and dispatches the window event `tc:languagechange`.
- **Side Effects**:
  - `document.documentElement.lang = lang`
  - `document.documentElement.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr')`
  - `document.body.classList.toggle('persian-mode', lang === 'fa')`
  - Dispatches `CustomEvent('tc:languagechange', { detail: { lang } })`

### `getLanguage(): 'en' | 'fa'`
- **Description**: Returns the current active language string.

### `t(key: string): string`
- **Description**: Looks up translation string for the active locale.
- **Fallback Chain**: `translations[currentLang][key]` -> `translations['en'][key]` -> `key`.
- **Guarantee**: Never returns an empty string or null if the key is provided.

### `toPersianDigits(str: string | number): string`
- **Description**: Converts all ASCII digit characters (`0-9`) within the provided input into Persian glyphs (`۰-۹`).
- **Input**: Any string or numeric primitive.
- **Output**: Formatted string with Persian digits.

### `applyTranslationsToDOM(): void`
- **Description**: Queries established semantic DOM nodes across topbar navigation pills, bottom suite tabs, panel drawer items, symbol search inputs, and indicators modal headers, updating text content according to the active dictionary.

### `autoLocalizeUI(root?: HTMLElement): number`
- **Description**: Recursively traverses the DOM subtree from `root` (defaults to `document.body`) using a `TreeWalker` (`NodeFilter.SHOW_TEXT`). Translates matched Latin phrases into formal Persian while skipping numeric/code zones (`.num-ltr`, `#pine-code-editor`, `.code-editor`, `svg`, `script`). Attaches `data-tc-orig-text` and `data-tc-orig-*` attributes to ensure lossless restoration when switching back to English.
- **Returns**: Number of translated elements and attributes.

### `patchVelaDataWindow(): boolean`
- **Description**: Idempotently wraps the active chart renderer's `dataWindowReadout` function, translating OHLC labels ('Open'->'باز', 'High'->'بالا', 'Low'->'پایین', 'Close'->'بسته', 'Volume'->'حجم', 'Time'->'زمان', 'Change'->'تغییر') while maintaining numbers in LTR.

### `localizeAxisWords(lang: 'en' | 'fa'): void`
- **Description**: Slices the chart engine's globally exposed month (`__VELA_MONTHS__`) and weekday (`__VELA_WEEKDAYS__`) string arrays in-place with localized names and triggers a canvas render request.

### `localizeMoreDrawer(): void`
- **Description**: Translates action buttons (Undo, Redo, Screenshot), category headers, and panel list rows inside the open mobile bottom sheet drawer (`.vela-drawer`), applying mirrored chevrons and anchoring the close button to the left (`left: 14px`) in Persian RTL mode.

### `initDrawerObserver(): void`
- **Description**: Initializes a `MutationObserver` on `document.body` monitoring drawer open attributes (`data-state="open"`), automatically invoking `localizeMoreDrawer()` upon appearance.

---

## 2. Window Events

### Event: `tc:languagechange`
- **Dispatched by**: `client/src/i18n.js:setLanguage`
- **Target**: `window`
- **Detail**:
  ```typescript
  interface LanguageChangeDetail {
    lang: 'en' | 'fa';
  }
  ```
- **Usage**: Listened to by secondary panels and third-party UI widgets to invalidate cached text strings and re-render canvas overlays.

---

## 3. Central Application Coordinator (`client/src/main.js`)

### `switchLanguage(lang: 'en' | 'fa'): void`
- **Description**: Invokes `setLanguage(lang)`, saves the selection to `localStorage['tradingchart_user_settings']`, and systematically re-renders all active, lazy-mounted, or open components:
  - `relocalizePlatformBanner()`
  - Chart style picker, workspaces, news, trade journal, DOM, technical screener, economic calendar, paper trading, bar replay, prop-firm sim, strategy tester, and scale controls.
  - Open modals: layout studio, user profile, account settings, plans, devices, indicators, settings, and data export.
  - Updates gold bubbles and TSE tape widgets.

### Mobile Header Event Bindings:
- `#btn-mobile-layout`: Click listener invokes `this.layoutManager?.openLayoutStudio()`.
- `#btn-mobile-fullscreen`: Click listener toggles `document.fullscreenElement` via `requestFullscreen()` or `exitFullscreen()`.
- `#btn-toggle-lang`: Click listener toggles between `'en'` and `'fa'` via `this.switchLanguage(next)`.

---

## 4. Landing Page Runtime (`client/landing/landing.js`)

### `pickLang(): 'en' | 'fa'`
- **Description**: Resolves landing page language from URL search param `?lang=...`, then `localStorage['tradingchart_user_settings'].language`, then navigator language, defaulting to `'fa'`.

### `applyLang(l: 'en' | 'fa'): void`
- **Description**: Sets `document.documentElement.lang` and `dir`, updates text content on elements with `[data-i18n]`, updates aria labels on `[data-i18n-aria]`, updates `document.title`, toggles `#lang-toggle` label ('فا' / 'EN'), saves preference to `localStorage['tradingchart_user_settings']`, and re-renders pricing plan cards with Persian/English digits and formatting.

---

## 5. Admin Console Runtime (`client/admin/core.js`)

### State & Language Management:
- `state.lang`: `'fa'` | `'en'`
- `isFa(): boolean`: Returns `state.lang === 'fa'`
- `setLang(lang: 'en' | 'fa'): void`: Mutates `state.lang`, stores to `localStorage['tc_admin_lang']`, sets `html[lang][dir]`, and updates document title.
- `tr(fa: string, en: string): string`: Returns `fa` when in Persian mode, otherwise `en`.

### Localized Formatters:
- `fmtNum(n: number, opts?: Intl.NumberFormatOptions): string`: Formats numbers using `Intl.NumberFormat('fa-IR')` or `'en-US'`.
- `fmtMoney(n: number): string`: Formats currency as `${s} دلار` (FA) or `$${s}` (EN).
- `fmtDate(ts: number | string, withTime?: boolean): string`: Formats timestamps using localized short month and numbers.
- `fmtAgo(ts: number): string`: Relative time formatting using `Intl.RelativeTimeFormat`.
- `fmtDuration(sec: number): string`: Formats durations with non-breaking spaces (`\u00A0 روز`, `ساعت`, `دقیقه`).
- `fmtBytes(b: number): string`: Formats byte counts with localized KB/MB strings.

---

## 6. Announcement Banner Controller (`client/src/platformBanner.js`)

### `initPlatformBanner(): void`
- **Description**: Bootstraps announcement banner polling (`GET /api/platform`), sets up a 5-minute recurring timer that respects `document.hidden`, and binds visibility change events.

### `relocalizePlatformBanner(): void`
- **Description**: Re-renders the announcement banner in place following a language switch, swapping between `announcementFa` and `announcementEn` and updating `dir="rtl"` or `dir="ltr"`.
