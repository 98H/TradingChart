# Research & Design Decisions: Internationalisation, RTL and Mobile

**Branch**: `011-i18n-rtl-mobile` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

This document formalizes the architectural decisions and implementation strategies embodied in the existing production codebase for internationalisation, RTL layout, and mobile device responsiveness.

---

## R1. Dual-Locale Architecture & Dynamic DOM Auto-Localizer with Lossless Restoration

- **Decision**: The client runtime establishes a centralized dictionary system (`translations` in `client/src/i18n.js`) supporting English (`en`) and formal Persian (`fa`). Language switching (`setLanguage(lang)` and `main.js:switchLanguage`) dynamically mutates `document.documentElement.lang` and `dir`, toggles `body.persian-mode`, dispatches the `tc:languagechange` window event, and triggers `applyTranslationsToDOM()` alongside a TreeWalker-based auto-localizer (`autoLocalizeUI`). `autoLocalizeUI` records original Latin text nodes into `data-tc-orig-text` and original attributes (`title`, `aria-label`, `placeholder`) into `data-tc-orig-*`, enabling lossless, non-destructive restoration when switching back to English without reloading the page.
- **Rationale**: Full-page reloads disrupt active WebGL canvas contexts, discard unsaved drawing primitives, sever live WebSocket market tick streams, and degrade user experience. Recording original strings directly on DOM attributes permits arbitrary bi-directional language switching in-memory without memory leaks or text distortion.
- **Alternatives considered**:
  - *Hard page reload on language change*: Rejected because it resets user zoom, pan, active chart layout, and WebSocket connections.
  - *Server-side rendering (SSR) of localized HTML templates*: Rejected because the charting engine is an interactive WebGL single-page application requiring instant in-memory switching.
- **Evidence**: `client/src/i18n.js:setLanguage` (lines 889–901), `client/src/i18n.js:autoLocalizeUI` (lines 670–747), `client/src/main.js:switchLanguage` (lines 1794–1880).

---

## R2. Non-Invasive WebGL Chart Chrome & Data Window Patching

- **Decision**: Deep WebGL chart components that do not render through traditional HTML DOM are localized through two non-invasive techniques:
  1. **Axis Label Splicing**: The global month and weekday arrays exposed by the chart build (`globalThis.__VELA_MONTHS__` and `globalThis.__VELA_WEEKDAYS__`) are mutated in-place via `.splice(0, 12, ...AXIS_FA.m)` and `.splice(0, 7, ...AXIS_FA.w)` in `localizeAxisWords()`, followed by invalidating the renderer to trigger an immediate canvas repaint.
  2. **Data Window Readout Provider Hook**: `patchVelaDataWindow()` monkey-patches `renderer.dataWindowReadout` to pass OHLC labels ('Open'→'باز', 'High'→'بالا', 'Low'→'پایین', 'Close'→'بسته', 'Volume'→'حجم', 'Time'→'زمان', 'Change'→'تغییر') through translation dictionaries while wrapping values in LTR spans. A `MutationObserver` on `.vela-panel.vela-dw .vela-panel-body` ensures dynamic DOM updates remain localized without recursive mutation loops.
- **Rationale**: `@luxalgo/vela` compiles canvas text rendering internally. Directly modifying `node_modules` is forbidden by Constitution Principle IX. Intercepting the readout provider and mutating build-exposed global arrays allows 100% Persian chart chrome without vendor forks.
- **Alternatives considered**:
  - *Patching Vela source in node_modules*: Strictly prohibited by Constitution Principle IX (Minimal Dependencies, No Vendor Edits).
  - *Overlaying an HTML table on top of WebGL canvas*: Rejected because it causes cursor lag, z-index layering conflicts, and broken crosshair alignment.
- **Evidence**: `client/src/i18n.js:localizeAxisWords` (lines 878–887), `client/src/i18n.js:patchVelaDataWindow` (lines 838–856), `client/src/i18n.js:localizeDataWindowDom` (lines 795–821).

---

## R3. 100% Self-Hosted Bundled Offline Typography Pipeline

