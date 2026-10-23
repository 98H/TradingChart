# Quickstart: Drawing Tools

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

Navigate to `${SDD_BASE_URL}/chart` in a modern browser (Chromium, Firefox, Safari, Edge).

---

## 2. Manual Verification by User Story

### User Story 1 — Draw with favourite tools (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Locate the floating glassmorphic toolbar `#floating-drawing-toolbar` near the bottom-left of the chart area.
3. Click the Trend Line favorite button `[data-tool="trendline"]`.
   - **Verification**: The button gains `.active` class (cyan highlight). Cursor enters drawing mode.
4. Click and drag across the chart canvas to place a trendline.
   - **Verification**: A trendline appears on the canvas.
5. Click the Trend Line button a second time.
   - **Verification**: The button disarms, losing `.active` class.
6. Test keyboard shortcuts:
   - Press `Alt+T`: Verify Trend Line tool is armed.
   - Press `Alt+H`: Verify Horizontal Line tool is armed. Click canvas to place an hline.
   - Press `Alt+F`: Verify Fib Retracement tool is armed.
   - Press `Alt+B`: Verify Rectangle / Order Block tool is armed.
   - Press `Alt+P`: Verify Position tool is armed.
   - Press `Alt+V`: Verify Vertical Line tool is armed.
7. Test undo / redo:
   - Press `Ctrl+Z` (or `Cmd+Z` on macOS) or click topbar `#btn-undo`.
   - **Verification**: The last drawn object disappears.
   - Press `Ctrl+Y` (or `Cmd+Shift+Z`) or click topbar `#btn-redo`.
   - **Verification**: The undone drawing is restored.

---

### User Story 2 — Drawing tools library (Priority: P1)

1. Click the All Tools 9-dot grid button `#fav-btn-all-tools` on `#floating-drawing-toolbar`.
2. **Verification**:
   - The modal `#drawing-tools-modal` opens with class `.open`.
   - 83 categorized tools are rendered under 9 group headings (`Trend Lines`, `Channels & Pitchforks`, `Fibonacci`, `Gann`, `Geometric Shapes`, `Annotations & Text`, `Patterns`, `Forecast & Measurement`, `Volume Profile & VWAP`).
   - The search input `#dtl-search` is automatically focused.
3. In `#dtl-search`, type `"fib"`.
   - **Verification**: The catalog filters down to display only Fibonacci tools (e.g. Fib Retracement, Fib Fan, Fib Circles).
4. Type `"nonexistenttoolquery"`.
   - **Verification**: The empty state `.dtl-empty` appears displaying `"No tools found"` (or `"ابزاری یافت نشد"` in Persian).
5. Clear the search input.
6. Click the star icon `[data-star="gannbox"]` next to Gann Box.
   - **Verification**: The star turns yellow (`.fav`), and a Gann Box button immediately appears on `#floating-drawing-toolbar`.
7. Reload the page (`Ctrl+F5`).
   - **Verification**: The Gann Box favorite button persists on `#floating-drawing-toolbar`.
8. Re-open the library, click `[data-star="gannbox"]` again to unpin it.
   - **Verification**: The button is removed from the toolbar.
9. Click any tool in the library, such as `[data-dtool="pitchfork"]`.
   - **Verification**: The Pitchfork tool is armed on the active chart cell, and the library modal automatically closes.
10. Re-open library and press `Escape` (or click `✕` / backdrop overlay).
   - **Verification**: The modal closes immediately.

---

### User Story 3 — Manage drawings (Priority: P2)

1. Draw several lines and boxes on the chart.
2. Test floating toolbar auxiliary controls:
   - Click `#fav-btn-magnet`: Verify button turns cyan (`.active`) and pointer snaps to candle OHLC extremes.
   - Click `#fav-btn-lock`: Verify padlock icon updates to locked; attempt to drag an existing drawing and confirm it cannot be moved.
   - Click `#fav-btn-hide`: Verify eye icon flips and all canvas drawings become hidden; click again to reveal.
   - Click `#fav-btn-trash`: Verify all drawings are cleared from the canvas.
3. Test topbar magnet snap cycle:
   - Click `#btn-magnet` once: Mode switches to `weak`, button highlights, toast displays `"Magnet: weak"` (or `"مگنت: ضعیف"`).
   - Click `#btn-magnet` a second time: Mode switches to `strong`, toast displays `"Magnet: strong"` (or `"مگنت: قوی"`).
   - Click `#btn-magnet` a third time: Mode switches to `off`, button deactivates, toast displays `"Magnet: off"` (or `"مگنت: خاموش"`).
