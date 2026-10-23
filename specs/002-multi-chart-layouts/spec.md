# Feature Specification: Multi-Chart Layouts (Layout Studio)

**Feature Branch**: `002-multi-chart-layouts` (retrofit; originally delivered in commits e09b27a, 703c314, ebfdcec, 4977283, 3d03128, 99761ed, 95eade6, 7544e50, a94a611, e676f25)

**Created**: 2026-09-18

**Status**: Implemented (retrofit spec, 2026-10-22)

**Input**: Founder intent (reconstructed): "Let traders split the chart into up to 8 synchronized charts like TradingView, save and reload named layouts, and come back to exactly the workspace they left — unless they opened a shared chart link."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick a multi-chart grid (Priority: P1)

A trader opens the Layout Studio from the topbar (desktop), the mobile header, the panels drawer or the chart engine's own layout button, and picks one of eight grid presets: 1x1, 2x1, 1x2, 2x2, 3x1, 1x3, 3x2, 4x2. The chart area re-tiles into that many chart cells; extra cells are seeded with different liquid markets so the grid is immediately useful.

**Why this priority**: Without grids there is no multi-chart feature; everything else builds on it.

**Independent Test**: Open the studio, apply 2x1, 1x2 and 2x2 and count the rendered chart cells; return to 1x1.

**Acceptance Scenarios**:

1. **Given** the chart page in 1x1, **When** the user opens the Layout Studio, **Then** a dialog shows exactly 8 grid preset cards with a visual cell matrix, a bilingual name and description, and the active preset highlighted.
2. **Given** the studio is open, **When** the user picks 2x2, **Then** the dialog closes, the chart area shows 4 cells, cells 2-4 show ETHUSDT, SOLUSDT and BNBUSDT (cell 1 keeps its symbol), and the topbar label shows the preset name.
3. **Given** a multi-cell grid, **When** the user picks 1x1, **Then** one cell remains and the quick-trade pill is restored (it is minimized in any grid other than 1x1).
4. **Given** a user whose plan allows N charts per tab, **When** the studio opens, **Then** presets with more than N cells show a lock badge ("PRO"/"ارتقا"), and picking one shows the plan-limit notice and opens the plans dialog instead of switching.

---

### User Story 2 - Synchronize charts in a grid (Priority: P1)

The trader chooses which properties are kept in step across all cells: symbol, interval, crosshair, time & zoom, drawings and chart style. Defaults: crosshair and time & zoom on, the other four off.

**Why this priority**: Synchronized multi-timeframe and multi-asset reading is the reason to use a grid.

**Independent Test**: In a 2x2 grid enable symbol sync, change the active symbol, and verify every cell shows the new symbol.

**Acceptance Scenarios**:

1. **Given** the studio is open, **When** it renders, **Then** six sync switches are shown with their current on/off state.
2. **Given** symbol sync is on in a multi-cell grid, **When** the user changes the symbol of the active cell, **Then** all other cells switch to the same symbol.
3. **Given** interval sync is on, **When** the user changes the interval, **Then** all other cells switch to the same interval with the same deep-history depth.
4. **Given** chart-style sync is on, **When** the user changes the price style, **Then** all other cells adopt it.
5. **Given** a switch is toggled, **When** the user clicks it, **Then** the switch knob and track update in place without closing or re-rendering the dialog.

---

### User Story 3 - Resume the workspace after reload (Priority: P1)

With auto-save on (the default) the current grid, per-cell symbol, interval, price style, watermark, drawings, indicators (built-in and script, with inputs, properties and visibility), sync settings and active cell are saved continuously and restored after a reload.

**Why this priority**: Losing a configured workspace on reload is the most painful failure for a returning user.

**Independent Test**: Apply 2x2, add an indicator with custom inputs to a cell, reload, and verify grid, symbols, intervals and indicator inputs come back.

**Acceptance Scenarios**:

1. **Given** auto-save is on, **When** the user changes an indicator, drawing, symbol, interval, style or the grid, **Then** the workspace is saved within about one second (debounced) and also every 15 seconds and on page hide/unload.
2. **Given** a saved workspace, **When** the page reloads, **Then** the grid, cells, indicators, drawings, sync settings and active cell are restored, and the app's market state (orders, alerts, order book, watchlist) follows the restored active cell.
3. **Given** the user turns auto-save off in the studio, **When** they keep working and reload, **Then** no further workspace snapshots are written and the switch shows "Auto-save: OFF"; turning it back on saves immediately.
4. **Given** the topbar Save button is pressed, **When** the save completes, **Then** the current workspace is stored as (or updates) a named layout and the button briefly shows "Saved ✓".

---

### User Story 4 - Shared chart link wins over the saved workspace (Priority: P2)

A returning user opens a link such as `/chart?symbol=BINANCE:ETHUSDT&interval=240`. The restored workspace keeps its grid, but the active cell shows the linked symbol and interval.

**Why this priority**: Links from the landing page, social posts and alerts must open what they promise.