- **Decision**: All typography declarations in `client/styles/fonts.css` import local `@fontsource/vazirmatn`, `@fontsource/inter`, and `@fontsource/jetbrains-mono` font files. Standard CSS fallback stacks are configured:
  - `--font-sans`: `'Inter', 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - `--font-mono`: `'JetBrains Mono', 'Vazirmatn', monospace`
  - `--font-vazirmatn`: `'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif`
  No Google Fonts or external CDN links exist in any HTML shell.
- **Rationale**: External font CDNs (such as Google Fonts or cdnjs) are frequently throttled, DNS-poisoned, or blocked by Iranian ISPs, causing Persian interfaces to fall back to unstyled system fonts (like Tahoma or Arial) with broken baseline alignments. Bundling fonts directly via Vite ensures guaranteed offline font delivery and zero layout shifts.
- **Alternatives considered**:
  - *Loading fonts from Google Fonts CDN*: Rejected due to severe availability and latency degradation across Iranian domestic networks.
  - *Relying on system fonts (Tahoma/Arial)*: Rejected due to inconsistent letter joining, missing modern typographic weights (500, 600, 800), and unrefined aesthetic quality.
- **Evidence**: `client/styles/fonts.css:1–28`, `package.json:dependencies` (`@fontsource/vazirmatn`, `@fontsource/inter`, `@fontsource/jetbrains-mono`).

---

## R4. Contextual Persian Numeral Shaping vs Strict LTR Numeric Isolation

- **Decision**: Numeric display follows a strict bi-directional isolation rule:
  1. **Persian Glyphs (۰-۹)**: Textual counters, alert badge counts, gold ounce rates, TSE volume figures, layout metrics, and landing page pricing cards are converted via `toPersianDigits(str)`.
  2. **Latin Tabular Numerals (0-9)**: Chart canvas price/time scales, technical indicator calculation readouts, order ticket quantity inputs, Pine Script code editor (`#pine-code-editor`), and CSS classes marked `.num-ltr` or `<bdi dir="ltr">` are strictly preserved in Latin LTR.
- **Rationale**: Converting financial calculation inputs, source code, or coordinate systems to Eastern Arabic/Persian digits breaks standard JavaScript numeric parsers (`parseFloat`), corrupts Pine Script AST compilation, and creates jarring price readability issues for traders accustomed to international exchange notations.
- **Alternatives considered**:
  - *Converting all numbers indiscriminately to Persian digits*: Rejected because it breaks JavaScript math evaluation and chart scale rendering.
  - *Leaving all numbers in Latin digits*: Rejected because Persian UI typography guidelines (Constitution Principle IV) require native digits in text bodies and metric summaries.
- **Evidence**: `client/src/i18n.js:toPersianDigits` (lines 265–268), `client/styles/main.css:157–180` (`.num-ltr`, `.price-badge`, `.axis-badge`).

---

## R5. Canonical Formal Persian Technical Indicator and SMC Terminology

- **Decision**: The indicator catalog (`client/src/indicatorsFa.js`) defines canonical formal Persian titles and descriptions with strict Zero-Width Non-Joiner (ZWNJ) characters for 114+ technical indicators, Smart Money Concepts (SMC), and volatility bands. SMC concepts (e.g., Fair Value Gap / FVG, Order Blocks, Liquidity Sweeps, Change of Character / CHoCH) retain their standard international acronyms alongside formal Persian explanations.
- **Rationale**: Preserves international standard trading terminology recognized by professional institutional analysts while providing accessible, grammatically rigorous Persian explanations for Persian-speaking traders.
- **Alternatives considered**:
  - *Direct phonetic transliteration (e.g. اوردر بلاک without explanation)*: Rejected because it lacks educational clarity for emerging traders.
  - *Completely translating acronyms into invented Persian words*: Rejected because traders search for recognizable industry acronyms (FVG, BOS, CHoCH, RSI, MACD).
- **Evidence**: `client/src/indicatorsFa.js:INDICATORS_FA` (lines 1–117), `client/src/indicatorsModal.js`.

---

## R6. Mobile Viewport Architecture: Dock Replacement, 6-Button Mobilebar, and Elevated Drawers