4. Test drawing right-click context menu:
   - Draw a new trendline.
   - Right-click directly on the canvas.
   - **Verification**: `#canvas-context-menu` opens showing drawing object actions:
     - `⚙ Drawing Settings...` (`#ctx-draw-settings`)
     - `⧉ Duplicate` (`#ctx-draw-duplicate`)
     - `🔒 Lock` (`#ctx-draw-lock`)
     - `⬆ Bring to Front` (`#ctx-draw-front`)
     - `⬇ Send to Back` (`#ctx-draw-back`)
     - `🗑 Remove Drawing` (`#ctx-draw-remove`)
   - Click `Duplicate`: Verify drawing count increases by 1.
   - Right-click and choose `Remove Drawing`: Verify drawing count decreases by 1.

---

### User Story 4 — Drawings follow symbols and layouts (Priority: P2)

1. On `BTCUSDT`, draw a distinct trendline and horizontal line.
2. In symbol search (`Ctrl+K`), switch to `ETHUSDT`.
   - **Verification**: The canvas clears; the BTCUSDT drawings are not visible on ETHUSDT.
3. Draw a box on `ETHUSDT`.
4. Switch back to `BTCUSDT`.
   - **Verification**: The BTCUSDT trendline and horizontal line are fully restored from `tc_drawings_by_symbol`.
5. Switch back to `ETHUSDT`:
   - **Verification**: The ETHUSDT box is restored.
6. Multi-chart layout drawing sync test:
   - Open Layout Studio (`#btn-layout-manager`) and switch to `2x2 Quad Grid` (`4`).
   - Open Layout Studio again and toggle `Drawings` sync ON in the 6-Axis Sync section.
   - Close studio. Ensure Cell 1 and Cell 2 both display `BTCUSDT`.
   - Draw a trendline in Cell 1.
   - **Verification**: The trendline automatically mirrors in Cell 2.

---

### User Story 5 — Toolbar placement, mobile and Persian (Priority: P3)

1. Drag the floating toolbar:
   - Click and hold the drag handle `.fav-tool-drag-handle`.
   - Drag across the chart towards the bottom-left and right edges.
   - **Verification**: The dock moves smoothly and clamps inside the chart area (>52px from left, >68px from bottom).
   - Release mouse and reload page: Verify toolbar reappears at the dragged coordinates.
2. Minimize toolbar:
   - Click the chevron button `#fav-btn-minimize`.
   - **Verification**: The tools list collapses (`display: none`). Click again to expand.
3. Mobile viewport test:
   - Set viewport to width <= 768 px (e.g. 390x844 iPhone).
   - **Verification**: `#floating-drawing-toolbar` is completely hidden (`display: none !important;`).
   - Tapping the engine's drawings drawer opens mobile drawing options.
   - Open the Drawing Tools Library: Verify `.dtl-box` fills the mobile screen (`100vw` width, `92vh` height) without horizontal overflow.
4. Persian mode test:
   - Switch language to Persian (`fa`).
   - Open `#drawing-tools-modal`: Verify title displays `"ابزارهای ترسیم"`, direction is RTL (`dir="rtl"`), and tool names are in formal Persian (e.g. `"خط روند"`, `"چنگال اندروز"`).
   - Right-click canvas: Verify drawing context menu has `direction: rtl` with Persian labels (`تنظیمات ترسیم...`, `تکرار (Duplicate)`, `حذف ترسیم`).

---

## 3. Automated Test Execution

Run the existing headless browser suites to verify regression, drawing functionality, and TradingView parity:

```bash
# 1. Drawing Tools Library modal, search, arming, favorites, mobile, RTL
node tests/qa_cycle_dtl.cjs

# 2. Drawing context menu actions (settings, duplicate, remove) and depth
node tests/qa_cycle_ctx_depth.cjs

# 3. All 75+ Vela drawing types probe & DOM surface recon
node tests/qa_parity_recon.cjs

# 4. Canvas interactive drag & keyboard shortcut verification
node tests/test_interactive_drawings.cjs

# 5. Favorite drawing toolbar activation & auxiliary controls
node tests/qa_crusade_omni.cjs

# 6. Context menu right-click and drawing interactions
node tests/qa_cycleB.cjs
```
