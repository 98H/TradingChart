# Tasks: Drawing Tools

**Input**: Design documents from `/specs/003-drawing-tools/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Status**: Implemented (retrofit task inventory, 2026-10-23)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: HTML markup topbar buttons, CSS styling for floating dock and library modal, and server catalog flag

- [x] T001 [P] Mount topbar undo, redo, and magnet buttons in client/chart/index.html (infra)
- [x] T002 [P] Define glassmorphic floating toolbar dock and tool button styles in client/styles/main.css (infra)
- [x] T003 [P] Define Drawing Tools Library modal and search input styles in client/styles/main.css (infra)
- [x] T004 [P] Declare drawingTools feature entitlement flag in server/featuresCatalog.js (infra)
- [x] T005 [P] Enable drawingTools across all plan definitions in server/accounts.js (infra)

---

## Phase 2: Foundational (Core Drawings Facade & Localization Bridge)

**Purpose**: Engine drawing manager delegation, Persian dictionary, and app coordinator integration

- [x] T006 [P] Add Persian translations for drawing tools, groups, and actions in client/src/i18nEngineFa.js (FR-014)
- [x] T007 Implement armDrawingTool and clearDrawingTool delegation in client/src/chartManager.js (infra)
- [x] T008 Initialize FloatingDrawingToolbar and DrawingToolsLibrary instances in client/src/main.js (infra)

---

## Phase 3: User Story 1 - Draw with favourite tools (Priority: P1)

**Goal**: Traders can arm favorite drawing tools from the floating dock, trigger them via keyboard shortcuts, and undo/redo operations.

- [x] T009 [US1] Render favorite tool buttons with icons and tooltips in client/src/floatingDrawingToolbar.js (FR-001)
- [x] T010 [US1] Implement 2-state toggle click arming and disarming on favorite tool buttons in client/src/floatingDrawingToolbar.js (FR-001)
- [x] T011 [US1] Bind global Alt+T, Alt+H, Alt+F, Alt+B, Alt+P, and Alt+V keyboard shortcuts in client/src/main.js (FR-002)
- [x] T012 [US1] Bind topbar #btn-undo and #btn-redo buttons to chart.drawings undo/redo in client/src/main.js (FR-003)
- [x] T013 [US1] Bind global Ctrl+Z, Meta+Z, Ctrl+Y, Meta+Y, and Ctrl+Shift+Z shortcuts to undo/redo in client/src/main.js (FR-003)

---

## Phase 4: User Story 2 - Drawing tools library (Priority: P1)

**Goal**: Traders can open the library modal, filter 83 tools in English or Persian, arm any tool, and pin/unpin favorites.

- [x] T014 [US2] Define 83 drawing tools across 9 categories in CATALOG in client/src/drawingToolsLibrary.js (FR-004)
- [x] T015 [US2] Implement live real-time search filtering with empty-state handling in client/src/drawingToolsLibrary.js (FR-004)
- [x] T016 [US2] Implement selectTool to arm engine and close library modal in client/src/drawingToolsLibrary.js (FR-005)
- [x] T017 [US2] Bind Escape key, backdrop click, and ✕ button modal dismiss handlers in client/src/drawingToolsLibrary.js (FR-005)
- [x] T018 [US2] Implement star toggle click to pin/unpin favorites and persist in client/src/drawingToolsLibrary.js (FR-006)

---

## Phase 5: User Story 3 - Manage drawings (Priority: P2)

**Goal**: Traders can toggle magnet snapping, lock, hide, or clear drawings, and manipulate drawing objects via context menu.

- [x] T019 [US3] Implement magnet mode toggle, lock all, and hide/show all buttons in client/src/floatingDrawingToolbar.js (FR-007)
- [x] T020 [US3] Implement clear all drawings trash bin action in client/src/floatingDrawingToolbar.js (FR-007)
- [x] T021 [US3] Implement topbar magnet button snap cycle off/weak/strong with toasts in client/src/main.js (FR-008)
- [x] T022 [US3] Detect drawing under cursor via findSelectedDrawing in client/src/canvasContextMenu.js (FR-009)
- [x] T023 [US3] Implement drawing context menu actions for settings, duplicate, lock, z-order, and remove in client/src/canvasContextMenu.js (FR-009)

---

## Phase 6: User Story 4 - Drawings follow symbols and layouts (Priority: P2)

**Goal**: Drawings are stashed and restored per symbol, saved per layout grid cell, and mirrored across grid cells.

- [x] T024 [US4] Implement stashActiveDrawings to persist drawings in tc_drawings_by_symbol in client/src/chartManager.js (FR-010)
- [x] T025 [US4] Implement swapDrawingsForSymbol to restore drawings on symbol switch in client/src/chartManager.js (FR-010)
- [x] T026 [US4] Serialize cell drawings via toJSON and restore via fromJSON in client/src/layoutManager.js (FR-011)
- [x] T027 [US4] Implement drawings 6-axis synchronization across grid cells in client/src/layoutManager.js (FR-011)

---

## Phase 7: User Story 5 - Toolbar placement, mobile and Persian (Priority: P3)

**Goal**: Traders can drag the floating toolbar with bounds clamping, use mobile drawing drawers, and experience Persian RTL mode.

- [x] T028 [US5] Implement draggable dock handle with plot bounds clamping in client/src/floatingDrawingToolbar.js (FR-012)
- [x] T029 [US5] Persist and restore toolbar position in tradingchart_fav_toolbar_pos in client/src/floatingDrawingToolbar.js (FR-012)
- [x] T030 [US5] Hide floating toolbar on viewports <= 768px via responsive CSS in client/styles/main.css (FR-013)
- [x] T031 [US5] Adapt library modal to full-screen mobile dimensions in client/styles/main.css (FR-013)
- [x] T032 [US5] Apply RTL direction and Persian tool labels in library modal in client/src/drawingToolsLibrary.js (FR-014)
- [x] T033 [US5] Apply RTL direction and Persian labels in canvas context menu in client/src/canvasContextMenu.js (FR-014)

---

## Phase 8: Cloud Synchronization & State Persistence

**Purpose**: Synchronize user drawing favorites to cloud account and handle profile reload

- [x] T034 [US2] Map drawing_favorites to drawingFavorites in authManager SYNC_MAP in client/src/authManager.js (FR-006)
- [x] T035 [US2] Persist and restore drawingFavorites in cloud state endpoints in server/accounts.js (FR-006)
