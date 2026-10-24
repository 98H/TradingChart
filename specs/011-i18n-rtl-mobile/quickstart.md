# Quickstart & Verification Guide: Internationalisation, RTL and Mobile

**Branch**: `011-i18n-rtl-mobile` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This guide details the procedures for manually verifying each user story on a live Chartivia instance (`$SDD_BASE_URL`, default `http://127.0.0.1:8088`), as well as executing the automated Puppeteer test suites.

---

## 1. Environment & Server Startup

Start the backend server on the default port:

```bash
# From repository root (/root/TradingChart)
PORT=8088 npm start
```

Ensure the server reports successful startup and live WebSocket binding:
```text
[Chartivia Server] Running on http://0.0.0.0:8088
[Chartivia Server] WebSocket live stream on ws://0.0.0.0:8088/ws/live
```

---

## 2. Manual Verification by User Story

### User Story 1 — Switch Language Anywhere (Priority: P1)

1. Open `$SDD_BASE_URL/chart` in your web browser.
2. **Topbar Trigger**:
   - Click `#btn-toggle-lang` ("FA / EN") on the top-right header band.
   - **Verify**: `<html>` immediately receives `lang="fa"` and `dir="rtl"`. Document body gains class `.persian-mode`.
   - **Verify**: Topbar navigation pills, bottom suite tabs, and side dock labels immediately display Persian text (e.g. "چارت تک‌پنجره‌ای", "دیده‌بان دارایی‌ها", "ویرایشگر پاین").
   - **Verify**: Month labels on the chart's horizontal time axis switch to Persian (e.g., "ژانویه", "فوریه", "مارس") without canvas distortion.
   - **Verify**: Hovering the crosshair across candles displays translated Data Window fields ("باز", "بالا", "پایین", "بسته", "حجم", "زمان").
3. **Settings Modal Trigger**:
   - Open Chart Settings (`#btn-shortcuts-help` or Gear icon).
   - In the "System & Language" tab, change `#cfg-lang-select` to "English (LTR)" and click "Save Settings".
   - **Verify**: App flips immediately back to LTR English without page reload.
4. **Command Palette Trigger**:
   - Press `Ctrl+K` (or `Cmd+K` on macOS) to open the Command Palette.
   - Type "Toggle Language" or "تغییر زبان" and press `Enter`.
   - **Verify**: Interface switches to the alternate language.
5. **Persistence**:
   - In Persian mode, reload the browser tab (`F5` / `Ctrl+R`).
   - **Verify**: App reboots directly into Persian RTL mode with zero flash of unstyled LTR content.

---

### User Story 2 — Correct Numbers and Direction in Persian (Priority: P1)

1. Navigate to `$SDD_BASE_URL/chart` in Persian mode.
2. **Text Digits**:
   - Inspect the indicator badge count in the indicators modal or symbol badge count in symbol search.
   - Inspect gold ounce rates and Tehran bubble percentages in the Gold panel.
   - **Verify**: Digits are rendered using Persian glyphs `۰-۹`.
3. **Numeric Isolation**:
   - Inspect the chart canvas vertical price scale, crosshair price label, and time axis coordinate readouts.
   - Open the Pine Script Editor tab (`#tab-label-pine`).
   - Inspect the Quick Trade ticket quantity input field (`#quick-trade-qty`).
   - **Verify**: Numerals in these zones remain strictly Latin `0-9` with LTR alignment, ensuring arithmetic validity and script readability.
4. **Leak Audit**:
   - Open bottom panel tabs (Trade Journal, Prop-Firm Simulator, Economic Calendar, Technical Screener).
   - **Verify**: Zero untranslated Latin boilerplate strings appear outside allowed ticker symbols (e.g. BTCUSDT) or technical acronyms (SMC, FVG, RSI).

---

### User Story 3 — Use the App on a Phone (Priority: P1)

1. Open DevTools (`F12`), toggle device toolbar (`Ctrl+Shift+M`), and select viewport **390×844 px** (iPhone 12/13/14).
2. Open `$SDD_BASE_URL/chart`.
3. **Mobilebar Presence**:
   - **Verify**: Floating desktop tool rail and header pills are hidden.
   - **Verify**: Bottom 6-button `.vela-mobilebar` is visible and docked to the thumb zone.
