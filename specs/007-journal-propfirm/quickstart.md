# Quickstart & Verification: Trade Journal and Prop-Firm Tools

Step-by-step guide to running the local Chartivia application, executing automated test suites, and manually verifying each user story on the live trading platform.

---

## 1. Prerequisites and Server Startup

Ensure the local Node.js environment is configured and the Chartivia server is running on port 8088:

```bash
# Check service status or start the dev server
cd /root/TradingChart
export SDD_BASE_URL="http://127.0.0.1:8088"
export PORT=8088

# Check if the service is active
curl -s -o /dev/null -w "%{http_code}\n" "$SDD_BASE_URL/chart"
# Expected output: 200
```

If the service is not currently running, start it:

```bash
bash scripts/build_and_restart.sh
```

---

## 2. Automated Test Suites

Run the existing regression and integration test suites that cover the 007 feature area:

### 2.1 Full LuxAlgo Trade Journal Deep Audit
Exercises all 8 suites, 14-format importer, Edge Score v2 polygon radar, monthly calendar heatmap, privacy mode toggle, trade scatter plot, and log trade modal:
```bash
node tests/test_luxalgo_trade_journal_deep.cjs
```
*Expected result*: All 8 suites loaded, TradingView statement pasted and committed, privacy mode verified, Edge Radar rendered, and output confirms `ZERO DEFECTS ✅`.

### 2.2 Trade Journal Modal & Execution Verification
Tests log modal opening, direction toggle, numeric inputs, trade submission, and verifies that the new trade appears in `app.tradeJournal.sampleExecutions`:
```bash
node tests/test_journal_and_timeframe.cjs
```
*Expected result*: Modal opens, SELL direction activates, trade submitted, and screenshot artifacts saved to `dogfood_cycle7/`.

### 2.3 Navigation Pill Visibility Probe
Verifies that clicking the Journal workspace pill properly hides the chart canvas and displays the full-page journal container:
```bash
node tests/qa_probe_journal_nav.cjs
```
*Expected result*: `#journal-workspace-view` gains `display: flex`, `#chart-area` is hidden (`display: none`), and `activePill: "journal"`.

---

## 3. Manual Verification Steps by User Story

Open the application in a modern browser at `http://127.0.0.1:8088/chart`.

### User Story 1 — Journal Workspace, Dashboard & Privacy Mode (Priority: P1)

1. **Switch to Full-Page Journal**:
   - In the top header bar, click the **Journal** (`ژورنال`) workspace pill `#nav-btn-journal`.
   - *Verification*: The candlestick chart area `#chart-area` hides, `#journal-workspace-view` opens showing the top filter ribbon and 8 suite tabs, and the **Dashboard** suite displays KPI cards, monthly calendar heatmap, and cumulative equity curve.
   - Click the **Quant** (`کوانت`) pill `#nav-btn-quant`.
   - *Verification*: The chart area returns immediately and the chart resizes smoothly. Click **Journal** again.
2. **Filter by Account**:
   - In the top filter ribbon, select **Paper Trading** from `#journal-account-filter`.
   - *Verification*: The KPIs, equity curve, and calendar refresh to display only trades associated with the paper trading account. Select **All Accounts** to restore all executions.
3. **Filter by Time Window**:
   - Select **Last 7 Days** (`۷ روز اخیر`) from `#journal-time-filter`.
   - *Verification*: KPIs and calendar restrict their metrics to trades executed within the past 7 days. Select **All Time** (`تمام زمان‌ها`).
4. **Toggle Privacy Mode**:
   - Click the **Public** (`نمایش`) button `#btn-journal-privacy`.
   - *Verification*: The button turns amber and changes label to **Private** (`پنهان`). Every monetary balance across KPI cards, calendar tiles, equity curve Y-axis, and ledger rows is masked as `$***.**` or `***`.
   - Click the button again. All monetary figures are unmasked.
5. **Calendar Day Interaction**:
   - Click any green or red day tile on the P&L Calendar Heatmap.
   - *Verification*: The view switches immediately to the **Trades Ledger** tab.

---

### User Story 2 — Log and Import Trades (Priority: P1)