- **Decision**: On viewports with width $\le 768$px, the floating desktop docks (side rail, topbar navigation pills) are hidden via media queries in `client/styles/main.css`. In their place, Vela's 6-button bottom `.vela-mobilebar` is activated:
  1. Symbol Search (`.vela-widget-symbol`)
  2. Timeframe Selector (`.vela-widget-timeframe`)
  3. Indicator Studio (`.vela-mb-indicators`)
  4. Drawing Tools (`.vela-widget-drawings`)
  5. More Tools Drawer (`.vela-mb-more`)
  6. Chart Settings (`.vela-widget-settings`)
  Tapping `.vela-mb-more` opens an elevated bottom drawer (`.vela-drawer`) containing 3 action tiles (Undo, Redo, Screenshot) and 24 scrollable panel rows with RTL-aligned text and mirrored chevron arrows in Persian mode.
- **Rationale**: Mobile screens lack the horizontal space required for persistent desktop tool rails and side docks. Docking navigation to the thumb zone at the bottom of the viewport improves single-handed mobile usability and touch accessibility.
- **Alternatives considered**:
  - *Shrinking desktop docks with horizontal scroll*: Rejected because horizontal scrolling inside chart workspaces conflicts with touch pan gestures.
  - *Collapsing everything into a top-right hamburger menu*: Rejected because the top region is outside the thumb reach zone on modern tall mobile devices.
- **Evidence**: `client/styles/main.css:1767–1803`, `client/src/i18n.js:localizeMoreDrawer` (lines 1184–1313), `tests/test_mobile_drawer_items.js`.

---

## R7. Full-Viewport Panel Sheets with 44px Touch Targets and Gesture Drag Handles

- **Decision**: When an operator selects a panel item from the mobile drawer (e.g., Watchlist, Paper Trade, Alerts, Journal), the panel (`.vela-panel`) opens as a fixed full-viewport mobile sheet (`position: fixed; top: 44px; bottom: 0; left: 0; right: 0; width: 100vw; z-index: 130`) topped with a pill drag handle (`.vela-panel-handle`), a 48px header, and a minimum 44×44 px close button (`.vela-panel-close`). Tapping close immediately restores the chart canvas.
- **Rationale**: Sliding panels as sidebars on mobile screens covers or distorts the chart viewport. Full-viewport sheets provide sufficient area for tabular data (watchlists, order ladders, journal logs) while ensuring compliance with iOS and Android minimum touch target guidelines ($\ge 44$px).
- **Alternatives considered**:
  - *Floating modal overlays*: Rejected because small modal windows cause internal scrolling inside an already constricted mobile screen.
  - *Opening panels in a separate mobile browser tab*: Rejected because it severs shared chart state, symbol selection, and execution context.
- **Evidence**: `client/styles/main.css:1643–1714`, `tests/test_mobile_interactive.js`.

---

## R8. Responsive Header Degradation & Truncation for Medium/Tablet Screens

- **Decision**: Between 769px and 1380px, responsive media queries in `client/styles/main.css` progressively compress the top app header:
  - At 1101–1380px: Hides `#btn-magnet` and `#btn-fullscreen`; truncates active layout name to 95px; hides text labels on save, compare, export, and replay buttons.
  - At 769–1100px: Truncates layout name to 80px; hides latency badge (`#header-latency-badge`); hides user avatar display label.
- **Rationale**: Prevents header button wrapping and vertical header height jumps that push the chart canvas down and cause layout glitches on medium laptop screens and tablet devices.
- **Alternatives considered**:
  - *Allowing header buttons to wrap into two rows*: Rejected because dual-row headers reduce chart canvas height and look unpolished.
  - *Hiding all topbar buttons behind an overflow menu*: Rejected because frequent actions (save, compare, replay) must remain one click away on laptop screens.
- **Evidence**: `client/styles/main.css:2377–2425`.

---

## R9. Cross-Entrypoint Preference Synchronization & Persistence