**Independent Test**: Seed an autosaved BTCUSDT/60 workspace, open the ETHUSDT/240 link, and check the active cell.

**Acceptance Scenarios**:

1. **Given** an autosaved workspace on BTCUSDT 1h, **When** the user opens `/chart?symbol=BINANCE:ETHUSDT&interval=240`, **Then** the active cell shows ETHUSDT on 240 and the app's current symbol/interval match it.
2. **Given** a link with only `symbol`, **When** it opens, **Then** only the symbol is overridden; the saved interval is kept.
3. **Given** a malformed symbol or interval parameter, **When** the page opens, **Then** the parameter is ignored and the saved workspace is used unchanged.

---

### User Story 5 - Manage named layouts (Priority: P2)

The trader saves the current workspace under a name, then searches, sorts (date or name), loads, renames, duplicates, exports to a JSON file, imports from a JSON file and deletes saved layouts. Two starter layouts ship by default ("Institutional SMC Master" 2x2 and "Macro Confluence (BTC+Gold)" 2x1).

**Why this priority**: Named layouts turn one-off setups into reusable workspaces; useful but not required for a single session.

**Independent Test**: Save "QA Test Layout", find it by search, duplicate it, export and re-import it, rename it, delete it; verify the list and count after each step.

**Acceptance Scenarios**:

1. **Given** the studio, **When** the user types a name and presses "Save Current", **Then** a new saved layout appears first in the list, marked ACTIVE, with a chart-count badge and date; an existing layout with the same name is replaced.
2. **Given** saved layouts, **When** the user types in the search box, **Then** the list filters by name, Persian name or badge without losing input focus, and the count updates.
3. **Given** a saved layout, **When** the user presses Load, **Then** its grid, cells, indicators and its own sync settings are restored and a "Layout "<name>" restored" toast appears.
4. **Given** a saved layout, **When** the user renames or deletes it, **Then** an in-app dialog (not a browser prompt/confirm) asks for the new name or a destructive confirmation.
5. **Given** an exported layout file, **When** it is imported, **Then** it is added as a new layout; a file that is not a layout export shows "Invalid layout file".
6. **Given** a plan limit on saved layouts, **When** the user saves a new name, duplicates or imports beyond the limit, **Then** the action is refused with the plan-limit notice; the two starter layouts do not count against the limit.

---

### User Story 6 - Focus one chart in a grid (Priority: P3)

In any grid other than 1x1 a floating cell strip lists "All Grid", one pill per cell (index, symbol, interval) and a Maximize/Restore control. The user can focus a cell, maximize the active cell (also Alt+Enter) and restore the grid (also Escape).

**Why this priority**: Convenience on large grids and essential on phones, where cells are too small to use.

**Independent Test**: Apply 2x2, maximize via the strip, press Escape, verify the grid is back.

**Acceptance Scenarios**:

1. **Given** a 2x2 grid, **When** it renders, **Then** the strip shows All Grid + 4 cell pills + Maximize; in 1x1 the strip is hidden.
2. **Given** the active cell, **When** the user presses Alt+Enter or the Maximize pill, **Then** that cell fills the chart area and the pill reads "Restore".
3. **Given** a maximized cell and no focused text input, **When** the user presses Escape, **Then** the grid is restored.
4. **Given** a phone-width viewport (768px or less), **When** the user taps a cell pill, **Then** that cell becomes active and is maximized.

### Edge Cases