1. **Log a Manual Trade Execution**:
   - Click **+ Log Trade** (`+ ثبت معامله`) in the top ribbon or bottom panel.
   - *Verification*: The modal dialog `#modal-log-trade` opens prefilled with the active symbol (e.g. `BTCUSDT`), current price, BUY direction pill active (`#side-pill-buy`), quantity `0.5`, stop-loss 1% below entry, target 1.5% above entry, and live P&L preview (`+$600.00 (+1.50%)`) with `R: 1 : 2.50`.
   - Click **▼ SELL / SHORT** (`#side-pill-sell`).
   - *Verification*: The SELL pill turns red, the preview shifts to reflect short mechanics, and R-multiple recalculates.
   - Change quantity to `1.0` and exit price. Observe live P&L and R updates in `#log-pnl-preview` and `#log-r-preview`.
   - Click **✓ Save to Journal** (`✓ ثبت در ژورنال`).
   - *Verification*: A confirmation toast appears (e.g. `BUY 0.5 BTCUSDT (+$600.00)`), the modal closes, and the new trade appears immediately in the trades ledger and KPI metrics.
2. **Voice Dictation in Log Modal**:
   - Click **+ Log Trade** again, then click **Voice Dictate** (`ضبط صوتی`).
   - *Verification*: In supported browsers, button turns red and reads `Listening…` (`در حال شنیدن...`). Speak into the microphone; transcribed words appear inside `#log-trade-notes`. Click to stop.
3. **Import Broker Statement (Paste & Preview)**:
   - Click the **Statement Importer** tab (`درون‌ریزی ۱۴ بروکر و خروجی`).
   - Select the target account in `#import-account-target`.
   - Paste the following sample TradingView CSV text into `#import-text-paste`:
     ```csv
     Symbol,Side,Price,Qty,Time
     BTCUSDT,BUY,77000.00,0.5,2026-09-28 10:00:00
     BTCUSDT,SELL,78500.00,0.5,2026-09-28 14:00:00
     ```
   - Click **Parse Pasted Text** (`پردازش متن پیست‌شده`).
   - *Verification*: `#import-preview-card` appears, `#detected-format-badge` indicates `TradingView Paper/Export`, count badge displays `2 Executions`, and the preview table lists both rows.
   - Click **Commit to Journal** (`تایید و افزودن به ژورنال`).
   - *Verification*: A green success toast displays `Successfully imported 2 executions into selected account`, and the executions enter the store.
4. **Duplicate Deduplication Verification**:
   - Without clearing the text, click **Parse Pasted Text** and **Commit to Journal** again.
   - *Verification*: Zero duplicate executions are added; the store detects matching 5-tuple signatures (`symbol|side|price|quantity|executedAt`).
5. **Export to CSV**:
   - In the top ribbon, click **CSV** (`#btn-journal-export-csv`).
   - *Verification*: Browser downloads `tradingchart_journal_export_YYYY-MM-DD.csv` containing headers `TradeKey,AccountId,Symbol,Direction,Status,OpenedAt,ClosedAt,Quantity,AvgEntry,AvgExit,GrossPnl,Fees,NetPnl,DurationMinutes,Playbook,Tags,Mistakes,Notes`.

---

### User Story 3 — Analytics & Edge Radar (Priority: P2)

1. **Inspect 6-Axis Edge Score Radar**:
   - Switch to the **Edge Radar & Deep Analytics** tab (`تحلیل پیشرفته و رادار مهارت`).
   - *Verification*: Renders the 6-axis SVG radar polygon (winRate 15%, profitFactor 25%, avgWinLoss 20%, drawdown 15%, recovery 10%, consistency 15%), radial spoke lines, percentage rings, and central 0–100 composite badge.
2. **Inspect 24-Hour Session Heatmap**:
   - Scroll down to the Session Heatmap.
   - *Verification*: Displays Tokyo (00-09 UTC), London (07-16 UTC), and New York (13-22 UTC) session bands above 24 hourly tiles colored green (positive net P&L) or red (negative net P&L) based on performance intensity.
3. **Inspect Trade Duration Scatter Explorer**:
   - Review the Duration vs P&L scatter plot.
   - *Verification*: Renders SVG bubbles where X = duration in minutes and Y = net P&L (green for wins, red for losses). Hovering over any bubble reveals trade symbol, direction, P&L, and duration.
