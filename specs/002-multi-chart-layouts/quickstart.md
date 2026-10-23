# Quickstart: Multi-Chart Layouts (Layout Studio)

Procedures for booting the application, manually verifying each user story on a running instance, and executing automated test suites.

---

## 1. Environment & Setup

Ensure Node.js v20+ is installed and dependencies are bundled.

```bash
# Set base testing URL (default port 8088)
export SDD_BASE_URL="${SDD_BASE_URL:-http://127.0.0.1:8088}"

# Start the application server
npm run start
# Or launch dev mode with live reloading:
npm run dev
```

Navigate to `${SDD_BASE_URL}/chart` in a modern browser (Chrome, Edge, Safari, Firefox).

---

## 2. Manual Verification by User Story

### User Story 1 — Pick a multi-chart grid (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Click the Layout Studio trigger `#btn-layout-manager` in the topbar (or `#btn-mobile-layout` on mobile).
3. Confirm that `#modal-layout-studio` opens with class `.open`, displaying exactly 8 preset cards:
   - `1x1 Single Chart` (`1`)
   - `2x1 Dual Horizontal` (`2h`)
   - `1x2 Dual Vertical` (`2v`)
   - `2x2 Quad Grid` (`4`)
   - `3x1 Triple Horizontal` (`g1x3`)
   - `1x3 Triple Vertical` (`g3x1`)
   - `3x2 Six-Chart Matrix` (`g2x3`)
   - `4x2 Institutional Matrix` (`8`)
4. Verify that each preset card shows a miniature visual grid matrix and bilingual name/description.
5. Click the `2x2 Quad Grid` card.
6. **Verification**:
   - The studio modal closes.
   - The chart area re-tiles into 4 distinct chart panes.
   - Cell 1 retains its current market; cells 2, 3, and 4 are automatically seeded with `ETHUSDT`, `SOLUSDT`, and `BNBUSDT`.
   - The topbar label `#active-layout-name` updates to `"2x2 Quad Grid"` (or `"چهار چارت مربعی (2x2)"` in Persian).
   - The quick-trade pill minimizes.
7. Re-open the studio and select `1x1 Single Chart`. Verify that 1 chart remains and the quick-trade pill restores.
8. *Plan Gating Check*: If signed in as a Basic plan user (`chartsPerTab = 1`), verify presets with > 1 cell display `🔒 PRO` (or `🔒 ارتقا`) and clicking one opens the Plans modal instead of switching.

---

### User Story 2 — Synchronize charts in a grid (Priority: P1)

1. Open a 2x2 grid (`4`).
2. Open the Layout Studio `#btn-layout-manager`.
3. Locate Section 2: "6-Axis Multi-Chart Synchronization Settings".
4. Confirm six switches are shown:
   - `Symbol` (`symbol`): default OFF.
   - `Interval` (`timeframe`): default OFF.
   - `Crosshair` (`crosshair`): default ON.
   - `Time & Zoom` (`viewport`): default ON.
   - `Drawings` (`drawings`): default OFF.
   - `Chart Style` (`style`): default OFF.
5. Click the `Symbol` switch to turn it ON. Verify the switch track turns cyan and the toggle thumb slides without closing the modal.
6. Close the studio. In the active cell, open symbol search (`Ctrl+K`) and switch to `XAUUSD`.
7. **Verification**: Confirm all four chart cells immediately update to `XAUUSD`.
8. Re-open the studio, turn `Interval` sync ON, and close. Change the active cell's timeframe to `15m`. Confirm all four cells switch to `15m`.

---

### User Story 3 — Resume the workspace after reload (Priority: P1)

1. In a 2x2 grid, configure Cell 1 on `BTCUSDT` 60m, Cell 2 on `ETHUSDT` 15m.
2. Add a `Volume` indicator and an `RSI` indicator with custom length `21` to Cell 1.
3. Draw a trendline on Cell 1.
4. Wait 1 second for the 600 ms debounced auto-save to write to `localStorage`.
5. Check topbar save button `#btn-layout-save`: click it and confirm it briefly flashes "Saved ✓" (or "ذخیره شد ✓").
6. Hard reload the page (`Ctrl+F5` or `Cmd+Shift+R`).
7. **Verification**:
   - The 2x2 grid layout is restored.
   - Cell 1 loads `BTCUSDT` 60m with Volume, RSI (length 21), and the trendline.
   - Cell 2 loads `ETHUSDT` 15m.
   - The active cell and global app state (order book, alerts, DOM) track the restored active cell.