4. **Header Cleanliness**:
   - **Verify**: `#top-app-header` shows 0 px horizontal overflow. Layouts button (`#btn-mobile-layout`) and fullscreen button (`#btn-mobile-fullscreen`) are present.
   - Tap `#btn-mobile-layout`: Centered multi-chart layout studio opens cleanly.
5. **Mobile "More" Drawer**:
   - Tap the three-dots button (`.vela-mb-more`).
   - **Verify**: Bottom drawer `.vela-drawer` slides up smoothly. In Persian mode, panel item titles align right, chevrons face left, and close button `✕` anchors at `left: 14px`.
6. **Full-Viewport Panel Sheets**:
   - Inside `.vela-drawer`, tap "Watchlist" (دیده‌بان دارایی‌ها).
   - **Verify**: Watchlist panel opens as a full-viewport sheet (`width: 100vw; top: 44px; bottom: 0`).
   - **Verify**: Panel header contains a prominent drag handle pill and a close button meeting the $\ge 44$px touch target requirement.
   - Tap the close button: Panel dismisses and returns focus to the chart.
7. **Docked Scale Controls & Quick Trade**:
   - **Verify**: Scale controls dock sits above the time axis (`bottom: calc(55px + 22px + 6px)`), with buttons at least 36×36 px.
   - **Verify**: Quick trade widget starts as a compact centered pill (`.qt-pill-trigger`) above the time axis.

---

### User Story 4 — Medium / Tablet Screens (Priority: P2)

1. Resize DevTools viewport to **1280×800 px**, **1024×768 px**, and **820×1180 px**.
2. **Verify**:
   - At 1280px: Magnet and Fullscreen buttons are hidden; buttons like Save, Compare, and Export collapse their text labels into compact icon buttons; layout name truncates gracefully.
   - At 820px: Latency badge and avatar display label are hidden.
   - **Verify**: At all tested intermediate resolutions, the header never wraps into two lines and maintains 0 px horizontal overflow (`document.documentElement.scrollWidth === window.innerWidth`).

---

### User Story 5 — Landing Page and Admin Console Languages (Priority: P2)

1. **Landing Page**:
   - Open `$SDD_BASE_URL/` in your browser.
   - **Verify**: Page loads in Persian RTL (`<html lang="fa" dir="rtl">`).
   - Click `#lang-toggle` ("EN").
   - **Verify**: Text, hero headings, feature descriptions, and aria labels switch to English. Pricing cards render `$39 /mo` with Latin numerals.
   - Click `#lang-toggle` ("فا").
   - **Verify**: Text switches back to Persian; plan pricing cards render `۳۹ دلار /ماه` with Persian digits and localized currency suffixes.
2. **Admin Console**:
   - Open `$SDD_BASE_URL/admin`.
   - **Verify**: Console loads in Persian RTL (`<html lang="fa" dir="rtl">`).
   - Click the language toggle button on the login gate (`#gate-lang`) or in the sidebar.
   - **Verify**: Back-office menus, KPI cards, and table headers switch to English with LTR alignment.
   - **Verify**: Reloading the page retains the chosen admin language via `localStorage['tc_admin_lang']`.

---

## 3. Automated Test Suites

Run the existing Puppeteer test suites from the project root:

```bash
# 1. Full-surface Persian text leak audit (Desktop & Mobile viewports)
node tests/qa_i18n_final.cjs

# 2. Diagnostic deep probe dumping Latin text across all panels & modals
node tests/qa_i18n_probe.cjs

# 3. Mobile drawer items extraction at 390x844 viewport
node tests/test_mobile_drawer_items.js

# 4. Mobilebar 6-button automated interaction and screenshot audit
node tests/audit_mobile_features.js

# 5. Mobile interactive panel (Watchlist) opening and touch close verification
node tests/test_mobile_interactive.js

# 6. Mobile header clean layout, 15m timeframe selection, and drawer elevation
node tests/capture_mobile_flawless.js
```

### Expected Test Results:
- `tests/qa_i18n_final.cjs`: Logs `TOTAL genuine untranslated strings: 0`.
- `tests/test_mobile_interactive.js`: Logs `panelState: { open: true, hasCloseBtn: true }` and `Test finished.`.
- `tests/capture_mobile_flawless.js`: Saves visual proof screenshots into `/root/TradingChart/screenshots/mobile_flawless/` with zero header overflow and clean drawer elevations.