- Saved workspace references more cells than the engine has created yet: restore waits up to about 3.5 s for the cells, then applies to whatever exists.
- A stored indicator script uses `color.cyan`: it is rewritten to an explicit RGB colour before re-adding.
- Corrupt JSON in storage: restore is skipped silently and defaults are used.
- Legacy snapshots without a cells list fall back to the engine's own state document.
- Duplicate layout names in storage are collapsed on load; "×" is normalised to "x"; legacy badge "1 Charts" becomes "1 Chart".
- Layout names are HTML-escaped when listed.
- Deleting the active saved layout detaches it (the workspace stays, but is no longer linked to that entry).
- Language switch re-renders the open studio, topbar label and cell strip in the new language.
- Cloud sync rejects a state whose saved-layout count exceeds the plan (see Assumptions and the open clarification).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST offer exactly eight grid presets (1, 2, 2, 4, 3, 3, 6 and 8 cells) with bilingual names and descriptions.
- **FR-002**: System MUST open the Layout Studio from the desktop topbar, the mobile header, the panels drawer and the chart engine's layout button.
- **FR-003**: System MUST seed cells 2-6 of a newly applied grid with BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XAUUSD, EURUSD by position, leaving cell 1 unchanged.
- **FR-004**: System MUST lock presets whose cell count exceeds the user's charts-per-tab entitlement and route a locked choice to the plan upgrade flow.
- **FR-005**: System MUST provide six independent sync switches (symbol, interval, crosshair, time & zoom, drawings, chart style) defaulting to crosshair and time & zoom on.
- **FR-006**: When symbol, interval or style sync is on, a change on the active cell MUST propagate to every other cell.
- **FR-007**: System MUST snapshot per cell: symbol, interval, price style, watermark visibility, drawings and indicators (type or script source, title, language, inputs, properties, visibility), plus grid, layout name, linked saved-layout id, active cell and sync settings.
- **FR-008**: With auto-save on, System MUST persist the snapshot debounced (600 ms) after any indicator, drawing, market, interval, style or cell change, every 15 s, and on page hide/unload.
- **FR-009**: Users MUST be able to turn auto-save off and on; the choice MUST persist across reloads; turning it on MUST save immediately.
- **FR-010**: On load System MUST restore the last snapshot, including indicators with their inputs, properties and visibility, without duplicating indicators already on the chart.
- **FR-011**: After restore, the app-level market state MUST match the restored active cell.
- **FR-012**: A valid `symbol` and/or `interval` (alias `tf`) URL parameter MUST override the active cell of the restored snapshot before it is applied, and MUST be re-checked once the restore settles.
- **FR-013**: Invalid URL parameters (symbol not matching `[A-Z0-9][A-Z0-9_.-]{0,23}` after the exchange prefix is stripped, interval not matching `1-4 digits + optional s/m/h/d/w` or `D/W/M`) MUST be ignored.
- **FR-014**: Users MUST be able to save, load, rename, duplicate, export (JSON download), import (JSON file), delete, search and sort (date desc / name asc) named layouts.
- **FR-015**: Loading a named layout MUST also restore that layout's own sync settings.
- **FR-016**: While a named layout is active, auto-save MUST also update that saved entry's snapshot, sync settings and date.
- **FR-017**: Rename and delete MUST use in-app dialogs; delete MUST be presented as destructive.
- **FR-018**: Import MUST accept only files carrying the layout-export marker and a grid id; it MUST assign a new id.
- **FR-019**: Save-new (new name), duplicate and import MUST respect the saved-layouts entitlement, excluding the two starter layouts from the count.
- **FR-020**: In grids other than 1x1 System MUST show a cell strip (overview, one pill per cell with index/symbol/interval, maximize/restore); it MUST be hidden in 1x1.
- **FR-021**: Users MUST be able to maximize the active cell (strip or Alt+Enter) and restore the grid (strip, Alt+Enter again, or Escape).
- **FR-022**: On viewports 768px wide or less, tapping a cell pill MUST activate and maximize that cell.
- **FR-023**: Every studio, strip and toast string MUST exist in English and Persian and re-localize on language switch.
- **FR-024**: Saved layouts and the current snapshot MUST be included in the signed-in user's cloud-synced state.
- **FR-025**: [NEEDS CLARIFICATION: Should the two starter layouts count toward the saved-layouts limit on the server? The client excludes them, the cloud-state check counts every entry, so a Basic-plan (limit 1) user who keeps both starters is refused on sync.]

### Key Entities

- **Grid Preset**: fixed catalogue entry — id, grid id, columns, rows, EN/FA name and description.
- **Workspace Snapshot**: the current grid, name, linked saved layout, active cell, sync settings, ordered cell states and a timestamp.
- **Cell State**: symbol, interval, price style, watermark flag, drawings document, indicator list.
- **Indicator Entry**: built-in type or script source + language, title, inputs, properties, visibility.
- **Saved Layout**: id, EN/FA name, grid id, EN/FA badge, sync settings, snapshot, date.
- **Sync Settings**: six on/off flags.
- **Deep Link**: optional symbol and interval taken from the page address.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the 8 presets renders its stated number of chart cells within 2 s of selection (suite checks 2x1, 1x2, 2x2).
- **SC-002**: After reload, 100% of cells, symbols, intervals and indicator inputs of the last workspace are restored (deep-audit and endless-perfection suites).
- **SC-003**: Opening a symbol+interval link over an autosaved workspace shows the linked market on the active cell within 20 s in 100% of runs.
- **SC-004**: With symbol sync on, every cell shows the new symbol after one change (zero cells left behind).
- **SC-005**: Save, duplicate, export/import round-trip, rename and delete each change the saved-layout count by exactly the expected amount (+1, +1, +1, 0, -1).
- **SC-006**: Layout suites report zero defects and zero console errors on desktop and mobile.

## Assumptions

- Layout data lives in the browser; signed-in users get it mirrored through the existing cloud-state sync (feature owned elsewhere).
- Grid geometry, cell creation, crosshair/viewport/drawing sync mechanics and maximize are provided by the chart engine; this feature configures and persists them.
- The charts-per-tab gate is a client mirror of the plan catalogue; layouts are rendered client-side, so there is no server check of cell count.
- Up to 8 cells per tab is the product ceiling even though the top plan's entitlement is 16.
- The Workspaces side panel offers a reduced shortcut (4 grids, 4 sync checkboxes) to the same layout functions.
