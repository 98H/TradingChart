# Implementation Plan: Internationalisation, RTL and Mobile

**Branch**: `011-i18n-rtl-mobile` | **Date**: 2026-10-24 (retrofit) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-i18n-rtl-mobile/spec.md`

## Summary

The Internationalisation (i18n), Right-to-Left (RTL), and Mobile subsystem delivers deep bilingual parity (English and formal Persian with strict Zero-Width Non-Joiner formatting) and phone responsiveness across the Chartivia platform. It establishes a resilient, self-contained localization architecture operating without external CDNs or third-party cloud translation services.

The implementation spans three core architectural pillars:
1. **Bilingual Engine & Dynamic DOM Localizer (`client/src/i18n.js`, `client/src/i18nEngineFa.js`, `client/src/indicatorsFa.js`)**: A client-side translation runtime managing dual dictionaries (`en`/`fa`), a reactive `setLanguage` coordinator, a TreeWalker-based DOM auto-localizer (`autoLocalizeUI`) with lossless original text/attribute restoration, an in-place splice patcher for WebGL axis time labels (`__VELA_MONTHS__`, `__VELA_WEEKDAYS__`), a monkey-patched Data Window OHLC readout provider (`patchVelaDataWindow`), and canonical Persian terminology for 114+ technical indicators and SMC concepts.
2. **Typography & Bidirectional Number Formatting (`client/styles/fonts.css`, `client/styles/main.css`)**: 100% self-hosted font stacks bundling Vazirmatn, Inter, and JetBrains Mono; RTL layout mirroring (`body.persian-mode`, `html[dir="rtl"]`); contextual numeral conversion (`toPersianDigits`) for text counters, badges, and financial metrics; and strict LTR isolation (`.num-ltr`, `<bdi>`) for canvas, price scales, and code editors.
3. **Responsive Mobile & Tablet Viewport Architectures (`client/styles/main.css`, `client/src/main.js`)**: Mobile layout adaptation at $\le 768$px replacing floating desktop docks with Vela's native 6-button bottom `.vela-mobilebar`, elevated action/panel drawers (`.vela-drawer`), full-viewport slide-over panel sheets (`.vela-panel`) with $\ge 44$px touch targets and drag handles, floating quick-trade pill, above-axis scale controls ($\ge 36$px buttons), and compact intermediate header rules (769–1380px) preventing horizontal overflow.

## Technical Context

**Language/Version**: JavaScript (ECMAScript 2022+ in browser ESM; Node.js v20+ ESM Express server).

**Primary Dependencies**:
- `@luxalgo/vela`: `^0.7.5` (WebGL2 charting engine, bottom mobile bar, drawer infrastructure).
- `@fontsource/vazirmatn`: `^5.3.0` (Self-hosted Persian font faces: weights 400, 500, 600, 700, 800).
- `@fontsource/inter`: `^5.3.0` (Self-hosted Latin font faces: weights 400, 500, 600, 700, 800).
- `@fontsource/jetbrains-mono`: `^5.3.0` (Self-hosted monospace tabular numeral font faces: weights 400, 700).
- `express`: `^4.21.2` (HTTP static server, platform info API, user state sync API).
- `vite`: `^6.4.5` (Asset bundler and font pipeline).
- `puppeteer-core`: `^24.3.1` (Headless browser testing framework).

**Storage**:
- Client `localStorage`:
  - `tradingchart_user_settings`: User preference JSON storing `language` (`'fa'` | `'en'`), theme, and chart settings.
  - `tc_admin_lang`: Admin back-office interface language (`'fa'` | `'en'`).
  - `tc_announcement_dismissed`: Timestamp (`updatedAt`) of dismissed global platform announcement.
- Server Atomic JSON Stores (`server/data/`, mode `0o600`):
  - `accounts/platform_settings.json`: Bilingual announcement text (`announcementFa`, `announcementEn`), level, and status.
  - `accounts/states/state_u_<userId>.json`: Per-user synchronized workspace state containing `tradingchart_user_settings.language`.

**Testing**:
- Puppeteer E2E & Probe Suites:
  - `tests/qa_i18n_final.cjs`: Deterministic full-surface Latin leak audit across desktop and mobile viewports in Persian mode.
  - `tests/qa_i18n_probe.cjs`: Diagnostic inspection probing all bottom panels, panels menu, and modals for untranslated strings.
  - `tests/test_mobile_drawer_items.js`: Puppeteer test verifying 390×844 mobile viewport, drawer triggering, and item extraction.
  - `tests/audit_mobile_features.js`: Automated audit exercising all 6 `.vela-mobilebar` buttons with screenshot capture.
  - `tests/test_mobile_interactive.js`: Interactive mobile test opening `.vela-mb-more`, launching Watchlist panel, and closing via $\ge 44$px close button.
  - `tests/capture_mobile_flawless.js`: Complete mobile audit verifying header overflow, 15m timeframe selection, and drawer elevation.

**Target Platform**: Responsive Web Browser across Desktop ($\ge 1024$px), Tablet (769–1024px), and Mobile Phone ($\le 768$px down to 320px, baseline 390×844px), supporting English (LTR) and Persian (RTL).

**Project Type**: Full-stack web application serving three entry points: `/` (Landing), `/chart` (Workspace), and `/admin` (Back Office).

**Performance Goals**:
- Language switch execution completing DOM updates across all views in $<250$ ms without page reload.
- 60 FPS WebGL rendering preserved during axis word splicing and Data Window cursor tracking.
- 0 network requests for typography: 100% bundled offline font delivery with zero layout shift (CLS).
- 0 px horizontal overflow on viewports down to 320 px width.

**Constraints**:
- Zero Google Fonts or external CDN dependencies: Iranian internet throttling/filtering mandates self-hosted font assets.
- Strict LTR isolation: Financial prices, tick percentages, order quantities, Pine code, and chart canvas coordinates remain LTR tabular numbers inside RTL Persian layouts.
- Zero vendor edits in `node_modules/@luxalgo/vela`: Engine customization implemented via runtime wrappers, global array splicing, and DOM mutation observers.
- Minimum 44×44 px touch targets for mobile bar controls, drawers, and panel headers (minimum 36×36 px for scale dock buttons).

**Scale/Scope**:
- 2 fully supported locales (English and Persian).
- 114+ technical indicators and SMC concepts with formal Persian naming and ZWNJ.
- 70+ drawing tools, harmonic patterns, and chart styles fully localized.
- 6 mobile bar buttons, 24 drawer panel rows, and 4 modal dialogs responsive on mobile screens.

## Constitution Check

| # | Principle | Status | Justification & Evidence |
|---|-----------|--------|--------------------------|
| I | Honest Data | PASS | Real market data ticks, order book entries, and indicator values remain unaltered; numeral shaping (`toPersianDigits`) applies solely to presentation/text counters without distorting raw floating-point calculation or WebSocket streams. |
| II | Spec Before Code | VIOLATION | Feature was implemented across September–October 2026 prior to adopting Inverted SDD methodology; this retrofit formalizes normative requirements (`spec.md`) and descriptive Spec Kit documentation without modifying production code. |
| III | Real-Browser Zero-Defect Verification | PASS | Audited by headless browser test suites (`qa_i18n_final.cjs`, `audit_mobile_features.js`, `test_mobile_interactive.js`, `capture_mobile_flawless.js`) validating 0 untranslated strings, touch targets, and 0 px header overflow. |
| IV | Bilingual Parity and RTL Correctness | VIOLATION | Main chart, landing, and admin console feature extensive Persian translations and RTL styling. However, minor gaps exist: untranslated `title`/`aria-label` attributes on 6 header buttons (`client/chart/index.html`), hardcoded "2 Active" alert badge (`client/src/i18n.js:1265`), redundant double re-render (`client/src/main.js:1826,1869`), and unconditional Persian 404 page (`server/index.js:213`). |
| V | Mobile Fit and Interaction Safety | PASS | Viewports $\le 768$px dock controls into `.vela-mobilebar`, expand panels into full-screen sheets with $\ge 44$px close buttons, transform the panels menu into a bottom drawer, minimize quick trade to a pill, and position scale controls above the time axis. (Baseline identified 11 sub-44px targets on mobile chart tracked for Converge). |
| VI | Security and Privacy by Default | PASS | Global announcement text is rendered strictly via `textContent` (preventing XSS from untrusted admin text), fonts are hosted locally (preventing tracking/IP leaks), and state sync endpoints enforce session authentication. |
| VII | Single Source of Truth for Entitlements | PASS | i18n, RTL layout, and mobile responsive behaviors are tier-agnostic core capabilities available unconditionally across all accounts and anonymous sessions. |
| VIII | Performance Budget | VIOLATION | `client/src/i18n.js:864` executes an unthrottled `setInterval(arm, 1500)` for Data Window patching that does not check `document.hidden` or panel visibility, conflicting with Principle VIII loop constraints. Auto-localizer utilizes `requestAnimationFrame` debouncing. |
| IX | Minimal Dependencies, No Vendor Edits | PASS | Font files bundled via `@fontsource/*`; zero edits to `node_modules/@luxalgo/vela` (customization relies on `patchVelaDataWindow`, global `__VELA_MONTHS__`/`__VELA_WEEKDAYS__` splicing, and CSS overrides). |
| X | Hybrid SDD | VIOLATION | Implementation preceded formal SDD tooling; this retrofit establishes the canonical Spec Kit artifacts for ongoing maintenance and convergence. |

## Project Structure

### Documentation (this feature)

```text
specs/011-i18n-rtl-mobile/
├── spec.md                     # Normative WHAT (user stories, FR-001..FR-012, SC-001..SC-004)
├── plan.md                     # This file (Technical context, constitution check, structure)
├── research.md                 # Architectural decisions R1..R10, rationale, spec/code mismatches
├── data-model.md               # Key entities, storage mappings, schemas, lifecycles
├── quickstart.md               # Manual story verification & automated test run procedures
├── contracts/
│   ├── http-api.md             # Server endpoints (/api/platform, /api/user/state, static routes)
│   └── module-api.md           # Client module interfaces (i18n.js, main.js, landing.js, core.js)
├── checklists/
│   └── requirements.md         # Spec Kit specification quality checklist
└── review-checklist.md         # Post-phase review checklist
```

### Source Code (repository root)

```text
client/
├── chart/
│   └── index.html              # Trading workspace HTML shell (#btn-toggle-lang, mobile buttons, modals)
├── src/
│   ├── i18n.js                 # Core i18n runtime, EN/FA dicts, autoLocalizeUI, data window & axis patchers
│   ├── i18nEngineFa.js         # Vela WebGL engine chrome, tooltips, drawings, and context menu translations
│   ├── indicatorsFa.js         # Canonical formal Persian names and descriptions for 114+ indicators
│   ├── main.js                 # App coordinator, language switch cascade, mobile button listeners
│   ├── platformBanner.js       # Localized global announcement banner renderer
│   ├── settingsModal.js        # Settings modal with language selector #cfg-lang-select
│   └── commandPalette.js       # Command palette quick actions including "Toggle Language FA/EN"
├── styles/
│   ├── fonts.css               # Self-hosted @fontsource font declarations (Vazirmatn, Inter, JetBrains Mono)
│   └── main.css                # RTL stylesheet rules, responsive breakpoints, mobile drawers, touch sizing
├── landing/
│   ├── landing.js              # Landing page i18n switcher, price and Persian numeral formatting
│   └── landing.css             # Landing page responsive and RTL rules
├── admin/
│   ├── core.js                 # Admin shared runtime (state.lang, setLang, tr, Intl number/date formatters)
│   ├── admin.js                # Admin console UI shell with gate/sidebar toggles and mobile bottom dock
│   └── admin.css               # Admin console RTL stylesheet and mobile navigation rules
└── index.html                  # Landing page HTML shell (<html lang="fa" dir="rtl">)

server/
├── platformSettings.js         # Global platform settings store & public info getter (bilingual announcements)
├── accounts.js                 # State sync routes (GET/PUT /api/user/state) & platform endpoint (GET /api/platform)
├── index.js                    # Express static routing and Persian RTL 404 page
└── data/
    └── accounts/
        ├── platform_settings.json   # Persistent JSON store for platform announcements
        └── states/
            └── state_u_<userId>.json # Per-user synced state storing user settings language
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principle II & X: Spec Before Code / Hybrid SDD | The i18n, RTL, and mobile features were implemented during initial platform prototyping; retrofit establishes full SDD governance. | Rewriting functional, tested production code would risk regressions and waste engineering budget. |
| Principle IV: Bilingual Parity Gaps | Header button attributes (`title`/`aria-label`) and alert badge strings were hardcoded during rapid UI assembly. | Deferred to the architect's Converge phase to prevent uncontrolled manual edits during retrofit. |
| Principle VIII: Unbounded 1500ms Timer | Vela rebuilds its renderer asynchronously on layout shifts; `setInterval(arm, 1500)` ensures `dataWindowReadout` is hooked. | Event-only hooking was attempted, but Vela internal layout changes rebuild the renderer without dispatching public DOM events. Refinement with `document.hidden` guards tracked for Converge. |
