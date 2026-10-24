# Review checklist — specs/011-i18n-rtl-mobile

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

---

## Behaviour beyond the tests

- [ ] Language toggle (`setLanguage(lang)` / `switchLanguage(lang)`) sets `document.documentElement.lang` and `dir`, toggles `body.persian-mode`, and emits `tc:languagechange` without page reload.
- [ ] `autoLocalizeUI` records original text nodes in `data-tc-orig-text` and attributes in `data-tc-orig-*` to enable lossless, non-destructive restoration when switching back to English.
- [ ] `localizeAxisWords()` mutates `globalThis.__VELA_MONTHS__` and `globalThis.__VELA_WEEKDAYS__` in place and invalidates the renderer to trigger an immediate canvas repaint.
- [ ] `patchVelaDataWindow()` intercepts `renderer.dataWindowReadout`, translating OHLC labels ('باز', 'بالا', 'پایین', 'بسته', 'حجم', 'زمان', 'تغییر') while wrapping numeric values in LTR spans.
- [ ] Mobile drawer `.vela-drawer` translates rows, flips chevrons in RTL mode, and anchors the custom close button `✕` at `left: 14px`.
- [ ] Mobile panel sheets (`.vela-panel`) open as full-width fixed sheets (`top: 44px; bottom: 0; left: 0; right: 0; width: 100vw; z-index: 130`) with a pill drag handle and $\ge 44$px close button.
- [ ] Quick-trade widget minimizes into a centered pill (`.qt-pill-trigger`) docked above the time axis (`bottom: calc(55px + 22px + 6px)`).
- [ ] Scale controls dock shifts above the time axis on mobile (`bottom: calc(55px + 22px + 6px); left: 8px`) with buttons $\ge 36$px.
- [ ] Mobilebar indicators button (`.vela-mb-indicators`) intercepts native Vela indicator dialogs to open the app's unified indicators modal.
- [ ] Topbar layout, compare, export, and replay buttons collapse text labels to icons on medium screens (769–1380px) and active layout name truncates to prevent overflow.
- [ ] Platform announcement banner sets `dir="rtl"` in Persian, displays `announcementFa`, and remembers dismissal by `updatedAt` in `localStorage['tc_announcement_dismissed']`.
- [ ] Landing page shares `tradingchart_user_settings` with the chart workspace and formats plan prices with Persian numerals and currency suffixes.
- [ ] Server 404 route returns a Persian RTL error page with links to `/` and `/chart`.

---

## Architecture boundaries

- [ ] Core localization dictionaries, `setLanguage`, `t`, `toPersianDigits`, `autoLocalizeUI`, `patchVelaDataWindow`, and drawer localization reside strictly in `client/src/i18n.js`.
- [ ] Vela WebGL engine chrome and drawing tool Persian lookups reside strictly in `client/src/i18nEngineFa.js`.
- [ ] Canonical Persian indicator titles and descriptions (114+ indicators) reside strictly in `client/src/indicatorsFa.js`.
- [ ] App coordinator `switchLanguage` cascade, mobile button bindings (`#btn-mobile-layout`, `#btn-mobile-fullscreen`), and mobilebar interception reside in `client/src/main.js`.
- [ ] Self-hosted font declarations (`@fontsource/*`) reside exclusively in `client/styles/fonts.css`.
- [ ] RTL layout rules, responsive breakpoints, mobile sheets, touch targets, and `.num-ltr` isolates reside in `client/styles/main.css`.
- [ ] Landing page i18n logic resides in `client/landing/landing.js` and styling in `client/landing/landing.css`.
- [ ] Admin console i18n state and formatters reside in `client/admin/core.js` and layout in `client/admin/admin.js` / `admin.css`.
- [ ] Announcement storage and public info endpoint reside in `server/platformSettings.js` and `server/accounts.js`.
- [ ] No direct edits or modifications to `node_modules/@luxalgo/vela`.

---

## Forbidden shortcuts

- [ ] No external font CDN calls (e.g. Google Fonts) or external cloud translation APIs; all fonts are self-hosted and bundled locally.
- [ ] No hardcoded English text in newly mounted views or dialogs.
- [ ] No converting calculation, coordinate, or source code numbers to Persian numerals (canvas, Pine editor, and order inputs must remain LTR tabular numbers).
- [ ] No hard page reloads (`location.reload()`) upon language switching; switching must complete in-memory.
- [ ] No horizontal scrolling on mobile viewports down to 320px (`document.documentElement.scrollWidth <= window.innerWidth`).
- [ ] No touch targets smaller than 44×44 px on mobilebar, sheets, and drawers (36×36 px for compact scale dock buttons).
- [ ] No inserting unescaped user or admin announcement text into HTML via `innerHTML` (use `textContent` or `esc()`).

---

## Copy and UX (only items tests cannot see)

- [ ] Respectful, formal Persian register throughout with zero informal colloquialisms.
- [ ] Strict ZWNJ (`\u200C`) usage in compound Persian words (e.g. `کندل‌استیک`, `می‌شود`, `اندیکاتورها`, `دیده‌بان`, `بک‌تستر`, `پراپ‌فرم`).
- [ ] Numbers, financial tickers, prices, percentages, codes, and order quantities maintain strict LTR isolation (`.num-ltr`, `<bdi dir="ltr">`, `dir="ltr"`).
- [ ] Mirrored iconography in RTL mode: back/forward chevrons and drawer arrows flip orientation.
- [ ] Mobile toast notifications positioned away from the bottom mobilebar and thumb zone to prevent covering actionable buttons.
