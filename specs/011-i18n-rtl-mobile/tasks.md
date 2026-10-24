# Tasks: Internationalisation, RTL and Mobile

**Input**: Design documents from `/specs/011-i18n-rtl-mobile/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-24)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML containers, font definitions, stylesheet variables, and baseline translation dictionaries

- [x] T001 [P] Declare self-hosted @fontsource font-faces (Vazirmatn, Inter, JetBrains Mono) in client/styles/fonts.css (infra)
- [x] T002 [P] Configure RTL root direction rules, CSS custom properties, and .persian-mode classes in client/styles/main.css (infra)
- [x] T003 [P] Mount language switcher button #btn-toggle-lang, mobile layout button, and fullscreen trigger in client/chart/index.html (infra)
- [x] T004 [P] Establish bilingual translation dictionary base structure with English and Persian keys in client/src/i18n.js (infra)

---

## Phase 2: Foundational (Core i18n Engine & Localization Infrastructure)

**Purpose**: Core translation lookup, DOM auto-localizer, fallback chains, and offline typography

- [x] T005 [P] Implement translation lookup helper `t(key)` with English and key fallback in client/src/i18n.js (FR-005)
- [x] T006 [P] Implement `toPersianDigits(str)` numeral converter for text metrics in client/src/i18n.js (FR-004)
- [x] T007 [P] Implement TreeWalker-based `autoLocalizeUI()` with lossless original attribute tracking in client/src/i18n.js (FR-002, FR-003)
- [x] T008 [P] Enforce strict LTR isolation for .num-ltr classes, price scales, and canvas in client/styles/main.css (FR-004)
- [x] T009 [P] Bundle self-hosted offline font assets avoiding external CDN requests in client/styles/fonts.css (FR-006)

---

## Phase 3: User Story 1 - Switch language anywhere (Priority: P1) 🎯 MVP

**Goal**: Users can switch between English and Persian from the topbar, settings modal, command palette, or user profile, triggering immediate in-place re-rendering and persistence without page reload.

- [x] T010 [US1] Implement `setLanguage(lang)` setting document lang/dir, font mode, and dispatching `tc:languagechange` in client/src/i18n.js (FR-001, FR-002)
- [x] T011 [US1] Implement `applyTranslationsToDOM()` updating header pills, bottom tabs, and modal titles in client/src/i18n.js (FR-002)
- [x] T012 [US1] Implement `switchLanguage(lang)` orchestrating cascading re-renders across all active views in client/src/main.js (FR-001, FR-002)
- [x] T013 [US1] Persist active language preference to localStorage['tradingchart_user_settings'] in client/src/main.js (FR-001)
- [x] T014 [US1] Bind #btn-toggle-lang click event to switchLanguage toggle in client/src/main.js (FR-001)
- [x] T015 [US1] Implement #cfg-lang-select language selector and save handler in client/src/settingsModal.js (FR-001)
- [x] T016 [US1] Register "Toggle Language FA/EN" quick action in client/src/commandPalette.js (FR-001)
- [x] T017 [US1] Bind #btn-profile-toggle-lang click event in client/src/userProfileModal.js (FR-001)
- [x] T018 [US1] Implement cloud state synchronization for user language in server/accounts.js (FR-001)

---

## Phase 4: User Story 2 - Correct numbers and direction in Persian (Priority: P1)

**Goal**: In Persian mode, counters and badges render Persian numerals while the canvas, Pine editor, and numerical inputs stay LTR; chart engine chrome and 114+ indicators render formal Persian with strict ZWNJ.

- [x] T019 [P] [US2] Compile exact Persian translations for Vela engine chrome and drawing tools in client/src/i18nEngineFa.js (FR-003)
- [x] T020 [P] [US2] Define canonical formal Persian names and descriptions with ZWNJ for 114+ indicators in client/src/indicatorsFa.js (FR-004)
- [x] T021 [US2] Implement `localizeAxisWords()` splicing `__VELA_MONTHS__` and `__VELA_WEEKDAYS__` in client/src/i18n.js (FR-003)
- [x] T022 [US2] Implement `patchVelaDataWindow()` translating OHLC labels and isolating numeric values in client/src/i18n.js (FR-003)
- [x] T023 [US2] Implement `localizeDataWindowDom()` MutationObserver for live cursor readouts in client/src/i18n.js (FR-003)
- [x] T024 [US2] Apply `toPersianDigits()` formatting to symbol count badges and indicator counts in client/src/i18n.js (FR-004)
- [x] T025 [US2] Enforce LTR code editor layout and Latin tabular digits on #pine-code-editor in client/styles/main.css (FR-004)

---

## Phase 5: User Story 3 - Use the app on a phone (Priority: P1)

**Goal**: On mobile viewports (≤ 768px), floating desktop docks yield to the 6-button bottom mobilebar, the "more" drawer, full-screen panel sheets with 44px close buttons, compact quick-trade pill, and above-axis scale controls.

- [x] T026 [P] [US3] Define responsive mobile styles (≤ 768px) hiding desktop tool rails in client/styles/main.css (FR-007)
- [x] T027 [P] [US3] Implement full-width fixed mobile panel sheets (.vela-panel) with 48px header and drag handle in client/styles/main.css (FR-007)
- [x] T028 [P] [US3] Enforce minimum 44×44 px touch target dimensions for panel close buttons and mobile items in client/styles/main.css (FR-007)
- [x] T029 [US3] Position mobile scale controls dock above time axis with minimum 36×36 px buttons in client/styles/main.css (FR-007)
- [x] T030 [US3] Dock quick trade as a centered mobile pill above the time axis in client/styles/main.css (FR-007)
- [x] T031 [US3] Implement `localizeMoreDrawer()` with RTL alignment and mirrored chevron arrows in client/src/i18n.js (FR-007)
- [x] T032 [US3] Anchor mobile drawer custom close button ✕ at left: 14px in RTL mode in client/src/i18n.js (FR-007)
- [x] T033 [US3] Intercept mobilebar indicators button (.vela-mb-indicators) to open unified indicators modal in client/src/main.js (FR-008)
- [x] T034 [US3] Bind #btn-mobile-layout click event to open multi-chart layout studio in client/src/main.js (FR-007)
- [x] T035 [US3] Bind #btn-mobile-fullscreen click event to toggle document fullscreen in client/src/main.js (FR-007)

---

## Phase 6: User Story 4 - Medium screens (Priority: P2)

**Goal**: On tablet and intermediate desktop viewports (769–1380px), the top app header compresses gracefully by hiding secondary controls and truncating labels, ensuring zero horizontal overflow without wrapping.

- [x] T036 [P] [US4] Define intermediate responsive rules (1101–1380px) hiding magnet/fullscreen and button text labels in client/styles/main.css (FR-009)
- [x] T037 [P] [US4] Define tablet responsive rules (769–1100px) hiding latency badge and truncating layout name in client/styles/main.css (FR-009)
- [x] T038 [US4] Enforce single-line flex containment preventing header wrapping across all viewports in client/styles/main.css (FR-009)

---

## Phase 7: User Story 5 - Landing page and admin console languages (Priority: P2)

**Goal**: Landing page starts in Persian RTL with switchable English and Persian-digit prices; admin console supports independent Persian/English switching; 404 handler serves localized RTL page.

- [x] T039 [P] [US5] Implement landing page language controller `applyLang()` and price formatting in client/landing/landing.js (FR-010)
- [x] T040 [P] [US5] Render landing page HTML shell starting in Persian RTL (<html lang="fa" dir="rtl">) in client/index.html (FR-010)
- [x] T041 [P] [US5] Implement responsive mobile navigation and RTL styles for landing page in client/landing/landing.css (FR-010)
- [x] T042 [P] [US5] Implement admin back-office i18n runtime (`state.lang`, `setLang`, `tr`, `fmtNum`) in client/admin/core.js (FR-011)
- [x] T043 [P] [US5] Render admin console gate and sidebar language switchers with RTL styling in client/admin/admin.js (FR-011)
- [x] T044 [P] [US5] Implement responsive mobile bottom navigation dock (.bottom-nav) for admin console in client/admin/admin.css (FR-011)
- [x] T045 [US5] Render bilingual platform announcement banner adapting to active language in client/src/platformBanner.js (FR-002)
- [x] T046 [US5] Serve bilingual announcement text in public platform info API in server/platformSettings.js (FR-002)
- [x] T047 [US5] Serve Persian RTL 404 error page for unmatched server routes in server/index.js (FR-012)
