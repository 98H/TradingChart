# Feature Specification: Drawing Tools

**Feature Branch**: `003-drawing-tools` (retrofit)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Traders must be able to draw on the chart like on TradingView — 70+ tools, a favourites toolbar, magnet, lock, hide, undo/redo, right-click actions — and find their drawings again per symbol and per layout, in English and Persian."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw with favourite tools (Priority: P1)

On desktop a floating toolbar shows the trader's favourite tools; clicking one arms it on the active chart, clicking it again disarms it. Keyboard shortcuts arm the most common tools.

**Independent Test**: Click the trend-line favourite, draw two points on the chart, confirm one drawing exists; press Alt+H and confirm the horizontal-line tool is armed.

**Acceptance Scenarios**:

1. **Given** the desktop chart, **When** the user clicks a favourite tool, **Then** it becomes active and is armed on the active chart cell; a second click disarms it.
2. **Given** the chart, **When** the user presses Alt+T / Alt+H / Alt+F / Alt+B / Alt+V, **Then** trend line / horizontal line / Fibonacci retracement / box / vertical line is armed.
3. **Given** a drawing was made, **When** the user presses Ctrl+Z (or clicks Undo), **Then** it is removed; Ctrl+Y / Ctrl+Shift+Z (or Redo) restores it.

---

### User Story 2 - Drawing tools library (Priority: P1)

The trader opens the library of all tools, searches in English or Persian, picks a tool (which arms it and closes the library) and stars tools to pin them to the favourites toolbar.

**Independent Test**: Open the library, search "fib", pick a result, confirm it is armed and the dialog closed; star a tool and confirm it appears on the toolbar after reload.

**Acceptance Scenarios**:

1. **Given** the toolbar, **When** the user clicks "All Drawing Tools", **Then** a dialog lists the supported tools in 7 categories with a search box.
2. **Given** a search with no match, **Then** "No tools found" / "ابزاری یافت نشد" is shown.
3. **Given** the library, **When** the user stars a tool, **Then** it is added to the favourites toolbar and kept after reload; un-starring removes it.
4. **Given** the library is open, **When** the user presses Escape, clicks ✕ or the backdrop, **Then** it closes.

---

### User Story 3 - Manage drawings (Priority: P2)

The trader toggles magnet snapping, locks, hides or clears all drawings, and uses the right-click menu on a drawing to open its settings, duplicate, lock/unlock, bring to front, send to back or remove it.

**Acceptance Scenarios**:

1. **Given** drawings exist, **When** the user clicks Lock all / Hide all / Clear all, **Then** drawings become non-editable / invisible / removed, and the button state reflects it.
2. **Given** the topbar magnet, **When** the user clicks it repeatedly, **Then** snapping cycles off → weak → strong → off with a toast naming the mode in the current language.
3. **Given** a drawing, **When** the user right-clicks it and chooses Duplicate or Remove Drawing, **Then** the drawing count increases or decreases by one.

---

### User Story 4 - Drawings follow symbols and layouts (Priority: P2)

Drawings belong to a symbol: switching symbol stashes the current drawings and restores the new symbol's drawings; layouts save drawings per cell and drawing sync mirrors them across cells.

**Acceptance Scenarios**:

1. **Given** a drawing on BTCUSDT, **When** the user switches to ETHUSDT and back, **Then** the BTCUSDT drawing is restored and ETHUSDT showed its own drawings.
2. **Given** drawing sync on in a multi-chart grid, **When** the user draws in one cell, **Then** the drawing appears in the other cells.

---

### User Story 5 - Toolbar placement, mobile and Persian (Priority: P3)

The trader drags the floating toolbar and minimises it; on mobile drawing uses the chart engine's own drawings drawer; in Persian the library and menus are right-to-left with Persian labels.

**Acceptance Scenarios**:

1. **Given** the toolbar, **When** the user drags it, **Then** it stays inside the chart bounds and reappears at the same place after reload.
2. **Given** a viewport ≤ 768 px, **Then** the floating toolbar is hidden and the library dialog fills the screen when opened.
3. **Given** Persian, **Then** the library and drawing context menu are rtl with Persian tool names and Persian digits.

