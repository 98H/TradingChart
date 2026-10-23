# Tasks: Multi-Chart Layouts (Layout Studio)

**Input**: Design documents from `/specs/002-multi-chart-layouts/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-23)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML markup mounts, CSS styles, dialog helpers, and server plan quotas

- [x] T001 [P] Mount topbar layout buttons and mobile trigger in client/chart/index.html (infra)
- [x] T002 [P] Define Layout Studio modal styles, preset cards, and cell strip in client/styles/main.css (infra)
- [x] T003 [P] Define chartsPerTab and savedLayouts quotas in server/featuresCatalog.js (infra)
- [x] T004 [P] Seed default plan limits for multi-chart layouts in server/data/accounts/plans.json (infra)
- [x] T005 [P] Implement in-app prompt and confirm glassmorphic dialogs in client/src/uiDialog.js (infra)

---

## Phase 2: Foundational (Core Workspace Bridge)

**Purpose**: Core chart engine manager, localization dictionary, and auxiliary workspaces drawer

- [x] T006 Initialize Vela multi-chart workspace initialization and setLayout bridge in client/src/chartManager.js (infra)
- [x] T007 [P] Initialize bilingual translations and RTL helpers for layout controls in client/src/i18n.js (FR-023)
- [x] T008 [P] Mount Workspaces side panel grid buttons and sync checkboxes in client/src/main.js (infra)

---

## Phase 3: User Story 1 - Pick a multi-chart grid (Priority: P1)

**Goal**: Traders can select one of eight grid presets, re-tile the charting area, and observe automated liquid asset seeding.

- [x] T009 [US1] Define 8 grid presets with bilingual metadata in client/src/layoutManager.js (FR-001)
- [x] T010 [US1] Bind Layout Studio triggers from topbar, mobile header, and panels drawer in client/src/layoutManager.js (FR-002)
- [x] T011 [US1] Implement Vela topbar layout button click interceptor in client/src/main.js (FR-002)
- [x] T012 [US1] Implement grid re-tiling and automated liquid asset seeding for cells 2-6 in client/src/layoutManager.js (FR-003)
- [x] T013 [US1] Minimize quick-trade pill in multi-grid and restore in 1x1 in client/src/layoutManager.js (FR-003)
- [x] T014 [US1] Enforce chartsPerTab plan entitlement lock badges on preset cards in client/src/layoutManager.js (FR-004)
- [x] T015 [US1] Route locked preset clicks to plan upgrade modal via authManager in client/src/authManager.js (FR-004)

---

## Phase 4: User Story 2 - Synchronize charts in a grid (Priority: P1)

**Goal**: Traders can configure 6 independent synchronization switches across chart cells and observe immediate property mirroring.

- [x] T016 [US2] Implement 6-axis synchronization state with default crosshair and viewport in client/src/layoutManager.js (FR-005)
- [x] T017 [US2] Render interactive sync switch toggles in Layout Studio modal in client/src/layoutManager.js (FR-005)
- [x] T018 [US2] Bind toggleSync to dispatch sync options to Vela workspace in client/src/layoutManager.js (FR-005)
- [x] T019 [US2] Propagate active cell symbol, interval, and style changes across cells in client/src/layoutManager.js (FR-006)
- [x] T020 [US2] Apply all active sync options to newly connected workspace cells in client/src/layoutManager.js (FR-005, FR-006)

---

## Phase 5: User Story 3 - Resume the workspace after reload (Priority: P1)

**Goal**: Workspaces continuously auto-save all cell configurations and restore cleanly upon browser page reload.

- [x] T021 [US3] Implement captureWorkspaceState rich state v2 with cell indicators and drawings in client/src/layoutManager.js (FR-007)
- [x] T022 [US3] Bind cell orchestrator and drawing reactive events to schedulePersist in client/src/layoutManager.js (FR-008)
- [x] T023 [US3] Implement 600ms debounced persistence, 15s timer, and unload handlers in client/src/layoutManager.js (FR-008)
- [x] T024 [US3] Implement auto-save toggle pill with immediate save and persistence in client/src/layoutManager.js (FR-009)
- [x] T025 [US3] Implement applyWorkspaceState with orchestrator polling and duplicate prevention in client/src/layoutManager.js (FR-010)
- [x] T026 [US3] Cleanse deprecated Pine syntax in restored indicators in client/src/layoutManager.js (FR-010)
- [x] T027 [US3] Synchronize application market state to restored active cell in client/src/layoutManager.js (FR-011)
- [x] T028 [US3] Implement quickSaveLayout topbar button with visual confirmation in client/src/layoutManager.js (FR-016)

---

## Phase 6: User Story 4 - Shared chart link wins over saved workspace (Priority: P2)

**Goal**: URL parameters override the primary cell of the restored workspace without discarding the multi-chart grid.

- [x] T029 [US4] Parse and validate symbol and interval URL query parameters in client/src/main.js (FR-012, FR-013)
- [x] T030 [US4] Reject malformed symbol and interval parameter values in client/src/main.js (FR-013)
- [x] T031 [US4] Override restored snapshot active cell before workspace application in client/src/layoutManager.js (FR-012)
- [x] T032 [US4] Re-verify and settle deep link market state in applyDeepLink in client/src/main.js (FR-012)

---

## Phase 7: User Story 5 - Manage named layouts (Priority: P2)

**Goal**: Traders can save, search, sort, load, rename, duplicate, export, import, and delete named layouts with plan quota gating.

- [x] T033 [US5] Seed institutional starter layouts usr_default and usr_macro in client/src/layoutManager.js (FR-014)
- [x] T034 [US5] Implement save new named layout and update active entry in client/src/layoutManager.js (FR-014, FR-016)
- [x] T035 [US5] Implement in-place layout search filtering and date/name sorting in client/src/layoutManager.js (FR-014)
- [x] T036 [US5] Implement load saved layout with sync options restoration in client/src/layoutManager.js (FR-014, FR-015)
- [x] T037 [US5] Implement in-app prompt rename and destructive confirm deletion in client/src/layoutManager.js (FR-017)
- [x] T038 [US5] Implement layout JSON export download and validated file import in client/src/layoutManager.js (FR-014, FR-018)
- [x] T039 [US5] Enforce savedLayouts plan entitlement excluding starter templates in client/src/layoutManager.js (FR-019)
- [x] T040 [US5] Enforce savedLayouts plan quota during cloud state synchronization in server/accounts.js (FR-019, FR-024, FR-025)

---

## Phase 8: User Story 6 - Focus one chart in a grid (Priority: P3)

**Goal**: Traders can navigate cells using the floating cell strip, maximize the active cell via Alt+Enter, and restore the grid.

- [x] T041 [US6] Render floating multi-chart cell strip with overview, pills, and max toggle in client/src/layoutManager.js (FR-020)
- [x] T042 [US6] Hide floating cell strip in 1x1 single chart layout in client/src/layoutManager.js (FR-020)
- [x] T043 [US6] Implement toggleMaximizeActiveCell and clearMaximized on active cell in client/src/layoutManager.js (FR-021)
- [x] T044 [US6] Bind Alt+Enter shortcut for cell maximization in client/src/main.js (FR-021)
- [x] T045 [US6] Bind Escape shortcut to restore maximized grid cell in client/src/main.js (FR-021)
- [x] T046 [US6] Implement mobile viewport auto-maximize on cell pill click in client/src/layoutManager.js (FR-022)

---

## Phase 9: Edge Cases, Templates & Cloud Sync

**Purpose**: Graceful degradation, indicator templates panel, and cloud synchronization

- [x] T047 [US5] Implement indicator templates panel with save and restore in client/src/templateManager.js (infra)
- [x] T048 [US5] Synchronize layouts, currentLayout, and layoutSync in cloud state API in server/accounts.js (FR-024)
- [x] T049 [US5] Handle corrupt localStorage gracefully with single chart fallback in client/src/layoutManager.js (infra)
- [x] T050 [US1] Re-render Layout Studio, cell strip, and topbar labels on language change in client/src/main.js (FR-023)