4. **Empty State Validation**:
   - In console, clear executions: `window.__TRADING_APP__.tradeJournal.store.clearExecutions('all')`.
   - *Verification*: The radar renders the honest empty state message: `The edge radar needs a few closed trades. Log paper / replay trades or import a broker statement.`, and the scatter explorer shows `No closed trades to plot in scatter explorer.`. (Reload the page to re-seed sample data).

---

### User Story 4 — Ledger, Daily Journal, Playbooks & AI Coach (Priority: P2)

1. **Replay Ledger Trade on Chart**:
   - Switch to the **Trades Ledger & Replay** tab (`دفتر معاملات و ری‌پلی`).
   - Find any closed trade card and click **View on Chart** (`نمایش روی چارت`).
   - *Verification*: Workspace switches to Quant chart mode (`#chart-area` displayed) and updates the active symbol to that trade's symbol.
2. **Daily Journal & Mood Reflection**:
   - Return to the journal and switch to **Daily Journal & Voice** (`ژورنال روزانه و یادداشت صوتی`).
   - Click date steppers (`‹`, `›`, `Today`) to inspect trades executed on that date.
   - Select an emotion pill (e.g. `🧘 Calm & In Control` or `🎯 Laser Focused`).
   - Type reflective notes in the textarea. Observe the save indicator displaying `Unsaved changes…`.
   - Click **Save Note** (`ذخیره یادداشت`).
   - *Verification*: Indicator updates to `Saved ✓` with timestamp, and emotion/notes persist.
3. **Playbooks & Strategy Rules Checklist**:
   - Switch to **Playbooks & Checklists** (`ستاپ‌ها و چک‌لیست انضباط`).
   - *Verification*: Lists 4 default setups (SMC Order Block, FVG Retest, Breakout & Retest, EMA Trend Pullback) with adherence rates and rule checklists.
   - Click **+ New Playbook Setup** (`+ تعریف ستاپ جدید`). Enter setup name and comma-separated rules.
   - *Verification*: New playbook card is added to the list.
4. **AI Coach Reflection**:
   - Switch to **AI Coach & Ask Journal** (`مربی هوش مصنوعی`).
   - Click the prompt chip `"What is my most expensive mistake and leak?"`.
   - *Verification*: A query card and response card are prepended to the thread, analyzing mistake attribution based on user executions.

---

### User Story 5 — Prop-Firm Tracker & Simulator (Priority: P2)

1. **Track Prop Challenges**:
   - Switch to **Prop Firm Tracker** (`پراپ فرم و مدیریت سرمایه`).
   - *Verification*: Displays total evaluation fees, payouts received, cash ROI, and active challenge cards with current balance, target progress bar, and drawdown buffer alert.
   - Click **+ Add Prop Challenge** (`+ افزودن حساب پراپ جدید`), enter firm name (e.g. `FundedNext`) and size (`100000`).
   - *Verification*: A new challenge card appears with a $10,000 profit target, $10,000 max loss, and live drawdown buffer.
2. **Run Monte Carlo Simulation**:
   - Click **Prop-Firm Simulator** (`شبیه‌ساز پیشرفته پراپ`) or open the bottom panel tab `Prop-Firm Simulator`.
   - *Verification*: Displays parameter controls (Win Rate, R:R, Risk %, Trades/Day) and challenge preset dropdown.
   - Change preset from `FTMO $100k (2-Phase)` to `Topstep $50k Futures`.
   - *Verification*: Simulator executes 500 Monte Carlo paths in under 200 ms, updating Pass Probability, Risk of Ruin, Expected Value (EV), and Median Days to Funded, with 35 SVG trajectory curves rendered.
3. **Export Backtest from Strategy Tester**:
   - In the bottom panel, switch to the **Strategy Tester** tab.
   - Run a Pine Script backtest, then click **Export to Prop-Sim →** (`انتقال به شبیه‌ساز پراپ ←`).
   - *Verification*: Bottom panel switches automatically to `propsim`, pre-fills win rate, average win R, and trades per day from the strategy's backtest results, and immediately re-runs the 500-path simulation.
