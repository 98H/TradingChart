# Tasks: Chart Workspace Shell

**Input**: Design documents from `/specs/001-chart-workspace-shell/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-23)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML workspace shell, typography, themes, and server infrastructure

- [x] T001 [P] Mount topbar layout, brand mark, navigation pills, and modal mounts in client/chart/index.html (infra)
- [x] T002 [P] Configure dark theme tokens, layout docks, modal overlays, and responsive styles in client/styles/main.css (infra)
- [x] T003 [P] Declare Inter, JetBrains Mono, and Vazirmatn font-face definitions in client/styles/fonts.css (infra)
- [x] T004 [P] Configure Express HTTP server, static asset cache headers, and error handling in server/index.js (infra)
- [x] T005 [P] Seed plan entitlement quotas and tier limits in server/data/accounts/plans.json (infra)

---

## Phase 2: Foundational (Core Coordinators & Feeds)

**Purpose**: Core chart engine manager, ticker feeds, and catalogue services

- [x] T006 Initialize Vela WebGL2 workspace manager and mount bindings in client/src/chartManager.js (infra)
- [x] T007 [P] Implement historical candle fetching and 24h ticker cache in server/dataFeed.js (infra)
- [x] T008 [P] Initialize universal bilingual dictionary and RTL helper utilities in client/src/i18n.js (infra)
- [x] T009 [P] Implement server health check endpoint in server/index.js (FR-022)

---

## Phase 3: User Story 1 - Find and open a market (Priority: P1)

**Goal**: Traders can search across English and Persian names, navigate with arrow keys, and switch active chart markets within 5 seconds.

- [x] T010 [P] [US1] Define universal symbol registry and search filter in server/symbolCatalog.js (FR-001, FR-002)
- [x] T011 [P] [US1] Implement /api/symbols catalogue endpoint in server/index.js (FR-002)
- [x] T012 [P] [US1] Implement /api/symbol-info metadata endpoint in server/index.js (FR-002)
- [x] T013 [US1] Implement /api/candles endpoint with plan histBars depth capping in server/index.js (FR-003)
- [x] T014 [US1] Bind symbol search input, keyboard navigation, and match count badge in client/src/main.js (FR-001, FR-002)
- [x] T015 [US1] Implement switchSymbol coordinator with pre-flight check and cache fallback in client/src/main.js (FR-001, FR-003)
- [x] T016 [P] [US1] Implement /api/tickers endpoint with 40-symbol batching in server/index.js (FR-004)
- [x] T017 [US1] Broadcast real-time ticker ticks over live WebSocket stream in server/index.js (FR-004, FR-005)
- [x] T018 [US1] Apply incoming live ticker ticks to active candle in client/src/main.js (FR-005)

---

## Phase 4: User Story 2 - Change timeframe and chart style (Priority: P1)

**Goal**: Traders can switch standard timeframes, construct custom intervals, and toggle across 13 chart styles with plan entitlement gating.

- [x] T019 [P] [US2] Implement TimeframeManager modal with standard interval selection in client/src/timeframeManager.js (FR-006)
- [x] T020 [P] [US2] Implement custom timeframe builder with persistence in client/src/timeframeManager.js (FR-006)
- [x] T021 [US2] Enforce secondIntervals and customIntervals plan entitlement gates in client/src/timeframeManager.js (FR-006)
- [x] T022 [US2] Implement setTimeframe coordinator with candle pre-flight validation in client/src/main.js (FR-006)
- [x] T023 [P] [US2] Implement ChartStylePicker dropdown and active style persistence in client/src/chartStylePicker.js (FR-007)
- [x] T024 [P] [US2] Implement synthetic bar algorithms (Renko, Kagi, Range, PnF, Hollow) in client/src/syntheticChartTypes.js (FR-007)
- [x] T025 [US2] Enforce synthChartTypes plan entitlement gate in client/src/chartStylePicker.js (FR-007)
- [x] T026 [US2] Feed computed synthetic series to active chart renderer in client/src/chartManager.js (FR-007)

---

## Phase 5: User Story 3 - Control the price scale (Priority: P2)

**Goal**: Traders can toggle Auto, Log, Percent, and Invert scale modes with keyboard shortcuts and observe the candle countdown timer.

- [x] T027 [US3] Implement ScaleControls dock with Auto, Log, Percent, and Inv toggles in client/src/scaleControls.js (FR-008)
- [x] T028 [US3] Dock scale controls into bottom bar on desktop and above axis on mobile in client/src/scaleControls.js (FR-008, FR-024)
- [x] T029 [US3] Synchronize active scale mode states with active chart renderer in client/src/scaleControls.js (FR-008)
- [x] T030 [US3] Bind Alt+R for auto scale reset and Alt+I for scale inversion in client/src/main.js (FR-008)
- [x] T031 [US3] Implement bar-close countdown calculation loop in client/src/scaleControls.js (FR-008)

---

## Phase 6: User Story 4 - Watchlists (Priority: P2)

**Goal**: Traders can manage multiple named watchlists, add/remove symbols, cycle 7 color flags, and step through assets using Space / Shift+Space.

- [x] T032 [US4] Implement WatchlistManager with multi-watchlist persistence in client/src/watchlistManager.js (FR-009)
- [x] T033 [US4] Enforce watchlists count limit and watchlistSymbols limit in client/src/watchlistManager.js (FR-009)
- [x] T034 [US4] Fetch and render 24h ticker prices and price change percentages in client/src/watchlistManager.js (FR-004, FR-009)
- [x] T035 [US4] Implement 7-color cyclic flag tagging and enforce flagColors limit in client/src/watchlistManager.js (FR-009)
- [x] T036 [US4] Implement Space and Shift+Space keyboard stepping across watchlist symbols in client/src/main.js (FR-009)

---

## Phase 7: User Story 5 - Workspace tools and shortcuts (Priority: P2)

**Goal**: Traders can launch tools via shortcuts and context menus, export data, capture screenshots, and compare symbols.

- [x] T037 [P] [US5] Implement CommandPalette Ctrl+K launcher with fuzzy indexing across 7 categories in client/src/commandPalette.js (FR-010)
- [x] T038 [P] [US5] Implement ShortcutsModal displaying keyboard shortcuts in 3 columns in client/src/shortcutsModal.js (FR-011)
- [x] T039 [P] [US5] Implement GoToDateModal with Alt+G shortcut and chart.setVisibleRange in client/src/goToDate.js (FR-012)
- [x] T040 [P] [US5] Implement SettingsModal with 4 tabs and tradingchart_user_settings persistence in client/src/settingsModal.js (FR-013)
- [x] T041 [US5] Implement CanvasContextMenu with exact price projection for alerts and orders in client/src/canvasContextMenu.js (FR-014)
- [x] T042 [P] [US5] Implement DataExportModal with CSV/JSON export and dataExport plan gate in client/src/dataExport.js (FR-015)
- [x] T043 [P] [US5] Implement ScreenshotModal with multi-layer canvas composition and Alt+S in client/src/screenshotModal.js (FR-016)
- [x] T044 [P] [US5] Implement CompareModal with benchmark overlay and Alt+C shortcut in client/src/compareModal.js (FR-017)
- [x] T045 [US5] Implement side-dock toggle with 340px offset and Quant/Journal view switch in client/src/main.js (FR-018)

---

## Phase 8: User Story 6 - Language, sound and platform announcements (Priority: P3)

**Goal**: Traders can toggle FA/EN language in-place, mute audio feedback, and receive admin-controlled platform announcements.

- [x] T046 [US6] Implement switchLanguage in-place localization, RTL direction, and font switching in client/src/main.js (FR-019)
- [x] T047 [P] [US6] Implement SoundEngine Web Audio synthesizer and mute toggle persistence in client/src/soundEngine.js (FR-020)
- [x] T048 [P] [US6] Implement platform settings storage and publicPlatformInfo helper in server/platformSettings.js (FR-021)
- [x] T049 [P] [US6] Mount GET /api/platform endpoint with Cache-Control no-store in server/accounts.js (FR-021)
- [x] T050 [US6] Implement PlatformBanner with safe textContent and revision-controlled dismissal in client/src/platformBanner.js (FR-021)

---

## Phase 9: Edge Cases, Mobile Fit and Resilience

**Purpose**: Graceful degradation, storage corruptions, and mobile responsiveness

- [x] T051 [US1] Wrap localStorage profile and settings JSON parsing in safe fallback try/catch blocks in client/src/main.js (FR-023)
- [x] T052 [US1] Sanitize deep-link query parameter parsing with regex validation in client/src/main.js (FR-023)
- [x] T053 [US5] Implement mobile off-canvas drawer docking for side panels on screens <= 768px in client/styles/main.css (FR-024)
- [x] T054 [US5] Ensure mobile topbar controls and quick trade minimize cleanly on small screens in client/src/main.js (FR-024)