- **Decision**: User language preference is stored in `localStorage['tradingchart_user_settings']` as `{ language: 'fa' | 'en' }`. This key is shared across both the landing page (`client/landing/landing.js`) and the main workspace (`client/src/main.js`). When an authenticated user updates their settings or workspace state, `tradingchart_user_settings` is synchronized to the server via `PUT /api/user/state` and restored upon subsequent sessions via `GET /api/user/state`. The admin back-office console maintains its own independent key `localStorage['tc_admin_lang']` to isolate operational language from trader accounts.
- **Rationale**: Ensures seamless continuity when a trader toggles language on the public landing page before logging into the charting workspace, while isolating administrative staff preferences across back-office workflows.
- **Alternatives considered**:
  - *Separate localStorage keys for landing and chart*: Rejected because switching language on the homepage would not take effect when navigating to the chart.
  - *Storing language only in server session cookies*: Rejected because anonymous users without accounts must also retain their language preference across page refreshes.
- **Evidence**: `client/src/main.js:1799–1801`, `client/landing/landing.js:55–60, 81`, `client/admin/core.js:8–16`, `server/accounts.js:944–978`.

---

## R10. Bilingual Platform Announcement Banner with Revision-Based Dismissal

- **Decision**: The global announcement banner (`client/src/platformBanner.js`) fetches announcements from `GET /api/platform`. In Persian mode, it sets `dir="rtl"` and renders `announcementFa` (falling back to `announcementEn`). Dismissing the banner stores the announcement's millisecond timestamp (`updatedAt`) in `localStorage['tc_announcement_dismissed']`. If an administrator edits the announcement in the back-office console, `updatedAt` updates, causing the banner to automatically reappear for all users.
- **Rationale**: Ensures critical platform notices (maintenance windows, service announcements) are received in the user's preferred language, while avoiding nag fatigue by remembering dismissals until the message content is actually modified.
- **Alternatives considered**:
  - *Static modal popup on every login*: Rejected because modal popups block immediate access to trading charts.
  - *Boolean dismissed flag in localStorage*: Rejected because modifying an announcement would never show the updated message to users who had dismissed the old one.
- **Evidence**: `client/src/platformBanner.js:render` (lines 32–57), `server/platformSettings.js:updatePlatformSettings` (lines 48–75).

---

## Spec/code mismatches

- FR-001 / FR-002: Header buttons `#btn-toggle-panels-dock`, `#btn-mobile-fullscreen`, `#btn-mobile-layout`, `#btn-shortcuts-help`, `#btn-toggle-lang`, and `#btn-toggle-sound` have hardcoded English `title` and `aria-label` attributes in HTML (`client/chart/index.html:27, 120, 125, 132, 139, 148`).
- FR-002: `switchLanguage()` calls `goldBubbleView.render()` / `updateUI()` and `tseTapeView.render()` / `updateUI()` twice redundantly in the same function call (`client/src/main.js:1826-1829, 1869-1872`).
- FR-003 / FR-007: Alerts badge count inside `localizeMoreDrawer()` hardcodes `'۲ فعال'` / `'2 Active'` instead of dynamically reading active alerts from `alertsManager` (`client/src/i18n.js:1265`).
- FR-003: `patchVelaDataWindow()` executes an unbounded `setInterval(arm, 1500)` that never clears, continuing to run even if the Data Window panel is closed or document is hidden (`client/src/i18n.js:864`).
- FR-007: Fullscreen active state is toggled on `#btn-fullscreen` on `fullscreenchange`, but mobile counterpart `#btn-mobile-fullscreen` is omitted from the listener (`client/src/main.js:958`).
- FR-012: Server 404 handler unconditionally renders `<html lang="fa" dir="rtl">` even when an English route or Accept-Language is requested (`server/index.js:213`).
- FR-004: Dead unused imports of `t` and `toPersianDigits` exist across 9 client modules (`client/src/depthOfMarket.js:5`, `client/src/economicCalendar.js:5`, `client/src/propFirmSimulator.js:6`, `client/src/settingsModal.js:5`, `client/src/templateManager.js:5`, `client/src/technicalScreener.js:5`, `client/src/userProfileModal.js:5`, `client/src/marketTrackersView.js:4`, `client/src/marketNewsView.js:5`).
