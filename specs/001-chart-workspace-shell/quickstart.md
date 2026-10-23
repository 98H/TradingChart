# Quickstart: Chart Workspace Shell

Procedures for booting the application, manually verifying each user story, and executing automated test suites.

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

Navigate to `${SDD_BASE_URL}/chart` in a modern desktop browser (Chrome, Edge, Safari, Firefox).

---

## 2. Manual Verification by User Story

### User Story 1 — Find and open a market (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Click the symbol search widget in the topbar or press `Ctrl+K` (or click `.vela-widget-symbol`).
3. Verify that `#modal-symbol-search` opens immediately and `#symbol-search-input` is focused.
4. Type `"ETH"` in the search input.
5. Verify that `#symbol-results-list` filters results down to matching instruments (e.g. `ETHUSDT`) and `#sym-count-badge` displays the instrument count.
6. Press `ArrowDown` to highlight the first result row, then press `Enter`.
7. **Verification**: Confirm that `#modal-symbol-search` closes, the topbar shows `ETHUSDT`, and candlestick bars for Ethereum load onto the active chart canvas within 5 seconds.

---

### User Story 2 — Change timeframe and chart style (Priority: P1)

1. Click the timeframe button in the topbar or press `,`.
2. Confirm `#modal-timeframes` opens showing standard intervals (`1s`, `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, etc.).
3. Click `"1h"`. Confirm the dialog closes and the chart reloads with 1-hour candles.
4. Re-open `,`, scroll to "+ Add Custom Interval", enter `"10"` with unit `"Minutes"`, and click "+ Add".
   - *If on Basic plan*: Confirm creation is refused and `#tc-plans-modal` opens (`customIntervals` gate).
   - *If on Essential+ plan*: Confirm the `"10m"` custom button appears, is stored in `tradingchart_custom_timeframes`, and the chart switches to 10m.
5. Click the chart style dropdown `#btn-topbar-chart-style`.
6. Select `"Bars"`. Confirm the chart switches from candles to OHLC bars and the topbar icon/label updates.
7. Click the style dropdown again and select a synthetic type, e.g. `"Renko"`.
   - *If on Basic or Essential plan*: Confirm style does not change and `#tc-plans-modal` opens (`synthChartTypes` gate).
   - *If on Plus+ plan*: Confirm the chart computes Renko bricks client-side and plots them.

---

### User Story 3 — Control the price scale (Priority: P2)

1. Locate the scale controls dock (`#scale-controls-bar`) docked in the chart's bottom bar.
2. Click `"Log"`. Confirm the button gains the `.active` class and the price axis converts to logarithmic coordinates. Click again to return to linear.
3. Click `"Inv"` or press `Alt+I`. Confirm the price scale vertically inverts (bearish candles display upward).
4. Press `Alt+R`. Confirm the price scale resets to auto-fit view and `#btn-scale-auto` is active.
5. Check the bar-close countdown on the price axis; confirm it decrements each second towards the close of the current bar.

---

### User Story 4 — Watchlists (Priority: P2)

1. Click the watchlist icon `[data-panel="watchlist"]` on the right side dock rail.
2. Confirm the side dock opens with offset 340 px on desktop.
3. In the "Add Symbol" input, enter `"SOLUSDT"` and press `Enter`.
4. Confirm `SOLUSDT` appears in the list showing its live last price and 24h percentage change from `GET /api/tickers`.
5. Click the circular flag button on the `SOLUSDT` row.
   - Confirm it turns Red.
   - Click again to cycle to Green. If on Basic plan, confirm cycling beyond Red is blocked and prompts `#tc-plans-modal` (`flagColors=1`).
6. Press the `Space` key. Confirm the active chart advances to the next symbol in the watchlist. Press `Shift+Space` to step backward.
7. Refresh the browser page (`F5`). Confirm the watchlist, custom symbols, and flag colors persist from `localStorage`.

---

### User Story 5 — Workspace tools and shortcuts (Priority: P2)

1. Press `Ctrl+K`. Confirm `#command-palette` opens. Type `"Export"`, press `Enter`, and confirm the Data Export modal opens. Press `Escape` to close.
2. Press `?` (or click `#btn-shortcuts-help`). Confirm `#modal-shortcuts` opens displaying 3 categorized columns of shortcuts.
3. Press `Alt+G`. Confirm `#goto-date-modal` opens. Click `"1w ago"` then `"Go"`. Confirm the chart viewport pans back 1 week.
4. Right-click inside the main price chart canvas. Confirm `#canvas-context-menu` opens showing price-aware actions:
   - "Add Alert at [Price]" (Alt+A)
   - "Buy Limit / Buy Stop at [Price]"
   - "Sell Limit / Sell Stop at [Price]"
5. Press `Alt+E`. Confirm `#modal-data-export` opens.
   - *If on Basic plan*: Confirm export is blocked and `#tc-plans-modal` opens (`dataExport` gate).
   - *If on Essential+ plan*: Click "Download Dataset" (CSV). Verify a file named `Chartivia_<symbol>_<tf>m_<date>.csv` downloads with valid OHLCV columns.
6. Press `Alt+S`. Confirm `#modal-screenshot-preview` captures a multi-canvas composite snapshot. Verify buttons: Download (PNG), Print, Embed, Copy Link, Copy Post Text.
7. Press `Alt+C`. Confirm `#modal-compare` opens. Check a benchmark (e.g. `ETHUSDT`) and confirm an overlay plot mounts onto the chart.

---

### User Story 6 — Language, sound, and platform announcements (Priority: P3)

1. Click the `#btn-toggle-lang` button in the topbar ("FA / EN").
   - Confirm the page flips to RTL layout (`dir="rtl"`).
   - Confirm typography shifts to Vazirmatn.
   - Confirm topbar labels, dock headers, modal titles, and platform banners re-render in formal Persian without a page reload.
   - Click again to return to English LTR.
2. Click the `#btn-toggle-sound` button.
   - Confirm button opacity dims to 0.35 and audio is muted (`tradingchart_sound_muted` = true).
   - Click again: confirm opacity returns to 1.0 and an audible synthetic chime plays.
3. In `server/data/accounts/platform_settings.json`, set `"announcementEnabled": true`, `"announcementFa": "تست اعلامیه"`, `"announcementEn": "Platform test announcement"`, and reload or trigger `GET /api/platform`.
   - Confirm `#tc-platform-banner` mounts at the top of `#app-container`.
   - Click the `.tc-pb-close` button. Confirm the banner removes itself and remains hidden across subsequent reloads.

---

## 3. Automated Test Execution

Run the existing headless browser suites to verify regression and parity compliance:

```bash
# 1. Symbol Search Modal & Query Filtering Test
node tests/qa_symsearch.cjs

# 2. Command Palette (Ctrl+K) Fuzzy Launcher Test
node tests/qa_cycle_palette.cjs

# 3. Scale Controls Dock (Auto/Log/Inv) & Replay Suite
node tests/test_replay_and_scales.cjs

# 4. Modals, Timeframe Builder & Export Regression (Cycle A)
node tests/qa_cycleA.cjs

# 5. Screenshot Studio, Chart Styles & Side Panels (Cycle B)
node tests/qa_cycleB.cjs

# 6. TradingView Feature Parity Verification Suite
npm run test:parity

# 7. Ultimate End-to-End Regression Audit Suite
npm run test:ultimate
```