---

### Edge Cases

- Chart engine drawings API unavailable at boot → the library still lists the full static catalogue.
- Missing or corrupt favourites in storage → default favourites are used.
- Saved toolbar position outside the plot → default position (bottom 68, left 52).
- Right-click on empty canvas while drawings exist → the drawing menu targets the newest unlocked drawing (current engine limitation; see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The desktop chart MUST show a floating favourites toolbar whose tool buttons arm the tool on the active chart cell and disarm it on a second click, with the active tool highlighted.
- **FR-002**: Keyboard shortcuts MUST arm tools: Alt+T trend line, Alt+H horizontal line, Alt+F Fibonacci retracement, Alt+B box, Alt+P position, Alt+V vertical line.
- **FR-003**: Undo and redo MUST be available from the topbar buttons and from Ctrl/Cmd+Z and Ctrl/Cmd+Y or Ctrl+Shift+Z.
- **FR-004**: The drawing tools library MUST list the chart engine's supported tools (falling back to the static catalogue of 76 tools) in 7 categories, with live search over English and Persian names and an empty-state message.
- **FR-005**: Choosing a tool in the library MUST arm it on the active cell, reflect it on the toolbar and close the library; Escape, ✕ and the backdrop MUST close it.
- **FR-006**: Starring a tool MUST add or remove it from the favourites toolbar and persist the list in `tradingchart_drawing_favorites`; for signed-in users the list MUST be part of the cloud-synced state (`drawingFavorites`).
- **FR-007**: The toolbar MUST offer magnet on/off, lock all, hide/show all, clear all and minimise/expand, each reflected in the button state.
- **FR-008**: The topbar magnet MUST cycle snap mode off → weak → strong → off and announce the mode in a toast in the current language.
- **FR-009**: Right-clicking a drawing MUST open a menu with Drawing Settings, Duplicate, Lock/Unlock, Bring to Front, Send to Back and Remove Drawing, each acting on that drawing.
- **FR-010**: Changing symbol MUST stash the current symbol's drawings in `tc_drawings_by_symbol` and restore the new symbol's drawings.
- **FR-011**: Layouts MUST save and restore drawings per cell, and the drawings sync switch MUST mirror drawings across cells of a grid.
- **FR-012**: The toolbar MUST be draggable by its handle, clamped inside the chart area, with the position persisted in `tradingchart_fav_toolbar_pos`; an out-of-bounds position MUST reset to the default.
- **FR-013**: On viewports ≤ 768 px the floating toolbar MUST be hidden and drawing MUST remain available through the chart engine's mobile drawings drawer; the library dialog MUST adapt to full screen.
- **FR-014**: In Persian the library, toolbar tooltips and drawing menu MUST show Persian labels, rtl direction and Persian digits; in English, ltr English labels.

### Key Entities

- **Drawing Tool**: key, EN/FA name, category, icon.
- **Favourites**: ordered list of tool keys (default: trend line, horizontal line, ray, Fibonacci retracement, box, position, date-price range, freehand, text).
- **Serialized Drawing**: engine-owned drawing document, stored per symbol and per layout cell.
- **Toolbar Position**: top/bottom/left offsets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can arm any supported tool in at most 2 interactions (library open + pick) or 1 shortcut.
- **SC-002**: 100% of drawings on a symbol are restored after switching away and back.
- **SC-003**: Undo followed by redo returns the drawing count to its previous value in 100% of runs.
- **SC-004**: Library, toolbar and drawing menu show zero untranslated labels in Persian and zero console errors on desktop and mobile.

## Assumptions

- Drawing geometry, rendering, hit-testing, history and snap modes are provided by the chart engine; this feature exposes and persists them.
- `drawingTools` is enabled on every plan; no plan gate applies to drawing.
- Known gaps recorded for the Converge phase (not current requirements): two independent magnet states (toolbar vs topbar), the `position` favourite/shortcut vs catalogue `longposition`/`shortposition`, per-symbol drawings not cloud-synced, minimised state not persisted, no custom library entry point on mobile, and the toolbar not re-rendering on language switch.
