# Quickstart: Indicators Library, Pine Editor and Strategy Tester

Manual step-by-step verification procedures for each user story on a running Chartivia instance, along with automated test commands.

---

## 1. Environment & Setup

Ensure Node.js v20+ is installed and dependencies are bundled.

```bash
# Set base test URL (default port 8088)
export SDD_BASE_URL="${SDD_BASE_URL:-http://127.0.0.1:8088}"

# Start the application server
npm run start
# Or launch dev mode with live reload:
npm run dev
```

Navigate to `${SDD_BASE_URL}/chart` in a modern evergreen browser (Chromium, Firefox, Safari, Edge).

---

## 2. Manual Verification by User Story

### User Story 1 — Browse and add a library indicator (Priority: P1)

1. Open `${SDD_BASE_URL}/chart`.
2. Open the indicators dialog via any of the supported triggers:
   - Click `.vela-widget-indicators` or `[aria-label="Indicators"]` on the top bar.
   - Press the `/` forward-slash shortcut key.
   - On mobile viewports (<=768px), tap `.vela-mb-indicators` on the bottom navigation bar.
3. **Verification**:
   - The modal `#modal-indicators` opens with `.open` class.
   - Title displays `دایره‌المعارف اندیکاتورها و استراتژی‌ها (۱۱۴+ ابزار)` in Persian or `Indicators, Metrics & Strategies (114+)` in English.
   - Search input `#ind-search-input` is focused and empty.
   - Count label `#ind-count-label` reads `Showing 114 of 114 indicators` (or `نمایش ۱۱۴ از ۱۱۴ اندیکاتور`).
   - `#ind-items-container` contains 114 rows.
4. Filter by category:
   - Select `Smart Money Concepts (SMC)` in `#ind-cat-select`: Verify list updates to 18 SMC indicators.
   - Select `Trend`: Verify list updates to 28 indicators.
   - Select `Oscillators`: Verify list updates to 29 indicators.
   - Select `Volatility`: Verify list updates to 19 indicators.
   - Select `Volume`: Verify list updates to 20 indicators.
   - Reset category to `All`.
5. Search indicators:
   - Type `"RSI"` into `#ind-search-input`: Verify matches include Relative Strength Index and RSI Momentum.
   - Click `#ind-clear-search`: Verify search query clears and all 114 items restore.
   - Type `"nonexistent_query_xyz"`: Verify empty state message appears: `هیچ اندیکاتوری مطابق با جستجوی شما یافت نشد.` / `No matching indicators found. Try another query or category.`.
6. Add library indicator:
   - Search `"Order Blocks"` and click the row or `+ Add` button (`.add-ind-btn[data-id="smc_order_blocks"]`).
   - **Verification**:
     - The indicator is attached to the chart canvas.
     - A green toast appears: `اندیکاتور «اوردر بلاک‌ها و نقدینگی (Order Blocks)» روی چارت اعمال شد` / `Added Order Blocks & Liquidity to active chart`.
     - Button displays `✓ افزوده شد` / `✓ Added` with green background for 1.5 seconds.
     - Clicking rapidly within 1.5 s is blocked by `data-busy="1"`.
7. Plan quota enforcement:
   - With a Basic account (quota = 2 indicators), add 2 indicators.
   - Attempt to add a 3rd indicator.
   - **Verification**: The 3rd indicator is not added; button flashes red `✕ Not added` / `✕ افزوده نشد`; an upgrade toast appears indicating the quota has been reached.

---

### User Story 2 — Write, validate and plot a Pine script (Priority: P1)

1. Open the Pine Editor:
   - On desktop, click the `Pine Editor` tab in the bottom dock suite (`#view-pine`).
   - Alternatively, open the Pine panel from the Vela side dock.
2. Template selection:
   - Select `Supertrend Multi-ATR` in `#pine-template-select`.
   - **Verification**: Textarea `#pine-code-editor` loads the Supertrend source; line gutter `#pine-line-gutter` updates line numbers.
3. New script:
   - Click `#btn-pine-new` (`کد جدید` / `New`).
   - **Verification**: Code replaces with a minimal `//@version=5` SMA skeleton indicator.
4. Save script:
   - Modify the indicator title to `"My Custom SMA"`.
   - Click `#btn-pine-save` (`ذخیره` / `Save`).
   - **Verification**: Diagnostics `#pine-diag-content` shows `✓ Script saved to local storage`. Refresh page and verify code is restored.
5. Compile and add to chart:
   - Click `#btn-pine-compile` (`افزودن به چارت` / `Add to Chart`).
   - **Verification**: Diagnostics displays `✓ اسکریپت معتبر است` / `✓ Script validated`, declaration type `indicator`, and inputs count; plot line renders on canvas.
6. Compiler error handling:
   - Introduce a syntax error (e.g. type `plot(broken_syntax` without closing parenthesis).
   - Click `#btn-pine-compile`.
   - **Verification**: Canvas remains intact; diagnostics pane renders `✗ خطای کامپایل:` / `✗ Compilation error:` in red with escaped error text.

---

### User Story 3 — Backtest a strategy with the real engine (Priority: P1)

1. Switch to a strategy script:
   - In Pine Studio, select `Cover-Shannon Volatility Rebalance` from `#pine-template-select` (contains `strategy("Shannon Rebalance Strategy", ...)`).