8. Re-open Layout Studio, click the auto-save pill `#btn-toggle-autosave`. Confirm it toggles to "Auto-save: OFF". Make changes and reload; verify no updates are captured while OFF.

---

### User Story 4 — Shared chart link wins over the saved workspace (Priority: P2)

1. Ensure an auto-saved workspace exists on `BTCUSDT` 60m in 1x1 or 2x2.
2. Navigate directly to URL: `${SDD_BASE_URL}/chart?symbol=BINANCE:SOLUSDT&interval=240`.
3. **Verification**:
   - The workspace grid geometry is preserved.
   - The primary/active cell immediately opens on `SOLUSDT` with `240` (4h) interval.
   - The app's topbar, market state, and ticker header display `SOLUSDT` 240m.
4. Test with only `?symbol=ETHUSDT`: confirm only the symbol is overridden while the saved interval is retained.
5. Test with malformed parameters `?symbol=BAD$$$###&interval=9999999`: confirm the parameters are rejected and the saved workspace loads unchanged.

---

### User Story 5 — Manage named layouts (Priority: P2)

1. Open the Layout Studio `#btn-layout-manager`.
2. In the "Saved User Layouts" section, type `"Swing Portfolio Matrix"` in `#new-layout-name-input` and click `#btn-save-as-new-layout` ("Save Current").
3. **Verification**:
   - A success toast "Layout saved" appears.
   - `"Swing Portfolio Matrix"` appears at the top of the list with badge `"4 Charts"` and tag `ACTIVE`.
4. In `#layout-search-input`, type `"Swing"`. Confirm the list filters down without losing input focus. Clear the input.
5. Click `#btn-sort-name`. Confirm saved layouts sort alphabetically. Click `#btn-sort-date` to sort by recency.
6. Click the Duplicate button (`⧉`) on `"Swing Portfolio Matrix"`. Confirm a copy `"Swing Portfolio Matrix (Copy)"` appears.
7. Click the Rename button (`✏️`). In the glassmorphic prompt dialog, enter `"Master Surveillance"` and submit. Confirm the name updates in the list.
8. Click the Export button (`⤓`). Confirm a JSON file named `tradingchart_layout_usr_....json` downloads containing `__tradingchart_layout: true`.
9. Click the Delete button (`✕`). In the destructive confirmation dialog, confirm deletion. Verify the layout is removed and count updates.
10. Click `#btn-import-layout` ("Import") and select the exported JSON file. Confirm the layout is re-imported and added to the list.

---

### User Story 6 — Focus one chart in a grid (Priority: P3)

1. In a 2x2 grid, observe the floating cell strip `#multi-chart-cell-strip` at the bottom of the chart area.
2. Verify it contains:
   - `#btn-strip-overview` ("All Grid" / "گرید کامل")
   - 4 cell pills (`#1`, `#2`, `#3`, `#4`) displaying ticker and timeframe.
   - `#btn-strip-toggle-max` ("Maximize" / "تمام‌صفحه").
3. Click the pill for Cell 2. Confirm Cell 2 gains focus.
4. Press `Alt + Enter` or click "Maximize". Confirm Cell 2 expands to fill the entire workspace and the button label flips to "Restore" ("خروج از زوم").
5. Press `Escape`. Confirm the grid view restores to 4 cells.
6. Resize the browser window to mobile width (≤ 768 px).
7. Tap the pill for Cell 3.
8. **Verification**: Confirm Cell 3 becomes active AND automatically maximizes to full screen for mobile viewing.

---

## 3. Automated Test Execution

Run the existing headless browser suites to verify regression and TradingView parity:

```bash
# 1. Layout Studio presets, grid switching, sync toggles, and CRUD test
node tests/qa_cycle_layout.cjs

# 2. 4-chart reload persistence, duplicate/export/import round-trip test
node tests/qa_cycle_layout_pro.cjs

# 3. Comprehensive multi-chart session persistence & indicator inputs test
node tests/qa_layout_deep_audit.cjs

# 4. Rich state v2 persistence and restoration stress test
node tests/qa_layout_endless_perfection.cjs

# 5. TradingView parity layout and profile persistence test
node tests/qa_cycle_layout_and_profile_tv_parity.cjs

# 6. Layout switching stress across profile reloads
node tests/qa_cycle_layout_and_profile_endless.cjs
```