2. Validate non-strategy warning:
   - Select an indicator template (e.g. `EMA Triple Ribbon`) and click `#btn-pine-backtest` (`بک‌تست استراتژی` / `Backtest Strategy`).
   - **Verification**: Diagnostics warns `⚠ این اسکریپت اندیکاتور است، نه استراتژی` / `⚠ This script is an indicator, not a strategy`; no backtest runs.
3. Run simulation:
   - Select `Cover-Shannon Volatility Rebalance` and click `#btn-pine-backtest`.
   - **Verification**:
     - View automatically switches to Strategy Tester (`#view-strategy`).
     - Message displays `در حال اجرای استراتژی روی N کندل…` / `Running strategy on N bars…`.
     - After simulation completes, KPI cards render:
       - `#strat-net-profit`: Net Profit in USD and %.
       - `#strat-profit-factor`: Profit Factor (e.g. `1.85` or `∞` or `—`).
       - `#strat-win-rate`: Win Rate percentage.
       - `#strat-max-drawdown`: Max Drawdown in USD and %.
       - `#strat-sharpe`: Per-trade Sharpe ratio.
     - SVG equity curve renders cumulative account growth with dashed baseline.
     - Table `#strat-trades-tbody` lists the last 8 closed trades with ID, Side, Entry/Exit times, prices, and P&L.
4. Export to Prop-Sim:
   - Click `#btn-export-propsim` (`انتقال به شبیه‌ساز پراپ ←` / `Export to Prop-Sim →`).
   - **Verification**: Switches active view to Prop-Firm Simulator with win rate, avg win/loss ratio, and trades/day pre-filled.
5. Export trades to CSV:
   - Click `#btn-export-csv` (`دریافت دفتر کل CSV` / `Download CSV Ledger`).
   - **Verification**: If plan includes `csvTradesExport` (Plus tier+), file `tradingchart_strategy_trades.csv` downloads containing 100% of closed trades. If on Basic plan, an upgrade toast is shown.
6. Silent re-run on new bars:
   - In chart topbar, change timeframe from `1h` to `15m` or switch symbol to `ETHUSDT`.
   - **Verification**: Strategy Tester automatically re-runs the Shannon strategy silently on the new bars without showing empty state or errors.

---

### User Story 4 — Tune or remove an applied indicator (Priority: P2)

1. Add `Relative Strength Index` to the chart from the library.
2. Click the gear settings icon `.vela-sl-settings` in the chart legend.
3. **Verification**:
   - Modal `#modal-indicator-settings` opens with `.open` class.
   - Dropdown `#ind-select-handle` has RSI selected.
4. Tune parameters:
   - In `Inputs` tab, modify `Length` from `14` to `21`.
   - Switch to `Style` tab, change line color to purple.
   - Click `#btn-ind-apply` (`اعمال و ذخیره ✓` / `Apply & Save ✓`).
   - **Verification**: Modal closes; toast displays `تنظیمات اندیکاتور با موفقیت اعمال شد` / `Indicator settings updated`; chart recomputes RSI with length 21.
5. Remove indicator:
   - Re-open settings modal for RSI.
   - Click `#btn-ind-remove` (`حذف از چارت ✕` / `Remove from Chart ✕`).
   - **Verification**: Modal closes; toast displays `اندیکاتور از چارت حذف شد` / `Indicator removed`; RSI disappears from chart canvas and legend.

---

### User Story 5 — Glance at a symbol's technical rating (Priority: P3)

1. Open the Watchlist side panel.
2. Locate the Technical Rating Card (`#wl-technical-rating-container`) at the bottom of the watchlist.
3. **Verification**:
   - `#trc-sym` displays selected symbol (e.g. `BTCUSDT`).
   - `#trc-price` displays real-time price matching ticker feed.
   - `#trc-chg` displays 24h percentage change in green or red.
   - Speedometer gauge `#trc-needle-group` rotates needle to consensus angle.
   - Rating badge `#trc-rating-badge` renders consensus rating (`Strong Buy`, `Buy`, `Neutral`, `Sell`, `Strong Sell`).
   - Sliders reflect Day's Range and 52-Week Range positions.
4. Select a different symbol in the watchlist (e.g. `ETHUSDT`):
   - **Verification**: Card immediately refetches and updates price, change, day range, and rating for the new symbol.

---

## 3. Automated Test Suites

Execute the following commands from the repository root:

### Indicator Compiler Validation (Offline Node)
Audits PineTS compiler syntax across all 114 library scripts:
```bash
node tests/validate-all-indicators.js
```
*Expected Result*: `Auditing 114 indicators with PineTS compiler... Passed: 114/114 Failed: 0/114. ALL INDICATORS VALIDATED WITH 100% SUCCESS!`

### Unified Indicators Modal & Library Test (Puppeteer)
Tests bottom bar trigger, 114 card count, category filters, SMC/native adding, plan limits, and Persian RTL:
```bash
node tests/qa_indicators_unified.cjs
```

### Canvas Plotting Probe (Puppeteer)
Verifies custom Pine SMA indicator mounts and renders on WebGL2 canvas:
```bash
node tests/test-pine-plot.js
```

### Input Parameters Override Probe (Puppeteer)
Tests live property mutations on active chart indicators:
```bash
node tests/test_pine_inputs.cjs
```

### Pine Studio Add-to-Chart Probe (Puppeteer)
Verifies compile button clicks, validation feedback, and chart mounting:
```bash
node tests/test-add-pine.js
```

### Indicator Workspace Ledger Probe (Puppeteer)
Inspects active indicator serialization and layout ledger:
```bash
node tests/probe_indicator_ledger.cjs
```
